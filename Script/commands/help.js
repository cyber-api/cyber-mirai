const { getAdminInfo } = require("../../utils/adminInfo.js");
const logger = require("../../utils/log.js");

/** Commands are loaded asynchronously; never assume config exists. */
function safeCommand(commands, name) {
        if (!commands || typeof commands.get !== "function") return null;
        const key = String(name == null ? "" : name).toLowerCase();
        const direct = commands.get(key);
        if (direct && direct.config) return direct;
        for (const [registeredName, command] of commands) {
                if (!command || !command.config) continue;
                if (String(registeredName).toLowerCase() === key) return command;
                if (String(command.config.name || "").toLowerCase() === key) return command;
        }
        return null;
}

function safeConfig(command) {
        return command && command.config && typeof command.config === "object" ? command.config : null;
}

function safeString(value, fallback) {
        return value === undefined || value === null || value === "" ? fallback : String(value);
}

module.exports.config = {
        name: "help",
        version: "1.0.2",
        hasPermssion: 0,
        credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐃 ⚠️ 𝑻𝑬𝑨𝑰_ ☢️",
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
    "moduleInfo": "╭──────•◈•──────╮\n |        𝗜𝘀𝗵𝗮𝗺𝗶𝗰𝗸 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁\n |●𝗡𝗮𝗺𝗶: •—» %1 «—•\n |●𝗨𝘀𝗮𝗴𝗲: %3\n |●𝗛𝗹𝗔𝗿𝗋𝗿𝗶p𝗌𝗋𝗷: %2\n |●𝗕𝗈𝗙𝗋𝗋𝗿𝗋: %4\n |●𝗧𝗛𝗼𝗹𝗉𝗎 𝗂𝗋𝗏𝗇𝗌: %5 seconds(s)\n |●𝗉𝗋𝗍𝗌𝗌𝗇𝗇𝗍𝗅𝗇𝗇𝗋: %6\n |𝗘𝗼𝗎𝗋𝗉𝗉 𝗘𝗈 𝗍𝗏𝗇𝗍𝗇𝗍\n |•—» " + (getAdminInfo().name || "Mahbub-Shaon ッ") + " «—•\n╰──────•◈•──────╯",
    "helpList": '[ There are %1 commands on this bot, Use: "%2help nameCommand" to know how to use! ]',
    "user": "User",
        "adminGroup": "Admin group",
        "adminBot": "Admin bot"
  }
};

module.exports.handleEvent = function ({ api, event, getText }) {
 const { commands } = global.client;
 const { threadID, messageID, body } = event;

 if (!body || typeof body == "undefined" || body.indexOf("help") != 0) return;
 const splitBody = body.slice(body.indexOf("help")).trim().split(/\s+/);
 if (splitBody.length == 1) return;
 const command = safeCommand(commands, splitBody[1]);
 const commandConfig = safeConfig(command);
 if (!commandConfig) {
  if (splitBody[1]) logger.loader(`[HELP] Skipped ${splitBody[1]}: missing config`, "warn");
  return;
 }
 const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
 const prefix = (threadSetting.hasOwnProperty("PREFIX")) ? threadSetting.PREFIX : global.config.PREFIX;
 return api.sendMessage(getText("moduleInfo", safeString(commandConfig.name, splitBody[1]), safeString(commandConfig.description, ""), `${prefix}${safeString(commandConfig.name, splitBody[1])} ${safeString(commandConfig.usages, "")}`, safeString(commandConfig.commandCategory, "uncategorized"), safeString(commandConfig.cooldowns, "0"), ((commandConfig.hasPermssion == 0) ? getText("user") : (commandConfig.hasPermssion == 1) ? getText("adminGroup") : getText("adminBot")), safeString(commandConfig.credits, "")), threadID, messageID);
}

module.exports.run = function({ api, event, args, getText }) {
  const httpClient = require("../../utils/httpClient");
  const fs = require("fs-extra");
  const commands = global.client.commands;
  const { threadID, messageID } = event;
  const command = safeCommand(commands, args[0] || "");
  const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
  const settings = global.configModule && global.configModule[this.config.name] || {};
  const autoUnsend = settings.autoUnsend !== false; // default true
  const delayUnsend = Number(settings.delayUnsend) || 20;
  const prefix = (threadSetting.hasOwnProperty("PREFIX")) ? threadSetting.PREFIX : global.config.PREFIX;

  if (args[0] == "all") {
    const commandList = commands.values();
    var group = [], msg = "";
    for (const commandConfig of commandList) {
      if (!commandConfig || !commandConfig.config) continue;
      const category = safeString(commandConfig.config.commandCategory, "uncategorized").toLowerCase();
      if (!group.some(item => item.group.toLowerCase() == category)) {
        group.push({ group: category, cmds: [safeString(commandConfig.config.name, "unknown")] });
      } else {
        group.find(item => item.group.toLowerCase() == category).cmds.push(safeString(commandConfig.config.name, "unknown"));
      }
    }
    group.forEach(commandGroup => msg += `❄️ ${commandGroup.group.charAt(0).toUpperCase() + commandGroup.group.slice(1)} \n${commandGroup.cmds.join(' • ')}\n\n`);

    return httpClient.get('https://loidsenpaihelpapi.miraiandgoat.repl.co').then(async (res) => {
      let ext = res.data.data.substring(res.data.data.lastIndexOf(".") + 1);
      const ownerInfo = getAdminInfo();
      let admID = ownerInfo.social.facebookUid || ownerInfo.avatar.uid || (global.config.ADMINBOT && global.config.ADMINBOT[0]) || "61551846081032";

      // Download image using httpClient.fetchBuffer
      const bufferRes = await httpClient.fetchBuffer(res.data.data);
      if (!bufferRes.ok) {
        throw new Error(bufferRes.error || "download failed");
      }
      const imgPath = __dirname + `/cache/472.${ext}`;
      fs.writeFileSync(imgPath, bufferRes.data);

      api.getUserInfo(parseInt(admID), (err, data) => {
        if (err) { return console.log(err); }
        const obj = Object.keys(data);
        const firstname = data[obj].name.replace("@", "");
        const callback = function () {
          api.sendMessage({ 
            body:`✿🄲🄾🄼🄼🄰🄽🄳 🄻🄸🅂🅃✿\n\n` + msg + `✿══════════════✿\n│𝗨𝘀𝗲 ${prefix}help [Name?]\n│𝗨𝘀𝗲 ${prefix}help [Page?]\n│𝗛𝗔𝗠𝗧 𝗊𝗧𝗧𝗲𝗁 : │${getAdminInfo().name || "Mahbub-Shaon ッ"}\n│𝗧𝗔𝗧𝗘𝗟 :  ${commands.size}\n————————————`, 
            mentions: [{
              tag: firstname,
              id: admID,
              fromIndex: 0
            }],
            attachment: fs.createReadStream(imgPath)
          }, event.threadID, (err, info) => {
            fs.unlinkSync(imgPath);
            if (autoUnsend == false) {
              setTimeout(() => {
                return api.unsendMessage(info.messageID);
              }, delayUnsend * 1000);
            }
          }, event.messageID);
        };
        callback();
      });
    });
  }

  if (!command) {
    const arrayInfo = [];
    const page = parseInt(args[0]) || 1;
    const numberOfOnePage = 15;
    let i = 0;
    let msg = "";

    for (var [name, commandInfo] of (commands)) {
      if (!commandInfo || !commandInfo.config) continue;
      arrayInfo.push({ data: name, config: commandInfo.config });
    }

    arrayInfo.sort((a, b) => a.data.localeCompare(b.data));
    const first = numberOfOnePage * page - numberOfOnePage;
    i = first;
    const helpView = arrayInfo.slice(first, first + numberOfOnePage);

    for (let entry of helpView) msg += `•—»[ ${entry.data} ]«—•\n`;
    const siu = `╭──────•◈•──────╮\n |        𝗝𝘀𝗧𝗮𝗮𝗸 𝗰𝗧𝗮𝗆 𝗯𝗼𝗆\n |   🄲🄾🄼🄼🄰🄽🄳 🄻🄸🅂🅃       \n╰──────•◈•──────╯`;
    const text = `╭──────•◈•──────╮\n│𝗨𝘀𝗲 ${prefix}help [Name?]\n│𝗨𝘀𝗲 ${prefix}help [Page?]\n│𝗛𝗔𝗠𝗧 𝗆𝗧𝗧𝗅𝗁 : │ ${getAdminInfo().name || "Mahbub-Shaon ッ"}\n│𝗧𝗔𝗧𝗍𝗍 : [${arrayInfo.length}]\n│📛🅶🅷🅶🅶🅴📛 :  [${page}/${Math.ceil(arrayInfo.length/numberOfOnePage)}]\n╰──────•◈•──────╯`;
    const links = [
      "https://files.catbox.moe/0yuk20.jpeg",
      "https://files.catbox.moe/0yuk20.jpeg",
      "https://files.catbox.moe/utby7g.jpeg",
      "https://i.postimg.cc/QdgH08j6/Messenger-creation-C2-A39-DCF-A8-E7-4-FC7-8715-2559476-FEEF4.gif",
      "https://files.catbox.moe/utby7g.jpeg",
      "https://files.catbox.moe/gatv0b.jpeg",
      "https://files.catbox.moe/0yuk20.jpeg"
    ];
    (async () => {
      const randomUrl = links[Math.floor(Math.random() * links.length)];
      const bufferRes = await httpClient.fetchBuffer(randomUrl);
      if (!bufferRes.ok) {
        // fallback: send text only
        return api.sendMessage(siu + "\n\n" + msg + text, event.threadID);
      }
      fs.writeFileSync(__dirname + "/cache/loidbutter.jpg", bufferRes.data);
      api.sendMessage({ body: siu + "\n\n" + msg + text, attachment: fs.createReadStream(__dirname + "/cache/loidbutter.jpg") }, event.threadID, () => fs.unlinkSync(__dirname + "/cache/loidbutter.jpg"), event.messageID);
    })();

    // The list branch above already sent its reply. Falling through used to
    // reach `command.config` with `command === undefined`, which threw
    // "Cannot read properties of undefined (reading 'config')".
    return;
  }

  const commandConfig = safeConfig(command);
  if (!commandConfig) {
    logger.loader(`[HELP] Skipped ${args[0] || "(unknown)"}: missing config`, "warn");
    return;
  }

  const leiamname = getText("moduleInfo", safeString(commandConfig.name, args[0] || "unknown"), safeString(commandConfig.description, ""), safeString(commandConfig.usages, ""), safeString(commandConfig.commandCategory, "uncategorized"), safeString(commandConfig.cooldowns, "0"), ((commandConfig.hasPermssion == 0) ? getText("user") : (commandConfig.hasPermssion == 1) ? getText("adminGroup") : getText("adminBot")), safeString(commandConfig.credits, ""));

  const link = ["https://i.postimg.cc/QdgH08j6/Messenger-creation-C2-A39-DCF-A8-E7-4-FC7-8715-2559476-FEEF4.gif"];
  (async () => {
    const randomUrl = link[Math.floor(Math.random() * link.length)];
    const bufferRes = await httpClient.fetchBuffer(randomUrl);
    if (!bufferRes.ok) {
      // fallback: send text only
      return api.sendMessage(leiamname, event.threadID);
    }
    fs.writeFileSync(__dirname + "/cache/loidbutter.jpg", bufferRes.data);
    api.sendMessage({ body: leiamname, attachment: fs.createReadStream(__dirname + "/cache/loidbutter.jpg") }, event.threadID, () => fs.unlinkSync(__dirname + "/cache/loidbutter.jpg"), event.messageID);
  })();
};
