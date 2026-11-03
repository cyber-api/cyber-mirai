const { getAdminInfo } = require("../../utils/adminInfo.js");

module.exports.config = {
    name: "info2",
    version: "1.1.0",
    hasPermssion: 0,
    credits: "Ialamick Chat",
    description: "Admin and Bot info.",
    commandCategory: "info",
    usages: "",
    cooldowns: 5
};

/**
 * Compact owner + bot summary. Identity comes from admin.json, so this command
 * never carries its own hardcoded owner name, avatar or social links.
 */
module.exports.run = async function({ api, event }) {
    const info = getAdminInfo();
    const config = global.config || {};
    const commands = global.client && global.client.commands ? global.client.commands.size : 0;
    const data = global.data || {};

    const uptimeSeconds = global.client && global.client.timeStart
        ? Math.floor((Date.now() - global.client.timeStart) / 1000)
        : 0;
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    const body = `╭──────•◈•──────╮
│  🤖 𝗕𝗢𝗧 𝗜𝗡𝗙𝗢
├──────•◈•──────┤
│ 𝗡𝗮𝗺𝗲      : ${config.BOTNAME || "Bot"}
│ 𝗣𝗿𝗲𝗳𝗶𝘅    : ${config.PREFIX || "!"}
│ 𝗠𝗼𝗱𝘂𝗹𝗲𝘀   : ${commands}
│ 𝗨𝘀𝗲𝗿𝘀     : ${Array.isArray(data.allUserID) ? data.allUserID.length : 0}
│ 𝗚𝗿𝗼𝘂𝗽𝘀    : ${Array.isArray(data.allThreadID) ? data.allThreadID.length : 0}
│ 𝗨𝗽𝘁𝗶𝗺𝗲    : ${hours}h ${minutes}m ${seconds}s
├──────•◈•──────┤
│  👤 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢
├──────•◈•──────┤
│ 𝗡𝗮𝗺𝗲      : ${info.name}
│ 𝗡𝗶𝗰𝗸𝗻𝗮𝗺𝗲  : ${info.nickname || info.name}
│ 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸  : ${info.social.facebook || "Not set"}
│ 𝗧𝗲𝗹𝗲𝗴𝗿𝗮𝗺  : ${info.social.telegram || "Not set"}
│ 𝗧𝗶𝗸𝗧𝗼𝗸   : ${info.social.tiktok || "Not set"}
╰──────•◈•──────╯`;

    return api.sendMessage(body, event.threadID, event.messageID);
};
