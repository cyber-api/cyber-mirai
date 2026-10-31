const logger = require("../../utils/log.js");

/**
 * eval — bot-admin only (hasPermssion: 2).
 *
 * Adapted from ST-BOT `scripts/cmds/eval.js`: the code is wrapped in an async
 * IIFE so `await` works. ST-BOT runs the code as statements; Mirai also shows
 * the returned value, so an expression is evaluated first and a plain
 * statement block is used as a fallback when the input is not an expression.
 */
module.exports.config = {
	name: "eval",
	version: "8.0.0",
	hasPermssion: 2,
	credits: "CYBER BOT TEAM",
	description: "Run JavaScript code (bot admin only)",
	commandCategory: "System",
	usages: "[code]",
	cooldowns: 0,
	dependencies: {}
};

module.exports.run = async function ({ api, args, event }) {
	function output(msg) {
		if (typeof msg === "number" || typeof msg === "boolean" || typeof msg === "function")
			msg = msg.toString();
		else if (msg instanceof Map) {
			let text = `Map(${msg.size})\n`;
			text += JSON.stringify(Object.fromEntries(msg), null, 2);
			msg = text;
		}
		else if (typeof msg === "object")
			msg = JSON.stringify(msg, null, 2);
		else if (typeof msg === "undefined")
			msg = "undefined";

		return api.sendMessage(msg, event.threadID, event.messageID);
	}

	const code = args.join(" ").trim();

	if (!code) {
		return api.sendMessage("⚠️ Please provide code to evaluate.", event.threadID, event.messageID);
	}

	try {
		let result;
		try {
			// Expression form: lets the admin type `1 + 1` and see the result.
			result = eval(`(async () => { return (${code}); })()`);
		} catch (expressionError) {
			// Statement form (ST-BOT style): `api.sendMessage(...)`, loops, etc.
			result = eval(`(async () => { ${code} })()`);
		}

		const resolved = await result;
		// If the code already sent its own message it usually returns undefined.
		if (resolved !== undefined) await output(resolved);
	} catch (error) {
		logger.error(`eval command: ${error && error.stack ? error.stack : error}`, "[ EVAL ]");
		return api.sendMessage(
			"❌ " + (error && (error.stack || error.message) ? (error.stack || error.message) : String(error)),
			event.threadID,
			event.messageID
		);
	}
};
