"use strict";

const vote = require("../../utils/vote.js");
const logger = require("../../utils/log.js");

module.exports.config = {
    name: "vote",
    version: "1.0.0",
    hasPermssion: 1,
    credits: "CYBER BOT TEAM",
    description: "Create a native group poll / vote (title => option | option)",
    commandCategory: "box",
    usages: "vote <title> => <option 1> | <option 2>",
    cooldowns: 5,
    dependencies: {},
};

function isGroupThread(event) {
    if (typeof event.isGroup === "boolean") return event.isGroup;
    // Facebook group thread IDs are longer than user IDs.
    return String(event.threadID || "").length > 15;
}

function sendUsage(api, event, prefix) {
    const usage = vote.usageText(prefix, "vote");
    return vote.sendMessageAsync(api, usage, event.threadID, event.messageID);
}

function draftPrompt(api, event) {
    return [
        "🗳️ নতুন পোল তৈরি করি।",
        "একটি রিপ্লাই-এ এই ফরম্যাটে লিখুন:",
        "",
        "<টাইটেল> => <অপশন ১> | <অপশন ২> | <অপশন ৩>",
        "",
        "উদাহরণ: সেরা খাবার => বিরিয়ানি | কাবাব | ফুচকা",
        "বাতিল করতে `cancel` লিখুন। (২ মিনিটের মধ্যে)",
    ].join("\n");
}

module.exports.run = async function ({ api, event, args }) {
    const prefix = (global.config && global.config.PREFIX) || "!";

    try {
        if (!isGroupThread(event)) {
            return api.sendMessage("⚠️ পোল শুধু গ্রুপে তৈরি করা যায়।", event.threadID, event.messageID);
        }

        const raw = Array.isArray(args) ? args.join(" ").trim() : String(args || "").trim();

        // No arguments: start a short, author-locked guided flow.
        if (!raw) {
            let info;
            try {
                info = await vote.sendMessageAsync(api, draftPrompt(api, event), event.threadID, event.messageID);
            } catch (error) {
                logger.error(`vote: failed to send draft prompt: ${error.message}`, "[ VOTE ]");
                return;
            }

            if (!info || !info.messageID) {
                // Some FCA builds do not return messageID; fall back to usage text.
                return sendUsage(api, event, prefix);
            }

            global.client.handleReply.push({
                name: "vote",
                type: "draft",
                messageID: info.messageID,
                author: String(event.senderID),
                threadID: String(event.threadID),
                expiresAt: Date.now() + 2 * 60 * 1000,
                createdAt: Date.now(),
            });
            return;
        }

        const parsed = vote.parseVoteInput(raw);
        if (!parsed.ok) {
            return api.sendMessage(`${vote.describeError(parsed)}\n\n${vote.usageText(prefix, "vote")}`, event.threadID, event.messageID);
        }

        try {
            await vote.createPollAsync(api, parsed.title, event.threadID, parsed.options);
        } catch (error) {
            logger.error(`vote: createPoll failed: ${error && error.message ? error.message : error}`, "[ VOTE ]");
            const reason = error && error.code === "UNSUPPORTED"
                ? "এই FCA ভার্সনে পোল সাপোর্ট নেই।"
                : "পোল তৈরি করতে সমস্যা হয়েছে, একটু পরে আবার চেষ্টা করুন।";
            return api.sendMessage(`❌ ${reason}`, event.threadID, event.messageID);
        }

        return api.sendMessage(vote.buildSuccessMessage(parsed), event.threadID, event.messageID);
    } catch (error) {
        logger.error(`vote: unexpected error: ${error && error.stack ? error.stack : error}`, "[ VOTE ]");
        return api.sendMessage("❌ পোল তৈরি করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
    }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
    const reply = handleReply || {};
    const sender = String(event.senderID);
    const thread = String(event.threadID);

    // Author + thread binding: anyone else replying is ignored silently and
    // must not consume the author's pending draft.
    if (!reply.author || sender !== String(reply.author)) return;
    if (reply.threadID && thread !== String(reply.threadID)) return;

    // One-shot: remove the entry as soon as the author consumes it.
    global.client.handleReply.delete(reply.messageID);

    if (reply.expiresAt && Date.now() > reply.expiresAt) {
        return api.sendMessage("⌛ সময় শেষ। আবার `vote` লিখে নতুন পোল শুরু করুন।", event.threadID, event.messageID);
    }

    const body = String(event.body || "").trim();
    if (!body) return;
    if (/^(cancel|বাতিল)$/i.test(body)) {
        return api.sendMessage("✅ বাতিল করা হয়েছে।", event.threadID, event.messageID);
    }

    const parsed = vote.parseVoteInput(body);
    if (!parsed.ok) {
        return api.sendMessage(vote.describeError(parsed) + "\n\nআবার চেষ্টা করুন, অথবা `cancel` লিখুন।", event.threadID, event.messageID);
    }

    try {
        await vote.createPollAsync(api, parsed.title, event.threadID, parsed.options);
    } catch (error) {
        logger.error(`vote(handleReply): createPoll failed: ${error && error.message ? error.message : error}`, "[ VOTE ]");
        return api.sendMessage("❌ পোল তৈরি করতে সমস্যা হয়েছে।", event.threadID, event.messageID);
    }

    return api.sendMessage(vote.buildSuccessMessage(parsed), event.threadID, event.messageID);
};
