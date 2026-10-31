module.exports.config = {
	name: "adminUpdate",
	eventType: ["log:thread-admins","log:thread-name", "log:user-nickname","log:thread-icon","log:thread-call","log:thread-color"],
	version: "1.1.0",
	credits: "𝗜𝘀𝗹𝗮𝗺𝗶𝗰𝗸 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁",
	description: "Update team information quickly",
	envConfig: {
		sendNoti: true,
		// Unsent notices default to staying in the thread. A missing value used
		// to become `undefined * 1000` => NaN => an immediate unsend (F-32).
		timeToUnsend: 30,
	}
};

const logger = require("../../utils/log.js");

// Coalesce per-thread writes: a burst of admin/nickname events must not issue
// one DB update per event (F-32).
const pendingWrites = new Map();
const WRITE_DEBOUNCE_MS = 500;

module.exports.run = async function ({ event, api, Threads, Users }) {
	const fs = require("fs");
	const path = require("path");
	const iconPath = path.join(__dirname, "cache", "emoji.json");
	const { threadID, logMessageType } = event;
	const logMessageData = (event.logMessageData && typeof event.logMessageData === "object")
		? event.logMessageData
		: {};
	const { setData, getData } = Threads;

	if (!threadID) return;

	const thread = (global.data && global.data.threadData && global.data.threadData.get(threadID)) || {};
	if (typeof thread["adminUpdate"] !== "undefined" && thread["adminUpdate"] == false) return;

	const config = (global.configModule && global.configModule[this.config.name]) || {};
	const sendNoti = config.sendNoti !== false;
	const autoUnsend = config.autoUnsend === true;
	const unsendDelayMs = Number(config.timeToUnsend) > 0 ? Number(config.timeToUnsend) * 1000 : 0;

	function notify(message) {
		if (!sendNoti) return;
		try {
			api.sendMessage(message, threadID, async (error, info) => {
				if (error || !info) return;
				if (!autoUnsend || unsendDelayMs === 0) return;
				try {
					await new Promise((resolve) => setTimeout(resolve, unsendDelayMs));
					api.unsendMessage(info.messageID);
				} catch (unsendError) {
					logger.warn(`adminUpdate: unsend failed for ${threadID}: ${unsendError && unsendError.message ? unsendError.message : unsendError}`);
				}
			});
		} catch (error) {
			logger.warn(`adminUpdate: notify failed for ${threadID}: ${error && error.message ? error.message : error}`);
		}
	}

	function scheduleWrite() {
		if (!dataThread) return;
		const previous = pendingWrites.get(threadID);
		if (previous) clearTimeout(previous);
		const timer = setTimeout(() => {
			pendingWrites.delete(threadID);
			Promise.resolve(setData(threadID, { threadInfo: dataThread })).catch((error) => {
				logger.warn(`adminUpdate: setData failed for ${threadID}: ${error && error.message ? error.message : error}`);
			});
		}, WRITE_DEBOUNCE_MS);
		if (typeof timer.unref === "function") timer.unref();
		pendingWrites.set(threadID, timer);
	}

	let dataThread;
	try {
		const row = await getData(threadID);
		const raw = row && row.threadInfo;
		dataThread = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
	} catch (error) {
		logger.warn(`adminUpdate: could not read thread ${threadID}: ${error && error.message ? error.message : error}`);
		return;
	}

	// Normalise the mutable sub-structures so later `.push`, index assignment,
	// and `.some` calls cannot throw (F-32).
	if (!Array.isArray(dataThread.adminIDs)) dataThread.adminIDs = [];
	if (!dataThread.nicknames || typeof dataThread.nicknames !== "object" || Array.isArray(dataThread.nicknames)) {
		dataThread.nicknames = {};
	}

	try {
		switch (logMessageType) {
			case "log:thread-admins": {
				const target = logMessageData.TARGET_ID != null ? String(logMessageData.TARGET_ID) : null;
				if (!target) break;
				if (logMessageData.ADMIN_EVENT === "add_admin") {
					if (!dataThread.adminIDs.some((item) => String(item && item.id) === target)) {
						dataThread.adminIDs.push({ id: target });
					}
					notify(`»» NOTICE «« Update user ${target} এই নে বলদ তোরে গ্রুপে এড়মিন দিলাম 😁🫵🏾`);
				} else if (logMessageData.ADMIN_EVENT === "remove_admin") {
					dataThread.adminIDs = dataThread.adminIDs.filter((item) => String(item && item.id) !== target);
					notify(`»» NOTICE «« Update user ${target} তুই পাগল ছাগল এড়মিন হওয়ার যোগ্য না \n তাই তোকে এড়মিন থেকে লাথি মেরে নামিয়ে দেওয়া হলো|`);
				} else {
					break;
				}
				logger.audit({
					action: "thread_admin_change",
					actor: event.author != null ? String(event.author) : "unknown",
					target,
					detail: `thread=${threadID} event=${logMessageData.ADMIN_EVENT}`,
				});
				break;
			}

			case "log:thread-icon": {
				let preIcon = {};
				try {
					if (fs.existsSync(iconPath)) {
						const parsed = JSON.parse(fs.readFileSync(iconPath, "utf-8"));
						if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) preIcon = parsed;
					}
				} catch (error) {
					logger.warn(`adminUpdate: emoji.json unreadable: ${error && error.message ? error.message : error}`);
					preIcon = {};
				}
				dataThread.threadIcon = logMessageData.thread_icon || "👍";
				const body = typeof event.logMessageBody === "string"
					? event.logMessageBody.replace("emoji", "icon")
					: "Group icon changed";
				notify(`» [ GROUP UPDATE ] ${body}\n» Original icon: ${preIcon[threadID] || "unknown"}`);
				preIcon[threadID] = dataThread.threadIcon;
				try {
					fs.mkdirSync(path.dirname(iconPath), { recursive: true });
					fs.writeFileSync(iconPath, JSON.stringify(preIcon), { mode: 0o600 });
				} catch (error) {
					logger.warn(`adminUpdate: could not persist emoji.json: ${error && error.message ? error.message : error}`);
				}
				break;
			}

			case "log:thread-call": {
				if (logMessageData.event === "group_call_started") {
					const name = await Users.getNameUser(logMessageData.caller_id);
					notify(`[ GROUP UPDATE ]\n❯ ${name} STARTED A ${(logMessageData.video) ? 'VIDEO ' : ''}CALL.`);
				} else if (logMessageData.event === "group_call_ended") {
					const callDuration = Number(logMessageData.call_duration) || 0;
					const hours = Math.floor(callDuration / 3600);
					const minutes = Math.floor((callDuration - (hours * 3600)) / 60);
					const seconds = callDuration - (hours * 3600) - (minutes * 60);
					const timeFormat = `${hours}:${minutes}:${seconds}`;
					notify(`[ GROUP UPDATE ]\n❯ ${(logMessageData.video) ? 'Video' : ''} call has ended.\n❯ Call duration: ${timeFormat}`);
				} else if (logMessageData.joining_user) {
					const name = await Users.getNameUser(logMessageData.joining_user);
					notify(`❯ [ GROUP UPDATE ]\n❯ ${name} Joined the ${(logMessageData.group_call_type == '1') ? 'Video' : ''} call.`);
				}
				break;
			}

			case "log:thread-color": {
				dataThread.threadColor = logMessageData.thread_color || "🌤";
				const body = typeof event.logMessageBody === "string"
					? event.logMessageBody.replace("Theme", "color")
					: "Group theme changed";
				notify(`» [ GROUP UPDATE ]\n» ${body}`);
				break;
			}

			case "log:user-nickname": {
				const participant = logMessageData.participant_id != null ? String(logMessageData.participant_id) : null;
				if (!participant) break;
				const nickname = logMessageData.nickname != null ? String(logMessageData.nickname) : "";
				dataThread.nicknames[participant] = nickname;

				// Preserve the original intent with explicit grouping: skip the
				// notice when the actor is not an admin, unless it is the bot.
				const nicknameConfig = global.configModule && global.configModule["nickname"];
				const allowChange = nicknameConfig && Array.isArray(nicknameConfig.allowChange)
					? nicknameConfig.allowChange.map(String)
					: [];
				const actorIsAdmin = dataThread.adminIDs.some((item) => String(item && item.id) === String(event.author));
				const actorIsBot = String(event.author) === String(api.getCurrentUserID());
				const skipNotice = (nicknameConfig && !allowChange.includes(String(threadID)) && !actorIsAdmin) && !actorIsBot;
				if (skipNotice) break;

				notify(`»» NOTICE «« Update user nicknames ${participant} to: ${nickname.length === 0 ? "original name" : nickname}`);
				break;
			}

			case "log:thread-name": {
				dataThread.threadName = logMessageData.name || "No name";
				notify(`»» NOTICE «« Update the group name to ${dataThread.threadName}`);
				break;
			}

			default:
				break;
		}

		scheduleWrite();
	} catch (error) {
		logger.error(`adminUpdate: ${logMessageType} failed for ${threadID}: ${error && error.message ? error.message : error}`);
	}
};
