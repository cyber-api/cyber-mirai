// includes/listen.js
module.exports = function ({ api, models }) {
    // প্রয়োজনীয় মডিউলগুলো লোড করা
    const fs = require('fs-extra');
    const path = require('path');
    const httpClient = require("../utils/httpClient");
    const moment = require("moment-timezone");
    const log = require("../utils/log.js");
    const { isAdmin } = require("../utils/adminAuth.js");

    // global.nodemodule সেট করা (পুরনো স্ক্রিপ্টগুলোর সাপোর্টের জন্য)
    global.nodemodule = global.nodemodule || {};
    global.nodemodule["fs"] = fs;
    global.nodemodule["path"] = path;
    global.nodemodule["axios"] = httpClient; // Use httpClient for compatibility
    global.nodemodule["moment-timezone"] = moment;

    // global.join সেট করা (TypeError ফিক্স করার জন্য)
    global.join = global.config.join || {};

    // কন্ট্রোলারগুলো লোড করা
    const userController = require("./controllers/users")({
        'models': models,
        'api': api
    });
    const threadController = require("./controllers/threads")({
        'models': models,
        'api': api
    });
    const currencyController = require("./controllers/currencies")({
        'models': models
    });

    // ইভেন্ট হ্যান্ডলারগুলো লোড করা
    const handleCommand = require("./handle/handleCommand")({ api, models, Users: userController, Threads: threadController, Currencies: currencyController });
    const handleCommandEvent = require("./handle/handleCommandEvent")({ api, models, Users: userController, Threads: threadController, Currencies: currencyController });
    const handleReply = require("./handle/handleReply")({ api, models, Users: userController, Threads: threadController, Currencies: currencyController });
    const handleReaction = require("./handle/handleReaction")({ api, models, Users: userController, Threads: threadController, Currencies: currencyController });
    const handleEvent = require("./handle/handleEvent")({ api, models, Users: userController, Threads: threadController, Currencies: currencyController });
    const handleCreateDatabase = require("./handle/handleCreateDatabase")({ api, Threads: threadController, Users: userController, Currencies: currencyController, models });

    // --- ১. Auto Refresh AppState (নিরাপদ করা হয়েছে) ---
    if (global.config.autoRefreshFbstate) {
        setInterval(() => {
            try {
                const appState = api.getAppState();
                const mainPath = global.client.mainPath || process.cwd();
                // Refresh the session file that actually produced this login:
                // appstate.json / appstate2.json / appstate3.json, whichever logged in.
                const appStatePath = global.client.sessionFile
                    || path.join(mainPath, (global.config.APPSTATEPATH || "appstate.json"));
                fs.writeFileSync(appStatePath, JSON.stringify(appState, null, '\x09'), { encoding: "utf8", mode: 0o600 });
                try { fs.chmodSync(appStatePath, 0o600); } catch (e) { /* best effort */ }
            } catch (e) {
                log.error("Failed to auto refresh AppState", "[ REFRESH ]");
            }
        }, 1000 * 60 * 60); // প্রতি ১ ঘণ্টায়
    }

    // --- ২. Interaction Report Logic ---
    var currentDay = moment.tz("Asia/Dhaka").day();
    const interactionPath = __dirname + "/../Script/commands/checktuongtac/";

    setInterval(async () => {
        // Cheap day check every minute; the expensive work only runs on a day
        // rollover, with a guard against overlapping runs (F-37/F-38).
        try {
            const today = moment.tz("Asia/Dhaka").day();
            // includes() on the original arrays keeps the remote-admin Proxy working.
            const isAuthorizedUser = (id) => isAdmin(id, global.config);
            if (currentDay == today || global.client.sending_top) return;
            currentDay = today;
            global.client.sending_top = true;
            {
                if (!fs.existsSync(interactionPath)) return;
                const interactionFiles = fs.readdirSync(interactionPath).filter(fileName => {
                    const id = fileName.replace(".json", '');
                    return isAuthorizedUser(id) || global.data.allThreadID.includes(id);
                });

                for (const file of interactionFiles) {
                    const threadID = file.replace(".json", '');
                    const data = JSON.parse(await fs.promises.readFile(interactionPath + file, "utf8"));
                    let topUsers = [];
                    let rank = 1;

                    for (const user of data.day) {
                        const userName = (await userController.getNameUser(user.id)) || "User";
                        user.name = userName;
                        topUsers.push(user);
                    }

                    topUsers.sort((a, b) => (a.count > b.count) ? -1 : (a.count < b.count ? 1 : a.name.localeCompare(b.name)));

                    let messageBody = "== DAILY INTERACTION REPORT ==\n\n";
                    messageBody += topUsers.slice(0, 10).map(user => rank++ + ". " + user.name + ": " + user.count + " messages").join("\n");

                    api.sendMessage(messageBody, threadID, error => error ? console.log(error) : '');

                    data.day.forEach(user => { user.count = 0; });
                    data.time = today;
                    await fs.promises.writeFile(interactionPath + file, JSON.stringify(data, null, 4), { mode: 0o600 });
                }

                if (today == 1) { // Weekly Report
                    for (const file of interactionFiles) {
                        const threadID = file.replace(".json", '');
                        const data = JSON.parse(await fs.promises.readFile(interactionPath + file, "utf8"));
                        let topUsers = [];
                        let rank = 1;

                        for (const user of data.week) {
                            const userName = (await userController.getNameUser(user.id)) || "User";
                            user.name = userName;
                            topUsers.push(user);
                        }

                        topUsers.sort((a, b) => (a.count > b.count) ? -1 : (a.count < b.count ? 1 : a.name.localeCompare(b.name)));

                        let messageBody = "== WEEKLY INTERACTION REPORT ==\n\n";
                        messageBody += topUsers.slice(0, 10).map(user => rank++ + ". " + user.name + ": " + user.count + " messages").join("\n");

                        api.sendMessage(messageBody, threadID, error => error ? console.log(error) : '');

                        data.week.forEach(user => { user.count = 0; });
                        await fs.promises.writeFile(interactionPath + file, JSON.stringify(data, null, 4), { mode: 0o600 });
                    }
                }
            }
        } catch (error) {
            log.error("Interaction Report Error: " + (error && error.message ? error.message : error));
        } finally {
            global.client.sending_top = false;
        }
    }, 60000);

    // --- ৩. পরিবেশ লোড করা ---
    (async function () {
        try {
            log(global.getText("listen", "startLoadEnvironment"), "[ DATABASE ]");
            let allThreads = await threadController.getAll();
            let allUsers = await userController.getAll(["userID", "name", "data"]);
            let allCurrencies = await currencyController.getAll(["userID"]);

            for (const thread of allThreads) {
                const threadID = String(thread.threadID);
                global.data.allThreadID.push(threadID);
                global.data.threadData.set(threadID, thread.data || {});
                global.data.threadInfo.set(threadID, thread.threadInfo || {});
                if (thread.data && thread.data.banned == true) global.data.threadBanned.set(threadID, { 'reason': thread.data.reason || '', 'dateAdded': thread.data.dateAdded || '' });
                if (thread.data && thread.data.commandBanned && thread.data.commandBanned.length != 0) global.data.commandBanned.set(threadID, thread.data.commandBanned);
                if (thread.data && thread.data.NSFW) global.data.threadAllowNSFW.push(threadID);
            }
            for (const user of allUsers) {
                const userID = String(user.userID);
                global.data.allUserID.push(userID);
                if (user.name && user.name.length != 0) global.data.userName.set(userID, user.name);
                if (user.data && user.data.banned == 1) global.data.userBanned.set(userID, { 'reason': user.data.reason || '', 'dateAdded': user.data.dateAdded || '' });
                if (user.data && user.data.commandBanned && user.data.commandBanned.length != 0) global.data.commandBanned.set(userID, user.data.commandBanned);
            }
            for (const currency of allCurrencies) global.data.allCurrenciesID.push(String(currency.userID));
            log(global.getText("listen", "successLoadEnvironment"), "[ DATABASE ]");
        } catch (error) {
            return log.loader(global.getText("listen", "failLoadEnvironment", error), "error");
        }
    })();

    // --- ৪. Scheduled Messages ---
    const scheduleFilePath = path.join(__dirname, "..", "Script", "commands", "cache", "datlich.json");
    setInterval(async () => {
        if (!fs.existsSync(scheduleFilePath)) return;
        try {
            var scheduledData = JSON.parse(fs.readFileSync(scheduleFilePath));
            var now = moment().tz("Asia/Dhaka");
            var currentTimeMs = now.valueOf();

            for (let boxID in scheduledData) {
                for (let entryTime in scheduledData[boxID]) {
                    let ent = entryTime.split('_');
                    let dP = ent[0].split('/');
                    let tP = ent[1].split(':');
                    let scheduledTimeMs = moment.tz(`${dP[2]}-${dP[1]}-${dP[0]} ${tP[0]}:${tP[1]}:${tP[2]}`, "YYYY-MM-DD HH:mm:ss", "Asia/Dhaka").valueOf();

                    if (scheduledTimeMs < currentTimeMs) {
                        if (currentTimeMs - scheduledTimeMs < 600000) {
                            api.sendMessage(scheduledData[boxID][entryTime].REASON || "Scheduled Message", boxID);
                        }
                        delete scheduledData[boxID][entryTime];
                        fs.writeFileSync(scheduleFilePath, JSON.stringify(scheduledData, null, 4));
                    }
                }
            }
        } catch (e) {}
    }, 60000);

    // --- ৬. Listener Return Function (নিরাপদ করা হয়েছে) ---
    return async (listenerEvent) => {
        try {
            if (!listenerEvent) return;
            const { config, data } = global;

            if (config.antiInbox && config.antiInbox.enable && listenerEvent.isGroup === false && !isAdmin(listenerEvent.senderID, config)) {
                return;
            }

            await handleCreateDatabase({ event: listenerEvent });

            // --- নিক-নেম ফিক্স লজিক (৩ সেকেন্ড ডিলে দিয়ে নিরাপদ করা হয়েছে) ---
            if (listenerEvent.type === "log:subscribe" && listenerEvent.logMessageData.addedParticipants.some(i => i.userFbId == api.getCurrentUserID())) {
                const botID = api.getCurrentUserID();
                const botName = config.nickNameBot || "CYBER MIRAI BOT";
                
                setTimeout(() => {
                    api.changeNickname(botName, listenerEvent.threadID, botID, (err) => {
                        if (err) log.error("Failed to set nickname", "[ NICKNAME ]");
                        else log("Nickname set successfully: " + botName, "[ NICKNAME ]");
                    });
                }, 3000);

                const threadInfo = await api.getThreadInfo(listenerEvent.threadID);
                data.threadInfo.set(listenerEvent.threadID, threadInfo);
            }

            switch (listenerEvent.type) {
                case "message":
                case "message_reply":
                case "message_unsend":
                    await handleCommand({ event: listenerEvent });
                    await handleReply({ event: listenerEvent });
                    await handleCommandEvent({ event: listenerEvent });
                    break;
                case "event":
                case "log:subscribe":
                case "log:unsubscribe":
                case "log:thread-name":
                case "log:thread-poll":
                    await handleEvent({ event: listenerEvent });
                    break;
                case "message_reaction":
                    // Single reaction pipeline lives in includes/handle/handleReaction.js
                    await handleReaction({ event: listenerEvent });
                    break;
                default:
                    break;
            }
        } catch (error) {
            log.error("Listener Error: " + error);
        }
    };
};
