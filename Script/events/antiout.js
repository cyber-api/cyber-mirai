module.exports.config = {
 name: "antiout",
 eventType: ["log:unsubscribe"],
 version: "1.1.0",
 credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
 description: "Re-adds members who leave when explicitly enabled (audited, rate-limited)"
};

const logger = require("../../utils/log.js");

const recentAdds = new Map();
const WINDOW_MS = 60 * 1000;

function overRateLimit(threadID, limit) {
 const now = Date.now();
 const history = (recentAdds.get(threadID) || []).filter((ts) => now - ts < WINDOW_MS);
 if (history.length >= limit) {
  recentAdds.set(threadID, history);
  return true;
 }
 history.push(now);
 recentAdds.set(threadID, history);
 return false;
}

module.exports.run = async ({ event, api, Threads, Users }) => {
 const settings = global.config.antiout || {};

 const threadID = String(event.threadID);
 const threadData = (await Threads.getData(threadID)) || {};
 const data = threadData.data || {};
 if (data.antiout !== true) return;

 const logData = event.logMessageData || {};
 const leftID = logData.leftParticipantFbId != null ? String(logData.leftParticipantFbId) : null;
 const botID = String(api.getCurrentUserID());
 if (!leftID || leftID === botID) return;

 // Only voluntary departures are re-added; admin removals are left alone.
 if (event.author == null || String(event.author) !== leftID) return;

 // Allow the operator/thread to exempt specific users (e.g. people who asked
 // to leave), and never trap bot admins or group admins.
 let info = null;
 try { info = await api.getThreadInfo(threadID); } catch (error) { info = null; }
 const adminIds = ((info && info.adminIDs) || []).map((item) => String(item.id));
 const exempt = new Set([
  ...((global.config.ADMINBOT || []).map(String)),
  ...((global.config.NDH || []).map(String)),
  ...adminIds,
  ...((data.antioutAllowList || []).map(String)),
 ]);
 if (exempt.has(leftID)) return;

 const limit = Number(settings.maxAddsPerMinute) > 0 ? Number(settings.maxAddsPerMinute) : 3;
 if (overRateLimit(threadID, limit)) {
  logger.warn(`[ ANTI-OUT ] rate limit reached in ${threadID}; not re-adding ${leftID}.`);
  return;
 }

 let name = "the member";
 try {
  name = global.data.userName.get(leftID) || await Users.getNameUser(leftID) || "the member";
 } catch (error) { name = "the member"; }

 await new Promise((resolve) => {
  api.addUserToGroup(leftID, threadID, (error) => {
   logger.audit({
    action: "antiout_readd",
    actor: leftID,
    target: leftID,
    detail: `thread=${threadID}`,
    result: error ? `error: ${error.message || error}` : "ok",
   });
   if (error) {
    api.sendMessage(
     `সরি, ${name}-কে আবার গ্রুপে যোগ করা যায়নি (ব্লক বা মেসেঞ্জার সীমাবদ্ধতা)।`,
     threadID
    );
   } else {
    api.sendMessage(
     `ℹ️ ${name} গ্ৰুপ থেকে বেরিয়ে গিয়েছিলেন, তাই আবার যোগ করা হয়েছে। থ্রেডে anti-out চালু আছে।`,
     threadID
    );
   }
   resolve();
  });
 });
};
