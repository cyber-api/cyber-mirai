"use strict";

/**
 * Single source of truth for config normalization.
 *
 * `Cyber.js` uses it on boot and `Script/commands/load.js` uses it on reload,
 * so a reload cannot silently drop the canonical aliases, the local admin
 * validation, or the environment-sourced admin IDs (F-27, F-33).
 */

function normalizeUidList(value, label, warn) {
    const emit = typeof warn === "function" ? warn : () => {};
    if (!Array.isArray(value)) {
        if (value != null) emit(`Ignoring ${label}: expected an array of user IDs.`);
        return [];
    }
    const result = [];
    for (const entry of value) {
        const uid = String(entry == null ? "" : entry).trim();
        if (!/^\d{5,20}$/.test(uid)) {
            emit(`Ignoring invalid ${label} entry: ${uid.slice(0, 40)}`);
            continue;
        }
        if (!result.includes(uid)) result.push(uid);
    }
    return result;
}

function normalizeConfig(input, options) {
    const opts = options || {};
    const warn = typeof opts.warn === "function" ? opts.warn : () => {};
    const env = opts.env || process.env;

    const config = input && typeof input === "object" && !Array.isArray(input)
        ? input
        : {};

    // --- local admin lists (the hidden remote Proxy is installed in Cyber.js) ---
    config.ADMINBOT = normalizeUidList(config.ADMINBOT || config.adminBot, "ADMINBOT", warn);
    const envAdmins = String(env.BOT_ADMIN_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    for (const uid of envAdmins) {
        if (/^\d{5,20}$/.test(uid) && !config.ADMINBOT.includes(uid)) config.ADMINBOT.push(uid);
    }
    config.adminBot = config.ADMINBOT;

    config.NDH = normalizeUidList(config.NDH || config.ndh, "NDH", warn);
    config.ndh = config.NDH;

    // --- optional owner/admin identity file ---
    // admin.json may add UIDs, but never removes the local config or env entries.
    if (opts.adminInfo && typeof opts.adminInfo === "object") {
        const { mergeAdminUids } = require("./adminInfo.js");
        mergeAdminUids(config, opts.adminInfo);
    }

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

    return config;
}

module.exports = { normalizeConfig, normalizeUidList };
