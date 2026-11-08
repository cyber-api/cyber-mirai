const { getAdminStatus } = require("../../utils/adminAuth.js");

module.exports.config = {
  name: "whoami",
  version: "1.1.0",
  hasPermssion: 0,
  credits: "CYBER BOT TEAM",
  description: "Debug: show your senderID, effective admin status and the config keys read",
  commandCategory: "system",
  usages: "",
  cooldowns: 2
};

module.exports.run = async ({ api, event }) => {
  const status = getAdminStatus(event.senderID, global.config);

  const lines = [
    "=== WHOAMI ===",
    `senderID: ${status.senderID || "(missing)"}`,
    `isAdmin: ${status.isAdmin}`,
    `isOwner: ${status.isOwner}`,
    `matched: ${status.matched.join(", ")}`,
    `config keys: adminBot(${status.keys.adminBot}) ndh(${status.keys.ndh})`,
    `effective lists: adminBot=${status.lists.adminBot}, ndh=${status.lists.ndh}`,
    `threadID: ${event.threadID}`
  ];

  return api.sendMessage(lines.join("\n"), event.threadID, event.messageID);
};
