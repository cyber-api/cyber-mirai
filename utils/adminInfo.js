"use strict";

/**
 * Owner / admin identity, loaded from the root `admin.json`.
 *
 * `admin.json` is the single place to change the owner name, avatar, social
 * links and (optionally) extra admin UIDs. It is intentionally fail-safe:
 * a missing, malformed or partially filled file never stops the bot. Invalid
 * UIDs are ignored and the normal `config.json` / environment admin lists keep
 * working exactly as before.
 *
 * The file is read with `fs` only (no npm dependencies) so it can be used by
 * `Cyber.js`, `load.js`, commands and test harnesses alike.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_PATH = path.join(__dirname, "..", "admin.json");

const PLACEHOLDER_PATTERNS = [
    /^(?:your|replace|todo|example|change|set)[\s_-]/i,
    /^(?:your|replace|todo|example|change|set)\b.*$/i,
    /^<.*>$/,
    /^\[.*\]$/
];

const DEFAULTS = Object.freeze({
    name: "",
    nickname: "",
    legalName: "",
    gender: "",
    relationship: "",
    age: "",
    religion: "",
    education: "",
    address: "",
    birthday: "",
    avatar: Object.freeze({ uid: "", url: "" }),
    social: Object.freeze({
        facebook: "",
        facebookUid: "",
        telegram: "",
        tiktok: "",
        github: "",
        youtube: "",
        whatsapp: ""
    }),
    permissions: Object.freeze({ adminUids: [], ownerUids: [] })
});

function isPlaceholder(value) {
    if (typeof value !== "string") return false;
    const text = value.trim();
    if (!text) return false;
    return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function stringValue(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string") {
        const text = value.trim();
        if (text && !isPlaceholder(text)) return text;
    }
    return fallback;
}

function uidValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) value = String(value);
    if (typeof value !== "string") return "";
    const uid = value.trim();
    return /^\d{5,20}$/.test(uid) ? uid : "";
}

function uidList(value, warn, label) {
    if (!Array.isArray(value)) return [];
    const result = [];
    for (const entry of value) {
        const uid = uidValue(entry);
        if (!uid) {
            if (entry != null && typeof warn === "function") {
                warn(`Ignoring invalid ${label} entry in admin.json: ${String(entry).slice(0, 40)}`);
            }
            continue;
        }
        if (!result.includes(uid)) result.push(uid);
    }
    return result;
}

function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeAdminInfo(input, options) {
    const opts = options || {};
    const warn = typeof opts.warn === "function" ? opts.warn : () => {};
    const source = objectValue(input);

    const avatar = objectValue(source.avatar);
    const social = objectValue(source.social);
    const permissions = objectValue(source.permissions);

    const info = {
        name: stringValue(source.name, DEFAULTS.name),
        nickname: stringValue(source.nickname, ""),
        legalName: stringValue(source.legalName, DEFAULTS.legalName),
        gender: stringValue(source.gender, DEFAULTS.gender),
        relationship: stringValue(source.relationship, DEFAULTS.relationship),
        age: stringValue(source.age, DEFAULTS.age),
        religion: stringValue(source.religion, DEFAULTS.religion),
        education: stringValue(source.education, DEFAULTS.education),
        address: stringValue(source.address, DEFAULTS.address),
        birthday: stringValue(source.birthday, DEFAULTS.birthday),
        avatar: {
            uid: uidValue(avatar.uid),
            url: stringValue(avatar.url, "")
        },
        social: {
            facebook: stringValue(social.facebook, ""),
            facebookUid: uidValue(social.facebookUid),
            telegram: stringValue(social.telegram, ""),
            tiktok: stringValue(social.tiktok, ""),
            github: stringValue(social.github, ""),
            youtube: stringValue(social.youtube, ""),
            whatsapp: stringValue(social.whatsapp, "")
        },
        permissions: {
            adminUids: uidList(permissions.adminUids, warn, "adminUids"),
            ownerUids: uidList(permissions.ownerUids, warn, "ownerUids")
        }
    };

    // Keep the two Facebook representations in sync when only one is supplied.
    if (!info.social.facebookUid) {
        const match = info.social.facebook.match(/[?&]id=(\d{5,20})/);
        if (match) info.social.facebookUid = match[1];
    }
    if (!info.social.facebook && info.social.facebookUid) {
        info.social.facebook = `https://www.facebook.com/profile.php?id=${info.social.facebookUid}`;
    }
    if (!info.nickname) info.nickname = info.name;

    return info;
}

function loadAdminInfo(options) {
    const opts = options || {};
    const warn = typeof opts.warn === "function" ? opts.warn : () => {};
    const file = opts.path || process.env.ADMIN_INFO_PATH || DEFAULT_PATH;

    try {
        if (!fs.existsSync(file)) {
            warn(`admin.json not found at ${file}; using built-in owner defaults.`);
            return normalizeAdminInfo({}, opts);
        }
        const raw = fs.readFileSync(file, "utf8");
        const parsed = JSON.parse(raw);
        return normalizeAdminInfo(parsed, opts);
    } catch (error) {
        warn(`Could not load admin.json (${error.message}); using built-in owner defaults.`);
        return normalizeAdminInfo({}, opts);
    }
}

function getAdminInfo(options) {
    if (global.adminInfo && typeof global.adminInfo === "object") return global.adminInfo;
    const info = loadAdminInfo(options);
    global.adminInfo = info;
    return info;
}

function reloadAdminInfo(options) {
    const info = loadAdminInfo(options);
    global.adminInfo = info;
    return info;
}

/**
 * Add UIDs declared in admin.json on top of the existing config lists.
 * `config.json` and `BOT_ADMIN_IDS` remain authoritative; admin.json can only
 * add more admins, never remove one. Returns the same config object.
 */
function mergeAdminUids(config, adminInfo) {
    if (!config || typeof config !== "object") return config;
    const info = adminInfo || {};

    if (!Array.isArray(config.ADMINBOT)) config.ADMINBOT = [];
    if (!Array.isArray(config.NDH)) config.NDH = [];

    const add = (list, uid) => {
        if (uid && !list.includes(uid)) list.push(uid);
    };

    const permissions = objectValue(info.permissions);
    for (const uid of uidList(permissions.adminUids, () => {}, "adminUids")) {
        add(config.ADMINBOT, uid);
    }
    for (const uid of uidList(permissions.ownerUids, () => {}, "ownerUids")) {
        add(config.ADMINBOT, uid);
        add(config.NDH, uid);
    }

    config.adminBot = config.ADMINBOT;
    config.ndh = config.NDH;
    return config;
}

module.exports = {
    DEFAULT_PATH,
    DEFAULTS,
    isPlaceholder,
    normalizeAdminInfo,
    loadAdminInfo,
    getAdminInfo,
    reloadAdminInfo,
    mergeAdminUids
};
