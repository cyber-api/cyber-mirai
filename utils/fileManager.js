"use strict";

/**
 * Shared file-manager core for the dashboard.
 *
 * The dashboard and the bot are two different processes. The dashboard used to
 * live only in Ullash.js, while Cyber.js served its own tiny static/health
 * server on Render's PORT. That split is why the file manager failed for every
 * file: the page was served by the health server, but /api/scripts and
 * /api/file only existed in the other process.
 *
 * This module is the single path resolver + request handler used by both
 * servers, so the allow/block rules cannot drift apart.
 *
 * Security model
 * - Paths are relative to the project root and can never escape it.
 * - Reads: Script/, assets/, languages/, includes/, utils/, public/ and a
 *   small set of root files.
 * - Writes: the same directories plus config.json/admin.json (with an explicit
 *   confirmation flag), package.json and README.md.
 * - Always blocked: .git/, node_modules/, .env*, *.sqlite, appstate*.json and
 *   account.txt (the phantom ST-BOT file that this bot never creates).
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const READ_DIRECTORIES = ["Script", "assets", "languages", "includes", "utils", "public"];
const WRITE_DIRECTORIES = ["Script", "assets", "languages", "includes", "utils", "public"];
const ROOT_FILES = [
    "config.json",
    "config.json.example",
    "admin.json",
    "admin.json.example",
    "package.json",
    "README.md"
];
const WRITE_ROOT_FILES = ["config.json", "admin.json", "package.json", "README.md"];
const CONFIRM_FILES = new Set(["config.json", "admin.json"]);

const MAX_READ_BYTES = 2 * 1024 * 1024;
const MAX_WRITE_BYTES = 1024 * 1024;

function sanitizeForLog(value, maxLength) {
    const text = String(value == null ? "" : value)
        .replace(/[\u0000-\u001f\u007f]/g, "?")
        .replace(/\\/g, "/");
    const limit = maxLength || 200;
    return text.length > limit ? text.slice(0, limit) + "…" : text;
}

/** Return a normalized relative path, or null when it is not safe. */
function normalizeRelative(input) {
    if (typeof input !== "string") return null;
    let value = input.trim();
    if (value === "") return "";
    if (value.includes("\u0000")) return null;

    // Decode once. A second encoded traversal (%252e%252e) leaves a literal
    // percent sign, which the loop below rejects.
    try {
        value = decodeURIComponent(value);
    } catch (error) {
        return null;
    }
    value = value.replace(/\\/g, "/");

    if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return null;

    const parts = [];
    for (const part of value.split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") return null;
        if (part.includes("%")) return null;
        parts.push(part);
    }
    return parts.join("/");
}

/** Return a machine-readable block code, or null when the path is allowed. */
function blockedReason(relative) {
    const lower = String(relative || "").toLowerCase();
    const segments = lower.split("/").filter(Boolean);
    for (const segment of segments) {
        if (segment === ".git" || segment === "node_modules") return "blocked_directory";
        if (segment === ".env" || segment.startsWith(".env.")) return "blocked_env";
    }
    if (/(^|\/)account\.txt$/.test(lower)) return "blocked_account_file";
    if (/\.sqlite3?$/.test(lower)) return "blocked_database";
    if (/(^|\/)appstate[^/]*\.json$/.test(lower)) return "blocked_appstate";
    return null;
}

function isAllowed(relative, write) {
    if (!relative) return false;
    if (ROOT_FILES.includes(relative)) {
        return write ? WRITE_ROOT_FILES.includes(relative) : true;
    }
    const first = relative.split("/")[0];
    return (write ? WRITE_DIRECTORIES : READ_DIRECTORIES).includes(first);
}

function failure(status, code, message) {
    return { ok: false, status, code, message };
}

function insideProject(absolute) {
    return absolute === PROJECT_ROOT || absolute.startsWith(PROJECT_ROOT + path.sep);
}

/**
 * Resolve a dashboard path. Returns { ok:true, absolute, relative, exists,
 * isDirectory, isFile } or { ok:false, status, code, message }.
 */
function resolveFile(input, options) {
    const opts = options || {};
    const relative = normalizeRelative(input);
    if (relative === null) {
        return failure(400, "invalid_path", "Path is not a safe relative path");
    }
    if (!relative) {
        return failure(400, "missing_path", "A file path is required");
    }
    if (!isAllowed(relative, opts.write === true)) {
        return failure(403, "not_allowed", "This path is not in the dashboard allow-list");
    }
    const blocked = blockedReason(relative);
    if (blocked) {
        return failure(403, blocked, "This path is blocked for security reasons");
    }
    if (opts.write === true && CONFIRM_FILES.has(relative) && opts.confirm !== true) {
        return failure(409, "confirmation_required", "Writing this file requires an explicit confirmation");
    }

    const absolute = path.resolve(PROJECT_ROOT, relative);
    if (!insideProject(absolute)) {
        return failure(403, "path_escape", "Path escapes the project root");
    }

    let exists = false;
    let isDirectory = false;
    let isFile = false;
    try {
        const stat = fs.statSync(absolute);
        exists = true;
        isDirectory = stat.isDirectory();
        isFile = stat.isFile();
    } catch (error) {
        exists = false;
    }

    // Resolve symlinks for the target (or its parent when creating a file) so
    // a symlink inside an allowed directory cannot point outside the project.
    try {
        const first = relative.split("/")[0];
        const rootForPath = ROOT_FILES.includes(relative)
            ? PROJECT_ROOT
            : path.join(PROJECT_ROOT, first);
        const realRoot = fs.realpathSync(rootForPath);
        const realTarget = exists
            ? fs.realpathSync(absolute)
            : path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute));
        if (!(realTarget === realRoot || realTarget.startsWith(realRoot + path.sep))) {
            return failure(403, "symlink_escape", "Path resolves outside its allowed directory");
        }
    } catch (error) {
        if (exists) return failure(403, "path_unavailable", "Path could not be resolved");
    }

    return { ok: true, relative, absolute, exists, isDirectory, isFile };
}

function listRoots() {
    const directories = READ_DIRECTORIES.map((name) => ({
        name,
        path: name,
        type: "directory",
        exists: fs.existsSync(path.join(PROJECT_ROOT, name))
    }));
    const files = ROOT_FILES.map((name) => ({
        name,
        path: name,
        type: "file",
        exists: fs.existsSync(path.join(PROJECT_ROOT, name))
    }));
    return {
        ok: true,
        directories,
        files,
        roots: directories.concat(files)
    };
}

function listDirectory(input) {
    const relative = normalizeRelative(input == null ? "" : input);
    if (relative === null) return failure(400, "invalid_path", "Path is not a safe relative path");
    if (!relative) return Object.assign({ path: "" }, listRoots());

    const resolved = resolveFile(relative, { write: false });
    if (!resolved.ok) return resolved;
    if (!resolved.exists) return failure(404, "not_found", "Directory not found");
    if (!resolved.isDirectory) return failure(400, "not_a_directory", "This path is not a directory");

    let dirents;
    try {
        dirents = fs.readdirSync(resolved.absolute, { withFileTypes: true });
    } catch (error) {
        return failure(500, "read_failed", "Could not list this directory");
    }

    const entries = [];
    for (const dirent of dirents) {
        const childRelative = relative + "/" + dirent.name;
        if (blockedReason(childRelative)) continue;
        const type = dirent.isDirectory() ? "directory" : (dirent.isFile() ? "file" : "other");
        let size = 0;
        if (type === "file") {
            try {
                size = fs.statSync(path.join(resolved.absolute, dirent.name)).size;
            } catch (error) {
                size = 0;
            }
        }
        entries.push({ name: dirent.name, path: childRelative, type, size });
    }
    entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return {
        ok: true,
        path: relative,
        files: entries.map((entry) => entry.name),
        entries
    };
}

function readTextFile(input) {
    const resolved = resolveFile(input, { write: false });
    if (!resolved.ok) return resolved;
    if (!resolved.exists) return failure(404, "not_found", "File not found");
    if (!resolved.isFile) return failure(400, "not_a_file", "This path is not a file");

    let stat;
    try {
        stat = fs.statSync(resolved.absolute);
    } catch (error) {
        return failure(500, "stat_failed", "Could not inspect this file");
    }
    if (stat.size > MAX_READ_BYTES) {
        return failure(413, "file_too_large", "File is too large to open in the dashboard");
    }

    let buffer;
    try {
        buffer = fs.readFileSync(resolved.absolute);
    } catch (error) {
        return failure(500, "read_failed", "Could not read this file");
    }
    if (buffer.includes(0)) {
        return failure(415, "binary_file", "Binary files cannot be edited as text");
    }

    return {
        ok: true,
        path: resolved.relative,
        content: buffer.toString("utf8"),
        encoding: "utf8",
        size: buffer.length
    };
}

function writeTextFile(input, content, options) {
    if (typeof content !== "string") {
        return failure(400, "invalid_content", "Content must be a string");
    }
    if (Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) {
        return failure(413, "content_too_large", "Content is too large");
    }
    const opts = options || {};
    const resolved = resolveFile(input, {
        write: true,
        confirm: opts.confirm === true
    });
    if (!resolved.ok) return resolved;
    if (resolved.exists && resolved.isDirectory) {
        return failure(400, "is_directory", "Cannot write to a directory");
    }
    // "Create new file" must not silently overwrite an existing script.
    if (opts.createOnly === true && resolved.exists) {
        return failure(409, "file_exists", "File already exists");
    }

    try {
        fs.writeFileSync(resolved.absolute, content, { encoding: "utf8", mode: 0o600 });
    } catch (error) {
        return failure(500, "write_failed", "Could not write this file");
    }
    return {
        ok: true,
        path: resolved.relative,
        reloaded: false,
        loadError: "Reload requires a bot restart"
    };
}

function deleteFile(input) {
    const resolved = resolveFile(input, { write: true, confirm: true });
    if (!resolved.ok) return resolved;
    if (ROOT_FILES.includes(resolved.relative)) {
        return failure(403, "protected_file", "Root configuration files cannot be deleted from the dashboard");
    }
    if (!resolved.exists) return failure(404, "not_found", "File not found");
    if (!resolved.isFile) return failure(400, "not_a_file", "Only files can be deleted");

    try {
        fs.unlinkSync(resolved.absolute);
    } catch (error) {
        return failure(500, "delete_failed", "Could not delete this file");
    }
    return { ok: true, path: resolved.relative };
}

function safeScriptName(name) {
    if (typeof name !== "string" || !name) return false;
    if (name.includes("..") || name.includes("/") || name.includes("\\")) return false;
    return /^[A-Za-z0-9][A-Za-z0-9._-]*\.js$/.test(name);
}

function jsonResponse(result) {
    if (result && result.ok === true) {
        return {
            status: 200,
            payload: Object.assign({ ok: true, success: true }, result)
        };
    }
    return {
        status: (result && result.status) || 400,
        payload: {
            ok: false,
            success: false,
            code: (result && result.code) || "bad_request",
            message: (result && result.message) || "Request failed"
        }
    };
}

function queryValue(query, key) {
    if (!query) return null;
    if (typeof query.get === "function") return query.get(key);
    return Object.prototype.hasOwnProperty.call(query, key) ? query[key] : null;
}

function headerValue(headers, key) {
    if (!headers) return null;
    if (typeof headers.get === "function") return headers.get(key);
    return headers[key] || headers[String(key).toLowerCase()] || null;
}

/**
 * Handle a file-manager API request. Both the Express dashboard and the plain
 * Node health server call this, so their behaviour is identical.
 *
 * Returns null when the request is not a file-manager route.
 */
async function handleApi(request) {
    const req = request || {};
    const method = String(req.method || "GET").toUpperCase();
    const pathname = String(req.pathname || "");
    const query = req.query || new URLSearchParams();
    const body = req.body || {};
    const confirm = body.confirm === true
        || String(headerValue(req.headers, "x-confirm-write") || "").toLowerCase() === "true";
    const logger = typeof req.logger === "function" ? req.logger : null;

    function logFailure(result, target) {
        if (!logger) return;
        logger(
            `[FILES] ${method} ${sanitizeForLog(target || pathname)} -> ${result.code || "error"}`,
            "warn"
        );
    }

    // --- generic listing: /api/files and /api/files?dir=... ---
    if (pathname === "/api/files" && method === "GET") {
        const dir = queryValue(query, "dir");
        const result = dir ? listDirectory(dir) : listRoots();
        if (!result.ok) logFailure(result, dir || "/api/files");
        return jsonResponse(result);
    }

    // --- generic read/write/delete: /api/file?path=... ---
    if (pathname === "/api/file") {
        const target = queryValue(query, "path");
        if (method === "GET") {
            const result = readTextFile(target);
            if (!result.ok) logFailure(result, target);
            return jsonResponse(result);
        }
        if (method === "POST") {
            const result = writeTextFile(target, body.content, {
                confirm,
                createOnly: body.createOnly === true
            });
            if (!result.ok) logFailure(result, target);
            return jsonResponse(result);
        }
        if (method === "DELETE") {
            const result = deleteFile(target);
            if (!result.ok) logFailure(result, target);
            return jsonResponse(result);
        }
        return jsonResponse(failure(405, "method_not_allowed", "Method not allowed"));
    }

    // --- legacy config editor: /api/file/:filename ---
    const legacyFile = pathname.match(/^\/api\/file\/([^/]+)$/);
    if (legacyFile && (method === "GET" || method === "POST")) {
        let target;
        try {
            target = decodeURIComponent(legacyFile[1]);
        } catch (error) {
            return jsonResponse(failure(400, "invalid_path", "Path is not a safe relative path"));
        }
        if (method === "GET") {
            const result = readTextFile(target);
            if (!result.ok) logFailure(result, target);
            return jsonResponse(result);
        }
        const result = writeTextFile(target, body.content, { confirm });
        if (!result.ok) logFailure(result, target);
        return jsonResponse(result);
    }

    // --- legacy script manager: /api/scripts/:type[/:filename] ---
    const scripts = pathname.match(/^\/api\/scripts\/([^/]+)(?:\/([^/]+))?$/);
    if (scripts) {
        const type = scripts[1];
        if (type !== "commands" && type !== "events") {
            return jsonResponse(failure(400, "invalid_script_type", "Invalid script type"));
        }
        const directory = `Script/${type}`;
        const filename = scripts[2] ? decodeURIComponent(scripts[2]) : null;

        if (!filename) {
            if (method === "GET") {
                const result = listDirectory(directory);
                if (!result.ok) {
                    logFailure(result, directory);
                    return jsonResponse(result);
                }
                const entries = result.entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".js"));
                return jsonResponse({
                    ok: true,
                    path: directory,
                    files: entries.map((entry) => entry.name),
                    entries
                });
            }
            if (method === "POST") {
                if (!safeScriptName(body.filename)) {
                    return jsonResponse(failure(400, "invalid_filename", "Filename must be a simple .js name"));
                }
                const target = `${directory}/${body.filename}`;
                const result = writeTextFile(target, body.content, { confirm: true, createOnly: true });
                if (!result.ok) logFailure(result, target);
                return jsonResponse(result);
            }
            return jsonResponse(failure(405, "method_not_allowed", "Method not allowed"));
        }

        if (!safeScriptName(filename)) {
            return jsonResponse(failure(400, "invalid_filename", "Filename must be a simple .js name"));
        }
        const target = `${directory}/${filename}`;
        if (method === "GET") {
            const result = readTextFile(target);
            if (!result.ok) logFailure(result, target);
            return jsonResponse(result);
        }
        if (method === "POST") {
            const result = writeTextFile(target, body.content, { confirm: true });
            if (!result.ok) logFailure(result, target);
            return jsonResponse(result);
        }
        if (method === "DELETE") {
            const result = deleteFile(target);
            if (!result.ok) logFailure(result, target);
            return jsonResponse(result);
        }
        return jsonResponse(failure(405, "method_not_allowed", "Method not allowed"));
    }

    // --- read-only FCA info ---
    if (pathname === "/api/get-fca-type" && method === "GET") {
        const config = req.config || {};
        return jsonResponse({
            ok: true,
            fcaType: config.FCA || config.fca || "cyber-bot-fca"
        });
    }

    return null;
}

module.exports = {
    PROJECT_ROOT,
    READ_DIRECTORIES,
    WRITE_DIRECTORIES,
    ROOT_FILES,
    CONFIRM_FILES,
    normalizeRelative,
    blockedReason,
    resolveFile,
    listRoots,
    listDirectory,
    readTextFile,
    writeTextFile,
    deleteFile,
    handleApi,
    jsonResponse,
    sanitizeForLog,
    safeScriptName
};
