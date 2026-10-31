module.exports.config = {
	name: "offbot",
	version: "1.0.0",
	hasPermssion: 2,
	credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
	description: "turn the bot off",
	commandCategory: "system",
	cooldowns: 0
        };
module.exports.run = ({event, api}) =>{
    // Permission is enforced centrally (hasPermssion: 2).
  api.sendMessage(`[ OK ] ${(global.config.botName || global.config.BOTNAME || "CYBER BOT")} Bot are now turned off.`,event.threadID, () =>process.exit(0))
}
