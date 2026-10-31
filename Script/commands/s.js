const { getFbAppToken } = require("../../utils/credentials.js");
module.exports.config = {
name: "s",
version: "1.0.0",
hasPermssion: 0,
credits: "Islamick Chat",
description: "show id profile",
commandCategory: "profile",
usages: "",
cooldowns: 0,
dependencies: []
};

module.exports.run = async function ({ api, event, args, Currencies, Users }) {
 const axios = require("axios")
var { threadID, messageID, body } = event,{ PREFIX } = global.config;
 async function streamURL(url, mime='jpg') {
 const dest = `${__dirname}/cache/${Date.now()}.${mime}`,
 downloader = require('image-downloader'),
 fse = require('fs-extra');
 await downloader.image({
 url, dest
 });
 setTimeout(j=>fse.unlinkSync(j), 60*1000, dest);
 return fse.createReadStream(dest);
};
const moment = require("moment-timezone");
var ngay = moment.tz('Asia/Dhaka').format('D/MM/YYYY');
var gio = moment.tz('Asia/Dhaka').format('HH:mm:ss');
var thu = moment.tz('Asia/Dhaka').format('dddd');
 var thang = moment.tz("Asia/Dhaka").format('MM');
 var nam = moment.tz("Asia/Dhaka").format('YYYY');
if (thu == 'Sunday') thu = 'Chủ Nhật'
if (thu == 'Monday') thu = 'Thứ Hai'
if (thu == 'Tuesday') thu = 'Thứ Ba'
if (thu == 'Wednesday') thu = 'Thứ Tư'
if (thu == "Thursday") thu = 'Thứ Năm'
if (thu == 'Friday') thu = 'Thứ Sáu'
if (thu == 'Saturday') thu = 'Thứ Bảy'
 const res = await axios.get(`https://golike.com.vn/func-api.php?user=${event.senderID}`);
 const finduid = res.data.data.uid
 const finddate = res.data.data.date
let name = await Users.getNameUser(event.senderID);
 let
 s = process.uptime(),u = [s/3600<<0, s/60%60<<0, s%60<<0].map(el => el < 10?'0'+el: el);
return api.sendMessage({body:`𝐇𝐞𝐥𝐥𝐨: ${name}\n\n𝐈𝐃 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤: ${name}\n\n𝐇𝐨𝐮𝐫: ${gio}\n\n𝐃𝐚𝐲: ${ngay} \n\n𝐘𝐞𝐚𝐫: ${nam}\n\n RUNNIG: ${u.join(':')}\n•┄┅════❁🌺❁════┅┄•\n`, attachment: await streamURL(`https://graph.facebook.com/${event.senderID}/picture?height=720&width=720&access_token=${getFbAppToken()}`)},event.threadID,event.messageID);
 }