"use strict";

/**
 * Image-migration resolver.
 *
 * Several older command assets were hard-coded to `i.imgur.com`. Imgur now
 * rate-limits (429) or blocks those cold-start downloads, so the URLs were
 * migrated to catbox. `assets/image-migration.json` keeps the mapping:
 *
 *   - `status: "migrated"`       -> rewrite the old URL to `newUrl`.
 *   - `status: "needs-user-upload"` -> the URL has no replacement yet. It must
 *     never be fetched (that is what produced the 429 storm). Callers receive a
 *     typed `IMAGE_MIGRATION_PENDING` error and can skip/fallback safely.
 *
 * The file is read once and cached. A missing or malformed file never stops the
 * bot: unknown URLs simply pass through unchanged.
 */

const fs = require("fs");
const path = require("path");

const MIGRATION_PATH = path.join(__dirname, "..", "assets", "image-migration.json");

let cache = null;

function isImgurUrl(url) {
    if (typeof url !== "string") return false;
    try {
        return /(^|\.)imgur\.com$/i.test(new URL(url).hostname);
    } catch (error) {
        return false;
    }
}

function load() {
    if (cache) return cache;

    const migrated = new Map();
    const pending = new Map();

    try {
        const raw = fs.readFileSync(MIGRATION_PATH, "utf8");
        const json = JSON.parse(raw);
        const entries = Array.isArray(json && json.entries) ? json.entries : [];
        for (const entry of entries) {
            if (!entry || typeof entry.old !== "string") continue;
            if (entry.status === "migrated"
                && typeof entry.newUrl === "string"
                && /^https?:\/\//i.test(entry.newUrl)) {
                migrated.set(entry.old, entry.newUrl);
            } else {
                pending.set(entry.old, entry.status || "needs-user-upload");
            }
        }
    } catch (error) {
        // Fail-open: the bot keeps working with the original URLs.
    }

    cache = { migrated, pending };
    return cache;
}

/**
 * Rewrite a known migrated URL, or throw a typed error for a pending one.
 *
 * @param {string} url
 * @returns {{ url: string, changed: boolean, original: string }}
 */
function resolveUrl(url) {
    if (!isImgurUrl(url)) return { url, changed: false, original: url };

    const { migrated, pending } = load();

    if (migrated.has(url)) {
        return { url: migrated.get(url), changed: true, original: url };
    }

    if (pending.has(url)) {
        const error = new Error("Image migration pending; refusing to fetch the original Imgur URL.");
        error.code = "IMAGE_MIGRATION_PENDING";
        error.url = url;
        error.migrationStatus = pending.get(url);
        throw error;
    }

    // Unknown Imgur URL: pass through so unusual/one-off URLs still work.
    return { url, changed: false, original: url };
}

function reload() {
    cache = null;
    return load();
}

function stats() {
    const { migrated, pending } = load();
    return { migrated: migrated.size, pending: pending.size, total: migrated.size + pending.size };
}

module.exports = {
    MIGRATION_PATH,
    isImgurUrl,
    resolveUrl,
    reload,
    stats,
};
