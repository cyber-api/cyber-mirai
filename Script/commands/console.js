"use strict";

/**
 * Mirai-style per-message console logger.
 *
 * This is the clean rewrite of the old obfuscated `console.js`. It prints one
 * coloured 7-line block for every message, and `!console` toggles silence for
 * the current thread.
 *
 * IMPORTANT: `threadData.console === true` means SILENCE. This matches the old
 * Mirai behaviour: enabling console mode in a thread turns the per-message log
 * OFF for that thread (useful in busy groups).
 *
 * The regular `[INFO]`, `[WARN]` and `[ERROR]` lines from `utils/log.js` are
 * untouched and still print on top of this.
 */

const chalk = require("chalk");
const moment = require("moment-timezone");

/** The 26-colour palette from the original Mirai console.js, exactly. */
const COLOR_PALETTE = [
  "FF9900", "FFFF33", "33FFFF", "FF99FF", "FF3366", "FFFF66", "FF00FF",
  "66FF99", "00CCFF", "FF0099", "FF0066", "7900FF", "93FFD8", "CFFFDC",
  "FF5B00", "3B44F6", "A6D1E6", "7F5283", "A66CFF", "F05454", "FCF8E8",
  "94B49F", "47B5FF", "B8FFF9", "42C2FF", "FF7396",
];

const BANNER = "◆━━━━━━━━━◆𝐂𝐘𝐁𝐄𝐑 𝐁𝐎𝐓 𝐂𝐎𝐌𝐌𝐔𝐍𝐈𝐓𝐘◆━━━━━━━━◆";
const EMPTY_CONTENT = "Photos, videos or special characters";

/** Pick `count` random colours. A colour may repeat, just like the old bot. */
function pickColours(count) {
  const wanted = Math.max(1, Number(count) || 7);
  const colours = [];
  for (let index = 0; index < wanted; index++) {
    colours.push(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
  }
  return colours;
}

function paint(hex, text) {
  try {
    return chalk.hex(`#${hex}`)(String(text));
  } catch (error) {
    return String(text);
  }
}

function threadDataFor(threadID) {
  try {
    if (!global.data || !global.data.threadData) return {};
    return global.data.threadData.get(threadID) || {};
  } catch (error) {
    return {};
  }
}

function saveThreadData(threadID, threadData) {
  try {
    if (global.data && global.data.threadData) {
      global.data.threadData.set(threadID, threadData);
    }
  } catch (error) {
    /* in-memory only; never break message handling */
  }
}

module.exports.config = {
  name: "console",
  version: "2.0.0",
  hasPermssion: 3,
  credits: "CYBER BOT TEAM",
  description: "Toggle per-thread console logging (Mirai style).",
  commandCategory: "Admin-bot system",
  usages: "",
  cooldowns: 0,
};

/** `!console` — invert the thread's silence flag. */
module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;
  const threadData = threadDataFor(threadID);
  const silenced = threadData.console === true;

  threadData.console = !silenced;
  saveThreadData(threadID, threadData);

  const prefix = (global.config && global.config.PREFIX) || "!";
  const state = threadData.console ? "silenced (OFF)" : "active (ON)";
  return api.sendMessage(
    `✅ Console ${state} for this thread.\nUse ${prefix}console to toggle again.`,
    threadID,
    messageID
  );
};

/** Prints the 7 coloured lines for every message unless the thread is silenced. */
module.exports.handleEvent = async function ({ api, event }) {
  try {
    const { threadID, senderID, body } = event;
    if (!threadID) return;

    // console === true -> SILENCE this thread.
    const threadData = threadDataFor(threadID);
    if (threadData.console === true) return;

    // Never log the bot's own messages.
    let botID = null;
    try { botID = api.getCurrentUserID(); } catch (error) { botID = null; }
    if (botID && senderID && String(senderID) === String(botID)) return;

    // Group name (fall back to Inbox for DMs).
    let threadInfo = null;
    try {
      if (global.data && global.data.threadInfo) {
        threadInfo = global.data.threadInfo.get(threadID) || null;
      }
    } catch (error) {
      threadInfo = null;
    }
    if (!threadInfo) {
      try { threadInfo = await api.getThreadInfo(threadID); }
      catch (error) { threadInfo = null; }
    }
    const threadName = (threadInfo && threadInfo.threadName) || "Inbox";

    // Sender name.
    let senderName = "Unknown";
    if (senderID) {
      const uid = String(senderID);
      try {
        const userInfo = await api.getUserInfo(uid);
        if (userInfo && userInfo[uid] && userInfo[uid].name) {
          senderName = userInfo[uid].name;
        }
      } catch (error) {
        /* keep "Unknown" */
      }
    }

    const content = body && String(body).trim() ? String(body) : EMPTY_CONTENT;
    const colours = pickColours(7);
    const time = moment.tz("Asia/Dhaka").format("LLLL");

    const lines = [
      paint(colours[0], `[💓]→ Group name: ${threadName}`),
      paint(colours[1], `[🔎]→ Group ID: ${threadID}`),
      paint(colours[2], `[🔱]→ User name: ${senderName}`),
      paint(colours[3], `[📝]→ User ID: ${senderID || "unknown"}`),
      paint(colours[4], `[📩]→ Content: ${content}`),
      paint(colours[5], `[ ${time} ]`),
      paint(colours[6], BANNER),
    ];

    for (const line of lines) console.log(line);
  } catch (error) {
    // Logging must never break message handling.
    console.log(`[ CONSOLE ] ${error && error.message ? error.message : error}`);
  }
};
