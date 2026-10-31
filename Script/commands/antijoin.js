module.exports.config = {
    name: "antijoin",
    version: "1.1.0",
    credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
    hasPermssion: 2,
    description: "Toggle anti-join for this thread (bot-admin only)",
    usages: "antijoin on/off",
    commandCategory: "system",
    cooldowns: 5
};

const logger = require("../../utils/log.js");

module.exports.run = async ({ api, event, Threads }) => {
    const info = await api.getThreadInfo(event.threadID);
    const adminIDs = (info && info.adminIDs) || [];
    if (!adminIDs.some(item => String(item.id) === String(api.getCurrentUserID()))) {
        return api.sendMessage(
            "[ ANTI-JOIN ] Need group admin permissions; add the bot as a group admin and try again.",
            event.threadID,
            event.messageID
        );
    }

    const threadData = await Threads.getData(event.threadID);
    const data = (threadData && threadData.data) || {};
    data.newMember = data.newMember === true ? false : true;
    // Explicit per-thread allow-list storage (user IDs added by operators).
    if (!Array.isArray(data.antijoinAllowList)) data.antijoinAllowList = [];

    await Threads.setData(event.threadID, { data });
    global.data.threadData.set(String(event.threadID), data);

    logger.audit({
        action: "antijoin_toggle",
        actor: String(event.senderID),
        target: String(event.threadID),
        result: data.newMember ? "on" : "off"
    });

    return api.sendMessage(
        `[ ANTI-JOIN ] ${data.newMember ? "ON" : "OFF"} for this thread.`,
        event.threadID,
        event.messageID
    );
};
