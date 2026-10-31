const num = 10; // prefixed messages within `timee` seconds before a ban
const timee = 120;

module.exports.config = {
  name: "spamban",
  version: "2.1.0",
  hasPermssion: 0,
  credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
  description: `automatically ban users if spam bots ${num} time/${timee}s`,
  commandCategory: "System",
  usages: "x",
  cooldowns: 5
};

const logger = require("../../utils/log.js");

module.exports.run = async function ({ api, event, args, Threads }) {
  const action = String(args[0] || "").toLowerCase();
  const sender = String(event.senderID || "");
  const isBotAdmin = (global.config.ADMINBOT || []).map(String).includes(sender)
    || (global.config.NDH || []).map(String).includes(sender);

  if ((action === "on" || action === "off") && isBotAdmin) {
    const threadData = await Threads.getData(event.threadID);
    const data = (threadData && threadData.data) || {};
    data.spamBan = action === "on";
    await Threads.setData(event.threadID, { data });
    global.data.threadData.set(String(event.threadID), data);
    logger.audit({ action: "spamban_toggle", actor: sender, target: String(event.threadID), result: action });
    return api.sendMessage(`Spam-ban ${action === "on" ? "ON" : "OFF"} for this thread.`, event.threadID, event.messageID);
  }

  return api.sendMessage(
    `Automatically ban users after ${num} prefixed messages in ${timee}s (bot admins can use "spamban on/off").`,
    event.threadID,
    event.messageID
  );
};

module.exports.handleEvent = async function ({ Users, Threads, api, event }) {
  const { senderID, threadID } = event;

  // Per-thread opt-in only, matching ST-BOT's moderation model.
  const settings = global.config.spamBan || {};

  let threadData;
  try { threadData = await Threads.getData(event.threadID); } catch (error) { return; }
  const data = (threadData && threadData.data) || {};
  if (data.spamBan !== true) return;

  // Never auto-ban the bot, its admins/owners, or group admins.
  const sender = String(senderID);
  const botID = String(api.getCurrentUserID());
  if (sender === botID) return;
  const exempt = new Set([
    ...((global.config.ADMINBOT || []).map(String)),
    ...((global.config.NDH || []).map(String)),
  ]);
  if (exempt.has(sender)) return;
  try {
    const info = await api.getThreadInfo(threadID);
    const admins = ((info && info.adminIDs) || []).map((item) => String(item.id));
    if (admins.includes(sender)) return;
  } catch (error) { /* continue with the remaining checks */ }

  const threadSetting = global.data.threadData.get(threadID) || {};
  const prefix = threadSetting.PREFIX || global.config.PREFIX;
  if (!event.body || !prefix || event.body.indexOf(prefix) !== 0) return;

  if (!global.client.autoban) global.client.autoban = {};
  if (!global.client.autoban[sender]) {
    global.client.autoban[sender] = { timeStart: Date.now(), number: 0 };
  }

  const record = global.client.autoban[sender];
  if (record.timeStart + (timee * 1000) <= Date.now()) {
    record.timeStart = Date.now();
    record.number = 0;
    return;
  }

  record.number += 1;
  if (record.number < num) return;

  let dataUser = null;
  try { dataUser = await Users.getData(sender); } catch (error) { dataUser = null; }
  const userData = (dataUser && dataUser.data) || {};
  if (userData.banned === true || userData.banned === 1) return;

  const moment = require("moment-timezone");
  const timeDate = moment.tz("Asia/Dhaka").format("DD/MM/YYYY HH:mm:ss");
  userData.banned = true;
  userData.reason = `spam bot ${num} time/${timee}s`;
  userData.dateAdded = timeDate;

  await Users.setData(sender, { data: userData });
  global.data.userBanned.set(sender, { reason: userData.reason, dateAdded: userData.dateAdded });
  global.client.autoban[sender] = { timeStart: Date.now(), number: 0 };

  logger.audit({ action: "spamban", actor: "system", target: sender, detail: `thread=${threadID}`, result: "banned" });

  const displayName = (dataUser && dataUser.name) || sender;
  api.sendMessage(
    `😻 ID: ${sender}\n😻 Name: ${displayName}\n😻 Reason: spam bot ${num} time/${timee}s\n\n✔️ Reported to the bot admins`,
    threadID,
    () => {
      for (const adminId of (global.config.ADMINBOT || [])) {
        api.sendMessage(
          `😻 Spam offender ${num} time/${timee}s\n😻 Name: ${displayName}\n😻 ID: ${sender}\n😻 Thread: ${threadID}\n😻 At: ${timeDate}`,
          adminId
        );
      }
    }
  );
};
