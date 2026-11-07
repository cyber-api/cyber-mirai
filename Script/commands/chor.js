const { getFbAppToken } = require("../../utils/credentials.js");
module.exports.config = {
	name: "chor",
	version: "1.0.1",
	hasPermssion: 0,
	credits: "Joshua Sy",
	description: "scooby doo template memes",
	commandCategory: "Picture",
	usages: "...",
	cooldowns: 5,
	dependencies: {
	 "fs-extra": "",
	 "axios": "",
	 "canvas" :"",
	 "jimp": "",
	 "node-superfetch": ""
	}
};

module.exports.circle = async (image) => {
	 const jimp = global.nodemodule['jimp'];
 	image = await jimp.read(image);
 	image.circle();
 	return await image.getBufferAsync("image/png");
};

module.exports.run = async ({ event, api, args, Users }) => {
try {
 const Canvas = global.nodemodule['canvas'];
 const request = global.nodemodule["node-superfetch"];
 const jimp = global.nodemodule["jimp"];
 const fs = global.nodemodule["fs-extra"];
 var path_toilet = __dirname+'/cache/damma.jpg'; 
 var id = Object.keys(event.mentions)[0] || event.senderID;
 const canvas = Canvas.createCanvas(500, 670);
	const ctx = canvas.getContext('2d');
	const background = await Canvas.loadImage('https://files.catbox.moe/0kdthb.png');
 
	var avatar = await request.get(`https://graph.facebook.com/${id}/picture?width=512&height=512&access_token=${getFbAppToken()}`);
	avatar = await this.circle(avatar.body);
	ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
	ctx.drawImage(await Canvas.loadImage(avatar), 48, 410, 111, 111);
	const imageBuffer = canvas.toBuffer();
	fs.writeFileSync(path_toilet,imageBuffer);
	 api.sendMessage({attachment: fs.createReadStream(path_toilet, {'highWaterMark': 128 * 1024}), body: "╭──────•◈•───────╮\n 𝗜𝘀𝗹𝗮𝗺𝗶𝗰𝗸 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁 \n\nমুরগির দুধ চুরি করতে গিয়া ধরা থাইসে_ 🐸👻\n\n BOT OWNER Mahbub-Shaon ッ\n╰──────•◈•───────╯"}, event.threadID, () => fs.unlinkSync(path_toilet), event.messageID);
}
catch(e) {api.sendMessage(e.stack, event.threadID )}
 }