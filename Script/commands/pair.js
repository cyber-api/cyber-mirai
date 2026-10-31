const { getFbAppToken } = require("../../utils/credentials.js");
module.exports.config = {
 name: "pair",
 version: "1.0.1",
 hasPermssion: 0,
 credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
 description: "Pair two users with a fun compatibility score",
 commandCategory: "Picture",
 cooldowns: 5,
 dependencies: {
 "axios": "",
 "fs-extra": "",
 "jimp": ""
 }
};

module.exports.onLoad = async () => {
 const { resolve } = global.nodemodule["path"];
 const { existsSync, mkdirSync } = global.nodemodule["fs-extra"];
 const { downloadFile } = global.utils;
 const dirMaterial = __dirname + `/cache/canvas/`;
 const path = resolve(__dirname, 'cache/canvas', 'pairing.png');
 if (!existsSync(dirMaterial + "canvas")) mkdirSync(dirMaterial, { recursive: true });
 if (!existsSync(path)) await downloadFile("https://i.postimg.cc/X7R3CLmb/267378493-3075346446127866-4722502659615516429-n.png", path);
};

async function makeImage({ one, two }) {
 const fs = global.nodemodule["fs-extra"];
 const path = global.nodemodule["path"];
 const axios = global.nodemodule["axios"];
 const jimp = global.nodemodule["jimp"];
 const __root = path.resolve(__dirname, "cache", "canvas");

 let pairing_img = await jimp.read(__root + "/pairing.png");
 let pathImg = __root + `/pairing_${one}_${two}.png`;
 let avatarOne = __root + `/avt_${one}.png`;
 let avatarTwo = __root + `/avt_${two}.png`;

 let getAvatarOne = (await axios.get(`https://graph.facebook.com/${one}/picture?width=512&height=512&access_token=${getFbAppToken()}`, { responseType: 'arraybuffer' })).data;
 fs.writeFileSync(avatarOne, Buffer.from(getAvatarOne, 'utf-8'));

 let getAvatarTwo = (await axios.get(`https://graph.facebook.com/${two}/picture?width=512&height=512&access_token=${getFbAppToken()}`, { responseType: 'arraybuffer' })).data;
 fs.writeFileSync(avatarTwo, Buffer.from(getAvatarTwo, 'utf-8'));

 let circleOne = await jimp.read(await circle(avatarOne));
 let circleTwo = await jimp.read(await circle(avatarTwo));
 pairing_img.composite(circleOne.resize(150, 150), 980, 200).composite(circleTwo.resize(150, 150), 140, 200);

 let raw = await pairing_img.getBufferAsync("image/png");

 fs.writeFileSync(pathImg, raw);
 fs.unlinkSync(avatarOne);
 fs.unlinkSync(avatarTwo);

 return pathImg;
}

async function circle(image) {
 const jimp = require("jimp");
 image = await jimp.read(image);
 image.circle();
 return await image.getBufferAsync("image/png");
}

module.exports.run = async function ({ api, event }) {
 const axios = require("axios");
 const fs = require("fs-extra");
 const { threadID, messageID, senderID } = event;

 // Match percentage
 const percentages = ['21%', '67%', '19%', '37%', '17%', '96%', '52%', '62%', '76%', '83%', '100%', '99%', '0%', '48%'];
 const matchRate = percentages[Math.floor(Math.random() * percentages.length)];

 // Sender info
 let senderInfo = await api.getUserInfo(senderID);
 let senderName = senderInfo[senderID].name;

 // Random partner
 let threadInfo = await api.getThreadInfo(threadID);
 let participants = threadInfo.participantIDs.filter(id => id !== senderID);
 let partnerID = participants[Math.floor(Math.random() * participants.length)];
 let partnerInfo = await api.getUserInfo(partnerID);
 let partnerName = partnerInfo[partnerID].name;

 // Mentions
 let mentions = [
 { id: senderID, tag: senderName },
 { id: partnerID, tag: partnerName }
 ];

 // Generate and send image
 let one = senderID, two = partnerID;
 return makeImage({ one, two }).then(path => {
 api.sendMessage({
 body: `🥰 Successful Pairing!\n💌 Wishing you two a lifetime of unexpected happiness – even with a ${matchRate} match!\n💕 Compatibility Score: ${matchRate}\nUnlikely but Unstoppable: [${senderName} + ${partnerName}]👨‍❤️‍👨`,
 mentions,
 attachment: fs.createReadStream(path)
 }, threadID, () => fs.unlinkSync(path), messageID);
 });
};
