const { getFbAppToken } = require("../../utils/credentials.js");
const { getAdminInfo } = require("../../utils/adminInfo.js");
const axios = require("axios");
const request = require("request");
const fs = require("fs-extra");
const moment = require("moment-timezone");

module.exports.config = {
    name: "admin",
    version: "1.0.0",
    hasPermssion: 0,
    credits: getAdminInfo().name,
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
┃ 👤 𝐍𝐚𝐦𝐞      : ${info.name}
┃ 🚹 𝐆𝐞𝐧𝐝𝐞𝐫    : ${info.gender || "Not set"}
┃ ❤️ 𝐑𝐞𝐥𝐚𝐭𝐢𝐨𝐧  : ${info.relationship || "Not set"}
┃ 🎂 𝐀𝐠𝐞       : ${info.age || "Not set"}
┃ 🕌 𝐑𝐞𝐥𝐢𝐠𝐢𝐨𝐧  : ${info.religion || "Not set"}
┃ 🏫 𝐄𝐝𝐮𝐜𝐚𝐭𝐢𝐨𝐧 : ${info.education || "Not set"}
┃ 🏡 𝐀𝐝𝐝𝐫𝐞𝐬𝐬  : ${info.address || "Not set"}
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🎭 𝐓𝐢𝐤𝐭𝐨𝐤  : ${info.social.tiktok || "Not set"}
┃ 📢 𝐓𝐞𝐥𝐞𝐠𝐫𝐚𝐦 : ${info.social.telegram || "Not set"}
┃ 🌐 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 : ${info.social.facebook || "Not set"}
┣━━━━━━━━━━━━━━━━━━━━━┫
┃ 🕒 𝐔𝐩𝐝𝐚𝐭𝐞𝐝 𝐓𝐢𝐦𝐞:  ${time}
┗━━━━━━━━━━━━━━━━━━━━━┛
        `,
        attachment: fs.createReadStream(__dirname + "/cache/1.png")
    }, event.threadID, () => fs.unlinkSync(__dirname + "/cache/1.png"));

    const avatar = info.avatar.url
        || (info.avatar.uid ? `https://graph.facebook.com/${info.avatar.uid}/picture?height=720&width=720&access_token=${getFbAppToken()}` : "");
    if (!avatar) {
        return api.sendMessage({ body: `🌟 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢 🌟\n👤 ${info.name}\n🌐 ${info.social.facebook || "Not set"}\n🕒 ${time}` }, event.threadID);
    }

    return request(encodeURI(avatar))
        .pipe(fs.createWriteStream(__dirname + '/cache/1.png'))
        .on('close', () => callback());
};
