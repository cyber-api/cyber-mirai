const { exec } = require("child_process");

/**
 * shell — bot-admin only (hasPermssion: 2).
 *
 * Adapted from ST-BOT `scripts/cmds/shell.js`: 30s timeout, 1MB output cap and
 * a 2000-character reply so a runaway command cannot flood Messenger.
 * The permission check is enforced centrally by handleCommand (hasPermssion: 2).
 */
module.exports.config = {
	name: "shell",
	version: "7.3.1",
	hasPermssion: 2,
	credits: "CYBER BOT TEAM",
	description: "Run a shell command (bot admin only)",
	commandCategory: "System",
	usages: "[shell]",
	cooldowns: 0,
	dependencies: {
		"child_process": ""
	}
};

module.exports.run = async function ({ api, event, args }) {
	const command = args.join(" ").trim();

	if (!command) {
		return api.sendMessage(
			"⚠️ Please provide a shell command to execute.\nExample: !shell ls -la",
			event.threadID,
			event.messageID
		);
	}

	try {
		exec(command, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
			let response = "";

			if (error) {
				response = `❌ Command Failed\n📝 Command: \`${command}\`\n\n💥 Error:\n\`\`\`\n${error.message}\n\`\`\``;
			} else {
				response = `✅ Command Executed Successfully\n📝 Command: \`${command}\`\n\n`;
				if (stdout) response += `📤 Output:\n\`\`\`\n${stdout}\n\`\`\``;
				if (stderr) response += `⚠️ Warning/Info:\n\`\`\`\n${stderr}\n\`\`\``;
				if (!stdout && !stderr) response += "✨ Command executed successfully with no output.";
			}

			if (response.length > 2000) {
				response = response.substring(0, 1900) + "\n\n... (output truncated)";
			}

			api.sendMessage(response, event.threadID, event.messageID);
		});
	} catch (error) {
		api.sendMessage(`❌ Failed to execute command: ${error.message}`, event.threadID, event.messageID);
	}
};
