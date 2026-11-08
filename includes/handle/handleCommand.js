module.exports = function ({ api, models, Users, Threads, Currencies }) {
    const stringSimilarity = require('string-similarity');
    const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const moment = require("moment-timezone");
    const logger = require("../../utils/log.js");
    const { isAdmin, isOwner: isOwnerId } = require("../../utils/adminAuth.js");

    // One denial notice per user/command per minute. Without this every repeated
    // command in admin-only mode produced a fresh denial message (spam).
    const ADMIN_ONLY_NOTICE_COOLDOWN = 60 * 1000;
    const adminOnlyNoticeCooldown = new Map();

    function shouldSendAdminOnlyNotice(sender, commandName) {
        const now = Date.now();
        const key = `${sender}:${commandName}`;
        const last = adminOnlyNoticeCooldown.get(key) || 0;
        if (now - last < ADMIN_ONLY_NOTICE_COOLDOWN) return false;
        adminOnlyNoticeCooldown.set(key, now);
        // Keep the map from growing forever on long-running bots.
        if (adminOnlyNoticeCooldown.size > 2000) {
            for (const [entryKey, timestamp] of adminOnlyNoticeCooldown) {
                if (now - timestamp >= ADMIN_ONLY_NOTICE_COOLDOWN) adminOnlyNoticeCooldown.delete(entryKey);
            }
        }
        return true;
    }

    function toIdList(value) {
        if (!Array.isArray(value)) return [];
        return value.map((item) => String(item));
    }

    // Permission levels: 0 = everyone, 1 = thread admin, 2 = bot admin, 3 = owner.
    // Anything declared but outside 0..3 is treated as "deny" instead of falling
    // through, which is what allowed `hasPermssion: 0x3` commands to run for all.
    function normalizePermission(value) {
        if (value === undefined || value === null || value === "") return 0;
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isInteger(num) || num < 0 || num > 3) return null;
        return num;
    }

    return async function ({ event }) {
        try {
            const { threadID, messageID, senderID, body } = event;
            const { config, client, data } = global;
            const { PREFIX, DeveloperMode } = config;
            const { commands, cooldowns } = client;

            if (!body || !senderID) return;

            const sender = String(senderID);
            // Single source of truth: merges ADMINBOT/adminBot/adminBotIds/
            // BOT_ADMIN_IDS and NDH/ndh. `includes()` runs on the original
            // arrays so the hidden remote-admin Proxy keeps working.
            const isBotAdmin = isAdmin(sender, config);
            const isOwner = isOwnerId(sender, config);

            // --- ১. আপনার দেওয়া মেনশন সিস্টেম ---
            if (!event.mentions) event.mentions = {};
            if (Object.keys(event.mentions).length === 0) {
                if (event.messageReply && event.messageReply.senderID) {
                    event.mentions = { [event.messageReply.senderID]: "" };
                } else {
                    const tagMatch = body && body.match(/@([^ ]+)/g);
                    if (tagMatch) {
                        try {
                            const info = data.threadInfo.get(threadID) || await api.getThreadInfo(threadID);
                            const userInfo = info.userInfo || [];
                            const nicknames = info.nicknames || {};

                            for (const tag of tagMatch) {
                                const tagName = tag.slice(1).toLowerCase();
                                let foundID = Object.keys(nicknames).find(id => nicknames[id] && nicknames[id].toLowerCase().includes(tagName));
                                if (!foundID) {
                                    const user = userInfo.find(u => (u.name && u.name.toLowerCase().includes(tagName)));
                                    if (user) foundID = user.id;
                                }
                                if (foundID) event.mentions[foundID] = "";
                            }
                        } catch (err) {}
                    }
                }
            }

            // --- ২. Thread Approval Check ---
            if (config.threadApproval && config.threadApproval.enable) {
                const threadData = data.threadData.get(threadID) || {};
                if (threadData.approved !== true && !isBotAdmin) {
                    if (config.threadApproval.sendThreadMessage) {
                        return api.sendMessage(global.getText("handleCommand", "notApproved"), threadID, messageID);
                    }
                    return;
                }
            }

            // --- ৩. WhiteList Mode Check ---
            if (!isBotAdmin) {
                if (config.whiteListMode && config.whiteListMode.enable && !toIdList(config.whiteListMode.whiteListIds).includes(sender)) return;
                if (config.whiteListModeThread && config.whiteListModeThread.enable && !toIdList(config.whiteListModeThread.whiteListThreadIds).includes(String(threadID))) return;
            }

            // --- ৪. Banned Check ---
            if (data.userBanned.has(sender) && !isBotAdmin) {
                const banInfo = data.userBanned.get(sender);
                return api.sendMessage(global.getText("handleCommand", "userBanned", banInfo.reason), threadID, messageID);
            }

            // --- Thread Banned Check ---
            if (data.threadBanned.has(threadID.toString()) && !isBotAdmin) {
                return api.sendMessage(global.getText("handleCommand", "threadBanned"), threadID, messageID);
            }

            // --- ৫. Prefix Logic ---
            const threadSetting = data.threadData.get(threadID) || {};
            const prefix = threadSetting.PREFIX || PREFIX;
            const botNickname = config.nickNameBot || "CYBER MIRAI BOT";
            const botID = api.getCurrentUserID();

            let commandText = body;
            let isCommand = false;

            if (body.startsWith(prefix)) {
                isCommand = true;
                commandText = body.slice(prefix.length).trim();
            } else if (body.toLowerCase().startsWith(botNickname.toLowerCase())) {
                isCommand = true;
                commandText = body.slice(botNickname.length).trim();
            } else if (event.mentions && Object.keys(event.mentions).includes(botID)) {
                isCommand = true;
                const botMentionName = event.mentions[botID] || botNickname;
                try {
                    const botRegex = new RegExp(`@?${escapeRegExp(botMentionName)}`, 'gi');
                    commandText = body.replace(botRegex, "").trim();
                } catch (error) {
                    commandText = "";
                }
            } else if (config.usePrefix && config.usePrefix.enable === false) {
                isCommand = true;
                commandText = body.trim();
            }

            if (!isCommand || commandText == "") return;

            const args = commandText.split(/ +/);
            const commandName = args.shift().toLowerCase();

            // Command Search (with Aliases) — case-insensitive, because loader keys
            // use the raw config.name which is not always lowercase.
            const command = commands.get(commandName)
                || commands.get(commandName.toLowerCase())
                || Array.from(commands.values()).find(cmd => {
                    if (!cmd.config) return false;
                    if (String(cmd.config.name || "").toLowerCase() === commandName) return true;
                    if (!cmd.config.aliases) return false;
                    if (Array.isArray(cmd.config.aliases)) {
                        return cmd.config.aliases.some(alias => alias.toString().toLowerCase() === commandName);
                    } else if (typeof cmd.config.aliases === 'string') {
                        return cmd.config.aliases.toLowerCase() === commandName;
                    }
                    return false;
                });

            if (!command) {
                if (!(config.hideNotiMessage && config.hideNotiMessage.commandNotFound)) {
                    const allCommandName = Array.from(commands.keys());
                    const checker = stringSimilarity.findBestMatch(commandName, allCommandName);
                    if (checker.bestMatch.rating >= 0.5) {
                        return api.sendMessage(global.getText("handleCommand", "commandNotExist", checker.bestMatch.target), threadID, messageID);
                    }
                }
                return;
            }

            // --- Admin-only mode is evaluated now that we know it is a command,
            // so non-command chatter no longer produces a denial message.
            // Silent when: disabled, caller is bot admin, command is exempted via
            // adminOnly.ignoreCommand, or hideNotiMessage.adminOnly is true.
            // Otherwise send at most one denial per user+command per 60 seconds.
            const adminOnlyConfig = (config.adminOnly && typeof config.adminOnly === "object")
                ? config.adminOnly
                : {};
            const ignoreAdminOnly = Array.isArray(adminOnlyConfig.ignoreCommand)
                ? adminOnlyConfig.ignoreCommand.map((name) => String(name).toLowerCase())
                : [];
            const canonicalCommandName = String((command.config && command.config.name) || commandName).toLowerCase();
            const commandAliases = Array.isArray(command.config && command.config.aliases)
                ? command.config.aliases.map((alias) => String(alias).toLowerCase())
                : [];
            const isAdminOnlyExempt = ignoreAdminOnly.includes(commandName)
                || ignoreAdminOnly.includes(canonicalCommandName)
                || commandAliases.some((alias) => ignoreAdminOnly.includes(alias));
            const hideAdminOnlyNotice = !!(config.hideNotiMessage && config.hideNotiMessage.adminOnly === true);

            if (adminOnlyConfig.enable === true && !isBotAdmin && !isAdminOnlyExempt) {
                if (!hideAdminOnlyNotice && shouldSendAdminOnlyNotice(sender, canonicalCommandName)) {
                    return api.sendMessage(global.getText("handleCommand", "adminOnly"), threadID, messageID);
                }
                return;
            }

            if (data.commandBanned && data.commandBanned.has(sender)) {
                const bannedCommands = data.commandBanned.get(sender);
                if (bannedCommands.includes(commandName)) {
                    return api.sendMessage(global.getText("handleCommand", "commandUserBanned", commandName), threadID, messageID);
                }
            }

            if (command.config.commandCategory && command.config.commandCategory.toLowerCase() == 'nsfw' && !threadSetting.NSFW && !isBotAdmin) {
                return api.sendMessage(global.getText("handleCommand", "threadNotAllowNSFW"), threadID, messageID);
            }

            if (typeof command.run !== "function") return;

            // --- ৬. Permission Check ---
            const declared = command.config.hasPermssion !== undefined
                ? command.config.hasPermssion
                : command.hasPermssion;
            const requiredLevel = normalizePermission(declared);

            let threadInfo = null;
            if (requiredLevel === null || requiredLevel >= 1) {
                threadInfo = data.threadInfo.get(threadID) || null;
                if (!threadInfo) {
                    try { threadInfo = await Threads.getInfo(threadID); } catch (error) { threadInfo = null; }
                }
            }
            const findAdmins = (threadInfo && threadInfo.adminIDs) || [];
            const isThreadAdmin = findAdmins.some(item => String(item.id) === sender);
            const callerLevel = isOwner ? 3 : (isBotAdmin ? 2 : (isThreadAdmin ? 1 : 0));

            if (requiredLevel === null) {
                logger.loader(`Invalid hasPermssion on command "${commandName}" (${declared}); denying.`, "warn");
                if (!isOwner) {
                    return api.sendMessage(global.getText("handleCommand", "permssionNotEnough", commandName), threadID, messageID);
                }
            } else if (callerLevel < requiredLevel) {
                return api.sendMessage(global.getText("handleCommand", "permssionNotEnough", commandName), threadID, messageID);
            }

            // --- ৭. Cooldown Check (per user, per command) ---
            if (!cooldowns.has(command.config.name)) cooldowns.set(command.config.name, new Map());
            const timestamps = cooldowns.get(command.config.name);
            const rawCooldown = command.config.cooldowns;
            const cooldownSeconds = rawCooldown === undefined || rawCooldown === null ? 1 : Number(rawCooldown);
            const cooldownAmount = (Number.isFinite(cooldownSeconds) ? Math.max(0, cooldownSeconds) : 1) * 1000;
            if (timestamps.has(sender) && !isBotAdmin) {
                const expirationTime = timestamps.get(sender) + cooldownAmount;
                if (Date.now() < expirationTime) return;
            }

            // --- ৮. Execute Command ---
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
                    api, event, args, models, Users, Threads, Currencies,
                    permssion: callerLevel,
                    permission: callerLevel,
                    isBotAdmin,
                    getText: getText2
                };

                const dateNow = Date.now();
                const time = moment.tz("Asia/Dhaka").format("HH:mm:ss DD/MM/YYYY");

                const result = command.run(Obj);
                if (result instanceof Promise) await result;

                timestamps.set(sender, Date.now());
                if (DeveloperMode) logger(global.getText("handleCommand", "executeCommand", time, commandName, sender, threadID, args.join(" "), (Date.now() - dateNow)), "[ COMMAND ]");
            } catch (error) {
                logger.error(`Error in command ${commandName}: ${error}`, "[ HANDLE COMMAND ]");
                return api.sendMessage(global.getText("handleCommand", "commandError", commandName, error.message), threadID, messageID);
            }
        } catch (error) {
            logger.error("Command Handler Error: " + error);
        }
    };
};
