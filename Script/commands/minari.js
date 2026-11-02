const { getAdminInfo } = require("../../utils/adminInfo.js");

module.exports.config = {
	name: "minari",
	version: "1.0.9",
	hasPermssion: 0,
	credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
	description: "Talk with AI Minari",
	commandCategory: "Ai - chatbot",
	usages: "[text/message/chat]",
	cooldowns: 5
};

module.exports.run = async ({ api, event,args }) => {
const axios = global.nodemodule["axios"];
  const Chatbot  =  require("discord-chatbot");

if (!args[0]) {api.sendMessage("Please enter a message!",event.threadID, event.messageID)}
  else{
 var mess = (event.type == "message_reply") ? event.messageReply.body : args.join(" ");
const chatbot  =  new  Chatbot({name: "Minari", gender: "Najimi"});
    const res = await chatbot.chat(mess).catch(e => console.log(e));
    const info = getAdminInfo();

 if(res === "My dear great botmaster, Priyansh.") {
    api.sendMessage(`I made by master ${info.name}, also known as ${info.nickname}`, event.threadID, event.messageID)
    return;
              }   
      if(res === "My birthplace is Priyansh's laptop. What is your birthplace?") {
    api.sendMessage(`I live here in ${info.address || "Bangladesh"}. What about you?`, event.threadID, event.messageID)
    return;
              } 
      if(res === "My favorite anime is <em>Ghost in the Shell</em>") {
    api.sendMessage(`My favorite anime is Zero no Tsukaima, what about you?`, event.threadID, event.messageID)
    return;
              }     
      if(res === "I can't think of any. You suggest anime.") {
    api.sendMessage(`I suggest you to watch Boku no Pico, 10/10 wholesome.`, event.threadID, event.messageID)
    return;
              }     
            if(res === "I was created by Priyansh.") {
    api.sendMessage(`I was created by ${info.nickname}.`, event.threadID, event.messageID)
    return;
              }     
              
              if(res === "I obey 𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭.") {
    api.sendMessage(`I obey ${info.nickname}`, event.threadID, event.messageID)
    return;
              }     
 api.sendMessage(res, event.threadID, event.messageID)
  }
}