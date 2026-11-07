module.exports.config = {
 name: "menu",
 version: "1.0.0",
 hasPermssion: 0,
 credits: "Islamick Chat",
 description: "Beginner's Guide",
 usages: "[all/-a] [number of pages]",
 commandCategory: "For users",
 cooldowns: 5
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
 let num = parseInt(event.body.split(" ")[0].trim());
 (handleReply.bonus) ? num -= handleReply.bonus : num;
 let msg = "";
 let data = handleReply.content;
 let check = false;
 if (isNaN(num)) msg = "𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗹𝗲𝗰𝘁 𝗻𝘂𝗺𝗯𝗲𝗿";
 else if (num > data.length || num <= 0) msg = "𝗧𝗵𝗲 𝗻𝘂𝗺𝗯𝗲𝗿 𝘆𝗼𝘂 𝘀𝗲𝗹𝗲𝗰𝘁𝗲𝗱 𝗶𝘀 𝗻𝗼𝘁 𝗶𝗻 𝘁𝗵𝗲 𝗹𝗶𝘀𝘁, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻";
 else {
 const { commands } = global.client;
 let dataAfter = data[num-=1];
 if (handleReply.type == "cmd_info") {
 let command_config = commands.get(dataAfter).config;
 msg += ` ｢ ${command_config.commandCategory.toUpperCase()} ｣ \n`;
 msg += `\nᴄᴏᴍᴍᴀɴᴅ ɴᴀᴍᴇ: ${dataAfter}`;
 msg += `\nᴅᴇsᴄʀɪʙᴇ: ${command_config.description}`;
 msg += `\nᴜsɪɴɢ: ${(command_config.usages) ? command_config.usages : ""}`;
 msg += `\nᴡᴀɪᴛɪɴɢ ᴛɪᴍᴇ: ${command_config.cooldowns || 5}s`;
 msg += `\nᴘᴏᴡᴇʀ: ${(command_config.hasPermssion == 0) ? "User" : (command_config.hasPermssion == 1) ? "Group administrator" : "Bot admin"}`;
 msg += `\n⋆✦⋆⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⋆✦⋆`
 msg += `\n\n Module code by ${command_config.credits} `;
 } else {
 check = true;
 let count = 0;
 msg += ` ${dataAfter.group.toUpperCase()} \n`;

 dataAfter.cmds.forEach(item => {
 msg += `\n ｢${count+=1}.｣ ${item}: ${commands.get(item).config.description}`;
 })
 msg += "\n𝗺𝗲𝘀𝘀𝗮𝗴𝗲 𝗯𝘆 𝗻𝘂𝗺𝗯𝗲𝗿 𝘁𝗼 𝘃𝗶𝗲𝘄 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗱𝗲𝘁𝗮𝗶𝗹𝘀 𝗮𝗻𝗱 𝗵𝗼𝘄 𝘁𝗼 𝘂𝘀𝗲 𝗰𝗼𝗺𝗺𝗮𝗻𝗱";
 }
 }
 const axios = require('../../utils/httpClient');
 const fs = require('fs-extra');
 const img = ["https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif"]
 var path = __dirname + "/cache/menu.gif"
 var rdimg = img[Math.floor(Math.random() * img.length)]; 
 const imgP = []
 let dowloadIMG = (await axios.get(rdimg, { responseType: "arraybuffer" } )).data; 
 fs.writeFileSync(path, Buffer.from(dowloadIMG, "utf-8") );
 imgP.push(fs.createReadStream(path))
 var msgg = {body: msg, attachment: imgP}
 api.unsendMessage(handleReply.messageID);
 return api.sendMessage(msgg, event.threadID, (error, info) => {
 if (error) console.log(error);
 if (check) {
 global.client.handleReply.push({
 type: "cmd_info",
 name: this.config.name,
 messageID: info.messageID,
 content: data[num].cmds
 })
 }
 }, event.messageID);
}

module.exports.run = async function({ api, event, args }) {
 const { commands } = global.client;
 const { threadID, messageID } = event;
 const threadSetting = global.data.threadData.get(parseInt(threadID)) || {};
 const prefix = (threadSetting.hasOwnProperty("PREFIX")) ? threadSetting.PREFIX : global.config.PREFIX;
 const axios = require('../../utils/httpClient');
 const fs = require('fs-extra');
 const imgP = []
 const img = ["https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif", "https://files.catbox.moe/wnif41.gif"]
 var path = __dirname + "/cache/menu.gif"
 var rdimg = img[Math.floor(Math.random() * img.length)]; 

 let dowloadIMG = (await axios.get(rdimg, { responseType: "arraybuffer" } )).data; 
 fs.writeFileSync(path, Buffer.from(dowloadIMG, "utf-8") );
 imgP.push(fs.createReadStream(path))
 const command = commands.values();
 var group = [], msg = "╭•┄┅════❁🌺❁════┅┄•╮\n আসসালামু আলাইকুম-!!🖤💫\n╰•┄┅════❁🌺❁════┅┄•╯\n\n𝐈𝐒𝐋𝐀𝐌𝐈𝐂𝐊 𝐂𝐇𝐀𝐓 𝐌𝐄𝐍𝐔 𝐋𝐈𝐒𝐓\n⋆✦⋆⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⋆✦⋆\n";
 let check = true, page_num_input = "";
 let bonus = 0;

 for (const commandConfig of command) {
 if (!group.some(item => item.group.toLowerCase() == commandConfig.config.commandCategory.toLowerCase())) group.push({ group: commandConfig.config.commandCategory.toLowerCase(), cmds: [commandConfig.config.name] });
 else group.find(item => item.group.toLowerCase() == commandConfig.config.commandCategory.toLowerCase()).cmds.push(commandConfig.config.name);
 }

 if (args[0] && ["all", "-a"].includes(args[0].trim())) {
 let all_commands = [];
 group.forEach(commandGroup => {
 commandGroup.cmds.forEach(item => all_commands.push(item));
 });
 let page_num_total = Math.ceil(all_commands.length / 2222222222);
 if (args[1]) {
 check = false;
 page_num_input = parseInt(args[1]);
 if (isNaN(page_num_input)) msg = "𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗹𝗲𝗰𝘁 𝗻𝘂𝗺𝗯𝗲𝗿";
 else if (page_num_input > page_num_total || page_num_input <= 0) msg = "𝗧𝗵𝗲 𝗻𝘂𝗺𝗯𝗲𝗿 𝘆𝗼𝘂 𝘀𝗲𝗹𝗲𝗰𝘁𝗲𝗱 𝗶𝘀 𝗻𝗼𝘁 𝗶𝗻 𝘁𝗵𝗲 𝗹𝗶𝘀𝘁, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻";
 else check = true;
 }
 if (check) {
 index_start = (page_num_input) ? (page_num_input * 2222222222) - 2222222222 : 0;
 bonus = index_start;
 index_end = (index_start + 2222222222 > all_commands.length) ? all_commands.length : index_start + 2222222222;
 all_commands = all_commands.slice(index_start, index_end);
 all_commands.forEach(e => {
 msg += `\n${index_start+=1}. ${e}: ${commands.get(e).config.description}`;
 })
 msg += `\n\nPage ${page_num_input || 1}/${page_num_total}`;
 msg += `\nᴛᴏ ᴠɪᴇᴡ ᴏᴛʜᴇʀ ᴘᴀɢᴇs, ᴜsᴇ: ${prefix}ᴍᴇɴᴜ [ᴀʟʟ/-ᴀ] [ɴᴜᴍʙᴇʀ ᴏғ ᴘᴀɢᴇs]`;
 msg += `\nʏᴏᴜ ᴄᴀɴ ᴜsᴇ ${prefix}ʜᴇʟᴘ ᴀʟʟ ᴛᴏ sᴇᴇ ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅs`
 msg += "\n𝗺𝗲𝘀𝘀𝗮𝗴𝗲 𝗯𝘆 𝗻𝘂𝗺𝗯𝗲𝗿 𝘁𝗼 𝘃𝗶𝗲𝘄 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗱𝗲𝘁𝗮𝗶𝗹𝘀 𝗮𝗻𝗱 𝗵𝗼𝘄 𝘁𝗼 𝘂𝘀𝗲 𝗰𝗼𝗺𝗺𝗮𝗻𝗱";
 }
 var msgg = {body: msg, attachment: imgP}
 return api.sendMessage(msgg, threadID, (error, info) => {
 if (check) {
 global.client.handleReply.push({
 type: "cmd_info",
 bonus: bonus,
 name: this.config.name,
 messageID: info.messageID,
 content: all_commands
 })
 }
 }, messageID)
 }

 let page_num_total = Math.ceil(group.length / 2222222222);
 if (args[0]) {
 check = false;
 page_num_input = parseInt(args[0]);
 if (isNaN(page_num_input)) msg = "𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗹𝗲𝗰𝘁 𝗻𝘂𝗺𝗯𝗲𝗿";
 else if (page_num_input > page_num_total || page_num_input <= 0) msg = "𝗧𝗵𝗲 𝗻𝘂𝗺𝗯𝗲𝗿 𝘆𝗼𝘂 𝘀𝗲𝗹𝗲𝗰𝘁𝗲𝗱 𝗶𝘀 𝗻𝗼𝘁 𝗶𝗻 𝘁𝗵𝗲 𝗹𝗶𝘀𝘁, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻";
 else check = true;
 }
 if (check) {
 index_start = (page_num_input) ? (page_num_input * 2222222222) - 2222222222 : 0;
 bonus = index_start;
 index_end = (index_start + 2222222222 > group.length) ? group.length : index_start + 2222222222;
 group = group.slice(index_start, index_end);
 group.forEach(commandGroup => msg += `\n${index_start+=1}. ${commandGroup.group.toUpperCase()} `);
 msg += `\n\n𝐏𝐀𝐆𝐄 ｢${page_num_input || 1}/${page_num_total}｣`;
 msg += `\nᴛᴏ ᴠɪᴇᴡ ᴏᴛʜᴇʀ ᴘᴀɢᴇs, ᴜsᴇ: ${prefix}ᴍᴇɴᴜ [ɴᴜᴍʙᴇʀ ᴏғ ᴘᴀɢᴇs]`;
 msg += `\nʏᴏᴜ ᴄᴀɴ ᴜsᴇ ${prefix}ᴍᴇɴᴜ ᴀʟʟ ᴛᴏ sᴇᴇ ᴀʟʟ ᴄᴏᴍᴍᴀɴᴅs`
 msg += `\n𝗺𝗲𝘀𝘀𝗮𝗴𝗲 𝗯𝘆 𝗻𝘂𝗺𝗯𝗲𝗿 𝘁𝗼 𝘃𝗶𝗲𝘄 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀 𝗯𝘆 𝗰𝗮𝘁𝗲𝗴𝗼𝗿𝘆`;
 }
 var msgg = {body: msg, attachment: imgP}
 return api.sendMessage(msgg, threadID, async (error, info) => {
 global.client.handleReply.push({
 name: this.config.name,
 bonus: bonus,
 messageID: info.messageID,
 content: group
 })
 });
 }