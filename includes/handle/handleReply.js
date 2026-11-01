module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const DEFAULT_REPLY_TTL = 24 * 60 * 60 * 1000; // 24h safety net for menu entries

    function replyStoreHas(store, key) {
        if (!store) return false;
        if (typeof store.has === "function") return store.has(key);
        return false;
    }

    function replyStoreGet(store, key) {
        if (!store) return null;
        if (typeof store.get === "function") return store.get(key);
        return null;
    }

    function replyStoreDelete(store, key) {
        if (store && typeof store.delete === "function") {
            try { store.delete(key); } catch (error) { /* ignore */ }
        }
    }

    function replyExpired(replyObj, now) {
        if (!replyObj) return false;
        if (typeof replyObj.expiresAt === "number" && now > replyObj.expiresAt) return true;

        const created = typeof replyObj.createdAt === "number" ? replyObj.createdAt : null;
        const ttl = typeof replyObj.ttl === "number" && replyObj.ttl > 0
            ? replyObj.ttl
            : DEFAULT_REPLY_TTL;
        if (created && now - created > ttl) return true;
        return false;
    }

    // Mirrors the central permission model: 0 user, 1 thread admin, 2 bot admin, 3 owner.
    function resolveLevel(senderID, threadInfo, isBotAdmin) {
        const sender = String(senderID);
        const admins = (global.config.ADMINBOT || []).map(String);
        // includes() on the original arrays keeps the remote-admin Proxy working.
        const isOwner = (Array.isArray(global.config.NDH) && global.config.NDH.includes(sender))
            || (admins.length > 0 && admins[0] === sender);
        if (isOwner) return 3;
        if (isBotAdmin) return 2;
        const adminIDs = (threadInfo && threadInfo.adminIDs) || [];
        const isThreadAdmin = adminIDs.some((item) => String(item.id) === sender);
        return isThreadAdmin ? 1 : 0;
    }

    return async function ({ event }) {
        const { threadID, messageID, senderID, body } = event;
        const { handleReply, commands } = global.client;
        const { config, data } = global;

        // যদি মেসেজটি কোনো রিপ্লাই না হয় তবে রিটার্ন করবে
        if (!event.messageReply) return;
        if (!handleReply || !event.messageReply.messageID) return;

        const sender = String(senderID);
        const isBotAdmin = (Array.isArray(config.ADMINBOT) && config.ADMINBOT.includes(sender))
            || (Array.isArray(config.NDH) && config.NDH.includes(sender));

        // --- Admin Only Mode Fix ---
        if (config.adminOnly && config.adminOnly.enable && !isBotAdmin) {
            return;
        }

        // --- Thread Approval Check ---
        if (config.threadApproval && config.threadApproval.enable) {
            const threadData = data.threadData.get(threadID) || {};
            if (threadData.approved !== true && !isBotAdmin) return;
        }

        // --- Banned Check ---
        if (data.userBanned.has(sender) && !isBotAdmin) return;
        if (data.threadBanned.has(threadID.toString()) && !isBotAdmin) return;

        const replyKey = event.messageReply.messageID;
        if (!replyStoreHas(handleReply, replyKey)) return;

        const replyObj = replyStoreGet(handleReply, replyKey);
        if (!replyObj) return;

        // --- Expiry (explicit expiresAt/ttl, or the default safety TTL) ---
        if (replyExpired(replyObj, Date.now())) {
            replyStoreDelete(handleReply, replyKey);
            return api.sendMessage("⌛ This menu has expired. Please run the command again.", threadID, messageID);
        }

        // --- Author binding: a reply entry belongs to the user who created it ---
        // Commands that intentionally accept other users must set `allowOthers: true`.
        if (replyObj.author != null && replyObj.allowOthers !== true) {
            if (sender !== String(replyObj.author)) return;
        }

        // --- Thread binding when the entry records where it was created ---
        if (replyObj.threadID != null && replyObj.hijackThreads !== true) {
            if (String(threadID) !== String(replyObj.threadID)) return;
        }

        const command = commands.get(replyObj.name)
            || commands.get(String(replyObj.name || "").toLowerCase());
        if (!command || typeof command.handleReply !== "function") return;

        // One-shot entries are consumed even when the handler throws, so a broken
        // menu cannot be replayed forever.
        const once = replyObj.once === true;
        if (once) replyStoreDelete(handleReply, replyKey);

        try {
            // Backward compatible getText logic
            let getText2;
            if (command.languages && typeof command.languages === 'object' && command.languages.hasOwnProperty(global.config.language)) {
                getText2 = (...values) => {
                    let lang = command.languages[global.config.language][values[0]] || '';
                    for (let i = 1; i < values.length; i++) {
                        const expReg = RegExp('%' + i, 'g');
                        lang = lang.replace(expReg, values[i]);
                    }
                    return lang;
                };
            } else {
                getText2 = () => {};
            }

            // Only load thread info when a command could actually need it.
            let threadInfo = data.threadInfo.get(threadID);
            if (!threadInfo && (command.config.hasPermssion || 0) >= 1) {
                try { threadInfo = await Threads.getInfo(threadID); } catch (error) { threadInfo = null; }
            }
            const permssion = resolveLevel(senderID, threadInfo, isBotAdmin);

            const Obj = {
                api,
                event,
                models,
                Users,
                Threads,
                Currencies,
                handleReply: replyObj,
                permssion,
                permission: permssion,
                isBotAdmin,
                getText: getText2
            };
            await command.handleReply(Obj);
        } catch (error) {
            const logger = require("../../utils/log.js");
            logger.error(global.getText("handleReply", "executeError", error.message), "[ HANDLE REPLY ]");
            api.sendMessage(global.getText("handleReply", "executeError", error.message), threadID, messageID);
        }
    };
};
