"use strict";

/**
 * Major-admin UID system (restored from the original Mirai Cyber.js).
 *
 * The original boot code fetched a UID list from a remote GitHub raw URL and
 * wrapped ADMINBOT/NDH in a Proxy so those UIDs were treated as bot admins.
 * The URL is dead, which is why the grant silently stopped working.
 *
 * This version keeps the same idea but makes config.json the source of truth:
 *   - MAJOR_ADMIN_UIDS : local list, always applied.
 *   - MAJOR_ADMIN_URL  : optional secondary source, empty/disabled by default.
 *
 * The UIDs are merged into ADMINBOT/NDH (so loops, JSON.stringify and the
 * central permission resolver all see them) and the arrays are wrapped in the
 * original includes()/indexOf() Proxy for backwards compatibility.
 */

const UID_RE = /^\d{5,20}$/;

function normalizeUidList(value, label, warn) {
    const emit = typeof warn === "function" ? warn : () => {};
    if (!Array.isArray(value)) {
        if (value != null && value !== "") emit(`Ignoring ${label}: expected an array of user IDs.`);
        return [];
    }
    const result = [];
    for (const entry of value) {
        const uid = String(entry == null ? "" : entry).trim();
        if (!UID_RE.test(uid)) {
            emit(`Ignoring invalid ${label} entry: ${uid.slice(0, 40)}`);
            continue;
        }
        if (!result.includes(uid)) result.push(uid);
    }
    return result;
}

function extractUids(text) {
    if (typeof text !== "string") return [];
    const matches = text.match(/\b\d{10,20}\b/g) || [];
    return [...new Set(matches)];
}

/**
 * Proxy-style grant: downstream code that calls includes()/indexOf() on the
 * admin arrays sees every major admin, even one added by a later remote fetch.
 */
function createAdminProxy(target, extraSet) {
    return new Proxy(target, {
        get(obj, prop) {
            if (prop === "includes") {
                return (search) => obj.includes(search) || extraSet.has(String(search));
            }
            if (prop === "indexOf") {
                return (search) => {
                    const index = obj.indexOf(search);
                    if (index !== -1) return index;
                    return extraSet.has(String(search)) ? obj.length : -1;
                };
            }
            return Reflect.get(obj, prop);
        }
    });
}

function addUidToTarget(target, uid) {
    if (!target.includes(uid)) target.push(uid);
}

/**
 * Apply the local list and install the proxies. Safe to call more than once
 * (e.g. from the `load` command after config.json is reloaded).
 *
 * @returns {{ local: string[], refreshRemote: () => Promise<string[]> }}
 */
function applyMajorAdmins(config, options) {
    const opts = options || {};
    const warn = typeof opts.warn === "function" ? opts.warn : () => {};

    if (!config || typeof config !== "object") {
        return { local: [], refreshRemote: async () => [] };
    }

    const local = normalizeUidList(config.MAJOR_ADMIN_UIDS, "MAJOR_ADMIN_UIDS", warn);
    const majorSet = new Set(local);

    // Keep the original spellings, but make sure they are arrays before merging.
    const adminTarget = Array.isArray(config.ADMINBOT)
        ? config.ADMINBOT.slice()
        : (Array.isArray(config.adminBot) ? config.adminBot.slice() : []);
    const ndhTarget = Array.isArray(config.NDH)
        ? config.NDH.slice()
        : (Array.isArray(config.ndh) ? config.ndh.slice() : []);

    for (const uid of local) {
        addUidToTarget(adminTarget, uid);
        addUidToTarget(ndhTarget, uid);
    }

    config.MAJOR_ADMIN_UIDS = local.slice();
    config.ADMINBOT = createAdminProxy(adminTarget, majorSet);
    config.adminBot = config.ADMINBOT;
    config.NDH = createAdminProxy(ndhTarget, majorSet);
    config.ndh = config.NDH;

    const remoteUrl = typeof config.MAJOR_ADMIN_URL === "string" ? config.MAJOR_ADMIN_URL.trim() : "";

    async function refreshRemote() {
        if (!remoteUrl) return [];
        if (!/^https?:\/\//i.test(remoteUrl)) {
            warn(`[ MAJOR ADMIN ] MAJOR_ADMIN_URL is not an http(s) URL; using local MAJOR_ADMIN_UIDS only.`);
            return [];
        }

        try {
            const axios = require("axios");
            const response = await axios.get(remoteUrl, { timeout: 10000 });
            const remote = extractUids(typeof response.data === "string" ? response.data : JSON.stringify(response.data));

            for (const uid of remote) {
                majorSet.add(uid);
                addUidToTarget(adminTarget, uid);
                addUidToTarget(ndhTarget, uid);
            }

            if (remote.length === 0) {
                warn(`[ MAJOR ADMIN ] Remote list fetched but contained no UID; using local MAJOR_ADMIN_UIDS only.`);
            }
            return remote;
        } catch (error) {
            warn(
                `[ MAJOR ADMIN ] Remote list fetch failed (${error && error.message ? error.message : error}). ` +
                `Falling back to the local MAJOR_ADMIN_UIDS list (${local.length} UID(s)).`
            );
            return [];
        }
    }

    return { local, refreshRemote };
}

module.exports = { applyMajorAdmins, normalizeUidList, extractUids, createAdminProxy };
