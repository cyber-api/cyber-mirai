"use strict";

/**
 * Bot-sent message tracker.
 *
 * `message_reaction` events on this FCA build do not reliably include the
 * author of the reacted message. The old anti-react code compared
 * `event.senderID` (the reactor) to the bot ID, so unsend never fired, and in
 * the other direction it could unsend messages the bot did not send.
 *
 * We wrap `api.sendMessage` once at startup and remember every message ID the
 * bot creates. `handleReaction.js` can then answer the only question that
 * matters: "did the bot send the message that was reacted to?"
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 5000;

const sentMessages = new Map(); // messageID -> { threadID, sentAt }

function prune(now, ttlMs, maxEntries) {
    const timestamp = typeof now === "number" ? now : Date.now();
    const ttl = ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
    const max = maxEntries > 0 ? maxEntries : DEFAULT_MAX_ENTRIES;

    for (const [messageID, entry] of sentMessages) {
        if (!entry || timestamp - entry.sentAt > ttl) sentMessages.delete(messageID);
    }

    while (sentMessages.size > max) {
        const oldest = sentMessages.keys().next();
        if (oldest.done) break;
        sentMessages.delete(oldest.value);
    }
}

function normalizeId(value) {
    if (value == null) return "";
    if (typeof value === "object") {
        const id = value.messageID || value.messageId || value.id;
        return id == null ? "" : String(id);
    }
    return String(value);
}

function track(messageID, meta) {
    const id = normalizeId(messageID);
    if (!id) return false;
    const info = meta && typeof meta === "object" ? meta : {};
    sentMessages.set(id, {
        threadID: info.threadID != null ? String(info.threadID) : null,
        sentAt: Date.now(),
    });
    if (sentMessages.size > DEFAULT_MAX_ENTRIES) prune();
    return true;
}

function isBotMessage(messageID) {
    const id = normalizeId(messageID);
    if (!id) return false;

    const entry = sentMessages.get(id);
    if (!entry) return false;

    if (Date.now() - entry.sentAt > DEFAULT_TTL_MS) {
        sentMessages.delete(id);
        return false;
    }
    return true;
}

function captureInfo(info, threadID) {
    if (!info) return;
    if (Array.isArray(info)) {
        for (const entry of info) captureInfo(entry, threadID);
        return;
    }
    track(info, { threadID });
}

/**
 * Wrap `api.sendMessage` so every send records its resulting message ID.
 * The wrapper preserves the FCA call signature:
 *   sendMessage(message, threadID, callback?, replyToMessage?)
 * A string third argument is treated as `replyToMessage` and kept in place.
 */
function install(api, options) {
    const opts = options || {};
    const warn = typeof opts.warn === "function" ? opts.warn : () => {};

    if (!api || typeof api.sendMessage !== "function") return false;
    if (api.__cyberMessageTrackerInstalled) return true;

    const original = api.sendMessage.bind(api);

    function wrapper(message, threadID, callback, replyToMessage) {
        const args = Array.prototype.slice.call(arguments);
        const thread = threadID;

        if (typeof args[2] === "function") {
            const userCallback = args[2];
            args[2] = function (error, info) {
                if (!error) {
                    try { captureInfo(info, thread); } catch (trackError) { /* never break a send */ }
                }
                return userCallback.apply(this, arguments);
            };
        } else {
            // No user callback. Add one so we can learn the message ID, and keep
            // any reply-to message ID in its original position.
            const replyTo = args.length > 2 ? args[2] : undefined;
            args[2] = function (error, info) {
                if (!error) {
                    try { captureInfo(info, thread); } catch (trackError) { /* ignore */ }
                }
            };
            if (replyTo !== undefined) args.push(replyTo);
        }

        const result = original.apply(api, args);

        // Some FCA builds return a Promise and never call the callback.
        if (result && typeof result.then === "function") {
            try {
                result.then((info) => {
                    try { captureInfo(info, thread); } catch (trackError) { /* ignore */ }
                }, () => {});
            } catch (trackError) { /* ignore */ }
        }

        return result;
    }

    try {
        api.sendMessage = wrapper;
        api.__cyberMessageTrackerInstalled = true;
    } catch (error) {
        warn(`Could not install message tracker: ${error.message}`);
        return false;
    }
    return true;
}

function reset() {
    sentMessages.clear();
}

function size() {
    return sentMessages.size;
}

module.exports = {
    install,
    installMessageTracker: install,
    track,
    isBotMessage,
    prune,
    reset,
    size,
    DEFAULT_TTL_MS,
    DEFAULT_MAX_ENTRIES,
};
