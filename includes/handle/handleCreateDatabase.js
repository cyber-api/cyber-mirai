module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");

    return async function ({ event }) {
        const { threadID, senderID } = event;
        const { config, data } = global;

        if (!threadID || !senderID || senderID == api.getCurrentUserID()) return;

        try {
            // --- Thread Data Creation ---
            if (!data.allThreadID.includes(threadID.toString())) {
                let threadInfo = null;
                try { threadInfo = await api.getThreadInfo(threadID); } catch (error) {
                    logger.loader(`Could not fetch thread info for ${threadID}: ${error.message}`, "warn");
                }

                await Threads.createData(threadID, {
                    threadInfo: threadInfo || {},
                    data: {
                        PREFIX: config.PREFIX,
                        // New threads are never auto-approved. The old code used
                        // `autoApproveExisting` here, which silently defeated
                        // thread approval for every new group (F-20).
                        approved: false
                    }
                });

                data.allThreadID.push(threadID.toString());
                if (threadInfo) {
                    data.threadInfo.set(threadID.toString(), threadInfo);
                    logger.loader(`New thread detected: ${threadID} | Name: ${threadInfo.threadName || "Unnamed"}`);
                } else {
                    logger.loader(`New thread detected: ${threadID}`);
                }

                // Startup Notification for new thread (Goat Bot Style)
                if (config.threadApproval && config.threadApproval.enable && config.threadApproval.sendThreadMessage) {
                    api.sendMessage("✨ Bot has been added to this group. Waiting for Admin approval.", threadID);
                }
            }
            // Goat Bot Feature: Auto refresh thread info on first message
            else if (config.database && config.database.autoRefreshThreadInfoFirstTime && !data.threadInfo.has(threadID.toString())) {
                try {
                    const threadInfo = await api.getThreadInfo(threadID);
                    if (threadInfo) data.threadInfo.set(threadID.toString(), threadInfo);
                } catch (error) {
                    logger.loader(`Could not refresh thread info for ${threadID}: ${error.message}`, "warn");
                }
            }

            // --- User Data Creation ---
            if (!data.allUserID.includes(senderID.toString())) {
                let name = "Facebook user";
                try {
                    const userInfo = await api.getUserInfo(senderID);
                    const profile = userInfo && userInfo[senderID];
                    if (profile && typeof profile.name === "string" && profile.name.trim()) {
                        name = profile.name;
                    }
                } catch (error) {
                    logger.loader(`Could not fetch user info for ${senderID}: ${error.message}`, "warn");
                }

                await Users.createData(senderID, {
                    name,
                    data: {}
                });

                // কারেন্সি বা টাকা-পয়সের ডাটাবেস তৈরি (যদি থাকে)
                if (Currencies) {
                    await Currencies.createData(senderID, {
                        exp: 0,
                        money: 0
                    });
                }

                data.allUserID.push(senderID.toString());
                data.userName.set(senderID.toString(), name);
                logger.loader(`New user detected: ${senderID} | Name: ${name}`);
            }
        } catch (error) {
            // Database failures matter even outside DeveloperMode; hiding them
            // made lost writes impossible to diagnose (F-32).
            logger.loader(`handleCreateDatabase: ${error.message}`, "error");
        }
    };
};
