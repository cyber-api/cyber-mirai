"use strict";

/**
 * Central credential access.
 *
 * config.json is the source of truth (Mirai/ST-BOT style). Environment
 * variables are an optional override for hosted deployments only.
 */

const fs = require("fs");
const path = require("path");

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

let warnedMissingFbToken = false;

function getFbAppToken() {
    // Environment is only an optional override; config.json works standalone.
    const token = process.env.FB_APP_TOKEN
        || process.env.FB_ACCESS_TOKEN
        || configValue("FB_APP_TOKEN")
        || configValue("fbAppToken")
        || "";
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

module.exports = { getFbAppToken, getEnv, configValue };
