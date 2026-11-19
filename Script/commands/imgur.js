module.exports.config = {
 name: "imgur",
 version: "1.0.0", 
 hasPermssion: 0,
 credits: "Islamick Cyber Chat",
 description: "create your video link",
 commandCategory: "other", 
 usages: "[tag]", 
 cooldowns: 0,
};

module.exports.run = async ({ api, event }) => {
const axios = global.nodemodule['axios'];

const apis = await axios.get('https://raw.githubusercontent.com/shaonproject/Shaon/main/api.json')
 const Shaon = apis.data.imgur
 
var linkanh = event.messageReply.attachments[0].url || args.join(" ");
 if(!linkanh) return api.sendMessage('╭•┄┅══❁🌺❁══┅┄•╮\n\n আসসালামু আলাইকুম-!!🖤💫\n আপনি যেই ছোবি টাকে Imgur link বানাতে চান সেই ছোবি টা imgur লিখে রিপ্লাই করুন \n\n╰•┄┅══❁🌺❁══┅┄•╯', event.threadID, event.messageID)
const res = await axios.get(`${Shaon}/imgur?link=${encodeURIComponent(linkanh)}`); 
var img = res.data.uploaded.image;
 return api.sendMessage(String(img), event.threadID, event.messageID);
}