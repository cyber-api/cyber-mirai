const { getFbAppToken } = require("../../utils/credentials.js");
const { getAdminInfo } = require("../../utils/adminInfo.js");
const axios = require("../../utils/httpClient");
const request = require("request");
const fs = require("fs-extra");
const moment = require("moment-timezone");

module.exports.config = {
    name: "admin",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "MAHBUB-SHAON", //don't change my credit,
    description: "Show Owner Info",
    commandCategory: "info",
    usages: "",
    cooldowns: 5
};

module.exports.run = async function({ api, event }) {
    var time = moment().tz("Asia/Dhaka").format("DD/MM/YYYY hh:mm:ss A");
    const info = getAdminInfo();

    var callback = () => api.sendMessage({
        body: `
┏━━━━━━━━━━━━━━━━━━━━━┓
┃      🌟 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢 🌟      
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 👤 𝐍𝐚𝐦𝐞      : ${info.name || "𝐮 𝐥 𝐥 𝐚 𝐬 𝐡 ッ"}
┃ 🚹 𝐆𝐞𝐧𝐝𝐞𝐫    : ${info.gender || "𝐌𝐚𝐥𝐞"}
┃ ❤️ 𝐑𝐞𝐥𝐚𝐭𝐢𝐨𝐧  : ${info.relationship || "𝐈𝐧 𝐂𝐨𝐦𝐩𝐥𝐢𝐜𝐚𝐭𝐞𝐝"}
┃ 🎂 𝐀𝐠𝐞       : ${info.age || "21"}
┃ 🕌 𝐑𝐞𝐥𝐢𝐠𝐢𝐨𝐧  : ${info.religion || "𝐈𝐬𝐥𝐚𝐦"}
┃ 🏫 𝐄𝐝𝐮𝐜𝐚𝐭𝐢𝐨𝐧 : ${info.education || "𝐝𝐢𝐩𝐥𝐨𝐦𝐚 𝐢𝐧 𝐀𝐠𝐫𝐢𝐜𝐮𝐥𝐭𝐮𝐫𝐞"}
┃ 🏡 𝐀𝐝𝐝𝐫𝐞𝐬𝐬  : ${info.address || "𝐍𝐨𝐚𝐤𝐡𝐚𝐥𝐢, 𝐁𝐚𝐧𝐠𝐥𝐚𝐝𝐞𝐬𝐡"}
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🎭 𝐓𝐢𝐤𝐭𝐨𝐤  : ${info.social.tiktok || "mahbub01"}
┃ 📢 𝐓𝐞𝐥𝐞𝐠𝐫𝐚𝐦 : ${info.social.telegram || "https://t.me/The_morning_star71"}
┃ 🌐 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 : ${info.social.facebook || "https://www.facebook.com/profile.php?id=100015168369582"}
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🕒 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 𝐓𝐢𝐦𝐞:  ${time}
┗━━━━━━━━━━━━━━━━━━━━━┛
        `,
        attachment: fs.createReadStream(__dirname + "/cache/1.png")
    }, event.threadID, () => fs.unlinkSync(__dirname + "/cache/1.png"));

    const avatar = info.avatar.url
        || ((info.avatar.uid || "100000478146113") ? `https://graph.facebook.com/${info.avatar.uid || "100000478146113"}/picture?height=720&width=720&access_token=${getFbAppToken()}` : "");
    if (!avatar) {
        return api.sendMessage({ body: `🌟 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢 🌟\n👤 ${info.name || "𝐮 𝐥 𝐥 𝐚 𝐬 𝐡 ッ"}\n🌐 ${info.social.facebook || "https://www.facebook.com/profile.php?id=100015168369582"}\n🕒 ${time}` }, event.threadID);
    }

    return request(encodeURI(avatar))
        .pipe(fs.createWriteStream(__dirname + '/cache/1.png'))
        .on('close', () => callback());
};
