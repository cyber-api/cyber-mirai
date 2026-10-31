module.exports.config = {
 name: "helpall",
 version: "1.0.2",
 hasPermssion: 0,
 credits: "MAHBUB SHAON",
 description: "FREE SET-UP MESSENGER",
 commandCategory: "system",
 usages: "[Name module]",
 cooldowns: 5,
 envConfig: {
 autoUnsend: true,
 delayUnsend: 20
 }
};

module.exports.languages = {
 "en": {
 "moduleInfo": "╭──────•◈•──────╮\n | 𝗜𝘀𝗹𝗮𝗺𝗶𝗰𝗸 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁\n |●𝗡𝗮𝗺𝗲: •—» %1 «—•\n |●𝗨𝘀𝗮𝗴𝗲: %3\n |●𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻: %2\n |●𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆: %4\n |●𝗪𝗮𝗶𝘁𝗶𝗻𝗴 𝘁𝗶𝗺𝗲: %5 seconds(s)\n |●𝗣𝗲𝗿𝗺𝗶𝘀𝘀𝗶𝗼𝗻: %6\n |𝗠𝗼𝗱𝘂𝗹𝗲 𝗰𝗼𝗱𝗲 𝗯𝘆\n |•—» Mahbub-Shaon ッ «—•\n╰──────•◈•──────╯",
 "helpList": '[ There are %1 commands on this bot, Use: "%2help nameCommand" to know how to use! ]',
 "user": "User",
 "adminGroup": "Admin group",
 "adminBot": "Admin bot"
 }
};

module.exports.handleEvent = function ({ api, event, getText }) {
 const { commands } = global.client;
 const { threadID, messageID, body } = event;

 if (!body || body.indexOf("help") != 0) return;

 const splitBody = body.trim().split(/\s+/);

 if (splitBody.length == 1 || !commands.has(splitBody[1].toLowerCase())) return;

 const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
 const command = commands.get(splitBody[1].toLowerCase());
 const prefix = threadSetting.PREFIX || global.config.PREFIX;

 return api.sendMessage(
 getText(
 "moduleInfo",
 command.config.name,
 command.config.description,
 `${prefix}${command.config.name} ${command.config.usages || ""}`,
 command.config.commandCategory,
 command.config.cooldowns,
 command.config.hasPermssion == 0
 ? getText("user")
 : command.config.hasPermssion == 1
 ? getText("adminGroup")
 : getText("adminBot"),
 command.config.credits
 ),
 threadID,
 messageID
 );
};

module.exports.run = async function ({ api, event, args, getText }) {
 const axios = require("axios");
 const request = require("request");
 const fs = require("fs-extra");

 const { commands } = global.client;
 const { threadID, messageID } = event;

 // ✅ FIX: safe config fallback
 const config =
 global.configModule?.[this.config.name] || this.config.envConfig;

 const { autoUnsend, delayUnsend } = config;

 const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
 const prefix = threadSetting.PREFIX || global.config.PREFIX;

 // ================= ALL COMMAND =================
 if (args[0] == "all") {
 let group = [],
 msg = "";

 for (const cmd of commands.values()) {
 let category = cmd.config.commandCategory.toLowerCase();

 let existing = group.find((g) => g.group === category);
 if (!existing) {
 group.push({ group: category, cmds: [cmd.config.name] });
 } else {
 existing.cmds.push(cmd.config.name);
 }
 }

 group.forEach(
 (g) =>
 (msg += `❄️ ${g.group.charAt(0).toUpperCase() + g.group.slice(1)}\n${g.cmds.join(
 " • "
 )}\n\n`)
 );

 const res = await axios.get(
 "https://loidsenpaihelpapi.miraiandgoat.repl.co"
 );

 let ext = res.data.data.split(".").pop();
 let path = __dirname + `/cache/472.${ext}`;

 let callback = () => {
 api.sendMessage(
 {
 body:
 `✿🄲🄾🄼🄼🄰🄽🄳 🄻🄸🅂🅃✿\n\n` +
 msg +
 `✿══════════════✿\n│Use ${prefix}help [name]\n│Total: ${commands.size}`,
 attachment: fs.createReadStream(path)
 },
 threadID,
 (err, info) => {
 fs.unlinkSync(path);

 // ✅ FIXED logic
 if (autoUnsend) {
 setTimeout(() => {
 api.unsendMessage(info.messageID);
 }, delayUnsend * 1000);
 }
 },
 messageID
 );
 };

 request(res.data.data)
 .pipe(fs.createWriteStream(path))
 .on("close", callback);

 return;
 }

 // ================= NORMAL HELP =================
 if (!commands.has((args[0] || "").toLowerCase())) {
 let list = Array.from(commands.keys()).sort();
 let msg = list.map((cmd) => `• ${cmd}`).join("\n");

 return api.sendMessage(
 `╭──────•◈•──────╮\n${msg}\n╰──────•◈•──────╯\n\nUse ${prefix}help [command]`,
 threadID,
 messageID
 );
 }

 // ================= SINGLE COMMAND =================
 const command = commands.get(args[0].toLowerCase());

 return api.sendMessage(
 getText(
 "moduleInfo",
 command.config.name,
 command.config.description,
 command.config.usages || "",
 command.config.commandCategory,
 command.config.cooldowns,
 command.config.hasPermssion == 0
 ? getText("user")
 : command.config.hasPermssion == 1
 ? getText("adminGroup")
 : getText("adminBot"),
 command.config.credits
 ),
 threadID,
 messageID
 );
};