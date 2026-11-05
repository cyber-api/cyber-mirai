const { getFbAppToken } = require("../../utils/credentials.js");
module.exports = {
  config: {
    name: "fp",
    version: "1.1",
    credits: "𝐈𝐬𝐥𝐚𝐦𝐢𝐜𝐤 𝐂𝐲𝐛𝐞𝐫",
    countDown: 5,
    hasPermssion: 0,
    description: "PROFILE image",
    commandCategory: "image",
    usages: "{pn} @tag or userID or reply to a message or provide a Facebook URL" 
  },
  run: async function ({ event, api, usersData, args }) {
    const getAvatarUrl = async (uid) => await `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=${getFbAppToken()}`;
    const uid = Object.keys(event.mentions)[0] || args[0] || event.senderID;
    let avt;
    try {
      if (event.type === "message_reply") {
        avt = await getAvatarUrl(event.messageReply.senderID);
      } else if (args.join(" ").includes("facebook.com")) {
        const match = args.join(" ").match(/(\d+)/);
        if (match) avt = await getAvatarUrl(match[0]);
        else throw new Error("Invalid Facebook URL.");
      } else {
        avt = await getAvatarUrl(uid);
      }
      api.sendMessage({ body: "", attachment: (await require('../../utils/httpClient').get(avt,{ responseType: 'stream' })).data }, event.threadID, event.messageID);
    } catch (error) {
      api.sendMessage(`⚠ Error: ${error.message}`,event.threadID, event.messageID);
    }
  }
};
