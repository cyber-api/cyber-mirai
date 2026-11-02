"use strict";

/**
 * Mirai-native, NON-MANDATORY update engine.
 *
 * Design notes
 * - Adapted from ST-BOT's manifest-driven updater (versions.json -> file list),
 *   but rewritten as small, testable functions that never terminate the host
 *   process and never block startup work.
 * - Every public function resolves with a result object. Nothing here throws to
 *   the caller: network/proxy/JSON failures become `{ ok: false, error }`.
 * - The bot keeps running if the manifest is unreachable, malformed, or if the
 *   user never updates.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = "mahbub-shaon/cyber-mirai";
const BRANCH = "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const VERSIONS_URL = `${RAW_BASE}versions.json`;
const COMMITS_API = `https://api.github.com/repos/${REPO}/commits/${BRANCH}`;

const DEFAULT_TIMEOUT = 15000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const REFUSE_MS = 2 * 60 * 60 * 1000;
const COMMIT_COOLDOWN_MS = 5 * 60 * 1000;
const BACKUP_ROOT = "backups";

// Files that are never written from the raw URL: secrets/local runtime state.
const PROTECTED_NAMES = [
    /^appstate\d*\.json$/i,
    /^config\.json$/i,
    /\.sqlite(-journal|-wal|-shm)?$/i,
    /^\.env(\.|$)/i
];
const PROTECTED_SEGMENTS = [".git", "node_modules", BACKUP_ROOT];
const SKIP_MARKERS = ["DO NOT UPDATE", "SKIP UPDATE", "DO NOT UPDATE THIS FILE"];

// In-memory state (same lifetime as the process, like ST-BOT's globals).
const state = {
    refusedUntil: 0,
    notifiedAt: 0,
    lastCheckAt: 0,
    lastResult: null
};

function now() {
    return Date.now();
}

function errorText(error) {
    if (!error) return "unknown error";
    return error.message ? String(error.message) : String(error);
}

function resetUpdateState() {
    state.refusedUntil = 0;
    state.notifiedAt = 0;
    state.lastCheckAt = 0;
    state.lastResult = null;
}

function getUpdateState() {
    return {
        refusedUntil: state.refusedUntil,
        refused: state.refusedUntil > now(),
        notifiedAt: state.notifiedAt,
        lastCheckAt: state.lastCheckAt,
        lastResult: state.lastResult
    };
}

/** Return 1 if a > b, -1 if a < b, 0 if equal. Never throws. */
function compareVersions(a, b) {
    const toParts = (value) => String(value == null ? "" : value)
        .trim()
        .replace(/^v/i, "")
        .split(".")
        .map((part) => {
            const number = parseInt(part, 10);
            return Number.isFinite(number) ? number : 0;
        });

    const left = toParts(a);
    const right = toParts(b);
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i++) {
        const l = left[i] || 0;
        const r = right[i] || 0;
        if (l > r) return 1;
        if (l < r) return -1;
    }
    return 0;
}

/** Read the installed version from package.json (version.txt as fallback). */
function readCurrentVersion(repoDir) {
    const base = repoDir || process.cwd();
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(base, "package.json"), "utf8"));
        if (pkg && typeof pkg.version === "string" && pkg.version.trim()) return pkg.version.trim();
    } catch (error) { /* fall through to version.txt */ }

    try {
        const plain = fs.readFileSync(path.join(base, "version.txt"), "utf8").trim();
        if (plain) return plain.split(/\r?\n/)[0].trim();
    } catch (error) { /* no version.txt */ }

    return "0.0.0";
}

function isSafeRelativePath(filePath) {
    if (typeof filePath !== "string" || !filePath.trim()) return false;
    if (filePath.includes("\0")) return false;
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return false;

    const segments = normalized.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) return false;
    if (segments.some((segment) => segment === ".." || segment === ".")) return false;
    if (PROTECTED_SEGMENTS.includes(segments[0].toLowerCase())) return false;

    const fileName = segments[segments.length - 1];
    if (PROTECTED_NAMES.some((pattern) => pattern.test(fileName))) return false;
    return true;
}

function resolveInside(repoDir, filePath) {
    const root = path.resolve(repoDir);
    const full = path.resolve(root, filePath);
    if (full !== root && !full.startsWith(root + path.sep)) return null;
    return full;
}

function deepGet(target, keyPath) {
    return String(keyPath)
        .split(".")
        .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), target);
}

function deepSet(target, keyPath, value) {
    const parts = String(keyPath).split(".");
    let cursor = target;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!cursor[key] || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) cursor[key] = {};
        cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
}

function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asUrlList(value) {
    if (!value) return [];
    return (Array.isArray(value) ? value : [value]).filter((url) => typeof url === "string" && url.trim());
}

function normalizeManifest(raw) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.versions) ? raw.versions : null);
    if (!list) throw new Error("Invalid versions.json: expected an array of releases");

    const entries = [];
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const version = typeof item.version === "string" ? item.version.trim() : "";
        if (!version) continue;
        entries.push({
            version,
            files: asObject(item.files),
            deleteFiles: asObject(item.deleteFiles),
            config: asObject(item["config.json"]),
            note: typeof item.note === "string" ? item.note : "",
            imageUrl: asUrlList(item.imageUrl),
            videoUrl: asUrlList(item.videoUrl),
            audioUrl: asUrlList(item.audioUrl),
            reinstallDependencies: item.reinstallDependencies === true
        });
    }
    if (entries.length === 0) throw new Error("Invalid versions.json: no usable release entries");
    return entries;
}

/**
 * Build an install plan from a manifest and the installed version.
 * Only releases AFTER the installed one are considered.
 */
function buildPlan(manifest, currentVersion) {
    const entries = normalizeManifest(manifest);
    const current = String(currentVersion || "0.0.0");

    let index = entries.findIndex((entry) => entry.version === current);
    if (index === -1) {
        // Unknown local version: take every release newer than it, so a patched
        // install can still catch up instead of being stuck forever.
        index = entries.reduce((last, entry, i) => (compareVersions(entry.version, current) <= 0 ? i : last), -1);
    }

    const pending = entries.slice(index + 1);
    const files = {};
    const deleteFiles = {};
    const configMerge = {};
    const notes = [];
    const media = { images: [], videos: [], audio: [] };
    let reinstallDependencies = false;
    let latestVersion = current;

    for (const entry of pending) {
        for (const [filePath, description] of Object.entries(entry.deleteFiles)) {
            if (!filePath) continue;
            deleteFiles[filePath] = description;
        }
        for (const [filePath, description] of Object.entries(entry.files)) {
            if (!filePath) continue;
            if (filePath === "config.json" || filePath === "configCommands.json") {
                if (description && typeof description === "object" && !Array.isArray(description)) {
                    Object.assign(configMerge, description);
                }
                continue;
            }
            files[filePath] = description;
            // A file that is (re)added in this or a later release must not also
            // be deleted; the newest instruction wins.
            delete deleteFiles[filePath];
        }
        Object.assign(configMerge, entry.config);
        if (entry.note) notes.push({ version: entry.version, note: entry.note });
        media.images.push(...entry.imageUrl);
        media.videos.push(...entry.videoUrl);
        media.audio.push(...entry.audioUrl);
        if (entry.reinstallDependencies) reinstallDependencies = true;
        latestVersion = entry.version;
    }

    const hasUpdate = pending.length > 0 && compareVersions(latestVersion, current) > 0;
    return {
        ok: true,
        hasUpdate,
        currentVersion: current,
        latestVersion: hasUpdate ? latestVersion : current,
        latestKnownVersion: entries[entries.length - 1].version,
        files,
        deleteFiles,
        configMerge,
        notes,
        media,
        reinstallDependencies,
        pendingVersions: pending.map((entry) => entry.version)
    };
}

function emptyResult(currentVersion, error, extra) {
    return Object.assign({
        ok: false,
        hasUpdate: false,
        currentVersion: currentVersion || "0.0.0",
        latestVersion: null,
        files: {},
        deleteFiles: {},
        configMerge: {},
        notes: [],
        media: { images: [], videos: [], audio: [] },
        reinstallDependencies: false,
        pendingVersions: [],
        error: error || "unknown error"
    }, extra || {});
}

async function fetchJsonWithAxios(url, timeout) {
    const axios = require("axios");
    const response = await axios.get(url, {
        timeout: timeout || DEFAULT_TIMEOUT,
        headers: { "User-Agent": "cyber-mirai-updater", "Cache-Control": "no-cache" },
        validateStatus: (status) => status >= 200 && status < 300
    });
    return response.data;
}

async function fetchBufferWithAxios(url, timeout) {
    const axios = require("axios");
    const response = await axios.get(url, {
        timeout: timeout || DEFAULT_TIMEOUT,
        responseType: "arraybuffer",
        maxContentLength: MAX_FILE_BYTES,
        headers: { "User-Agent": "cyber-mirai-updater" },
        validateStatus: (status) => status >= 200 && status < 300
    });
    return Buffer.from(response.data);
}

/**
 * Check the remote manifest. Never throws.
 * @returns {{ok:boolean,hasUpdate:boolean,currentVersion:string,latestVersion:string|null,files:object,deleteFiles:object,notes:array,error?:string}}
 */
async function checkForUpdate(options) {
    const opts = options || {};
    const repoDir = opts.repoDir || process.cwd();
    const currentVersion = opts.currentVersion || readCurrentVersion(repoDir);
    const fetchJson = typeof opts.fetchJson === "function" ? opts.fetchJson : fetchJsonWithAxios;
    const url = opts.url || VERSIONS_URL;

    state.lastCheckAt = now();
    let manifest;
    try {
        manifest = await fetchJson(url, opts.timeout || DEFAULT_TIMEOUT);
    } catch (error) {
        const result = emptyResult(currentVersion, `manifest fetch failed: ${errorText(error)}`, {
            networkError: true
        });
        state.lastResult = result;
        return result;
    }

    try {
        const result = buildPlan(manifest, currentVersion);
        state.lastResult = result;
        return result;
    } catch (error) {
        const result = emptyResult(currentVersion, errorText(error), { manifestError: true });
        state.lastResult = result;
        return result;
    }
}

/**
 * Soft 5-minute cooldown (ST-BOT concept): returns `{ tooSoon, remainingMs }`.
 * Failures are non-fatal: the caller may still proceed.
 */
async function checkCommitCooldown(options) {
    const opts = options || {};
    const fetchJson = typeof opts.fetchJson === "function" ? opts.fetchJson : fetchJsonWithAxios;
    try {
        const data = await fetchJson(opts.url || COMMITS_API, opts.timeout || DEFAULT_TIMEOUT);
        const date = new Date(data && data.commit && data.commit.committer && data.commit.committer.date);
        if (Number.isNaN(date.getTime())) return { ok: false, tooSoon: false, error: "missing commit date" };
        const age = now() - date.getTime();
        if (age < COMMIT_COOLDOWN_MS) {
            return { ok: true, tooSoon: true, ageMs: age, remainingMs: COMMIT_COOLDOWN_MS - age };
        }
        return { ok: true, tooSoon: false, ageMs: age, remainingMs: 0 };
    } catch (error) {
        return { ok: false, tooSoon: false, error: errorText(error) };
    }
}

/** Local git working-tree check. Missing git / non-repo = "clean" (cannot verify). */
function getLocalChanges(repoDir) {
    const cwd = repoDir || process.cwd();
    try {
        const output = execFileSync("git", ["status", "--porcelain"], {
            cwd,
            encoding: "utf8",
            timeout: 10000,
            stdio: ["ignore", "pipe", "ignore"]
        });
        const changes = String(output || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        return { isRepo: true, clean: changes.length === 0, changes };
    } catch (error) {
        return { isRepo: false, clean: true, changes: [], error: errorText(error) };
    }
}

function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${totalSeconds % 60}s`;
    return `${totalSeconds}s`;
}

function refuseUpdates(milliseconds) {
    const windowMs = Number(milliseconds) > 0 ? Number(milliseconds) : REFUSE_MS;
    state.refusedUntil = now() + windowMs;
    state.notifiedAt = 0; // allow a fresh notification once the window ends
    return state.refusedUntil;
}

function isUpdateRefused() {
    return state.refusedUntil > now();
}

function getRefusalRemaining() {
    return Math.max(0, state.refusedUntil - now());
}

function isNotified() {
    return state.notifiedAt > 0;
}

function markNotified() {
    state.notifiedAt = now();
}

function backupFile(repoDir, filePath, backupDir) {
    const source = resolveInside(repoDir, filePath);
    const destination = resolveInside(repoDir, path.join(backupDir, filePath));
    if (!source || !destination || !fs.existsSync(source)) return false;
    try {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        return true;
    } catch (error) {
        return false;
    }
}

function backupDirectory(repoDir, filePath, backupDir) {
    const source = resolveInside(repoDir, filePath);
    const destination = resolveInside(repoDir, path.join(backupDir, filePath));
    if (!source || !destination || !fs.existsSync(source)) return false;
    try {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        if (typeof fs.cpSync === "function") {
            fs.cpSync(source, destination, { recursive: true });
        } else {
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
}

function readSkipMarker(fullPath) {
    try {
        const firstLine = fs.readFileSync(fullPath, "utf8").trim().split(/\r?\n|\r/)[0] || "";
        return SKIP_MARKERS.find((marker) => firstLine.includes(marker)) || null;
    } catch (error) {
        return null;
    }
}

function mergeConfigFile(repoDir, configMerge, backupDir, report) {
    const fullPath = path.join(repoDir, "config.json");
    if (!fs.existsSync(fullPath)) {
        report.skipped.push({ path: "config.json", reason: "config.json not found (nothing to merge)" });
        return;
    }

    let current;
    try {
        current = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (error) {
        report.failed.push({ path: "config.json", error: `invalid local JSON: ${errorText(error)}` });
        return;
    }
    if (!current || typeof current !== "object" || Array.isArray(current)) {
        report.failed.push({ path: "config.json", error: "local config is not an object" });
        return;
    }

    for (const [key, value] of Object.entries(configMerge)) {
        if (typeof value === "string" && value.startsWith("DEFAULT_")) {
            const sourceKey = value.slice("DEFAULT_".length);
            const preserved = deepGet(current, sourceKey);
            if (preserved === undefined) {
                report.skipped.push({ path: `config.json:${key}`, reason: `DEFAULT_${sourceKey} not present` });
                continue;
            }
            deepSet(current, key, preserved);
        } else {
            deepSet(current, key, value);
        }
    }

    backupFile(repoDir, "config.json", backupDir);
    try {
        fs.writeFileSync(fullPath, `${JSON.stringify(current, null, 4)}\n`);
        report.updated.push("config.json");
    } catch (error) {
        report.failed.push({ path: "config.json", error: errorText(error) });
    }
}

/**
 * Apply a plan to disk. Never throws and never exits the process.
 * @returns {{ok:boolean,updated:string[],skipped:object[],deleted:string[],failed:object[],backupDir:string|null,newVersion:string,error?:string}}
 */
async function applyUpdate(plan, options) {
    const opts = options || {};
    const repoDir = opts.repoDir || process.cwd();
    const report = {
        ok: false,
        updated: [],
        skipped: [],
        deleted: [],
        failed: [],
        backupDir: null,
        newVersion: (plan && (plan.latestVersion || plan.currentVersion)) || "unknown"
    };

    if (!plan || typeof plan !== "object" || !plan.hasUpdate) {
        report.failed.push({ path: "*", error: "no update to apply" });
        return report;
    }

    if (!fs.existsSync(repoDir)) {
        report.failed.push({ path: "*", error: `project directory not found: ${repoDir}` });
        return report;
    }

    const fetchBuffer = typeof opts.fetchBuffer === "function" ? opts.fetchBuffer : fetchBufferWithAxios;
    const rawBase = opts.rawBase || RAW_BASE;
    const currentVersion = plan.currentVersion || readCurrentVersion(repoDir);
    const backupDir = path.join(BACKUP_ROOT, `backup_${currentVersion}`);
    report.backupDir = backupDir;

    try {
        fs.mkdirSync(path.resolve(repoDir, backupDir), { recursive: true });
    } catch (error) {
        report.failed.push({ path: backupDir, error: errorText(error) });
        return report;
    }

    const files = asObject(plan.files);
    for (const [filePath, description] of Object.entries(files)) {
        if (!isSafeRelativePath(filePath)) {
            report.skipped.push({ path: filePath, reason: "unsafe or protected path" });
            continue;
        }
        const fullPath = resolveInside(repoDir, filePath);
        if (!fullPath) {
            report.skipped.push({ path: filePath, reason: "path escapes project directory" });
            continue;
        }

        let buffer;
        try {
            const url = `${rawBase}${filePath.split("/").map(encodeURIComponent).join("/")}`;
            buffer = await fetchBuffer(url, opts.timeout || DEFAULT_TIMEOUT);
            if (!buffer || !buffer.length) throw new Error("empty response");
            if (path.basename(filePath) === "package.json") {
                try {
                    JSON.parse(buffer.toString("utf8"));
                } catch (parseError) {
                    throw new Error(`remote package.json is not valid JSON: ${errorText(parseError)}`);
                }
            }
        } catch (error) {
            report.failed.push({ path: filePath, error: `download failed: ${errorText(error)}` });
            continue;
        }

        const exists = fs.existsSync(fullPath);
        if (exists) {
            backupFile(repoDir, filePath, backupDir);
            const marker = readSkipMarker(fullPath);
            if (marker) {
                report.skipped.push({ path: filePath, reason: `skip marker: ${marker}` });
                continue;
            }
        }

        try {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, buffer);
            report.updated.push(filePath);
            void description;
        } catch (error) {
            report.failed.push({ path: filePath, error: errorText(error) });
        }
    }

    if (plan.configMerge && Object.keys(plan.configMerge).length > 0) {
        mergeConfigFile(repoDir, plan.configMerge, backupDir, report);
    }

    for (const [filePath, description] of Object.entries(asObject(plan.deleteFiles))) {
        if (!isSafeRelativePath(filePath)) {
            report.skipped.push({ path: filePath, reason: "unsafe or protected path" });
            continue;
        }
        const fullPath = resolveInside(repoDir, filePath);
        if (!fullPath || !fs.existsSync(fullPath)) continue;
        try {
            const stats = fs.lstatSync(fullPath);
            if (stats.isDirectory()) {
                backupDirectory(repoDir, filePath, backupDir);
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                backupFile(repoDir, filePath, backupDir);
                fs.unlinkSync(fullPath);
            }
            report.deleted.push(filePath);
            void description;
        } catch (error) {
            report.failed.push({ path: filePath, error: errorText(error) });
        }
    }

    // Keep the local version marker in step so the same release is not offered
    // again. Only do this when every download/merge succeeded: a partial update
    // must stay visible so the operator can retry it.
    try {
        const packagePath = path.join(repoDir, "package.json");
        if (report.failed.length === 0 && fs.existsSync(packagePath) && report.updated.length + report.deleted.length > 0) {
            const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
            const nextVersion = plan.latestVersion || pkg.version;
            if (nextVersion && pkg.version !== nextVersion) {
                backupFile(repoDir, "package.json", backupDir);
                pkg.version = nextVersion;
                fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
                report.updated.push("package.json");
            }
        }
    } catch (error) {
        report.failed.push({ path: "package.json", error: errorText(error) });
    }

    report.ok = report.failed.length === 0;
    state.refusedUntil = 0;
    state.notifiedAt = 0;
    return report;
}

function buildNotificationText(result, config) {
    const prefix = (config && (config.PREFIX || config.prefix)) || "!";
    const fileCount = Object.keys(result.files || {}).length;
    const deleteCount = Object.keys(result.deleteFiles || {}).length;
    const firstNote = (result.notes || [])[0];
    const noteLine = firstNote ? `\n📝 v${firstNote.version}: ${String(firstNote.note).slice(0, 240)}` : "";
    return [
        "🔔 নতুন আপডেট পাওয়া গেছে / Update available",
        "",
        `বর্তমান ভার্সন / Current : ${result.currentVersion}`,
        `সর্বশেষ ভার্সন / Latest  : ${result.latestVersion}`,
        "",
        "⚠️ আপডেট না করেও আপনি এখন বট চালাতে পারবেন — কোনো সমস্যা নেই।",
        "You can keep using the current version without any problem.",
        "",
        `📦 ফাইল / Files: ${fileCount}   🗑️ মুছবে / Removals: ${deleteCount}`,
        noteLine,
        "",
        "কীভাবে আপডেট করবেন / How to update:",
        `• কমান্ড / Command: ${prefix}update  (তারপর রিঅ্যাক্ট দিয়ে কনফার্ম করুন / then react to confirm)`,
        "• অথবা ম্যানুয়ালি / Or manually: git pull && npm install, তারপর বট রিস্টার্ট করুন / then restart the bot",
        "",
        `২ ঘণ্টার জন্য নোটিফিকেশন বন্ধ / Silence for 2 hours: ${prefix}update refuse`
    ].filter((line) => line !== "").join("\n");
}

function sendMessage(api, text, threadID) {
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            if (timer && typeof clearTimeout === "function") clearTimeout(timer);
            resolve(value);
        };
        // Some FCA builds neither resolve nor call back when the session is
        // unhealthy; bound the wait so a background notice cannot leak.
        timer = setTimeout(() => finish({ ok: false, error: "send timeout" }), 20000);
        if (timer && typeof timer.unref === "function") timer.unref();
        const callback = (error) => finish({ ok: !error, error: error ? errorText(error) : null });
        try {
            const maybePromise = api.sendMessage(text, threadID, callback);
            if (maybePromise && typeof maybePromise.then === "function") {
                maybePromise
                    .then(() => finish({ ok: true, error: null }))
                    .catch((error) => finish({ ok: false, error: errorText(error) }));
            }
        } catch (error) {
            finish({ ok: false, error: errorText(error) });
        }
    });
}

/**
 * Startup notification. Safe to call in the background: never throws, never
 * blocks login, and only fires once per process.
 */
async function notifyOnStartup(options) {
    const opts = options || {};
    const config = opts.config || (global.config || {});
    const settings = config.updateNotification || {};
    const log = typeof opts.log === "function" ? opts.log : (message) => console.log(message);
    const api = opts.api;

    if (settings.enable === false) return { ok: true, skipped: "disabled" };
    if (settings.checkOnStart === false) return { ok: true, skipped: "checkOnStart disabled" };
    if (isNotified()) return { ok: true, skipped: "already notified this startup" };
    if (isUpdateRefused()) {
        log(`[ UPDATE ] Notification suppressed for ${formatDuration(getRefusalRemaining())} (update refuse).`);
        return { ok: true, skipped: "refused" };
    }

    const result = await checkForUpdate({
        repoDir: opts.repoDir || process.cwd(),
        currentVersion: opts.currentVersion,
        fetchJson: opts.fetchJson,
        timeout: opts.timeout
    });

    if (!result.ok) {
        log(`[ UPDATE ] আপডেট চেক ব্যর্থ / check failed — বট স্বাভাবিক চলবে / bot continues normally: ${result.error}`);
        return result;
    }
    if (!result.hasUpdate) return result;

    // One notification per startup, even if some sends fail.
    markNotified();

    if (settings.notifyConsole !== false) {
        log("[ UPDATE ] নতুন আপডেট / New version: " + result.currentVersion + " -> " + result.latestVersion +
            " | আপডেট না করেও বট চলবে / optional, current version keeps working" +
            " | ফাইল / files: " + Object.keys(result.files).length +
            ", মুছবে / removals: " + Object.keys(result.deleteFiles).length);
    }

    const deliveries = [];
    if (api && typeof api.sendMessage === "function") {
        const text = buildNotificationText(result, config);
        const groupId = settings.groupId || config.mainThreadId;
        if (groupId) deliveries.push(await sendMessage(api, text, String(groupId)));

        if (settings.notifyAdmins !== false) {
            const recipients = new Set();
            for (const list of [config.ADMINBOT, config.NDH]) {
                if (!Array.isArray(list)) continue;
                for (const id of list) {
                    const uid = String(id || "").trim();
                    if (/^\d{5,20}$/.test(uid)) recipients.add(uid);
                }
            }
            for (const uid of recipients) deliveries.push(await sendMessage(api, text, uid));
        }
    }

    return { ok: true, result, deliveries };
}

module.exports = {
    REPO,
    BRANCH,
    RAW_BASE,
    VERSIONS_URL,
    COMMITS_API,
    REFUSE_MS,
    COMMIT_COOLDOWN_MS,
    SKIP_MARKERS,
    compareVersions,
    readCurrentVersion,
    isSafeRelativePath,
    normalizeManifest,
    buildPlan,
    checkForUpdate,
    checkCommitCooldown,
    getLocalChanges,
    applyUpdate,
    notifyOnStartup,
    buildNotificationText,
    refuseUpdates,
    isUpdateRefused,
    getRefusalRemaining,
    isNotified,
    markNotified,
    formatDuration,
    getUpdateState,
    resetUpdateState
};
