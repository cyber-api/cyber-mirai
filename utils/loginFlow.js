"use strict";

/**
 * Login-source helpers for the appstate.json -> appstate2.json ->
 * appstate3.json -> config.json credential failover flow.
 *
 * The order is defined once in `loginOrder()` so Cyber.js, tests, and any
 * future caller cannot drift apart.
 */

const fs = require("fs");
const path = require("path");

const APPSTATE_FILES = ["appstate.json", "appstate2.json", "appstate3.json"];
const DEFAULT_SESSION_FILE = "appstate.json";

/**
 * Extract a cookie array from every supported on-disk shape:
 *   - plain FCA array:            [{ name, value, ... }, ...]
 *   - documented wrapper:         { _note: "...", _data: [ ... ] }
 *   - legacy object forms:        { appState: [ ... ] } / { cookies: [ ... ] }
 * Empty arrays are treated as "no session" so the next candidate runs.
 */
function extractCookieArray(parsed) {
    if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : null;
    if (!parsed || typeof parsed !== "object") return null;
    for (const key of ["_data", "appState", "cookies", "data"]) {
        if (Array.isArray(parsed[key])) {
            return parsed[key].length > 0 ? parsed[key] : null;
        }
    }
    return null;
}

function parseCookieJson(content) {
    if (typeof content !== "string" || content.trim() === "") return null;
    try {
        return extractCookieArray(JSON.parse(content));
    } catch (error) {
        // Empty or malformed cookie files are treated as "not available".
        return null;
    }
}

function readCookieFile(file) {
    try {
        if (!file || !fs.existsSync(file)) return null;
        return parseCookieJson(fs.readFileSync(file, "utf8"));
    } catch (error) {
        return null;
    }
}

/**
 * Read all three appstate files from a directory. Missing/empty/malformed
 * files become `null`; the caller decides whether to continue to credentials.
 */
function readLoginSources(baseDir) {
    const states = {};
    for (const file of APPSTATE_FILES) {
        states[file] = readCookieFile(path.join(baseDir, file));
    }
    return states;
}

/**
 * Centralized login order. `options.appStates` is a map of
 * { "appstate.json": [...], "appstate2.json": [...], "appstate3.json": [...] }.
 * Only non-empty sources become candidates; config credentials are appended
 * last when both email and password are present.
 */
function loginOrder(options) {
    const opts = options || {};
    const states = opts.appStates || {};
    const candidates = [];

    for (const file of APPSTATE_FILES) {
        const appState = states[file];
        if (Array.isArray(appState) && appState.length > 0) {
            candidates.push({
                type: file === "appstate.json" ? "appstate" : file.replace(/\.json$/, ""),
                file,
                label: file,
                appState
            });
        }
    }

    if (opts.email && opts.password) {
        candidates.push({
            type: "credentials",
            file: null,
            label: "config.json botAccount",
            email: opts.email,
            password: opts.password,
            userAgent: opts.userAgent
        });
    }

    return candidates;
}

/** The file that must receive refreshed cookies for a given candidate. */
function sessionFileFor(candidate) {
    if (candidate && typeof candidate.file === "string" && APPSTATE_FILES.includes(candidate.file)) {
        return candidate.file;
    }
    // Email/password logins have no source file: save the new session as the
    // primary appstate so the next start can reuse it.
    return DEFAULT_SESSION_FILE;
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

module.exports = {
    APPSTATE_FILES,
    DEFAULT_SESSION_FILE,
    extractCookieArray,
    parseCookieJson,
    readCookieFile,
    readLoginSources,
    loginOrder,
    buildLoginCandidates: loginOrder,
    sessionFileFor,
    toLoginData,
    runLoginFlow
};
