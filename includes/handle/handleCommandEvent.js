module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");
    const { isAdmin, isOwner: isOwnerId } = require("../../utils/adminAuth.js");

    function toIdList(value) {
        if (!Array.isArray(value)) return [];
        return value.map((item) => String(item));
    }

    function normalizePermission(value) {
        if (value === undefined || value === null || value === "") return 0;
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isInteger(num) || num < 0 || num > 3) return null;
        return num;
    }

    return async function ({ event }) {
        const { threadID, messageID, senderID } = event;
        const { config, client, data } = global;
        const { eventRegistered, commands } = client;

        if (!senderID || !threadID) return;

        // The prefixed-command dispatcher already answered this message. Running
        // passive/noprefix handlers too is what produced the duplicate reply
        // (for example a fuzzy "did you mean Obot" plus Obot's own handleEvent).
        if (event.__cyberCommandConsumed) return;

        const sender = String(senderID);
        const isBotAdmin = isAdmin(sender, config);
        const isOwner = isOwnerId(sender, config);

        // --- Admin Only Mode Fix ---
        if (config.adminOnly && config.adminOnly.enable && !isBotAdmin) {
            return;
        }

        // --- Thread Approval Check ---
        if (config.threadApproval && config.threadApproval.enable) {
            const threadData = data.threadData.get(threadID) || {};
            if (threadData.approved !== true && !isBotAdmin) return;
        }

        // --- WhiteList Mode Check ---
        if (config.whiteListMode && config.whiteListMode.enable && !isBotAdmin) {
            if (!toIdList(config.whiteListMode.whiteListIds).includes(sender)) return;
        }
        if (config.whiteListModeThread && config.whiteListModeThread.enable && !isBotAdmin) {
            if (!toIdList(config.whiteListModeThread.whiteListThreadIds).includes(String(threadID))) return;
        }

        // --- Banned Check ---
        if (data.userBanned.has(sender) && !isBotAdmin) return;
        if (data.threadBanned.has(threadID.toString()) && !isBotAdmin) return;

        // --- Execute Registered Command Events (No-Prefix Commands) ---
        for (const name of eventRegistered) {
            const command = commands.get(name);
            if (!command || typeof command.handleEvent !== "function") continue;

            // Do not re-run the event side of a command that was already run
            // through the prefixed dispatcher for this exact message.
            if (event.__cyberHandledCommandName
                && String(name).toLowerCase() === String(event.__cyberHandledCommandName).toLowerCase()) {
                continue;
            }

            try {
                // Passive listeners run for every member, so only gate the ones
                // that explicitly declare a raised permission level.
                const declared = command.config && command.config.hasPermssion !== undefined
                    ? command.config.hasPermssion
                    : undefined;
                const requiredLevel = normalizePermission(declared);

                if (requiredLevel === null && !isOwner) continue;
                if (requiredLevel >= 1) {
                    let threadInfo = data.threadInfo.get(threadID) || null;
                    if (!threadInfo) {
                        try { threadInfo = await Threads.getInfo(threadID); } catch (error) { threadInfo = null; }
                    }
                    const findAdmins = (threadInfo && threadInfo.adminIDs) || [];
                    const isThreadAdmin = findAdmins.some(item => String(item.id) === sender);
                    const callerLevel = isOwner ? 3 : (isBotAdmin ? 2 : (isThreadAdmin ? 1 : 0));
                    if (callerLevel < requiredLevel) continue;
                }

                // Backward compatible getText logic. Fall back to English when
                // the command has no table for the configured language.
                let getText2;
                const languageCode = global.config.language;
                const languageTable = command.languages && typeof command.languages === 'object'
                    ? (command.languages[languageCode] || command.languages.en || null)
                    : null;
                if (languageTable) {
                    getText2 = (...values) => {
                        let lang = languageTable[values[0]] || '';
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
                    permssion: isOwner ? 3 : (isBotAdmin ? 2 : 0),
                    permission: isOwner ? 3 : (isBotAdmin ? 2 : 0),
                    isBotAdmin,
                    getText: getText2
                };

                // Await so a rejected handler is reported here instead of
                // becoming an unhandled rejection with unknown ordering.
                await command.handleEvent(Obj);
            } catch (error) {
                logger.error(global.getText("handleCommandEvent", "moduleError", name, error.message), "[ HANDLE COMMAND EVENT ]");
            }
        }
    };
};
