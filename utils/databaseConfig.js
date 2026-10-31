"use strict";

const path = require("path");
const fs = require("fs");

/**
 * Only explicit, known dialects are accepted. The previous code took
 * `Object.keys(DATABASE)[0]`, so the active database depended on JSON key
 * order and an unexpected key produced a confusing startup crash.
 */
const SUPPORTED_DIALECTS = ["sqlite", "mysql", "mariadb", "postgres", "mssql"];

function findDialect(raw, requested) {
    if (requested && SUPPORTED_DIALECTS.includes(requested)) return requested;

    for (const key of Object.keys(raw)) {
        const lower = String(key).toLowerCase();
        if (SUPPORTED_DIALECTS.includes(lower)) return lower;
    }
    return "sqlite";
}

/**
 * Pure config normalizer (no Sequelize side effects, so it can be unit tested).
 *
 * @param {object} raw - `config.DATABASE`
 * @param {string} storageRoot - directory that SQLite files must stay inside
 * @returns {{ dialect: string, storage: string|null, section: object, warnings: string[] }}
 */
function normalizeDatabaseConfig(raw, storageRoot) {
    const config = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const warnings = [];
    const root = path.resolve(storageRoot || path.join(__dirname, "..", "includes"));

    const requested = typeof config.type === "string" ? config.type.trim().toLowerCase() : "";
    const dialect = findDialect(config, requested);

    if (requested && !SUPPORTED_DIALECTS.includes(requested)) {
        warnings.push(`Unsupported database type "${requested}"; using "${dialect}".`);
    }
    if (!requested) {
        warnings.push(`database.type is not set; inferred "${dialect}" from the config keys.`);
    }

    let section = {};
    const sectionKey = Object.keys(config).find((key) => String(key).toLowerCase() === dialect);
    if (sectionKey && config[sectionKey] && typeof config[sectionKey] === "object") {
        section = config[sectionKey];
    }

    let storage = null;
    if (dialect === "sqlite") {
        const requestedStorage = typeof section.storage === "string" && section.storage.trim()
            ? section.storage.trim()
            : "data.sqlite";

        const resolved = path.resolve(root, requestedStorage);
        const relative = path.relative(root, resolved);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
            warnings.push(`Refusing storage path "${requestedStorage}" outside includes/; using includes/data.sqlite.`);
            storage = path.join(root, "data.sqlite");
        } else {
            storage = resolved;
        }
    }

    return { dialect, storage, section, warnings };
}

module.exports = { SUPPORTED_DIALECTS, normalizeDatabaseConfig };
