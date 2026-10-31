"use strict";

/**
 * Optional relay for Facebook's `log:thread-poll` events.
 * Disabled unless `config.pollNotification.enable === true`.
 * No config.json change is required; a missing key simply keeps this off.
 */
module.exports.config = {
    name: "pollnoti",
    version: "1.0.0",
    credits: "CYBER BOT TEAM",
    description: "Optional: announce newly created group polls",
    eventType: ["log:thread-poll"],
};

module.exports.run = async function ({ api, event }) {
    const settings = global.config && global.config.pollNotification;
    if (!settings || settings.enable !== true) return;

    const { threadID, logMessageData, author } = event || {};
    if (!threadID) return;

    // Do not announce polls the bot itself just created.
    try {
        if (author && String(author) === String(api.getCurrentUserID())) return;
    } catch (error) {
        // getCurrentUserID may be unavailable very early; ignore.
    }

    const data = logMessageData || {};
    const title = data.question_text || data.questionText || data.title || data.pollQuestion;
    const message = title
        ? `🗳️ নতুন পোল তৈরি হয়েছে: ${String(title).slice(0, 200)}`
        : "🗳️ এই গ্রুপে একটি নতুন পোল তৈরি হয়েছে।";

    return api.sendMessage(message, threadID);
};
