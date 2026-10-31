//includes/database/index.js
const Sequelize = require("sequelize");
const path = require("path");
const fs = require("fs");
const { normalizeDatabaseConfig } = require("../../utils/databaseConfig.js");

// SQLite files live next to `includes/` (unchanged from the original layout).
const STORAGE_ROOT = path.resolve(__dirname, "..");

const normalized = normalizeDatabaseConfig(global.config.DATABASE || global.config.database, STORAGE_ROOT);

const options = {
    dialect: normalized.dialect,
    logging: false,
    define: {
        underscored: false,
        freezeTableName: true,
        charset: "utf8",
        timestamps: true,
    },
};

if (normalized.dialect === "sqlite") {
    options.storage = normalized.storage;
    try {
        fs.mkdirSync(path.dirname(normalized.storage), { recursive: true });
    } catch (error) {
        // The Sequelize constructor will report a clearer error if this fails.
    }
} else {
    // Non-SQLite dialects need host/user/database; use the matching section
    // verbatim so operators keep control over connection details.
    const { storage, ...connection } = normalized.section;
    Object.assign(options, connection);
    options.pool = {
        max: 20,
        min: 0,
        acquire: 60000,
        idle: 20000,
    };
    options.retry = {
        match: [/SQLITE_BUSY/],
        name: "query",
        max: 20,
    };
}

module.exports.sequelize = new Sequelize(options);
module.exports.Sequelize = Sequelize;
module.exports.normalizeDatabaseConfig = normalizeDatabaseConfig;

if (normalized.warnings.length) {
    const log = require("../../utils/log.js");
    for (const warning of normalized.warnings) log.loader(`[ DATABASE ] ${warning}`, "warn");
}
