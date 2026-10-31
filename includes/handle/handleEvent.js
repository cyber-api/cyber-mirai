module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../utils/log.js");
    const moment = require("moment-timezone");

    const configuredTimeout = process.env.EVENT_TIMEOUT_MS
        || (global.config && global.config.EVENT_TIMEOUT_MS)
        || 0;
    const EVENT_TIMEOUT_MS = Number(configuredTimeout) > 0
        ? Number(configuredTimeout)
        : 15 * 1000;

    function toIdList(value) {
        return Array.isArray(value) ? value.map((item) => String(item)) : [];
    }

    function notify(idList, message) {
        for (const id of toIdList(idList)) {
            try { api.sendMessage(message, id); } catch (error) { /* best effort */ }
        }
    }

    function withTimeout(promise, label) {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${EVENT_TIMEOUT_MS}ms`)), EVENT_TIMEOUT_MS);
            if (typeof timer.unref === "function") timer.unref();
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    return async function ({ event }) {
        const { threadID, logMessageType, logMessageData, author } = event;
        const { config, client, data } = global;
        const { events } = client || {};
        if (!events || typeof events.entries !== "function") return;

        const actor = author != null ? String(author) : "";
        const isBotAdmin = toIdList(config.ADMINBOT).includes(actor) || toIdList(config.NDH).includes(actor);

        // --- Thread Approval Check ---
        if (config.threadApproval && config.threadApproval.enable) {
            const threadData = data.threadData.get(threadID) || {};
            if (threadData.approved !== true && !isBotAdmin) {
                // Allow log:subscribe so the bot can notify admins and set nickname
                if (logMessageType !== "log:subscribe") return;
            }
        }

        const logData = logMessageData && typeof logMessageData === "object" ? logMessageData : {};

        // --- Bot Logging System (opt-in, redacted) ---
        if (config.botLogging && config.botLogging.enable) {
            const botID = String(api.getCurrentUserID());
            const added = Array.isArray(logData.addedParticipants) ? logData.addedParticipants : [];

            if (logMessageType === "log:subscribe" && added.some((item) => item && String(item.userFbId) === botID)) {
                if (config.botLogging.logBotAdded) {
                    const logMsg = `📥 Bot added to a new thread!\nThread ID: ${threadID}\nAdded by: ${actor || "unknown"}`;
                    if (config.botLogging.sendToThreads) {
                        notify(config.botLogging.logThreadIds, logMsg);
                    }
                }

                if (config.threadApproval && config.threadApproval.enable && config.threadApproval.sendNotifications) {
                    const approvalMsg = `🔔 New Thread Request!\nThread ID: ${threadID}\nUse: ${config.PREFIX}approve ${threadID} to allow.`;
                    notify(config.threadApproval.adminNotificationThreads, approvalMsg);
                }
                logger.audit({ action: "bot_added_to_thread", actor, target: String(threadID) });
            }

            if (logMessageType === "log:unsubscribe" && logData.leftParticipantFbId != null
                && String(logData.leftParticipantFbId) === botID) {
                if (config.botLogging.logBotKicked) {
                    const logMsg = `📤 Bot kicked/removed from thread!\nThread ID: ${threadID}\nAction by: ${actor || "unknown"}`;
                    if (config.botLogging.sendToThreads) {
                        notify(config.botLogging.logThreadIds, logMsg);
                    }
                }
                logger.audit({ action: "bot_removed_from_thread", actor, target: String(threadID) });
            }
        }

        // --- Execute Registered Events ---
        for (const [key, value] of events.entries()) {
            try {
                const eventTypes = value && value.config && value.config.eventType;
                const matches = Array.isArray(eventTypes)
                    ? eventTypes.includes(logMessageType)
                    : typeof eventTypes === "string" && eventTypes === logMessageType;
                if (!matches) continue;

                // Backward compatible getText logic (fixed replacement loop).
                let getText2;
                if (value.languages && typeof value.languages === "object" && value.languages.hasOwnProperty(global.config.language)) {
                    getText2 = (...values) => {
                        let lang = value.languages[global.config.language][values[0]] || '';
                        for (let i = 1; i < values.length; i++) {
                            lang = lang.replace(RegExp('%' + i, 'g'), values[i]);
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
                    getText: getText2
                };

                const dateNow = Date.now();
                const time = moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY");

                // Await with a timeout so one hanging module cannot block every
                // later event for this message (F-32).
                const result = value.run(Obj);
                if (result instanceof Promise) await withTimeout(result, `event ${key}`);

                if (global.config.DeveloperMode) {
                    logger(global.getText("handleEvent", "executeEvent", time, key, threadID, Date.now() - dateNow), "[ EVENT ]");
                }
            } catch (error) {
                // Always surface failures: silent suppression hid real breakage.
                logger.error(global.getText("handleEvent", "eventError", key, error.message), "[ HANDLE EVENT ]");
            }
        }
    };
};
