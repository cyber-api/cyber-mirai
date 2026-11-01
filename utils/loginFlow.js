"use strict";

/**
 * Login-source helpers for the account.txt / account.txt2 failover flow.
 *
 * The bot keeps the existing appstate.json precedence, then tries
 * account.txt (primary cookie file), then account.txt2 (secondary cookie
 * file), and finally falls back to config.json botAccount credentials.
 */

const fs = require("fs-extra");

function parseCookieJson(content) {
    if (typeof content !== "string" || content.trim() === "") return null;
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (parsed && Array.isArray(parsed.appState) && parsed.appState.length > 0) return parsed.appState;
        if (parsed && Array.isArray(parsed.cookies) && parsed.cookies.length > 0) return parsed.cookies;
    } catch (error) {
        // Empty or malformed cookie files are treated as "not available".
    }
    return null;
}

function readCookieFile(file) {
    try {
        if (!file || !fs.existsSync(file)) return null;
        return parseCookieJson(fs.readFileSync(file, "utf8"));
    } catch (error) {
        return null;
    }
}

function buildLoginCandidates(options) {
    const opts = options || {};
    const candidates = [];
    const seen = new Set();

    function add(candidate) {
        if (!candidate) return;
        const key = candidate.type === "credentials"
            ? `credentials:${candidate.email}`
            : `${candidate.type}:${JSON.stringify(candidate.appState)}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(candidate);
    }

    if (Array.isArray(opts.appState) && opts.appState.length > 0) {
        add({ type: "appstate", label: "appstate.json", appState: opts.appState });
    }
    if (Array.isArray(opts.accountTxt) && opts.accountTxt.length > 0) {
        add({ type: "account", label: "account.txt", appState: opts.accountTxt });
    }
    if (Array.isArray(opts.accountTxt2) && opts.accountTxt2.length > 0) {
        add({ type: "account2", label: "account.txt2", appState: opts.accountTxt2 });
    }
    if (opts.email && opts.password) {
        add({
            type: "credentials",
            label: "config.json botAccount",
            email: opts.email,
            password: opts.password,
            userAgent: opts.userAgent
        });
    }

    return candidates;
}

function toLoginData(candidate) {
    if (!candidate) return {};
    if (candidate.type === "credentials") {
        const data = { email: candidate.email, password: candidate.password };
        if (candidate.userAgent) data.userAgent = candidate.userAgent;
        return data;
    }
    const data = { appState: candidate.appState };
    if (candidate.userAgent) data.userAgent = candidate.userAgent;
    return data;
}

/**
 * Try every candidate in order. `loginFn` must return a Promise that resolves
 * to an api object. The first success wins; the returned `candidate` tells the
 * caller which session file should receive the refreshed cookies.
 */
async function runLoginFlow(candidates, loginFn) {
    let lastError = null;
    for (const candidate of candidates) {
        try {
            const api = await loginFn(candidate);
            return { api, candidate };
        } catch (error) {
            lastError = error;
        }
    }
    const error = new Error("All login methods failed");
    error.cause = lastError;
    throw error;
}

module.exports = { parseCookieJson, readCookieFile, buildLoginCandidates, toLoginData, runLoginFlow };
