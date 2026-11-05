const axios = require('../../utils/httpClient');

module.exports.config = {
 name: "gpt",
 version: "1.0",
 hasPermssion: 0,
 credits: "Islamick Chat",
 usePrefix: false,
 description: "M H BD AI",
 commandCategory: "General",
 cooldowns: 2,
};

const API_SERVER_URL = 'https://sensui-useless-apis.codersensui.repl.co/api/tools/ai';

module.exports.run = async ({ api, event, args }) => {
 try {
 const question = args.join(' ');

 if (!question) {
 return api.sendMessage("আপনার প্রশ্ন টি gpt লিখে অ্যাড করুন: 📝", event.threadID);
 }

 const response = await axios.get(`${API_SERVER_URL}?question=${encodeURIComponent(question)}`);

 if (response.data.error) {
 return api.sendMessage("Oops! The AI encountered an error. Please try again later.", event.threadID);
 }

 const answer = response.data.answer;

 if (answer) {
 api.sendMessage(`${global.config.BOTNAME}\n𝐓𝐡𝐢𝐬 𝐢𝐬 𝐦𝐲 𝐀𝐧𝐬𝐰𝐞𝐫🙆‍♂️😌\n\n${answer}`, event.threadID);
 } else {
 api.sendMessage("There's something wrong. Please try again...", event.threadID);
 }
 } catch (error) {
 console.error('Error fetching response:', error);
 api.sendMessage("Error fetching response.", event.threadID);
 }
};