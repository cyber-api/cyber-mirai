module.exports.config = {
	name: "language",
	version: "1.1.0",
	hasPermssion: 2,
	credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
	description: "Change BOT language",
	commandCategory: "System",
	usages: "[en] [bn] [hi] [vi]",
	cooldowns: 5
};

module.exports.run = async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    switch (args[0]) {
        case "vietnames":
        case "vietnamese":
        case "vi":
            {
                return api.sendMessage(`Ngôn ngữ đã được chuyển sang tiếng Việt`, threadID, () => global.config.language = "vi"); 
            }
            break;

        case "bengali":
        case "bangla":
        case "bn":
            {
                return api.sendMessage(`ভাষা বাংলায় পরিবর্তন করা হয়েছে`, threadID, () => global.config.language = "bn");
            }
            break;

        case "hindi":
        case "hi":
            {
                return api.sendMessage(`भाषा हिन्दी में बदल दी गई है`, threadID, () => global.config.language = "hi");
            }
            break;
        
        case "english":
        case "en":
            {
                return api.sendMessage(`Language has been converted to English`, threadID, () => global.config.language = "en"); 
            }
            break;
    
        default:
            {
                return api.sendMessage("Syntax error, use : language [en / bn / hi / vi]", threadID, messageID);
            }   
            break; 
            
    }	
}
