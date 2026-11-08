"use strict";

/**
 * Canonical admin identity.
 *
 * Historically the bot accepted several spellings of the same two lists
 * (`ADMINBOT`/`adminBot`/`adminBotIds`/`BOT_ADMIN_IDS` and `NDH`/`ndh`). The old
 * normalizer used `config.ADMINBOT || config.adminBot`, so an empty or
 * placeholder uppercase list silently discarded a valid camelCase list. That is
 * why real admins were denied while the denial text still said `[ADMIN]`.
 *
 * Everything now flows through this module:
 *   - `normalizeAdminConfig()` merges every alias plus `BOT_ADMIN_IDS`.
 *   - `isAdmin()` / `isOwner()` are the only membership checks handlers use.
 *   - `getAdminCounts()` feeds the `[CONFIG] Admin count: ...` startup log.
 *   - `getAdminStatus()` powers the `whoami` debug command.
 *
 * Membership checks call `.includes()` on the original arrays so the hidden
 * remote-admin Proxy installed by `Cyber.js` keeps working. Do not `.map()` or
 * spread those arrays for permission decisions.
 */

const ADMIN_KEYS = ["ADMINBOT", "adminBot", "adminBotIds", "BOT_ADMIN_IDS", "botAdminIds"];
const NDH_KEYS = ["NDH", "ndh", "NDH_IDS", "ndhIds", "supportIds"];
const UID_PATTERN = /^\d{5,20}$/;

function normalizeUid(value) {
    return String(value == null ? "" : value).trim();
}

/**
 * Accept an array or a comma/space separated string and return unique, valid
 * numeric UIDs. Invalid entries are skipped and optionally reported.
 */
function normalizeUidList(value, warn, label) {
    const emit = typeof warn === "function" ? warn : () => {};
    if (value == null || value === "") return [];

    let entries;
    if (Array.isArray(value)) {
        entries = value;
    } else if (typeof value === "string" || typeof value === "number") {
        entries = String(value).split(/[\s,;]+/);
    } else {
        emit(`Ignoring ${label || "admin list"}: expected an array or comma-separated list.`);
        return [];
    }

    const result = [];
    for (const entry of entries) {
        const uid = normalizeUid(entry);
        if (!UID_PATTERN.test(uid)) {
            if (uid) emit(`Ignoring invalid ${label || "admin list"} entry: ${uid.slice(0, 40)}`);
            continue;
        }
        if (!result.includes(uid)) result.push(uid);
    }
    return result;
}

function collectFromKeys(config, keys, warn, label) {
    const result = [];
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(config, key)) continue;
        const value = config[key];
        if (value == null || value === "") continue;
        for (const uid of normalizeUidList(value, warn, `${label}.${key}`)) {
            if (!result.includes(uid)) result.push(uid);
        }
    }
    return result;
}

/**
 * Merge every admin alias into the canonical arrays and keep the aliases
 * pointing at the same array instance.
 */
function normalizeAdminConfig(config, options) {
    const opts = options || {};
    const warn = typeof opts.warn === "function" ? opts.warn : () => {};
    const env = opts.env || process.env;
    const target = config && typeof config === "object" ? config : {};

    const adminBot = collectFromKeys(target, ADMIN_KEYS, warn, "adminBot");
    for (const uid of normalizeUidList(env.BOT_ADMIN_IDS, warn, "env.BOT_ADMIN_IDS")) {
        if (!adminBot.includes(uid)) adminBot.push(uid);
    }

    const ndh = collectFromKeys(target, NDH_KEYS, warn, "ndh");

    target.ADMINBOT = adminBot;
    target.adminBot = adminBot;
    target.adminBotIds = adminBot;

    target.NDH = ndh;
    target.ndh = ndh;

    // admin.json may add UIDs, but never removes config/env entries.
    if (opts.adminInfo && typeof opts.adminInfo === "object") {
        const { mergeAdminUids } = require("./adminInfo.js");
        mergeAdminUids(target, opts.adminInfo);
    }

    return target;
}

function getConfig(config) {
    if (config && typeof config === "object") return config;
    if (typeof global !== "undefined" && global.config) return global.config;
    return {};
}

function getLists(config) {
    const c = getConfig(config);
    const adminBot = Array.isArray(c.ADMINBOT)
        ? c.ADMINBOT
        : (Array.isArray(c.adminBot)
            ? c.adminBot
            : (Array.isArray(c.adminBotIds) ? c.adminBotIds : []));
    const ndh = Array.isArray(c.NDH)
        ? c.NDH
        : (Array.isArray(c.ndh) ? c.ndh : []);
    return { adminBot, ndh };
}

function listHas(list, uid) {
    if (!Array.isArray(list)) return false;
    try {
        return list.includes(uid);
    } catch (error) {
        return false;
    }
}

/**
 * Local-only membership. `listHas` intentionally goes through the Proxy so
 * remote admins count as admins, but `whoami` needs to distinguish a local
 * match from a remote one. Calling the built-in directly skips the Proxy's
 * `includes` trap and only sees the real array.
 */
function listHasLocal(list, uid) {
    if (!Array.isArray(list)) return false;
    try {
        return Array.prototype.includes.call(list, uid);
    } catch (error) {
        return false;
    }
}

function getRemoteAdmins() {
    try {
        if (typeof global !== "undefined" && global.remoteAdminsRef) {
            const current = global.remoteAdminsRef.current;
            if (Array.isArray(current)) return current.map(String);
        }
    } catch (error) {
        // Ignore an absent/broken remote list.
    }
    return [];
}

/** True when `senderID` appears in either canonical admin list or the remote list. */
function isAdmin(senderID, config) {
    const uid = normalizeUid(senderID);
    if (!uid) return false;

    const c = getConfig(config);
    const { adminBot, ndh } = getLists(c);

    if (listHas(adminBot, uid) || listHas(ndh, uid)) return true;

    // Fallback for callers that pass an un-normalized config object.
    if (listHas(c.adminBot, uid) || listHas(c.adminBotIds, uid) || listHas(c.ndh, uid)) return true;

    return getRemoteAdmins().includes(uid);
}

/**
 * Owner = any `ndh` entry or the first configured bot admin. This mirrors the
 * historical `NDH.includes(sender) || ADMINBOT[0] === sender` rule.
 */
function isOwner(senderID, config) {
    const uid = normalizeUid(senderID);
    if (!uid) return false;

    const { adminBot, ndh } = getLists(config);
    if (listHas(ndh, uid)) return true;

    const first = adminBot && adminBot.length > 0 ? String(adminBot[0]) : "";
    return first === uid;
}

/** Permission level helper: 0 user, 1 thread admin, 2 bot admin, 3 owner. */
function resolveLevel(senderID, config, isThreadAdmin) {
    const uid = normalizeUid(senderID);
    if (isOwner(uid, config)) return 3;
    if (isAdmin(uid, config)) return 2;
    return isThreadAdmin ? 1 : 0;
}

function configKeySummary(config) {
    const c = getConfig(config);
    const summarize = (keys) => {
        const parts = [];
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(c, key)) continue;
            const value = c[key];
            let count = 0;
            if (Array.isArray(value)) count = value.length;
            else if (typeof value === "string" && value.trim()) count = value.split(/[\s,;]+/).filter(Boolean).length;
            parts.push(`${key}=${count}`);
        }
        return parts.length ? parts.join(", ") : "none";
    };
    return { adminBot: summarize(ADMIN_KEYS), ndh: summarize(NDH_KEYS) };
}

function getAdminStatus(senderID, config) {
    const uid = normalizeUid(senderID);
    const { adminBot, ndh } = getLists(config);

    const matched = [];
    if (listHasLocal(adminBot, uid)) matched.push("adminBot");
    if (listHasLocal(ndh, uid)) matched.push("ndh");
    if (getRemoteAdmins().includes(uid)) matched.push("remote");

    return {
        senderID: uid,
        isAdmin: matched.length > 0,
        isOwner: isOwner(uid, config),
        matched: matched.length > 0 ? matched : ["none"],
        lists: { adminBot: adminBot.length, ndh: ndh.length },
        keys: configKeySummary(config),
    };
}

function getAdminCounts(config) {
    const { adminBot, ndh } = getLists(config);
    const union = new Set();
    for (let i = 0; i < adminBot.length; i++) union.add(String(adminBot[i]));
    for (let i = 0; i < ndh.length; i++) union.add(String(ndh[i]));
    return { adminBot: adminBot.length, ndh: ndh.length, total: union.size };
}

module.exports = {
    ADMIN_KEYS,
    NDH_KEYS,
    normalizeUid,
    normalizeUidList,
    normalizeAdminConfig,
    isAdmin,
    isOwner,
    resolveLevel,
    getAdminStatus,
    getAdminCounts,
    configKeySummary,
    getRemoteAdmins,
};
