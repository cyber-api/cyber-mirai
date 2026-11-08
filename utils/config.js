"use strict";

/**
 * Single source of truth for config normalization.
 *
 * `Cyber.js` uses it on boot and `Script/commands/load.js` uses it on reload,
 * so a reload cannot silently drop the canonical aliases, the local admin
 * validation, or the environment-sourced admin IDs (F-27, F-33).
 */

const { normalizeAdminConfig, normalizeUidList: normalizeUidListFromAuth } = require("./adminAuth.js");

// Kept for backwards compatibility: callers/tests use (value, label, warn).
function normalizeUidList(value, label, warn) {
    return normalizeUidListFromAuth(value, warn, label);
}

function normalizeEmojiList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
    return [String(value)];
}

/**
 * The anti-react feature had several shapes over time: a bare boolean, only
 * `enable`, or the full `reactByUnsend`/`reactByRemove` objects. Normalize them
 * all so `handleReaction.js` can rely on one shape.
 */
function normalizeAntiReact(config, warn) {
    const defaults = () => ({
        enable: false,
        onlyAdminBot: false,
        removeBotMessage: true,
        reactByUnsend: { enable: true, emojis: ["👍"] },
        reactByRemove: { enable: false, emoji: "⚠" }
    });

    let raw = config.antiReact;
    if (raw === undefined || raw === null) {
        config.antiReact = defaults();
        return config.antiReact;
    }
    if (raw === true || raw === false) raw = { enable: raw };
    if (typeof raw !== "object" || Array.isArray(raw)) {
        warn("Ignoring antiReact: expected an object.");
        config.antiReact = defaults();
        return config.antiReact;
    }

    const antiReact = raw;
    // An existing object means the operator opted in; only an explicit false
    // turns the feature off.
    if (typeof antiReact.enable !== "boolean") antiReact.enable = true;
    if (typeof antiReact.onlyAdminBot !== "boolean") antiReact.onlyAdminBot = false;
    if (typeof antiReact.removeBotMessage !== "boolean") antiReact.removeBotMessage = true;

    const unsend = antiReact.reactByUnsend;
    if (!unsend || typeof unsend !== "object" || Array.isArray(unsend)) {
        antiReact.reactByUnsend = { enable: true, emojis: ["👍"] };
    } else {
        if (typeof unsend.enable !== "boolean") unsend.enable = true;
        const emojis = normalizeEmojiList(unsend.emojis);
        unsend.emojis = emojis.length ? emojis : ["👍"];
    }

    const remove = antiReact.reactByRemove;
    if (!remove || typeof remove !== "object" || Array.isArray(remove)) {
        antiReact.reactByRemove = { enable: false, emoji: "⚠" };
    } else {
        if (typeof remove.enable !== "boolean") remove.enable = false;
        remove.emoji = typeof remove.emoji === "string" && remove.emoji ? remove.emoji : "⚠";
    }

    config.antiReact = antiReact;
    return antiReact;
}

function normalizeConfig(input, options) {
    const opts = options || {};
    const warn = typeof opts.warn === "function" ? opts.warn : () => {};
    const env = opts.env || process.env;

    const config = input && typeof input === "object" && !Array.isArray(input)
        ? input
        : {};

    // --- local admin lists (the hidden remote Proxy is installed in Cyber.js) ---
    // Merge every accepted alias (`ADMINBOT`, `adminBot`, `adminBotIds`,
    // `BOT_ADMIN_IDS`, `NDH`, `ndh`) plus the environment list and admin.json.
    // The old `||` chain discarded a valid camelCase list whenever the
    // uppercase key existed but was empty/placeholder.
    normalizeAdminConfig(config, {
        warn,
        env,
        adminInfo: opts.adminInfo
    });

    // --- canonical aliases ---
    config.PREFIX = typeof config.PREFIX === "string" && config.PREFIX
        ? config.PREFIX
        : (typeof config.prefix === "string" && config.prefix ? config.prefix : "!");
    config.prefix = config.PREFIX;

    config.DeveloperMode = Boolean(config.DeveloperMode || config.developerMode);
    config.developerMode = config.DeveloperMode;

    config.FCA = config.FCA || config.fca || "cyber-bot-fca";
    config.fca = config.FCA;

    // `dashboard`/`dashBoard` drift: keep the documented spelling available.
    if (config.dashboard && !config.dashBoard) config.dashBoard = config.dashboard;
    if (config.dashBoard) {
        const dash = config.dashBoard;
        // Dashboard settings live in config.json. Older installs only had
        // passwordProtection.password, so keep reading that as a fallback.
        if (typeof dash.password !== "string" || dash.password === "") {
            dash.password = (dash.passwordProtection && dash.passwordProtection.password) || "";
        }
        if (typeof dash.sessionSecret !== "string") dash.sessionSecret = "";
        if (typeof dash.host !== "string" || dash.host === "") dash.host = "127.0.0.1";
        if (typeof dash.secureCookie !== "boolean") dash.secureCookie = dash.https === true;
        config.dashboard = dash;
    }

    // Moderation toggles are per-thread. `enable` is kept for config shape
    // compatibility, but the event handlers no longer require a global gate.
    for (const key of ["antijoin", "antiout", "autosetname", "spamBan"]) {
        if (config[key] && typeof config[key] === "object" && !Array.isArray(config[key])) {
            if (typeof config[key].enable !== "boolean") config[key].enable = true;
        }
    }

    normalizeAntiReact(config, warn);

    config.commandDisabled = Array.isArray(config.commandDisabled) ? config.commandDisabled : [];
    config.eventDisabled = Array.isArray(config.eventDisabled) ? config.eventDisabled : [];

    config.DATABASE = config.DATABASE || config.database || {
        type: "sqlite",
        sqlite: { storage: "data.sqlite" }
    };
    if (!config.DATABASE.type) config.DATABASE.type = "sqlite";
    config.database = config.DATABASE;

    // `antiInbox` used to be a boolean while the listener read `.enable`.
    if (typeof config.antiInbox === "boolean") {
        config.antiInbox = { enable: config.antiInbox };
    }

    // `mainThreadId` is used for nickname/startup notices. An invalid value used
    // to be passed straight to the API (F-35); blank it out and warn instead.
    if (config.mainThreadId != null && String(config.mainThreadId).trim() !== "") {
        const id = String(config.mainThreadId).trim();
        if (/^\d{5,20}$/.test(id)) {
            config.mainThreadId = id;
        } else {
            warn(`Ignoring invalid mainThreadId "${id.slice(0, 40)}": expected a numeric thread ID.`);
            config.mainThreadId = "";
        }
    } else {
        config.mainThreadId = "";
    }

    // --- Admin-only and notification defaults (ensured even if missing) ---
    if (!config.adminOnly || typeof config.adminOnly !== "object" || Array.isArray(config.adminOnly)) {
        config.adminOnly = { enable: false, ignoreCommand: [] };
    } else {
        if (typeof config.adminOnly.enable !== "boolean") config.adminOnly.enable = false;
        if (!Array.isArray(config.adminOnly.ignoreCommand)) config.adminOnly.ignoreCommand = [];
    }

    if (!config.hideNotiMessage || typeof config.hideNotiMessage !== "object" || Array.isArray(config.hideNotiMessage)) {
        config.hideNotiMessage = {};
    }
    if (typeof config.hideNotiMessage.adminOnly !== "boolean") config.hideNotiMessage.adminOnly = false;

    // --- Web service health endpoint (Render) ---
    // Absent means "only start when Render supplies PORT". The example config
    // sets enable=true for Web Service deployments.
    if (!config.webServer || typeof config.webServer !== "object" || Array.isArray(config.webServer)) {
        config.webServer = { enable: false, port: null };
    } else {
        if (typeof config.webServer.enable !== "boolean") config.webServer.enable = false;
        const port = Number(config.webServer.port);
        config.webServer.port = Number.isInteger(port) && port > 0 ? port : null;
    }

    return config;
}

module.exports = { normalizeConfig, normalizeUidList, normalizeAntiReact, normalizeEmojiList };
