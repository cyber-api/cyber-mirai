module.exports.config = {
 name: "autosend",
 eventType: ["log:subscribe"], // Changed from empty to log:subscribe to at least be valid, though it seems to be a time-based task
 version: "0.0.1",
 credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
 description: "Listen events"
};

module.exports.run = async({ event, api, Threads, Users }) => {
const moment = require("moment-timezone");
const time = moment.tz('Asia/Dhaka').format('HH:mm:ss');
var cantsend = [];
    var allThread = global.data.allThreadID || [];
    if (time == "17:22:00") {
    for (const idThread of allThread) {
        if (isNaN(parseInt(idThread)) || idThread == event.threadID) continue;
        else {
            api.sendMessage("test" , idThread, (error, info) => {
                if (error) cantsend.push(idThread);
            });
        }
      }
    for (var id of global.config.ADMINBOT) {
          api.sendMessage(`Error when automatically sending messages to threads:\n${cantsend.join("\n")}`,id);
    }
  }
};
