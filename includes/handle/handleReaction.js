module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");
    const { isAdmin } = require("../../utils/adminAuth.js");
    const { isBotMessage } = require("../../utils/messageTracker.js");
    const DEFAULT_REACTION_TTL = 30 * 60 * 1000; // 30 minutes

    function asEmojiList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.map((entry) => String(entry));
        return [String(value)];
    }

    function reactionExpired(entry, now) {
        if (!entry) return false;
        if (typeof entry.expiresAt === "number" && now > entry.expiresAt) return true;
        const created = typeof entry.createdAt === "number" ? entry.createdAt : null;
        const ttl = typeof entry.ttl === "number" && entry.ttl > 0 ? entry.ttl : DEFAULT_REACTION_TTL;
        return Boolean(created && now - created > ttl);
    }

    function botUserId() {
        try {
            const id = api.getCurrentUserID();
            return id == null ? null : String(id);
        } catch (error) {
            return null;
        }
    }

    return async function ({ event }) {
        const { threadID, messageID, reaction } = event;
        // `userID` is the reactor on this FCA build. `senderID` is only a
        // fallback: it previously held the reacted message's author (or was
        // absent entirely), which is why unsend never fired.
        const reactor = String(event.userID || event.senderID || "");
        const { config, client, data } = global;
        const { handleReaction } = client;

        if (!reactor) return;

        const botID = botUserId();
        // Ignore the bot reacting to its own messages (or to anything else).
        if (botID && reactor === botID) return;

        const callerIsAdmin = isAdmin(reactor, config);

        // --- Thread Approval Check ---
        if (config.threadApproval && config.threadApproval.enable) {
            const threadData = data.threadData.get(threadID) || {};
            if (threadData.approved !== true && !callerIsAdmin) return;
        }

        // --- Single Anti-React pipeline (replaces the duplicate in listen.js) ---
        const antiReact = config.antiReact;
        if (antiReact && antiReact.enable) {
            const onlyAdminBot = antiReact.onlyAdminBot === true;

            if (!onlyAdminBot || callerIsAdmin) {
                // ১. রিয়্যাকশন দিয়ে বটের মেসেজ আনসেন্ড (reactByUnsend)
                const unsendConfig = antiReact.reactByUnsend || {};
                const unsendEnabled = unsendConfig.enable !== false;
                const emojis = asEmojiList(unsendConfig.emojis);
                if (unsendEnabled && emojis.includes(String(reaction))) {
                    const removeBotMessage = antiReact.removeBotMessage !== false;
                    if (removeBotMessage && botID && isBotMessage(messageID)) {
                        try {
                            api.unsendMessage(messageID, (error) => {
                                if (error) {
                                    logger.error(`Failed to unsend bot message ${messageID}: ${error.message || error}`, "[ ANTI-REACT ]");
                                }
                            });
                        } catch (error) {
                            logger.error(`Anti-react unsend threw: ${error.message || error}`, "[ ANTI-REACT ]");
                        }
                    }
                }

                // ২. রিয়্যাকশন দিয়ে ইউজারকে কিক করা (reactByRemove)
                const kickConfig = antiReact.reactByRemove || {};
                const kickEmoji = kickConfig.emoji;
                if (kickConfig.enable === true && kickEmoji && String(reaction) === String(kickEmoji)) {
                    if (!callerIsAdmin) return; // kick is an admin-only action
                    if (botID && reactor !== botID) {
                        try {
                            api.removeUserFromGroup(reactor, threadID, (error) => {
                                if (error) {
                                    return api.sendMessage("❌ Cannot kick this user. They might be an admin or I don't have permission.", threadID);
                                }
                                api.sendMessage("🚫 User removed due to admin reaction.", threadID);
                            });
                        } catch (error) {
                            logger.error(`Anti-react kick threw: ${error.message || error}`, "[ ANTI-REACT ]");
                        }
                    }
                }
            }
        }

        // --- Execute Registered Reaction Handlers ---
        if (!handleReaction || typeof handleReaction.has !== "function" || !handleReaction.has(messageID)) return;

        const handleReactionObj = handleReaction.get(messageID);
        if (!handleReactionObj) return;

        // Expiry + one-shot consumption prevent stale callbacks from firing forever.
        if (reactionExpired(handleReactionObj, Date.now())) {
            if (typeof handleReaction.delete === "function") handleReaction.delete(messageID);
            return;
        }

        // Author binding: the user who started the reaction flow must be the reactor.
        if (handleReactionObj.author != null && String(handleReactionObj.author) !== reactor) return;

        const command = client.commands.get(handleReactionObj.name)
            || client.commands.get(String(handleReactionObj.name || "").toLowerCase());
        if (!command || typeof command.handleReaction !== "function") return;

        if (handleReactionObj.once === true && typeof handleReaction.delete === "function") {
            handleReaction.delete(messageID);
        }

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

            const Obj = {
                api,
                event,
                models,
                Users,
                Threads,
                Currencies,
                handleReaction: handleReactionObj,
                permssion: callerIsAdmin ? 2 : 0,
                permission: callerIsAdmin ? 2 : 0,
                isBotAdmin: callerIsAdmin,
                getText: getText2
            };
            await command.handleReaction(Obj);
        } catch (error) {
            logger.error(global.getText("handleReaction", "executeError", error.message), "[ HANDLE REACTION ]");
            api.sendMessage(global.getText("handleReaction", "executeError", error.message), threadID, messageID);
        }
    };
};
