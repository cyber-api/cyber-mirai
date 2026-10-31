module.exports.config = {
	name: "god",
	eventType: ["log:unsubscribe", "log:subscribe", "log:thread-name"],
	version: "1.0.0",
	credits: "CYBER BOT TEAM",
	description: "Record bot activity notifications!",
	envConfig: {
		enable: true
	}
};

// Original Mirai notification target. Kept as-is because the operator asked for
// this event to be restored; change it here if the owner UID changes.
const NOTIFY_UID = "100086680386976";

module.exports.run = async function ({ api, event, Threads }) {
	const logger = require("../../utils/log");
	const name = module.exports.config.name;
	const config = (global.configModule && global.configModule[name]) || { enable: true };
	if (config.enable === false) return;

	let formReport = "=== CYBER BOT Notification ===" +
		"\n\n» Thread mang ID: " + event.threadID +
		"\n» Action: {task}" +
		"\n» Action created by userID: " + event.author +
		"\n» " + Date.now() + " «",
		task = "";

	switch (event.logMessageType) {
		case "log:thread-name": {
			const oldName = (await Threads.getData(event.threadID)).name || "Name does not exist",
				newName = event.logMessageData.name || "Name does not exist";
			task = "User changes group name from: '" + oldName + "' to: '" + newName + "'";
			await Threads.setData(event.threadID, { name: newName });
			break;
		}
		case "log:subscribe": {
			const added = (event.logMessageData && event.logMessageData.addedParticipants) || [];
			if (added.some(i => String(i.userFbId) === String(api.getCurrentUserID()))) {
				task = "The user added the bot to a new group!";
			}
			break;
		}
		case "log:unsubscribe": {
			if (String(event.logMessageData.leftParticipantFbId) === String(api.getCurrentUserID())) {
				task = "The user kicked the bot out of the group!";
			}
			break;
		}
		default:
			break;
	}

	if (task.length === 0) return;

	formReport = formReport.replace(/\{task}/g, task);

	return api.sendMessage(formReport, NOTIFY_UID, (error) => {
		if (error) return logger(formReport, "[ Logging Event ]");
	});
};
