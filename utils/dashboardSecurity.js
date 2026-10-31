"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/** Constant-time comparison of two secrets (never compare raw strings with ==). */
function secretsMatch(candidate, expected) {
    if (typeof candidate !== "string" || typeof expected !== "string") return false;
    if (!candidate || !expected) return false;
    const a = crypto.createHash("sha256").update(candidate, "utf8").digest();
    const b = crypto.createHash("sha256").update(expected, "utf8").digest();
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** True when a state-changing request comes from the same host. */
function sameOriginAllowed(method, origin, host) {
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
    if (!origin) return true;
    try {
        return new URL(origin).host === host;
    } catch (error) {
        return false;
    }
}

function isSafeScriptName(name) {
    if (typeof name !== "string" || !name) return false;
    if (name.includes("..") || name.includes("/") || name.includes("\\")) return false;
    return /^[A-Za-z0-9][A-Za-z0-9._-]*\.js$/.test(name);
}

/**
 * Build path guards bound to concrete roots. Resolves symlinks and rejects
 * anything that is not a direct child of the intended directory.
 */
function createPathGuards({ scriptRoots, baseDir, configFiles }) {
    const allowedConfigFiles = new Set(configFiles || []);

    function safeScriptPath(type, filename) {
        if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(scriptRoots, type)) return null;
        const root = scriptRoots[type];
        if (typeof root !== "string" || !root) return null;
        if (!isSafeScriptName(filename)) return null;

        const target = path.resolve(root, filename);
        const relative = path.relative(root, target);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) {
            return null;
        }

        try {
            const realRoot = fs.realpathSync(root);
            if (fs.existsSync(target)) {
                if (path.dirname(fs.realpathSync(target)) !== realRoot) return null; // symlink escape
            } else if (fs.realpathSync(path.dirname(target)) !== realRoot) {
                return null;
            }
        } catch (error) {
            return null;
        }
        return target;
    }

    function safeConfigPath(filename) {
        if (typeof filename !== "string" || !allowedConfigFiles.has(filename)) return null;
        const base = path.resolve(baseDir);
        const target = path.resolve(base, filename);
        return path.dirname(target) === base ? target : null;
    }

    return { safeScriptPath, safeConfigPath, isSafeScriptName };
}

module.exports = { secretsMatch, sameOriginAllowed, isSafeScriptName, createPathGuards };
