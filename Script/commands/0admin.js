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
 "removedNDH": '[ADMIN] Removed %1 Support user(s):\n\n%2'
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

module.exports.run = async function ({ api, event, args, Users, permssion, getText }) { 
 const content = args.slice(1);
 if (args.length == 0) {
 return api.sendMessage({
 body: `==== [ ADMIN SETTINGS ] ====
━━━━━━━━━━━━━━━
admin list → View Admin & Support list
admin add → Add user as Admin
admin remove → Remove Admin
admin addndh → Add Support user
admin removendh → Remove Support
admin qtvonly → Only group admins can use bot
admin ndhonly → Only support users can use bot
admin only → Only bot admins can use bot
admin ibonly → Only admins can use bot in inbox
━━━━━━━━━━━━━━━
Usage → ${global.config.PREFIX}admin <command>`
 }, event.threadID, event.messageID);
 }

 const { threadID, messageID, mentions } = event;
 const { configPath } = global.client;
 const { ADMINBOT } = global.config;
 const { NDH } = global.config;

 const mention = Object.keys(mentions);

 delete require.cache[require.resolve(configPath)];
 var config = require(configPath);

 switch (args[0]) {

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
 if (permssion != 3) return api.sendMessage("Permission denied.", threadID);

 config.adminOnly = !config.adminOnly;

 api.sendMessage(
 config.adminOnly
 ? "Enabled admin-only mode."
 : "Disabled admin-only mode.",
 threadID
 );

 writeFileSync(configPath, JSON.stringify(config, null, 4));
 break;
 }

 default:
 return global.utils.throwError(this.config.name, threadID, messageID);
 }
};