module.exports.config = {
    name: "antiout",
    version: "1.1.0",
    credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
    hasPermssion: 2,
    description: "Toggle anti-out for this thread (bot-admin only)",
    usages: "antiout on/off",
    commandCategory: "system",
    cooldowns: 5
};

const logger = require("../../utils/log.js");

module.exports.run = async ({ api, event, Threads }) => {
    const threadData = await Threads.getData(event.threadID);
    const data = (threadData && threadData.data) || {};
    data.antiout = data.antiout === true ? false : true;
    if (!Array.isArray(data.antioutAllowList)) data.antioutAllowList = [];

    await Threads.setData(event.threadID, { data });
    global.data.threadData.set(String(event.threadID), data);

    logger.audit({
        action: "antiout_toggle",
        actor: String(event.senderID),
        target: String(event.threadID),
        result: data.antiout ? "on" : "off"
    });

    return api.sendMessage(
        `✅ Anti-out ${data.antiout ? "ON" : "OFF"} for this thread.`,
        event.threadID,
        event.messageID
    );
};
