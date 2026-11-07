// islam command: sends a random Islamic video from Google Drive links, rewritten to use httpClient
"use strict";

const fs = require("fs-extra");
const path = require("path");
const httpClient = require("../../utils/httpClient");

module.exports.config = {
  name: "islam",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Islamick Chat",
  description: "prefix VEDIO",
  commandCategory: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑰_ ☢️",
  usages: "love10 vedio",
  cooldowns: 5,
  dependencies: {
    "fs-extra": "",
    "axios": ""
  }
};

const hi = [
  "•┄┅════❁🌺❁════┅┄•\n\nআসসালামু আলাইকুম-!!🖤💫প্রিয় ভাই ও বন - তুমাদের জন্য নিয়ে আসলাম আমি ইসলামিক ভিডিও \n\n•┄┅════❁🌺❁════┅┄•"
];

const links = [
  "https://drive.google.com/uc?id=1Y5O3qRzxt-MFR4vVhz0QsMwHQmr-34iH",
  "https://drive.google.com/uc?id=1YDyNrN-rnzsboFmYm8Q5-FhzoJD9WV3O",
  "https://drive.google.com/uc?id=1XzgEzopoYBfuDzPsml5-RiRnItXVx4zW",
  "https://drive.google.com/uc?id=1YEeal83MYRI9sjHuEhJdjXZo9nVZmfHD",
  "https://drive.google.com/uc?id=1YMEDEKVXjnHE0KcCJHbcT2PSbu8uGSk4",
  "https://drive.google.com/uc?id=1YRb2k01n4rIdA9Vf69oxIOdv54JyAprD",
  "https://drive.google.com/uc?id=1YSQCTVhrHTNl6B9xSBCQ7frBJ3bp_KoA",
  "https://drive.google.com/uc?id=1Yc9Rwwdpqha1AWeEb5BXV-goFbag0441",
  "https://drive.google.com/uc?id=1YcwtkC5wRbbHsAFuEQYQuwQsH4-ZiBS8",
  "https://drive.google.com/uc?id=1YhfyPl8oGmsIAIOjWQyzQYkDdZUPSalo"
];

module.exports.run = async function ({ api, event }) {
  const cacheFile = path.join(__dirname, "cache", "15.mp4");
  const cleanup = () => {
    try { fs.unlinkSync(cacheFile); } catch (_) {}
  };
  const sendTextOnly = () => api.sendMessage(hi[Math.floor(Math.random() * hi.length)], event.threadID, event.messageID);

  try {
    fs.ensureDirSync(path.join(__dirname, "cache"));
    const url = links[Math.floor(Math.random() * links.length)];
    const response = await httpClient.fetchWithRetry(url, { responseType: "stream" });

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(cacheFile);
      response.data.on("error", reject);
      out.on("error", reject);
      out.on("close", resolve);
      response.data.pipe(out);
    });

    return api.sendMessage(
      { body: hi[Math.floor(Math.random() * hi.length)], attachment: fs.createReadStream(cacheFile) },
      event.threadID,
      cleanup,
      event.messageID
    );
  } catch (error) {
    cleanup();
    return sendTextOnly();
  }
};
