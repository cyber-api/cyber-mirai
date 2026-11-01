module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");
    const DEFAULT_REACTION_TTL = 30 * 60 * 1000; // 30 minutes

    function toIdList(value) {
        if (!Array.isArray(value)) return [];
        return value.map((item) => String(item));
    }

    function asEmojiList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return [value];
    }

    function reactionExpired(entry, now) {
        if (!entry) return false;
        if (typeof entry.expiresAt === "number" && now > entry.expiresAt) return true;
        const created = typeof entry.createdAt === "number" ? entry.createdAt : null;
        const ttl = typeof entry.ttl === "number" && entry.ttl > 0 ? entry.ttl : DEFAULT_REACTION_TTL;
        return Boolean(created && now - created > ttl);
    }

    return async function ({ event }) {
        const { threadID, messageID, userID, reaction, senderID } = event;
        const { config, client, data } = global;
        const { handleReaction } = client;
        const antiReact = config.antiReact;

        // The reactor is `userID`; `senderID` is the author of the reacted message.
        const reactor = String(userID);
        const messageAuthor = senderID != null ? String(senderID) : null;

        const isBotAdmin = toIdList(config.ADMINBOT).includes(reactor)
            || (Array.isArray(config.NDH) && config.NDH.includes(reactor));
        const botID = (() => { try { return String(api.getCurrentUserID()); } catch (error) { return null; } })();

        // --- Thread Approval Check ---
        if (config.threadApproval && config.threadApproval.enable) {
            const threadData = data.threadData.get(threadID) || {};
            if (threadData.approved !== true && !isBotAdmin) return;
        }

        // --- Single Anti-React pipeline (replaces the duplicate in listen.js) ---
        if (antiReact && antiReact.enable) {
            // ১. রিয়্যাকশন দিয়ে মেসেজ আনসেন্ড (reactByUnsend)
            const unsendConfig = antiReact.reactByUnsend;
            if (unsendConfig && (unsendConfig.enable === true || unsendConfig.enable === undefined)) {
                const emojis = asEmojiList(unsendConfig.emojis);
                if (emojis.includes(reaction)) {
                    if (antiReact.onlyAdminBot && !isBotAdmin) return;
                    // Only the bot's own messages may be removed. Previously any
                    // message could be unsent, letting users delete others' chat.
                    if (botID && messageAuthor === botID) {
                        api.unsendMessage(messageID, (err) => {
                            if (err) logger.error("Failed to unsend message via reaction", "[ ANTI-REACT ]");
                        });
                    }
                }
            }

            // ২. রিয়্যাকশন দিয়ে ইউজারকে কিক করা (reactByRemove)
            const kickConfig = antiReact.reactByRemove;
            if (kickConfig && (kickConfig.enable === true || kickConfig.enable === undefined)) {
                const kickEmoji = kickConfig.emoji;
                if (kickEmoji && reaction === kickEmoji) {
                    if (!isBotAdmin) return; // kick is an admin-only action
                    // Kick the reactor, never the message author, and never the bot.
                    if (botID && reactor !== botID) {
                        api.removeUserFromGroup(reactor, threadID, (err) => {
                            if (err) {
                                return api.sendMessage("❌ Cannot kick this user. They might be an admin or I don't have permission.", threadID);
                            }
                            api.sendMessage("🚫 User removed due to admin reaction.", threadID);
                        });
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
                permssion: isBotAdmin ? 2 : 0,
                permission: isBotAdmin ? 2 : 0,
                isBotAdmin,
                getText: getText2
            };
            await command.handleReaction(Obj);
        } catch (error) {
            logger.error(global.getText("handleReaction", "executeError", error.message), "[ HANDLE REACTION ]");
            api.sendMessage(global.getText("handleReaction", "executeError", error.message), threadID, messageID);
        }
    };
};
