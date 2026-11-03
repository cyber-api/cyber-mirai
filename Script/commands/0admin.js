var request = require("request");
const { readdirSync, readFileSync, writeFileSync, existsSync, copySync, createWriteStream, createReadStream } = require("fs-extra");

module.exports.config = {
	name: "0admin",
	version: "1.0.5",
	hasPermssion: 0,
	credits: "CYBER BOT TEAM",
	description: "Admin Config",
	commandCategory: "Admin",
	usages: "Admin",
 cooldowns: 2,
 dependencies: {
 "fs-extra": ""
 }
};

module.exports.languages = {
 "en": {
 "listAdmin": `=== ADMIN LIST ===\n━━━━━━━━━━━━━━━\n%1\n\n=== SUPPORT USERS ===\n━━━━━━━━━━━━━━━\n%2`,
 "notHavePermssion": '[ADMIN] You do not have permission to use "%1"',
 "addedNewAdmin": '[ADMIN] Added %1 user(s) as Admin:\n\n%2',
 "addedNewNDH": '[ADMIN] Added %1 user(s) as Support:\n\n%2',
 "removedAdmin": '[ADMIN] Removed %1 Admin(s):\n\n%2',
 "removedNDH": '[ADMIN] Removed %1 Support user(s):\n\n%2',
 "adminOnlyEnabled": '✅ Admin-only mode enabled.',
 "adminOnlyDisabled": '✅ Admin-only mode disabled.',
 "adminOnlyNotiEnabled": '✅ Admin-only notification enabled.',
 "adminOnlyNotiDisabled": '✅ Admin-only notification disabled.',
 "adminOnlyInvalidValue": '⚠️ Invalid value. Use "on" or "off".'
 },
 "bn": {
 "listAdmin": `=== অ্যাডমিন তালিকা ===\n━━━━━━━━━━━━━━━\n%1\n\n=== সাপোর্ট ব্যবহারকারী ===\n━━━━━━━━━━━━━━━\n%2`,
 "notHavePermssion": '[ADMIN] "%1" ব্যবহার করার অনুমতি আপনার নেই',
 "addedNewAdmin": '[ADMIN] %1 জন ব্যবহারকারীকে অ্যাডমিন হিসেবে যোগ করা হয়েছে:\n\n%2',
 "addedNewNDH": '[ADMIN] %1 জন ব্যবহারকারীকে সাপোর্ট হিসেবে যোগ করা হয়েছে:\n\n%2',
 "removedAdmin": '[ADMIN] %1 জন অ্যাডমিন সরানো হয়েছে:\n\n%2',
 "removedNDH": '[ADMIN] %1 জন সাপোর্ট ব্যবহারকারী সরানো হয়েছে:\n\n%2',
 "adminOnlyEnabled": '✅ অ্যাডমিন-অনলি মোড চালু হয়েছে।',
 "adminOnlyDisabled": '✅ অ্যাডমিন-অনলি মোড বন্ধ হয়েছে।',
 "adminOnlyNotiEnabled": '✅ অ্যাডমিন-অনলি নোটিফিকেশন চালু হয়েছে।',
 "adminOnlyNotiDisabled": '✅ অ্যাডমিন-অনলি নোটিফিকেশন বন্ধ হয়েছে।',
 "adminOnlyInvalidValue": '⚠️ ভুল মান। "on" অথবা "off" লিখুন।'
 },
 "hi": {
 "listAdmin": `=== एडमिन सूची ===\n━━━━━━━━━━━━━━━\n%1\n\n=== सपोर्ट उपयोगकर्ता ===\n━━━━━━━━━━━━━━━\n%2`,
 "notHavePermssion": '[ADMIN] आपके पास "%1" उपयोग करने की अनुमति नहीं है',
 "addedNewAdmin": '[ADMIN] %1 उपयोगकर्ता को एडमिन के रूप में जोड़ा गया:\n\n%2',
 "addedNewNDH": '[ADMIN] %1 उपयोगकर्ता को सपोर्ट के रूप में जोड़ा गया:\n\n%2',
 "removedAdmin": '[ADMIN] %1 एडमिन हटाए गए:\n\n%2',
 "removedNDH": '[ADMIN] %1 सपोर्ट उपयोगकर्ता हटाए गए:\n\n%2',
 "adminOnlyEnabled": '✅ एडमिन-ओनली मोड चालू हो गया।',
 "adminOnlyDisabled": '✅ एडमिन-ओनली मोड बंद हो गया।',
 "adminOnlyNotiEnabled": '✅ एडमिन-ओनली सूचना चालू हो गई।',
 "adminOnlyNotiDisabled": '✅ एडमिन-ओनली सूचना बंद हो गई।',
 "adminOnlyInvalidValue": '⚠️ गलत मान। "on" या "off" लिखें।'
 },
 "vi": {
 "listAdmin": `=== DANH SÁCH QUẢN TRỊ VIÊN ===\n━━━━━━━━━━━━━━━\n%1\n\n=== NGƯỜI DÙNG HỖ TRỢ ===\n━━━━━━━━━━━━━━━\n%2`,
 "notHavePermssion": '[ADMIN] Bạn không có quyền sử dụng "%1"',
 "addedNewAdmin": '[ADMIN] Đã thêm %1 người dùng làm quản trị viên:\n\n%2',
 "addedNewNDH": '[ADMIN] Đã thêm %1 người dùng làm hỗ trợ:\n\n%2',
 "removedAdmin": '[ADMIN] Đã xóa %1 quản trị viên:\n\n%2',
 "removedNDH": '[ADMIN] Đã xóa %1 người dùng hỗ trợ:\n\n%2',
 "adminOnlyEnabled": '✅ Đã bật chế độ chỉ quản trị viên.',
 "adminOnlyDisabled": '✅ Đã tắt chế độ chỉ quản trị viên.',
 "adminOnlyNotiEnabled": '✅ Đã bật thông báo chỉ quản trị viên.',
 "adminOnlyNotiDisabled": '✅ Đã tắt thông báo chỉ quản trị viên.',
 "adminOnlyInvalidValue": '⚠️ Giá trị không hợp lệ. Dùng "on" hoặc "off".'
 }
};

module.exports.onLoad = function() {
 const { writeFileSync, existsSync } = require('fs-extra');
 const { resolve } = require("path");
 const path = resolve(__dirname, 'cache', 'data.json');

 if (!existsSync(path)) {
 const obj = { adminbox: {} };
 writeFileSync(path, JSON.stringify(obj, null, 4));
 } else {
 const data = require(path);
 if (!data.hasOwnProperty('adminbox')) data.adminbox = {};
 writeFileSync(path, JSON.stringify(data, null, 4));
 }
};

function parseToggleValue(value) {
 if (value === undefined || value === null || value === "") return null;
 const normalized = String(value).trim().toLowerCase();
 if (["on", "enable", "enabled", "true", "1"].includes(normalized)) return true;
 if (["off", "disable", "disabled", "false", "0"].includes(normalized)) return false;
 return undefined;
}

module.exports.run = async function ({ api, event, args, Users, permssion, getText }) { 
 const content = args.slice(1);
 const { threadID, messageID, mentions } = event;
 const { configPath } = global.client;
 const { ADMINBOT } = global.config;
 const { NDH } = global.config;

 const mention = Object.keys(mentions || {});

 delete require.cache[require.resolve(configPath)];
 var config = require(configPath);

 const persistConfig = () => writeFileSync(configPath, JSON.stringify(config, null, 4));

 const ensureAdminOnlyObject = () => {
 if (!config.adminOnly || typeof config.adminOnly !== "object" || Array.isArray(config.adminOnly)) {
 config.adminOnly = { enable: false, ignoreCommand: [] };
 }
 if (!Array.isArray(config.adminOnly.ignoreCommand)) config.adminOnly.ignoreCommand = [];
 if (typeof config.adminOnly.enable !== "boolean") config.adminOnly.enable = false;
 return config.adminOnly;
 };

 const ensureHideNotiObject = () => {
 if (!config.hideNotiMessage || typeof config.hideNotiMessage !== "object" || Array.isArray(config.hideNotiMessage)) {
 config.hideNotiMessage = {};
 }
 if (typeof config.hideNotiMessage.adminOnly !== "boolean") config.hideNotiMessage.adminOnly = false;
 return config.hideNotiMessage;
 };

 const setAdminOnly = (value) => {
 const adminOnly = ensureAdminOnlyObject();
 adminOnly.enable = value;
 if (global.config) {
 if (!global.config.adminOnly || typeof global.config.adminOnly !== "object") global.config.adminOnly = {};
 global.config.adminOnly.enable = value;
 if (!Array.isArray(global.config.adminOnly.ignoreCommand)) global.config.adminOnly.ignoreCommand = adminOnly.ignoreCommand;
 }
 persistConfig();
 return api.sendMessage(
 getText(value ? "adminOnlyEnabled" : "adminOnlyDisabled"),
 threadID,
 messageID
 );
 };

 const setAdminOnlyNoti = (value) => {
 const hideNoti = ensureHideNotiObject();
 hideNoti.adminOnly = value;
 if (global.config) {
 if (!global.config.hideNotiMessage || typeof global.config.hideNotiMessage !== "object") global.config.hideNotiMessage = {};
 global.config.hideNotiMessage.adminOnly = value;
 }
 persistConfig();
 return api.sendMessage(
 getText(value ? "adminOnlyNotiEnabled" : "adminOnlyNotiDisabled"),
 threadID,
 messageID
 );
 };

 const requireOwner = () => {
 if (permssion != 3) {
 api.sendMessage(getText("notHavePermssion", args[0] || "0admin"), threadID, messageID);
 return false;
 }
 return true;
 };

 if (args.length == 0) {
 if (!requireOwner()) return;
 const adminOnly = ensureAdminOnlyObject();
 return setAdminOnly(!adminOnly.enable);
 }

 switch (args[0]) {

 case "on":
 case "enable": {
 if (!requireOwner()) return;
 return setAdminOnly(true);
 }

 case "off":
 case "disable": {
 if (!requireOwner()) return;
 return setAdminOnly(false);
 }

 case "noti":
 case "notification": {
 if (!requireOwner()) return;
 const value = parseToggleValue(args[1]);
 if (value === undefined) return api.sendMessage(getText("adminOnlyInvalidValue"), threadID, messageID);
 const hideNoti = ensureHideNotiObject();
 return setAdminOnlyNoti(value === null ? !hideNoti.adminOnly : value);
 }

 case "help": {
 return api.sendMessage({
 body: `==== [ ADMIN SETTINGS ] ====
━━━━━━━━━━━━━━━
${global.config.PREFIX}0admin on|off → Turn admin-only mode on/off
${global.config.PREFIX}0admin → Toggle admin-only mode
${global.config.PREFIX}0admin noti on|off → Turn admin-only notifications on/off
${global.config.PREFIX}0admin only [on|off] → Legacy admin-only toggle
${global.config.PREFIX}0admin list → View Admin & Support list
${global.config.PREFIX}0admin add → Add user as Admin
${global.config.PREFIX}0admin remove → Remove Admin
${global.config.PREFIX}0admin addndh → Add Support user
${global.config.PREFIX}0admin removendh → Remove Support
${global.config.PREFIX}0admin qtvonly → Only group admins can use bot
${global.config.PREFIX}0admin ndhonly → Only support users can use bot
${global.config.PREFIX}0admin ibonly → Only admins can use bot in inbox
━━━━━━━━━━━━━━━
Usage → ${global.config.PREFIX}0admin <command>`
 }, threadID, messageID);
 }

 case "list":
 case "all":
 case "-a": { 
 let listAdmin = ADMINBOT || config.ADMINBOT || [];
 let msg = [];

 for (const id of listAdmin) {
 if (parseInt(id)) {
 const name = (await Users.getData(id)).name;
 msg.push(`Name: ${name}\nProfile: https://www.facebook.com/${id}`);
 }
 }

 let listNDH = NDH || config.NDH || [];
 let msg1 = [];

 for (const id of listNDH) {
 if (parseInt(id)) {
 const name = (await Users.getData(id)).name;
 msg1.push(`Name: ${name}\nProfile: https://www.facebook.com/${id}`);
 }
 }

 return api.sendMessage(getText("listAdmin", msg.join("\n\n"), msg1.join("\n\n")), threadID, messageID);
 }

 case "add": {
 if (permssion != 3) return api.sendMessage(getText("notHavePermssion", "add"), threadID, messageID);

 if (event.type == "message_reply") content[0] = event.messageReply.senderID;

 if (mention.length != 0) {
 let listAdd = [];

 for (const id of mention) {
 ADMINBOT.push(id);
 config.ADMINBOT.push(id);
 listAdd.push(`${id} - ${event.mentions[id]}`);
 }

 writeFileSync(configPath, JSON.stringify(config, null, 4));
 return api.sendMessage(getText("addedNewAdmin", mention.length, listAdd.join("\n")), threadID, messageID);
 }

 else if (!isNaN(content[0])) {
 ADMINBOT.push(content[0]);
 config.ADMINBOT.push(content[0]);

 const name = (await Users.getData(content[0])).name;

 writeFileSync(configPath, JSON.stringify(config, null, 4));
 return api.sendMessage(getText("addedNewAdmin", 1, `Admin - ${name}`), threadID, messageID);
 }
 }

 case "addndh": {
 if (permssion != 3) return api.sendMessage(getText("notHavePermssion", "addndh"), threadID, messageID);

 if (event.type == "message_reply") content[0] = event.messageReply.senderID;

 if (mention.length != 0) {
 let listAdd = [];

 for (const id of mention) {
 NDH.push(id);
 config.NDH.push(id);
 listAdd.push(`${id} - ${event.mentions[id]}`);
 }

 writeFileSync(configPath, JSON.stringify(config, null, 4));
 return api.sendMessage(getText("addedNewNDH", mention.length, listAdd.join("\n")), threadID, messageID);
 }
 }

 case "remove":
 case "rm": {
 if (permssion != 3) return api.sendMessage(getText("notHavePermssion", "remove"), threadID, messageID);

 if (mention.length != 0) {
 let list = [];

 for (const id of mention) {
 const index = config.ADMINBOT.findIndex(i => i == id);
 ADMINBOT.splice(index, 1);
 config.ADMINBOT.splice(index, 1);
 list.push(`${id}`);
 }

 writeFileSync(configPath, JSON.stringify(config, null, 4));
 return api.sendMessage(getText("removedAdmin", mention.length, list.join("\n")), threadID, messageID);
 }
 }

 case "qtvonly": {
 if (permssion < 1) return api.sendMessage("Only group admins can change this mode.", threadID, messageID);

 const path = require("path").resolve(__dirname, 'cache', 'data.json');
 const database = require(path);

 if (database.adminbox[threadID]) {
 database.adminbox[threadID] = false;
 api.sendMessage("Disabled admin-only group mode.", threadID);
 } else {
 database.adminbox[threadID] = true;
 api.sendMessage("Enabled admin-only group mode.", threadID);
 }

 writeFileSync(path, JSON.stringify(database, null, 4));
 break;
 }

 case "ndhonly": {
 if (permssion < 2) return api.sendMessage("Permission denied.", threadID);

 config.ndhOnly = !config.ndhOnly;

 api.sendMessage(
 config.ndhOnly
 ? "Enabled support-only mode."
 : "Disabled support-only mode.",
 threadID
 );

 writeFileSync(configPath, JSON.stringify(config, null, 4));
 break;
 }

 case "ibonly": {
 if (permssion != 3) return api.sendMessage("Permission denied.", threadID);

 config.adminPaOnly = !config.adminPaOnly;

 api.sendMessage(
 config.adminPaOnly
 ? "Enabled inbox admin-only mode."
 : "Disabled inbox admin-only mode.",
 threadID
 );

 writeFileSync(configPath, JSON.stringify(config, null, 4));
 break;
 }

 case "only": {
 if (!requireOwner()) return;

 const value = parseToggleValue(args[1]);
 if (value === undefined) return api.sendMessage(getText("adminOnlyInvalidValue"), threadID, messageID);
 const adminOnly = ensureAdminOnlyObject();
 return setAdminOnly(value === null ? !adminOnly.enable : value);
 }

 default:
 return global.utils.throwError(this.config.name, threadID, messageID);
 }
};