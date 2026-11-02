const { getAdminInfo } = require("../../utils/adminInfo.js");

module.exports.config = {
  name: 'allbox',
  version: '1.0.0',
  credits: '𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️',
  hasPermssion: 2,
  description: '[Ban/Unban/Del/Remove] List[Data] thread The bot has joined in.',
  commandCategory: 'Admin',
  usages: '[page number/all]',
  cooldowns: 5
};

module.exports.handleReply = async function ({ api, event, args, Threads, handleReply }) {
  const { threadID, messageID } = event;
  if (parseInt(event.senderID) !== parseInt(handleReply.author)) return;
  const moment = require("moment-timezone");
  const time = moment.tz("Asia/Dhaka").format("HH:MM:ss L");
  var arg = event.body.split(" ");
  var idgr = handleReply.groupid[arg[1] - 1];
  var groupName = handleReply.groupName[arg[1] - 1];
  switch (handleReply.type) {
    case "reply":
      {
        if (arg[0] == "ban" || arg[0] == "Ban") {
          const data = (await Threads.getData(idgr)).data || {};
          data.banned = 1;
          data.dateAdded = time;
          await Threads.setData(idgr, { data });
          global.data.threadBanned.set(idgr, { dateAdded: data.dateAdded });
          return api.sendMessage(`»Notifications from Owner ${getAdminInfo().name}«\n\n Group of Friends Have been banned from using bots by Ban.`, idgr, () =>
            api.sendMessage(`${api.getCurrentUserID()}`, () =>
              api.sendMessage(`★★BanSuccess★★\n\n🔷${groupName} \n🔰TID:${idgr}`, threadID, () =>
                api.unsendMessage(handleReply.messageID))));
        }

        if (arg[0] == "unban" || arg[0] == "Unban" || arg[0] == "ub" || arg[0] == "Ub") {
          const data = (await Threads.getData(idgr)).data || {};
          data.banned = 0;
          data.dateAdded = null;
          await Threads.setData(idgr, { data });
          global.data.threadBanned.delete(idgr, 1);
          return api.sendMessage(`»Notifications from Owner ${getAdminInfo().name}«\n\n Group Of Friends That Have Been Removed Board`, idgr, () =>
            api.sendMessage(`${api.getCurrentUserID()}`, () =>
              api.sendMessage(`★★𝐔𝐧𝐛𝐚𝐧𝐒𝐮𝐜𝐜𝐞𝐬𝐬★★\n\n🔷${groupName} \n🔰𝐓𝐈𝐃:${idgr} `, threadID, () =>
                api.unsendMessage(handleReply.messageID))));
        }

        if (arg[0] == "del" || arg[0] == "Del") {
          const data = (await Threads.getData(idgr)).data || {};
          await Threads.delData(idgr, { data });
          console.log(groupName)
          api.sendMessage(`★★𝐃𝐞𝐥𝐒𝐮𝐜𝐜𝐞𝐬𝐬★★\n\n🔷${groupName} \n🔰𝐓𝐈𝐃: ${idgr} \n Successfully deleted the data!`, event.threadID, event.messageID);
          break;
        }

        if (arg[0] == "out" || arg[0] == "Out") {
          api.sendMessage(`»Notifications from Owner ${getAdminInfo().name}«\n\n ★★Deleted from chat★★ group`, idgr, () =>
            api.sendMessage(`${api.getCurrentUserID()}`, () =>
              api.sendMessage(`★★𝐎𝐮𝐭𝐒𝐮𝐜𝐜𝐞𝐬𝐬★★\n\n🔷${groupName} \n🔰𝐓𝐈𝐃:${idgr} `, threadID, () =>
                api.unsendMessage(handleReply.messageID, () =>
                  api.removeUserFromGroup(`${api.getCurrentUserID()}`, idgr)))));
          break;
        }
      }
  }
};
module.exports.run = async function ({ api, event, args }) {
  switch (args[0]) {
    case "all":
      {
        var threadList = [];
        var data, msg = "";
        /////////
        try {
          data = await api.getThreadList(100, null, ["INBOX"]);
        } catch (e) {
          console.log(e);
        }
        for (const thread of data) {
          if (thread.isGroup == true) threadList.push({ threadName: thread.name, threadID: thread.threadID, messageCount: thread.messageCount });
        }
        /////////////////////////////////////////////////////
        //===== sắp xếp từ cao đến thấp cho từng nhóm =====//
        threadList.sort((a, b) => {
          if (a.messageCount > b.messageCount) return -1;
          if (a.messageCount < b.messageCount) return 1;
        })

        var groupid = [];
        var groupName = [];
        var page = 1;
        page = parseInt(args[0]) || 1;
        page < -1 ? page = 1 : "";
        var limit = 100;
        var msg = "🎭DS GROUP [Data]🎭\n\n";
        var numPage = Math.ceil(threadList.length / limit);

        for (var i = limit * (page - 1); i < limit * (page - 1) + limit; i++) {
          if (i >= threadList.length) break;
          let group = threadList[i];
          msg += `${i + 1}. ${group.threadName}\n🔰𝐓𝐈𝐃: ${group.threadID}\n💌𝐌𝐞𝐬𝐬𝐚𝐠𝐞𝐂𝐨𝐮𝐧𝐭: ${group.messageCount}\n`;
          groupid.push(group.threadID);
          groupName.push(group.threadName);
        }
        msg += `--Page ${page}/${numPage}--\nDy ${global.config.PREFIX}allbox page number/all\n\n`

        api.sendMessage(msg + '🎭Reply Out, Ban, Unban, Del[data] the order number to Out, Ban, Unban, Del[data] that thread!', event.threadID, (e, data) =>
          global.client.handleReply.push({
            name: this.config.name,
            author: event.senderID,
            messageID: data.messageID,
            groupid,
            groupName,
            type: 'reply'
          })
        )
      }
      break;

    default:
      /*
          var threadList = [];
          var data, msg = "";
          /////////
          try {
              data = await api.getThreadList(1000, null, ["INBOX"]);
          } catch (e) {
              console.log(e);
          }
          for (const thread of data) {
              if (thread.isGroup == true) threadList.push({ threadName: thread.name, threadID: thread.threadID, messageCount: thread.messageCount });
          }
          /////////////////////////////////////////////////////
          //===== sắp xếp từ cao đến thấp cho từng nhóm =====//
          threadList.sort((a, b) => {
              if (a.messageCount > b.messageCount) return -1;
              if (a.messageCount < b.messageCount) return 1;
          })

          var groupid = [];
          var groupName = [];
          var page = 1;
          page = parseInt(args[0]) || 1;
          page < -1 ? page = 1 : "";
          var limit = 10;
          var msg = "🎭DS NHÓM [Data]🎭\n\n";
          var numPage = Math.ceil(threadList.length / limit);

          for (var i = limit * (page - 1); i < limit * (page - 1) + limit; i++) {
              if (i >= threadList.length) break;
              let group = threadList[i];
              msg += `${i+1}. ${group.threadName}\n🔰𝐓𝐈𝐃: ${group.threadID}\n💌MessageCount: ${group.messageCount}\n\n`;
              groupid.push(group.threadID);
              groupName.push(group.threadName);
          }
          msg += `--Trang ${page}/${numPage}--\nDùng ${global.config.PREFIX}allbox + số trang/all\n\n`

          api.sendMessage(msg + '🎭Reply Out, Ban, Unban, Del[data]+ số thứ tự để Out, Ban, Unban, Del[data] thread đó!', event.threadID, (e, data) =>
              global.client.handleReply.push({
                  name: this.config.name,
                  author: event.senderID,
                  messageID: data.messageID,
                  groupid,
                  groupName,
                  type: 'reply'
              })
          );
          break;
  }*/

      const { threadID, messageID } = event;
      var threadList = [];
      var data, msg = "";
      i = 1;
      /////////
      try {
		  //var listUserID = event.participantIDs.filter(ID => ID);
        data = global.data.allThreadID;
		
      } catch (e) {
        console.log(e);
      }
      for (const thread of data) {
        var nameThread = await global.data.threadInfo.get(thread).threadName || "The name doesn't exist.";
         threadList.push(`${i++}. ${nameThread} \n🔰𝐓𝐈𝐃: ${thread}`);
		  //console.log(`${nameThread}`);
      }
 
	   return api.sendMessage(threadList.length != 0 ? api.sendMessage(`🍄There is currently ${threadList.length} group\n\n${threadList.join("\n")}`,
          threadID,
          messageID
        ) : "There is currently no group!", threadID, messageID);
      
      }
  };
