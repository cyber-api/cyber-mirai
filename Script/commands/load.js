module.exports.config = {
	name: "load",
	version: "1.1.0",
	hasPermssion: 2,
	credits: "CYBER BOT TEAM",
	description: "Reload config.json through the same validated normalizer used at boot",
	commandCategory: "Admin",
	usages: "[]",
	cooldowns: 30
};

module.exports.run = async function({ api, event }) {
	const fs = require("fs-extra");
	const { normalizeConfig } = require("../../utils/config.js");
	const { configPath } = global.client;

	try {
		const raw = fs.readFileSync(configPath, "utf8");
		const parsed = JSON.parse(raw);
		// Do not replace global.config with a raw require(): that dropped the
		// canonical aliases, local admin validation, and env admin IDs (F-33).
		const normalized = normalizeConfig(parsed, {
			warn: (message) => console.warn("[ config ] " + message)
		});
		global.config = normalized;
		// Re-apply the same hidden remote-admin Proxy after a reload.
		if (typeof global.applyRemoteAdminProxies === "function") {
			global.applyRemoteAdminProxies(global.config);
		}
		return api.sendMessage("[OK] config.json reloaded and normalized.", event.threadID, event.messageID);
	} catch (error) {
		return api.sendMessage(`[ERR] Could not reload config.json: ${error.message}`, event.threadID, event.messageID);
	}
};
