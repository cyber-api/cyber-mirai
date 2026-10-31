module.exports.config = {
 name: "antijoin",
 eventType: ["log:subscribe"],
 version: "1.1.0",
 credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
 description: "Removes new members when explicitly enabled for the thread"
};

const logger = require("../../utils/log.js");

// Per-thread sliding window so a mass-add cannot turn into a kick storm.
const recentKicks = new Map();
const WINDOW_MS = 60 * 1000;

function overRateLimit(threadID, limit) {
 const now = Date.now();
 const history = (recentKicks.get(threadID) || []).filter((ts) => now - ts < WINDOW_MS);
 if (history.length >= limit) {
  recentKicks.set(threadID, history);
  return true;
 }
 history.push(now);
 recentKicks.set(threadID, history);
 return false;
}

module.exports.run = async function ({ event, api, Threads }) {
 const settings = global.config.antijoin || {};

 const threadID = String(event.threadID);
 const threadData = (await Threads.getData(threadID)) || {};
 const data = threadData.data || {};
 if (data.newMember !== true) return;

 const logData = event.logMessageData || {};
 const added = Array.isArray(logData.addedParticipants) ? logData.addedParticipants : [];
 const botID = String(api.getCurrentUserID());
 if (added.some((item) => item && String(item.userFbId) === botID)) return;

 // Never remove the actor who added the members, group admins, bot admins, or
 // explicitly allow-listed users.
 let info = null;
 try { info = await api.getThreadInfo(threadID); } catch (error) { info = null; }
 const adminIds = ((info && info.adminIDs) || []).map((item) => String(item.id));
 const exempt = new Set([
  ...((global.config.ADMINBOT || []).map(String)),
  ...((global.config.NDH || []).map(String)),
  ...adminIds,
  ...((data.antijoinAllowList || []).map(String)),
  ...(event.author != null ? [String(event.author)] : []),
 ]);

 const limit = Number(settings.maxKicksPerMinute) > 0 ? Number(settings.maxKicksPerMinute) : 5;
 const targets = added
  .map((item) => item && item.userFbId != null ? String(item.userFbId) : null)
  .filter((id) => id && id !== botID && !exempt.has(id));

 for (const idUser of targets) {
  if (overRateLimit(threadID, limit)) {
   logger.warn(`[ ANTI-JOIN ] rate limit reached in ${threadID}; remaining joins left in place.`);
   break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await new Promise((resolve) => {
   api.removeUserFromGroup(idUser, threadID, (err) => {
    logger.audit({
     action: "antijoin_kick",
     actor: event.author != null ? String(event.author) : "unknown",
     target: idUser,
     detail: `thread=${threadID}`,
     result: err ? `error: ${err.message || err}` : "ok",
    });
    if (err) logger.warn(`[ ANTI-JOIN ] could not remove ${idUser} from ${threadID}: ${err.message || err}`);
    resolve();
   });
  });
 }

 if (targets.length) {
  return api.sendMessage(
   "» Anti-join removed " + targets.length + " new member(s). This thread has anti-join enabled.",
   threadID
  );
 }
};
