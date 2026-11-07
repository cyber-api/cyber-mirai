// Fork-link command, rewritten from the obfuscated original.
// The original file called `require` through an obfuscated helper parameter and
// threw `TypeError: _0x3d0133 is not a function` on every invocation.
"use strict";

const fs = require("fs-extra");
const path = require("path");
const httpClient = require("../../utils/httpClient");

module.exports.config = {
  name: "fork",
  version: "1.0.2",
  hasPermssion: 0,
  credits: "Islamick Chat",
  description: "public fork link",
  commandCategory: "public",
  cooldowns: 1,
  dependencies: {
    "fs-extra": "",
    "axios": ""
  }
};

const MESSAGE = `╭•┄┅════❁🌺❁════┅┄•╮\n   আসসালামু আলাইকুম-!!🖤💫\n╰•┄┅════❁🌺❁════┅┄•╯\n\nআপনি আমাদের ইসলামিক মেসেঞ্জার রোবোট টি ব্যবহার করে চাইলে,  নিজের দেওয়া ইউটিউব ভিডিও লিংক থেকে দেখে শিখে নিতে পারবেন কিভাবে রোবটটি চালাবেন\n\n আপনি C3C zip file এবং kiwi browser লিংক আমাদের web site এ পয়ে জাবেন।\n web site link  and fork লিংক নিচে দেওয়া থাকবে-!!✨💖\nআরও নতুন নতুন ফাইল updated  গুলো আমাদের গ্রুপ এ দেওয়া হবে-!!📂\n\nনতুন নতুন update file পেতে আমাদের গ্রুপ এর সাথেই থাকবেন-!!✨🧡\n\n\n       𝐅𝐎𝐑𝐊 𝐋𝐈𝐍𝐊.  https://github.com/mahbub-shaon/CYBER-BOT-COMMUNITY.git\n\n YOUTUBE VIDEO 📷 :- https://youtu.be/qHUMWc7CTS8?si=N5abO6d9SnnwMJJr \n\n   🌐𝐖𝐄𝐁 𝐒𝐈𝐓𝐄 𝐋𝐈𝐍𝐊.  https://bio.link/mahbub_shaon\n\n𝐆𝐫𝐨𝐮𝐩 𝐋𝐢𝐧𝐤:- https fron.m.me/j/AbY9JRzH2X7k9weO/         \n\n SUPPORT 𝐆𝐫𝐨𝐮𝐩 𝐋𝐢𝐧𝐤:- https://m.me/j/AbaYeTodykMcGSTO/`;

const MEDIA_URLS = [
  "https://i.imgur.com/gSW285Z.gif",
  "https://i.postimg.cc/QdgH08j6/Messenger-creation-C2-A39-DCF-A8-E7-4-FC7-8715-2559476-FEEF4.gif"
];

module.exports.run = async function ({ api, event }) {
  const cacheDir = path.join(__dirname, "cache");
  const target = path.join(cacheDir, "justwa.jpg");
  const cleanup = () => {
    try { fs.unlinkSync(target); } catch (error) { /* best effort */ }
  };
  const sendTextOnly = () => api.sendMessage(MESSAGE, event.threadID, event.messageID);

  try {
    fs.ensureDirSync(cacheDir);
    const url = MEDIA_URLS[Math.floor(Math.random() * MEDIA_URLS.length)];
    const response = await httpClient({
      url: encodeURI(url),
      method: "GET",
      responseType: "stream"
    });

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(target);
      response.data.on("error", reject);
      out.on("error", reject);
      out.on("close", resolve);
      response.data.pipe(out);
    });

    return api.sendMessage(
      { body: MESSAGE, attachment: fs.createReadStream(target) },
      event.threadID,
      cleanup,
      event.messageID
    );
  } catch (error) {
    cleanup();
    return sendTextOnly();
  }
};
