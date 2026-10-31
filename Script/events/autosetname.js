module.exports.config = {
	name: "autosetname",
	eventType: ["log:subscribe"],
	version: "1.1.0",
	credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
	description: "Prefixes a configured nickname onto new members (opt-in, audited)"
};

const logger = require("../../utils/log.js");

module.exports.run = async function ({ api, event }) {
	const threadID = String(event.threadID);
	const logData = event.logMessageData || {};
	const added = Array.isArray(logData.addedParticipants) ? logData.addedParticipants : [];
	const botID = String(api.getCurrentUserID());

	const fs = global.nodemodule && global.nodemodule["fs-extra"];
	const path = global.nodemodule && global.nodemodule["path"];
	if (!fs || !path) return;

	const pathData = path.join(global.client.mainPath, "Script", "commands", "cache", "autosetname.json");
	if (!fs.existsSync(pathData)) return;

	let dataJson;
	try {
		dataJson = JSON.parse(fs.readFileSync(pathData, "utf-8"));
	} catch (error) {
		logger.warn(`[ AUTOSETNAME ] cannot parse autosetname.json: ${error.message}`);
		return;
	}
	if (!Array.isArray(dataJson)) return;

	const thisThread = dataJson.find((item) => item && String(item.threadID) === threadID);
	if (!thisThread || !Array.isArray(thisThread.nameUser) || thisThread.nameUser.length === 0) return;

	// Configuration is written by an admin command, but require the explicit
	// per-thread enable flag as well so an old cache file cannot rename people.
	if (thisThread.enabled !== true) return;

	const rawPrefix = String(thisThread.nameUser[0] || "");
	// Canvas/name fields are not involved here, but a nickname is still user
	// input: trim, bound the length, and reject control characters.
	const prefix = rawPrefix.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
	if (!prefix) return;

	let info = null;
	try { info = await api.getThreadInfo(threadID); } catch (error) { info = null; }
	const adminIds = ((info && info.adminIDs) || []).map((item) => String(item.id));

	for (const idUser of added.map((item) => item && item.userFbId != null ? String(item.userFbId) : null)) {
		if (!idUser || idUser === botID || adminIds.includes(idUser)) continue;

		let name = "";
		try {
			const userInfo = await api.getUserInfo(idUser);
			name = userInfo && userInfo[idUser] && userInfo[idUser].name ? String(userInfo[idUser].name) : "";
		} catch (error) {
			name = "";
		}
		if (!name) continue;

		await new Promise((resolve) => setTimeout(resolve, 1000));
		await new Promise((resolve) => {
			api.changeNickname(`${prefix} ${name}`.slice(0, 64), threadID, idUser, (error) => {
				logger.audit({
					action: "autosetname",
					actor: "system",
					target: idUser,
					detail: `thread=${threadID}`,
					result: error ? `error: ${error.message || error}` : "ok",
				});
				resolve();
			});
		});
	}

	return api.sendMessage("Set a temporary nickname for the new member(s).", threadID);
};
