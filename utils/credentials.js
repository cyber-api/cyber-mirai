"use strict";

/**
 * Central credential access.
 *
 * config.json is the source of truth (Mirai/ST-BOT style). Environment
 * variables are an optional override for hosted deployments only.
 *
 * `fbAccessToken` is the public Facebook app token used by Graph profile
 * picture URLs (avatar/cover drawing, `!file`, rank cards, welcome images).
 * It is not a user session token and cannot be used to log in. The original
 * value was recovered from the upstream ST-BOT source and restored here as a
 * last-resort default, so image commands keep working even when config.json
 * has an empty `FB_APP_TOKEN`. A configured value always wins.
 */

const fs = require("fs");
const path = require("path");

// Public Facebook app token (same value used by the original ST-BOT project).
// Keep it as the fallback only; never print it to the console.
const DEFAULT_FB_APP_TOKEN = "6628568379|c1e620fa708a1d5696fb991c1bde5662";

let cachedFileConfig = null;

function fileConfig() {
    if (cachedFileConfig) return cachedFileConfig;
    try {
        cachedFileConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"));
    } catch (error) {
        cachedFileConfig = {};
    }
    return cachedFileConfig;
}

function configValue(key) {
    if (global.config && global.config[key] !== undefined) return global.config[key];
    const cfg = fileConfig();
    return cfg[key];
}

function firstNonEmpty(values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
}

let warnedMissingFbToken = false;

function getFbAppToken() {
    // Environment is only an optional override; config.json works standalone.
    const token = firstNonEmpty([
        process.env.FB_APP_TOKEN,
        process.env.FB_ACCESS_TOKEN,
        configValue("fbAccessToken"),
        configValue("FB_APP_TOKEN"),
        configValue("fbAppToken"),
        DEFAULT_FB_APP_TOKEN,
    ]);
    if (!token && !warnedMissingFbToken) {
        warnedMissingFbToken = true;
        // Avoid printing the token or any credential; just tell the operator.
        console.warn("[ credentials ] FB_APP_TOKEN is not set in config.json; Graph profile-picture requests will be skipped.");
    }
    return token;
}

function getEnv(name, fallback) {
    const value = process.env[name];
    if (value !== undefined && value !== "") return value;
    const configured = configValue(name);
    return configured === undefined || configured === "" ? fallback : configured;
}

module.exports = { getFbAppToken, getEnv, configValue, DEFAULT_FB_APP_TOKEN };
