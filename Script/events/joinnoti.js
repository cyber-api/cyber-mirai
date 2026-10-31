const { getFbAppToken } = require("../../utils/credentials.js");
const { sanitizeCanvasText, safeId, fetchImageBuffer } = require("../../utils/canvasSafety.js");
const fs = require("fs-extra");
const path = require("path");
const Canvas = require("canvas");

module.exports.config = {
  name: "joinnoti",
  version: "1.1.0",
  credits: "Maria (rX Modded) + Updated by rX Abdullah",
  description: "Welcome new member with profile pic and random background",
  eventType: ["log:subscribe"],
  dependencies: {
    "canvas": "",
    "axios": "",
    "fs-extra": ""
  }
};

const BG_HOSTS = ["i.postimg.cc"];

function unlinkQuiet(file) {
  try { if (file && fs.existsSync(file)) fs.unlinkSync(file); } catch (error) { /* ignore */ }
}

module.exports.run = async function ({ api, event, Users }) {
  const { threadID, logMessageData } = event;
  const added = Array.isArray(logMessageData && logMessageData.addedParticipants)
    ? logMessageData.addedParticipants[0]
    : null;
  if (!added) return;

  const userID = added.userFbId != null ? String(added.userFbId) : "";
  if (!/^\d{5,20}$/.test(userID)) return;

  // Welcome text is user-controlled; bound it before drawing (F-18).
  const userName = sanitizeCanvasText(added.fullName || "New member", 36);

  let groupName = "this group";
  let memberCount = 0;
  try {
    const threadInfo = await api.getThreadInfo(threadID);
    groupName = sanitizeCanvasText(threadInfo.threadName || "this group", 40);
    memberCount = Array.isArray(threadInfo.participantIDs) ? threadInfo.participantIDs.length : 0;
  } catch (error) { /* use defaults */ }

  const adderID = event.author;
  let adderName = "Unknown";
  try { adderName = sanitizeCanvasText((await Users.getNameUser(adderID)) || "Unknown", 32); } catch (error) { /* ignore */ }

  const bgURLs = [
    "https://i.postimg.cc/904gjPHn/images-11.jpg",
    "https://i.postimg.cc/8k3nmYhQ/images-10.jpg",
    "https://i.postimg.cc/KjdqcKZv/images-9.jpg",
    "https://i.postimg.cc/28Z9cxwq/images-8.jpg"
  ];
  const bgURL = bgURLs[Math.floor(Math.random() * bgURLs.length)];
  const avatarURL = `https://graph.facebook.com/${userID}/picture?width=512&height=512&access_token=${encodeURIComponent(getFbAppToken())}`;

  const cacheDir = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);

  // Filenames use a digit-only ID, so they cannot escape the cache directory.
  const idSafe = safeId(userID);
  const bgPath = path.join(cacheDir, `bg_${idSafe}_${Date.now()}.jpg`);
  const avatarPath = path.join(cacheDir, `avt_${idSafe}_${Date.now()}.png`);
  const outPath = path.join(cacheDir, `welcome_${idSafe}_${Date.now()}.png`);

  try {
    const bgImg = await fetchImageBuffer(bgURL, { allowedHosts: BG_HOSTS, maxBytes: 5 * 1024 * 1024 });
    fs.writeFileSync(bgPath, bgImg, { mode: 0o600 });

    const avatarImg = await fetchImageBuffer(avatarURL, { allowedHosts: ["graph.facebook.com"], maxBytes: 5 * 1024 * 1024 });
    fs.writeFileSync(avatarPath, avatarImg, { mode: 0o600 });

    const canvas = Canvas.createCanvas(800, 500);
    const ctx = canvas.getContext("2d");

    const background = await Canvas.loadImage(bgPath);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    const avatarSize = 180;
    const avatarX = (canvas.width - avatarSize) / 2;
    const avatarY = 100;

    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 8, 0, Math.PI * 2, false);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    const avatar = await Canvas.loadImage(avatarPath);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.font = "bold 36px Arial";
    ctx.fillStyle = "#FFB6C1";
    ctx.fillText(userName, canvas.width / 2, avatarY + avatarSize + 50);

    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "#00FFFF";
    ctx.fillText(groupName, canvas.width / 2, avatarY + avatarSize + 90);

    ctx.font = "bold 28px Arial";
    ctx.fillStyle = "#FFFF00";
    ctx.fillText(`You are the ${memberCount}th member of this group`, canvas.width / 2, avatarY + avatarSize + 130);

    fs.writeFileSync(outPath, canvas.toBuffer(), { mode: 0o600 });

    const message = {
      body: `‎🌸 ʜᴇʟʟᴏ @${userName}
🎀 ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴏᴜʀ ɢʀᴏᴜᴘ — ${groupName}
📌 ʏᴏᴜ'ʀᴇ ᴛʜᴇ ${memberCount} ᴍᴇᴍʙᴇʀ ᴏɴ ᴛʜɪꜱ ɢʀᴏᴜᴘ!
💬 ғᴇᴇʟ ғʀᴇᴇ ᴛᴏ ᴄʜᴀᴛ, ᴄᴏɴɴᴇᴄᴛ ᴀɴᴅ ʜᴀᴠᴇ ꜰᴜɴ ʜᴇʀᴇ!
ᰔ Sııƞƞeɽ мΛяเα 倫ッ
━━━━━━━━━━━━━━━━
📅 ${new Date().toLocaleTimeString("en-US", { hour12: true, timeZone: "Asia/Dhaka" })} - ${new Date().toLocaleDateString("en-GB")} - ${new Date().toLocaleDateString("en-US", { weekday: "long" })}`,
      mentions: [
        { tag: `@${userName}`, id: userID }
      ],
      attachment: fs.createReadStream(outPath)
    };

    api.sendMessage(message, threadID, () => {
      unlinkQuiet(bgPath);
      unlinkQuiet(avatarPath);
      unlinkQuiet(outPath);
    });
  } catch (error) {
    unlinkQuiet(bgPath);
    unlinkQuiet(avatarPath);
    unlinkQuiet(outPath);
    console.error("Joinnoti error:", error && error.message ? error.message : error);
    api.sendMessage("𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐲𝐩𝐞 !𝐡𝐞𝐥𝐩 𝐟𝐨𝐫 𝐚𝐥𝐥 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐬 ⚙️", threadID);
  }
};
