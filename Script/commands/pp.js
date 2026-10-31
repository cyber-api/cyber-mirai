const { getFbAppToken } = require("../../utils/credentials.js");
module.exports.config = {
 name: "pp",
 version: "1.0.0",
 hasPermssion: 0,
 credits: "NAZRUL (fixed by ChatGPT)",
 description: "Get user profile picture",
 commandCategory: "Tools",
 cooldowns: 0
};

module.exports.run = async function({ event, api, args, Users }) {
 const fs = require("fs-extra");
 const axios = require("axios");

 const path = __dirname + "/cache/1.png";

 async function downloadAndSend(uid, bodyText = "==profile==━") {
 try {
 const url = `https://graph.facebook.com/${uid}/picture?height=1500&width=1500&access_token=${getFbAppToken()}`;

 const response = await axios({
 url,
 method: "GET",
 responseType: "stream"
 });

 const writer = fs.createWriteStream(path);
 response.data.pipe(writer);

 writer.on("finish", () => {
 api.sendMessage(
 {
 body: bodyText,
 attachment: fs.createReadStream(path)
 },
 event.threadID,
 () => fs.unlinkSync(path),
 event.messageID
 );
 });

 } catch (err) {
 api.sendMessage("❌ Error while fetching profile picture!", event.threadID, event.messageID);
 console.error(err);
 }
 }

 // 👉 reply case
 if (event.type === "message_reply") {
 return downloadAndSend(event.messageReply.senderID);
 }

 // 👉 no args = self
 if (!args[0]) {
 return downloadAndSend(event.senderID);
 }

 // 👉 facebook link
 if (args[0].includes(".com/")) {
 try {
 const uid = await api.getUID(args[0]);
 return downloadAndSend(uid, "=== profile ===");
 } catch {
 return api.sendMessage("❌ Invalid Facebook link!", event.threadID, event.messageID);
 }
 }

 // 👉 mention
 if (Object.keys(event.mentions).length > 0) {
 const uid = Object.keys(event.mentions)[0];
 return downloadAndSend(uid, "=== profile ===");
 }

 // 👉 fallback
 return api.sendMessage("❌ Invalid input!", event.threadID, event.messageID);
};