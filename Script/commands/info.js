/**
 * @author Owner (see admin.json)
 * @warn Do not edit code or edit credits
 */

const { getAdminInfo } = require("../../utils/adminInfo.js");

module.exports.config = {
 name: "info",
 version: "1.2.6",
 hasPermssion: 0,
 credits: "Shaon Ahmed",
 description: "🥰আসসালামু আলাইকুম 🥰",
 commandCategory: "For users",
 hide:true,
 usages: "",
 cooldowns: 5,
};


module.exports.run = async function ({ api, event, args, Users, permssion, getText ,Threads}) {
 const content = args.slice(1, args.length);
 const { threadID, messageID, mentions } = event;
 const { configPath } = global.client;
 const { ADMINBOT } = global.config;
 const { NDH } = global.config;
 const { userName } = global.data;
 const request = global.nodemodule["request"];
 const fs = global.nodemodule["fs-extra"];
 const { writeFileSync } = global.nodemodule["fs-extra"];
 const mention = Object.keys(mentions);
 delete require.cache[require.resolve(configPath)];
 var config = require(configPath);
 const listAdmin = ADMINBOT || config.ADMINBOT || [];
 const listNDH = NDH || config.NDH || [];
 {
 const PREFIX = config.PREFIX;
 const namebot = config.BOTNAME;
 const { commands } = global.client;
 const threadSetting = (await Threads.getData(String(event.threadID))).data || 
 {};
 const prefix = (threadSetting.hasOwnProperty("PREFIX")) ? threadSetting.PREFIX 
 : global.config.PREFIX;
 const dateNow = Date.now();
 const time = process.uptime(),
 hours = Math.floor(time / (60 * 60)),
 minutes = Math.floor((time % (60 * 60)) / 60),
 seconds = Math.floor(time % 60);
 const data = [
 "Bạn không thể tìm được lệnh admin tại 'help' của MintBot",
 "Đừng mong chờ gì từ MintBot.",
 "Cái đoạn này á? Của SpermBot.",
 "Nếu muốn không lỗi lệnh thì hãy xài những lệnh có trong help vì những lệnh lỗi đã bị ẩn rồi.",
 "Đây là một con bot được các coder của MiraiProject nhúng tay vào.",
 "Muốn biết sinh nhật của Mint thì hãy xài 'birthday'.",
 "Cặc.",
 "Cút.",
 "Lồn.",
 "Bạn chưa biết.",
 "Bạn đã biết.",
 "Bạn sẽ biết.",
 "Không có gì là hoàn hảo, MintBot là ví dụ.",
 "Mirai dropped.",
 "MintBot là MiraiProject nhưng module là idea của SpermBot.",
 "Bạn không biết cách sử dụng MintBot? Đừng dùng nữa.",
 "Muốn chơi game? Qua bot khác mà chơi đây không rảnh",
 "MintBot có thể hiểu phụ nữ nhưng không thể có được họ.",
 "MintBot cân spam nhưng không có gì đáng để bạn spam."
 ];
 var link = [
 "https://i.postimg.cc/QdgH08j6/Messenger-creation-C2-A39-DCF-A8-E7-4-FC7-8715-2559476-FEEF4.gif",
 "https://files.catbox.moe/utby7g.jpeg",
 "https://i.postimg.cc/QdgH08j6/Messenger-creation-C2-A39-DCF-A8-E7-4-FC7-8715-2559476-FEEF4.gif",
 "https://files.catbox.moe/utby7g.jpeg",
 "https://files.catbox.moe/utby7g.jpeg",

 ]; 
 var i = 1;
 var msg = [];
 const moment = require("moment-timezone");
 const date = moment.tz("Asia/Dhaka").format("hh:mm:ss");
 for (const idAdmin of listAdmin) {
 if (parseInt(idAdmin)) {
 const name = await Users.getNameUser(idAdmin);
 msg.push(`${i++}/ ${name} - ${idAdmin}`);
 }
 }
 var msg1 = [];
 for (const idNDH of listNDH) {
 if (parseInt(idNDH)) {
 const name1 = (await Users.getData(idNDH)).name
 msg1.push(`${i++}/ ${name1} - ${idNDH}`);
 }
 }
 var callback = () => 
 api.sendMessage({ body: 
 `🍀----আসসালামু আলাইকুম----🍀

┏━━•❅•••❈•••❈•••❅•━━┓\n\n「 ${namebot} 」\n\n┗━━•❅•••❈•••❈•••❅•━━┛ \n\n______________________________\n\n↓↓_𝗥𝗢𝗕𝗢𝗧 𝗦𝗬𝗦𝗧𝗘𝗠 𝗜𝗡𝗙𝗢_↓↓\n\n» 𝗣𝗿𝗲𝗳𝗶𝘅 𝘀𝘆𝘀𝘁𝗲𝗺: ${PREFIX}\n\n» 𝗣𝗿𝗲𝗳𝗶𝘅 𝗯𝗼𝘅: ${prefix}\n\n» 𝗧𝗼𝘁𝗮𝗹 𝗠𝗼𝗱𝘂𝗹𝗲𝘀: ${commands.size}\n\n» 𝗣𝗶𝗻𝗴: ${Date.now() - dateNow}ms\n______________________________\n\n ↓↓_𝗥𝗢𝗕𝗢𝗧 𝗢𝗪𝗡𝗘𝗥 𝗜𝗡𝗙𝗢_↓↓\n\n 
𝗡𝗔𝗠𝗘 :>${getAdminInfo().name || "MAHBUB-SHAON"}

𝗢𝘄𝗻𝗲𝗿 𝗜𝗱 𝗹𝗶𝗻𝗸:☞${getAdminInfo().social.facebook || "https://www.facebook.com/profile.php?id=100086680386976"}

𝗪𝗵𝗮𝘁𝘀𝗮𝗽𝗽☞${getAdminInfo().social.whatsapp || "01631813286"}

______________________________\n\n----↓↓𝙍𝙤𝙗𝙤𝙩 𝙖𝙘𝙩𝙞𝙫𝙚 𝙩𝙞𝙢𝙚↓↓----\n\n ${hours} : ${minutes} : ${seconds} second(s)\n\n______________________________\n» 𝗧𝗢𝗧𝗔𝗟 𝗨𝗦𝗘𝗥𝗦: ${global.data.allUserID.length} \n\n» 𝗧𝗢𝗧𝗔𝗟 𝗚𝗥𝗢𝗨𝗣: ${global.data.allThreadID.length}\n______________________________\n\n thanks for using \n 𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 
\n--------------------------------------------------\n\n☢️☣️⚠️`, attachment: fs.createReadStream(__dirname + "/cache/kensu.jpg"), }, event.threadID, () => fs.unlinkSync(__dirname + "/cache/kensu.jpg"));
 return request(encodeURI(link[Math.floor(Math.random() * link.length)])).pipe(fs.createWriteStream(__dirname + "/cache/kensu.jpg")).on("close", () => callback()); 
 }
}
