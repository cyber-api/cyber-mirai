// islamic command: sends a random Islamic video from imgur links, rewritten to use httpClient and migration JSON
"use strict";

const fs = require("fs-extra");
const path = require("path");
const httpClient = require("../../utils/httpClient");

module.exports.config = {
  name: "islamic",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑰_ ☢️",
  description: "RANDOM islamic video",
  commandCategory: "Random video",
  usages: "Statusvideo",
  cooldowns: 2,
  dependencies: {
    "fs-extra": "",
    "axios": ""
  }
};

const MESSAGE_BODY = `╭──────•◈•───────╮\n\n🌻মানুষ হারাম ছাড়েনা অথচ সুখ শান্তি খুঁজে বেড়ায় আরাম \nমানুষ কেন বুঝতে চায় না\n সে যে খোদার গোলাম🥺। \n\nআল্লাহ আমাদের সবাইকে হারাম থেকে দূরে থাকার তৌফিক দান করুক 😭❤️‍🩹।\n\n𝗠𝗔𝗛𝗘 𝗕𝗬: 𝗜𝘀𝗹𝗮𝗺𝗶𝗰𝗸 𝗰𝗵𝗮𝘁 𝗯𝗼𝘁 \n╰──────•◈•───────╯`;

const LINKS = [
  "https://i.imgur.com/FbnZI40.mp4",
  "https://i.imgur.com/8k6OOZg.mp4",
  "https://i.imgur.com/lgQghHX.mp4",
  "https://i.imgur.com/D7HZFSg.mp4",
  "https://i.imgur.com/vUe9Zlv.mp4",
  "https://i.imgur.com/oxFuJYw.mp4",
  "https://i.imgur.com/OKKlDBN.mp4",
  "https://i.imgur.com/6wWebFc.mp4",
  "https://i.imgur.com/K2LTmaA.mp4",
  "https://i.imgur.com/i9vKvTd.mp4",
  "https://i.imgur.com/Y6uBzxx.mp4",
  "https://i.imgur.com/ULtFVPQ.mp4",
  "https://i.imgur.com/wX8WJh3.mp4",
  "https://i.imgur.com/6A42EIx.mp4",
  "https://i.imgur.com/ozRevxt.mp4",
  "https://i.imgur.com/Gd49ZSo.mp4",
  "https://i.imgur.com/xu6lBXk.mp4",
  "https://i.imgur.com/sDNohv4.mp4",
  "https://i.imgur.com/JBu2Ie3.mp4",
  "https://i.imgur.com/UaY42rq.mp4",
  "https://i.imgur.com/NFxf731.mp4",
  "https://i.imgur.com/vv1HsMC.mp4",
  "https://i.imgur.com/Y8MPzLv.mp4",
  "https://i.imgur.com/9M1v1qK.mp4",
  "https://i.imgur.com/EgUy7v0.mp4",
  "https://i.imgur.com/IjDqg2G.mp4",
  "https://i.imgur.com/51NYqmO.mp4",
  "https://i.imgur.com/XjfJHh9.mp4",
  "https://i.imgur.com/XHrkPt4.mp4",
  "https://i.imgur.com/mqEYRdy.mp4",
  "https://i.imgur.com/NaVsFmQ.mp4",
  "https://i.imgur.com/31XSmVj.mp4",
  "https://i.imgur.com/PPamCPI.mp4",
  "https://i.imgur.com/i6Iy7iN.mp4"
];

// Load migration mapping (old -> new, status) from assets/image-migration.json
const loadMigrationMap = () => {
  const migrationPath = path.join(__dirname, "../../assets/image-migration.json");
  try {
    const data = fs.readFileSync(migrationPath, "utf8");
    const json = JSON.parse(data);
    const map = new Map();
    for (const entry of json.entries) {
      map.set(entry.old, { new: entry.suggested_host ? `https://${entry.suggested_host}/${entry.old.split("/").pop()}` : null, status: entry.status, detail: entry.detail });
    }
    return map;
  } catch (_) {
    return new Map();
  }
};

module.exports.run = async function ({ api, event }) {
  const cacheFile = path.join(__dirname, "cache", "1.mp4");
  const cleanup = () => {
    try { fs.unlinkSync(cacheFile); } catch (_) {}
  };
  const sendTextOnly = () => api.sendMessage(MESSAGE_BODY, event.threadID, event.messageID);
  const migrationMap = loadMigrationMap();

  try {
    fs.ensureDirSync(path.join(__dirname, "cache"));
    const url = LINKS[Math.floor(Math.random() * LINKS.length)];
    const mapping = migrationMap.get(url);

    if (mapping && mapping.status === "migrated" && mapping.new) {
      const response = await httpClient.fetchWithRetry(mapping.new, { responseType: "stream" });
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(cacheFile);
        response.data.on("error", reject);
        out.on("error", reject);
        out.on("close", resolve);
        response.data.pipe(out);
      });
      return api.sendMessage(
        { body: MESSAGE_BODY, attachment: fs.createReadStream(cacheFile) },
        event.threadID,
        cleanup,
        event.messageID
      );
    }

    // Fallback: if migration pending or not found, try original url (imgur) with httpClient (should be blocked); fallback to text only.
    cleanup();
    return sendTextOnly();
  } catch (error) {
    cleanup();
    return sendTextOnly();
  }
};
