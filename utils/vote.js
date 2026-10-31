"use strict";

/**
 * utils/vote.js
 * Shared, Mirai-native poll/vote parsing + creation helpers.
 *
 * Used by:
 *   - Script/commands/vote.js      (native command)
 *   - Script/commands/alllin.js    (legacy `setallbox poll` forwarder)
 *
 * Format (tolerant):
 *   <title> => <option 1> | <option 2> [| ...]
 *   <title> -> <option 1>; <option 2>
 *   <title> → <option 1> • <option 2>
 *   <title>
 *   <option 1>
 *   <option 2>
 *   ...                            (one option per line, title on first line)
 *
 * Deliberately does NOT touch Facebook directly, so it can be unit tested.
 */

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const MAX_TITLE_LENGTH = 200;
const MAX_OPTION_LENGTH = 100;

// First supported title/options separator. `:` alone is intentionally excluded
// because titles such as "আজকের ভোট: সেরা খাবার" would be split incorrectly.
const TITLE_SEPARATORS = /\s*(?:=>|⇒|⟶|→|->|—>)\s*/;

// Option separators: pipe, semicolon, bullet, middle dot, newline.
const OPTION_SEPARATORS = /[|;•·\n]+/;

// Leading list markers such as "1." "2)" "-" "*" "•".
const LIST_MARKER = /^\s*(?:[-*•·]|\d{1,2}[.)])\s*/;

function collapseWhitespace(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function stripWrappingQuotes(value) {
    const text = String(value == null ? "" : value).trim();
    if (text.length < 2) return text;
    const pairs = [['"', '"'], ["'", "'"], ["“", "”"], ["‘", "’"], ["«", "»"], ["`", "`"]];
    for (const [open, close] of pairs) {
        if (text.startsWith(open) && text.endsWith(close)) {
            return text.slice(open.length, text.length - close.length).trim();
        }
    }
    return text;
}

function cleanTitle(value) {
    return collapseWhitespace(stripWrappingQuotes(value)).replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "").trim();
}

function cleanOption(value) {
    return collapseWhitespace(stripWrappingQuotes(String(value == null ? "" : value).replace(LIST_MARKER, ""))).replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim();
}

function fail(code, extra) {
    return Object.assign({ ok: false, code }, extra || {});
}

function splitOptions(text) {
    return String(text || "")
        .split(OPTION_SEPARATORS)
        .map(cleanOption)
        .filter((item) => item.length > 0);
}

/**
 * Parse raw user input into `{ ok, title, options, removedDuplicates }`
 * or `{ ok: false, code, ... }`.
 */
function parseVoteInput(raw) {
    const input = Array.isArray(raw) ? raw.join(" ") : String(raw == null ? "" : raw);
    const text = input.replace(/\r\n?/g, "\n").trim();

    if (!text) return fail("EMPTY");

    let title = "";
    let optionText = "";
    const separator = text.match(TITLE_SEPARATORS);

    if (separator && typeof separator.index === "number") {
        title = text.slice(0, separator.index);
        optionText = text.slice(separator.index + separator[0].length);
    } else {
        // Multi-line fallback: first line is the title, remaining lines are options.
        const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines.length >= 2) {
            title = lines.shift();
            optionText = lines.join("\n");
        } else {
            return fail("NO_SEPARATOR");
        }
    }

    const cleanedTitle = cleanTitle(title);
    if (!cleanedTitle) return fail("TITLE_EMPTY");
    if (cleanedTitle.length > MAX_TITLE_LENGTH) {
        return fail("TITLE_TOO_LONG", { max: MAX_TITLE_LENGTH, actual: cleanedTitle.length });
    }

    const parsedOptions = splitOptions(optionText);
    if (parsedOptions.length === 0) return fail("OPTIONS_EMPTY");

    const seen = new Set();
    const options = [];
    let removedDuplicates = 0;

    for (const option of parsedOptions) {
        if (option.length > MAX_OPTION_LENGTH) {
            return fail("OPTION_TOO_LONG", { max: MAX_OPTION_LENGTH, option });
        }
        const key = option.toLocaleLowerCase();
        if (seen.has(key)) {
            removedDuplicates += 1;
            continue;
        }
        seen.add(key);
        options.push(option);
    }

    if (options.length < MIN_OPTIONS) return fail("TOO_FEW_OPTIONS", { min: MIN_OPTIONS, actual: options.length });
    if (options.length > MAX_OPTIONS) return fail("TOO_MANY_OPTIONS", { max: MAX_OPTIONS, actual: options.length });

    return {
        ok: true,
        title: cleanedTitle,
        options,
        removedDuplicates,
    };
}

function describeError(result) {
    const limit = (result && result.max) || "";
    switch (result && result.code) {
        case "EMPTY":
            return "⚠️ পোলের টাইটেল ও অপশন দিন।\nExample: vote সেরা খাবার => বিরিয়ানি | কাবাব";
        case "NO_SEPARATOR":
            return "⚠️ টাইটেল আর অপশনের মাঝে `=>` চিহ্ন দিন।\nExample: vote সেরা খাবার => বিরিয়ানি | কাবাব";
        case "TITLE_EMPTY":
            return "⚠️ পোলের টাইটেল খালি রাখা যাবে না।";
        case "TITLE_TOO_LONG":
            return `⚠️ টাইটেল অনেক বড় (${result.actual}/${limit} অক্ষর)। ছোট করে দিন।`;
        case "OPTIONS_EMPTY":
            return "⚠️ অন্তত ২টি অপশন দিন, `|` দিয়ে আলাদা করে।";
        case "TOO_FEW_OPTIONS":
            return `⚠️ অন্তত ${(result && result.min) || MIN_OPTIONS}টি আলাদা অপশন দরকার (পেয়েছি ${result.actual}টি)।`;
        case "TOO_MANY_OPTIONS":
            return `⚠️ সর্বোচ্চ ${limit || MAX_OPTIONS}টি অপশন দেওয়া যাবে (দিয়েছেন ${result.actual}টি)।`;
        case "OPTION_TOO_LONG":
            return `⚠️ একটি অপশন অনেক বড় (সর্বোচ্চ ${limit || MAX_OPTION_LENGTH} অক্ষর)।`;
        default:
            return "⚠️ পোল তৈরি করা যায়নি। ফরম্যাট: vote <টাইটেল> => <অপশন ১> | <অপশন ২>";
    }
}

function usageText(prefix, commandName) {
    const lead = prefix == null ? "" : prefix;
    const name = commandName || "vote";
    return [
        "🗳️ ভোট/পোল তৈরি করার নিয়ম:",
        `${lead}${name} <টাইটেল> => <অপশন ১> | <অপশন ২> | <অপশন ৩>`,
        "",
        `• সর্বনিম্ন ${MIN_OPTIONS}টি, সর্বোচ্চ ${MAX_OPTIONS}টি অপশন`,
        `• টাইটেল সর্বোচ্চ ${MAX_TITLE_LENGTH} অক্ষর`,
        `• শুধু \`${lead}${name}\` লিখলে ধাপে ধাপে ইনপুট নেওয়া হবে`,
    ].join("\n");
}

function buildSuccessMessage(parsed) {
    const lines = [`✅ পোল তৈরি হয়েছে / Poll created`, `📊 ${parsed.title}`, ""];
    parsed.options.forEach((option, index) => lines.push(`${index + 1}. ${option}`));
    if (parsed.removedDuplicates) {
        lines.push("", `ℹ️ ${parsed.removedDuplicates}টি ডুপ্লিকেট অপশন বাদ দেওয়া হয়েছে।`);
    }
    return lines.join("\n");
}

function buildPreviewMessage(parsed) {
    const lines = ["📝 পোল প্রিভিউ / Poll preview", `📊 ${parsed.title}`, ""];
    parsed.options.forEach((option, index) => lines.push(`${index + 1}. ${option}`));
    return lines.join("\n");
}

/**
 * Facebook's `createPoll` is callback based. Resolve on either the callback or
 * a returned promise, and never resolve twice.
 */
function createPollAsync(api, title, threadID, options, timeoutMs) {
    const waitMs = typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : 20000;
    return new Promise((resolve, reject) => {
        if (!api || typeof api.createPoll !== "function") {
            return reject(Object.assign(new Error("createPoll is not available in this FCA build"), { code: "UNSUPPORTED" }));
        }

        const pollOptions = {};
        for (const option of options) pollOptions[option] = false;

        let settled = false;
        let timer = null;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            if (error) reject(error);
            else resolve(value);
        };

        timer = setTimeout(() => finish(Object.assign(new Error("Poll creation timed out"), { code: "TIMEOUT" })), waitMs);

        try {
            const returned = api.createPoll(title, threadID, pollOptions, (error, info) => finish(error, info));
            if (returned && typeof returned.then === "function") {
                returned.then((info) => finish(null, info)).catch((error) => finish(error));
            }
        } catch (error) {
            finish(error);
        }
    });
}

function sendMessageAsync(api, text, threadID, replyToMessageID) {
    return new Promise((resolve, reject) => {
        if (!api || typeof api.sendMessage !== "function") {
            return reject(new Error("sendMessage is not available"));
        }
        const callback = (error, info) => (error ? reject(error) : resolve(info || {}));
        try {
            if (replyToMessageID) api.sendMessage(text, threadID, callback, replyToMessageID);
            else api.sendMessage(text, threadID, callback);
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    MIN_OPTIONS,
    MAX_OPTIONS,
    MAX_TITLE_LENGTH,
    MAX_OPTION_LENGTH,
    parseVoteInput,
    describeError,
    usageText,
    buildSuccessMessage,
    buildPreviewMessage,
    createPollAsync,
    sendMessageAsync,
};
