const { getAdminInfo } = require("../../utils/adminInfo.js");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

// TODO: replace mahbub-shaon with your real GitHub handle and ship the API
// config file at this path (the previous API URL is dead).
const API_CONFIG_URL = "https://raw.githubusercontent.com/mahbub-shaon/cyber-mirai/refs/heads/main/Mahbub-ShaonApi.json";

const getApiUrl = async () => {
    try {
        const response = await axios.get(API_CONFIG_URL);
        const albumUrl = response.data.album;
        if (!albumUrl) {
            throw new Error("Album API URL not found in the JSON data.");
        }
        return albumUrl;
    } catch (error) {
        console.error("API URL :", error);
        throw new Error("API URL");
    }
};

module.exports.config = {
 name: "album",
 version: "1.0.1",
 hasPermssion: 0,
 credits: getAdminInfo().name,
 description: "Manage and view video/photo albums",
 usePrefix: true,
 prefix: true,
 category: "Media",
 commandCategory: "Media",
 usages: "Empty to see list, or album [category] to get media.",
 cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
 const { threadID, messageID, senderID } = event;

 const albumOptionsPage1 = [
 "funny", "islamic", "sad", "anime", "cartoon",
 "love", "horny", "couple", "flower", "marvel"
 ];
 const albumOptionsPage2 = [
 "aesthetic", "sigma", "lyrics", "cat", "18plus",
 "freefire", "football", "girl", "friends", "cricket"
 ];

 const toBold = (text) => text.replace(/[a-z]/g, (c) => String.fromCodePoint(0x1d41a + c.charCodeAt(0) - 97));
 const toBoldNumber = (num) => String(num).replace(/[0-9]/g, (c) => String.fromCodePoint(0x1d7ec + parseInt(c)));

 const formatOptions = (options, startIndex = 1) =>
 options.map((opt, i) => `✨ | ${toBoldNumber(i + startIndex)}. ${toBold(opt)}`).join("\n");

 if (args[0] === "2") {
 const message2 =
 "💫 𝐂𝐡𝐨𝐨𝐬𝐞 𝐚𝐧 𝐚𝐥𝐛𝐮𝐦 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲 𝐁𝐚𝐛𝐲 💫\n" +
 "✺━━━━━━━◈◉◈━━━━━━━✺\n" +
 formatOptions(albumOptionsPage2, 11) +
 "\n✺━━━━━━━◈◉◈━━━━━━━✺\n🎯 | 𝐏𝐚𝐠𝐞 [𝟐/𝟐]\n✺━━━━━━━◈◉◈━━━━━━━✺";

 await api.sendMessage(
 { body: message2 },
 threadID,
 (error, info) => {
 if (!error) {
 global.client.handleReply.push({
 name: this.config.name,
 type: "reply",
 messageID: info.messageID,
 author: senderID,
 link: albumOptionsPage2,
 });
 }
 },
 messageID
 );
 return;
 }

 if (!args[0] || args[0].toLowerCase() === "list") {
 api.setMessageReaction("☢️", messageID, () => {}, true);

 const message =
 "💫 𝐂𝐡𝐨𝐨𝐬𝐞 𝐚𝐧 𝐚𝐥𝐛𝐮𝐦 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲 𝐁𝐚𝐛𝐲 💫\n" +
 "✺━━━━━━━◈◉◈━━━━━━━✺\n" +
 formatOptions(albumOptionsPage1) +
 `\n✺━━━━━━━◈◉◈━━━━━━━✺\n🎯 | 𝐏𝐚𝐠𝐞 [𝟏/𝟐]\nℹ | 𝐓𝐲𝐩𝐞: ${global.config.PREFIX}album 2 - 𝐧𝐞𝐱𝐭 𝐩𝐚𝐠𝐞\n✺━━━━━━━◈◉◈━━━━━━━✺`;

 await api.sendMessage(
 { body: message },
 threadID,
 (error, info) => {
 if (!error) {
 global.client.handleReply.push({
 name: this.config.name,
 type: "reply",
 messageID: info.messageID,
 author: senderID,
 link: albumOptionsPage1,
 });
 }
 },
 messageID
 );
 return;
 }

 const validCategories = [
 "cartoon", "marvel", "lofi", "sad", "islamic", "funny",
 "horny", "anime", "love", "baby", "lyrics", "sigma",
 "aesthetic", "cat", "flower", "freefire", "sex", "girl",
 "football", "friend", "cricket", "couple", "18plus", "freefire"
 ];

 const command = args[0].toLowerCase();

 if (!validCategories.includes(command)) {
 return api.sendMessage(
 "❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲! 𝐓𝐲𝐩𝐞 '/album' 𝐭𝐨 𝐬𝐞𝐞 𝐥𝐢𝐬𝐭.",
 threadID,
 messageID
 );
 }

 return api.sendMessage(
 `📁 𝐋𝐨𝐚𝐝𝐢𝐧𝐠 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲: 𝐚𝐥𝐛𝐮𝐦 - ${command}...`,
 threadID,
 messageID
 );
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
 api.unsendMessage(handleReply.messageID);

 const isBotAdmin = (global.config.ADMINBOT || []).concat(global.config.NDH || []).map(String).includes(String(event.senderID));
 const replyNum = parseInt(event.body);
 if (isNaN(replyNum)) {
 return api.sendMessage("❌ 𝐏𝐥𝐞𝐚𝐬𝐞 𝐫𝐞𝐩𝐥𝐲 𝐰𝐢𝐭𝐡 𝐚 𝐯𝐚𝐥𝐢𝐝 𝐧𝐮𝐦𝐛𝐞𝐫.", event.threadID, event.messageID);
 }

 const categories = [
 "funny", "islamic", "sad", "anime", "cartoon",
 "love", "horny", "couple", "flower", "marvel",
 "aesthetic", "sigma", "lyrics", "cat", "18plus",
 "freefire", "football", "girl", "friend", "cricket"
 ];

 if (replyNum < 1 || replyNum > categories.length) {
 return api.sendMessage("❌ 𝐈𝐧𝐯𝐚𝐥𝐢𝐝 𝐬𝐞𝐥𝐞𝐜𝐭𝐢𝐨𝐧.", event.threadID, event.messageID);
 }

 const selectedCategory = categories[replyNum - 1];

 if (
 (selectedCategory === "horny" || selectedCategory === "18plus") &&
 !isBotAdmin
 ) {
 return api.sendMessage("🚫 𝐘𝐨𝐮 𝐚𝐫𝐞 𝐧𝐨𝐭 𝐚𝐮𝐭𝐡𝐨𝐫𝐢𝐳𝐞𝐝 𝐟𝐨𝐫 𝐭𝐡𝐢𝐬 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲.", event.threadID, event.messageID);
 }

 const captions = {
 funny: "🤣 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐅𝐮𝐧𝐧𝐲 𝐯𝐢𝐝𝐞𝐨",
 islamic: "😇 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐈𝐬𝐥𝐚𝐦𝐢𝐜 𝐯𝐢𝐝𝐞𝐨",
 sad: "🥺 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐒𝐚𝐝 𝐯𝐢𝐝𝐞𝐨",
 anime: "😘 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐀𝐧𝐢𝐦𝐞 𝐯𝐢𝐝𝐞𝐨",
 cartoon: "😇 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐂𝐚𝐫𝐭𝐨𝐨𝐧 𝐯𝐢𝐝𝐞𝐨",
 love: "😇 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐋𝐨𝐯𝐞 𝐯𝐢𝐝𝐞𝐨",
 horny: "🥵 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐇𝐨𝐫𝐧𝐲 𝐯𝐢𝐝𝐞𝐨",
 couple: "❤️ > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐂𝐨𝐮𝐩𝐥𝐞 𝐯𝐢𝐝𝐞𝐨",
 flower: "🌸 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐅𝐥𝐨𝐰𝐞𝐫 𝐯𝐢𝐝𝐞𝐨",
 marvel: "🎯 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐌𝐚𝐫𝐯𝐞𝐥 𝐯𝐢𝐝𝐞𝐨",
 aesthetic: "🎀 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐀𝐞𝐬𝐭𝐡𝐞𝐭𝐢𝐜 𝐯𝐢𝐝𝐞𝐨",
 sigma: "🐤 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐒𝐢𝐠𝐦𝐚 𝐯𝐢𝐝𝐞𝐨",
 lyrics: "🥰 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐋𝐲𝐫𝐢𝐜𝐬 𝐯𝐢𝐝𝐞𝐨",
 cat: "🐱 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐂𝐚𝐭 𝐯𝐢𝐝𝐞𝐨",
 "18plus": "🔞 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝟏𝟖+ 𝐯𝐢𝐝𝐞𝐨",
 freefire: "🎮 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐅𝐫𝐞𝐞𝐟𝐢𝐫𝐞 𝐯𝐢𝐝𝐞𝐨",
 football: "⚽ > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐅𝐨𝐨𝐭𝐛𝐚𝐥𝐥 𝐯𝐢𝐝𝐞𝐨",
 girl: "👧 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐆𝐢𝐫𝐥 𝐯𝐢𝐝𝐞𝐨",
 friend: "👫 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐅𝐫𝐢𝐞𝐧𝐝𝐬 𝐯𝐢𝐝𝐞𝐨",
 cricket: "🏏 > 𝐍𝐚𝐰 𝐁𝐚𝐛𝐲 𝐂𝐫𝐢𝐜𝐤𝐞𝐭 𝐯𝐢𝐝𝐞𝐨"
 };

 try {
 const BASE_API_URL = await getApiUrl();
 const res = await axios.get(`${BASE_API_URL}/album?type=${selectedCategory}`);
 const mediaUrl = res.data.data;

 if (!mediaUrl) {
 return api.sendMessage("⚠️ 𝐍𝐨 𝐜𝐨𝐧𝐭𝐞𝐧𝐭 𝐟𝐨𝐮𝐧𝐝 𝐢𝐧 𝐭𝐡𝐢𝐬 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲.", event.threadID, event.messageID);
 }

 const response = await axios({
 method: 'get',
 url: mediaUrl,
 responseType: 'stream'
 });

 const filename = path.basename(mediaUrl).split("?")[0];
 const filePath = path.join(__dirname, "cache", `${Date.now()}_${filename}`);
 const writer = fs.createWriteStream(filePath);

 response.data.pipe(writer);

 writer.on('finish', () => {
 api.sendMessage({
 body: captions[selectedCategory] || `🎬 𝐍𝐨𝐰 𝐁𝐚𝐛𝐲 ${selectedCategory} 𝐜𝐨𝐧𝐭𝐞𝐧𝐭`,
 attachment: fs.createReadStream(filePath)
 }, event.threadID, () => fs.unlinkSync(filePath), event.messageID);
 });

 writer.on('error', (err) => {
 console.error("Write Error:", err);
 api.sendMessage("❌ 𝐅𝐚𝐢𝐥𝐞𝐝 𝐭𝐨 𝐬𝐞𝐧𝐝 𝐯𝐢𝐝𝐞𝐨.", event.threadID, event.messageID);
 });

 } catch (err) {
 console.error("Axios Error:", err.message);
 return api.sendMessage("❌ 𝐒𝐨𝐦𝐞𝐭𝐡𝐢𝐧𝐠 𝐰𝐞𝐧𝐭 𝐰𝐫𝐨𝐧𝐠. 𝐓𝐫𝐲 𝐚𝐠𝐚𝐢𝐧!", event.threadID, event.messageID);
 }
};
