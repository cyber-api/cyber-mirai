module.exports.config = {
    name: "autosetname",
    version: "1.1.0",
    hasPermssion: 1,
    credits: "𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️",
    description: "Automatic nickname prefix for new members (opt-in)",
    commandCategory: "Box Chat",
    usages: "[add <name> / remove] ",
    cooldowns: 5
};

module.exports.onLoad = () => {
    const fs = global.nodemodule["fs-extra"];
    const path = global.nodemodule["path"];
    const pathData = path.join(__dirname, "cache", "autosetname.json");
    if (!fs.existsSync(pathData)) fs.writeFileSync(pathData, "[]", "utf-8");
};

module.exports.run = async function ({ event, api, args, Users }) {
    const { threadID, messageID } = event;
    const fs = global.nodemodule["fs-extra"];
    const path = global.nodemodule["path"];

    const pathData = path.join(__dirname, "cache", "autosetname.json");
    let dataJson;
    try {
        dataJson = JSON.parse(fs.readFileSync(pathData, "utf-8"));
        if (!Array.isArray(dataJson)) dataJson = [];
    } catch (error) {
        return api.sendMessage("The nickname configuration file is unreadable; ask the bot owner to repair it.", threadID, messageID);
    }

    const content = args.slice(1).join(" ").trim();
    let thisThread = dataJson.find(item => item && String(item.threadID) === String(threadID));
    if (!thisThread) {
        thisThread = { threadID, nameUser: [], enabled: false };
        dataJson.push(thisThread);
    }
    if (!Array.isArray(thisThread.nameUser)) thisThread.nameUser = [];

    switch ((args[0] || "").toLowerCase()) {
        case "add": {
            if (!content) return api.sendMessage("The nickname prefix must not be empty.", threadID, messageID);
            if (thisThread.nameUser.length > 0) {
                return api.sendMessage("Remove the old nickname prefix before adding a new one.", threadID, messageID);
            }
            // Bound and strip control characters so a prefix cannot break names.
            thisThread.nameUser = [content.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 24)];
            thisThread.enabled = true;

            let name = "you";
            try {
                const userData = await Users.getData(event.senderID);
                if (userData && userData.name) name = userData.name;
            } catch (error) { /* preview only */ }

            fs.writeFileSync(pathData, JSON.stringify(dataJson, null, 4), "utf-8");
            return api.sendMessage(`Nickname prefix configured.\nPreview: ${thisThread.nameUser[0]} ${name}`, threadID, messageID);
        }
        case "rm":
        case "remove":
        case "delete": {
            if (thisThread.nameUser.length === 0 && thisThread.enabled !== true) {
                return api.sendMessage("This thread has no nickname prefix configured.", threadID, messageID);
            }
            thisThread.nameUser = [];
            thisThread.enabled = false;
            fs.writeFileSync(pathData, JSON.stringify(dataJson, null, 4), "utf-8");
            return api.sendMessage("Removed the new-member nickname prefix.", threadID, messageID);
        }
        default: {
            return api.sendMessage(
                "Use: autosetname add <prefix> | autosetname remove",
                threadID,
                messageID
            );
        }
    }
};
