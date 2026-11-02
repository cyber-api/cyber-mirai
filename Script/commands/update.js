"use strict";

/**
 * `update` — optional (NON-MANDATORY) update command.
 *
 * - `update`         : check the manifest and offer an update
 * - `update refuse`  : silence startup update notices for 2 hours
 * - `update status`  : show current/latest version without installing
 *
 * Nothing here exits the process, force-pulls, resets, or deletes local work.
 * When the local git tree has changes the command refuses and asks the operator
 * to commit/stash first.
 */

const path = require("path");
const {
    checkForUpdate,
    checkCommitCooldown,
    getLocalChanges,
    applyUpdate,
    readCurrentVersion,
    refuseUpdates,
    isUpdateRefused,
    getRefusalRemaining,
    formatDuration,
    REFUSE_MS
} = require(path.join(__dirname, "..", "..", "utils", "updater.js"));

const COMMAND_NAME = "update";

module.exports.config = {
    name: COMMAND_NAME,
    version: "1.0.0",
    hasPermssion: 2,
    credits: "MAHBUB MAHBUB-SHAON",
    description: "Optional update system: check, install, or silence update notices for 2 hours",
    commandCategory: "System",
    usages: "[check/status/refuse]",
    cooldowns: 15
};

module.exports.languages = {
    en: {
        checking: "🔎 Checking for updates...",
        noUpdate: "✅ You are using the latest version (v%1).",
        checkFailed: "⚠️ Update check failed: %1\n\nYour bot keeps working normally. You can also update manually with git pull.",
        pendingHeader: "💫 Update available: v%1 → v%2",
        optionalNotice: "This is optional. You can keep using v%1 without any problem.",
        filesHeader: "\n📦 Files to update (%1):",
        deletesHeader: "\n🗑️ Files to remove (%1):",
        notesHeader: "\n📝 What's new:",
        moreFiles: "\n   …and %1 more",
        confirmHint: "\n\n💡 React to this message to confirm the update.\n🛑 To skip for 2 hours: %1update refuse",
        confirmed: "🚀 Confirmed. Downloading updates...",
        updating: "⏳ Applying update, please wait...",
        localChanges: "🛑 Update cancelled: the local git tree has changes (%1 file(s)).\nCommit or stash them first, then retry.\nNo files were changed.",
        alreadyChanged: "⚠️ The installed version changed while the prompt was open (now v%1). Run %2update again.",
        updateOk: "✅ Update finished: %1 updated, %2 removed, %3 skipped.\nBackup: %4\n\nNow restart the bot (%5restart) to apply the update. This command never restarts the bot automatically.",
        updatePartial: "⚠️ Update finished with problems.\nUpdated: %1 | Removed: %2 | Skipped: %3 | Failed: %4\nBackup: %5\nFailed entries: %6\n\nRestart the bot (%7restart) after fixing the failures.",
        updateFailed: "❌ Update could not be applied: %1\nYour bot keeps running normally.",
        tooSoon: "ℹ️ The repository was updated less than 5 minutes ago (%1 remaining). The update will still run, but if files look incomplete wait a moment and retry.",
        refused: "✅ Update notices are silenced for %1 (until %2).\nThe bot keeps working normally, and %3update still works.",
        alreadyRefused: "ℹ️ Update notices are already silenced for another %1.",
        nothingToRefuse: "⚠️ No update is pending, so there is nothing to refuse.",
        status: "📌 Current: v%1\n📌 Latest: v%2\n📌 Pending: %3 version(s)\n📌 Notices: %4",
        notesOn: "enabled",
        notesOff: "refused for %1",
        confirmedNoPermission: "Only the admin who ran the command can confirm this update."
    },
    bn: {
        checking: "🔎 আপডেট খোঁজা হচ্ছে...",
        noUpdate: "✅ আপনি সর্বশেষ ভার্সন ব্যবহার করছেন (v%1)।",
        checkFailed: "⚠️ আপডেট চেক ব্যর্থ: %1\n\nবট স্বাভাবিকভাবেই চলবে। চাইলে git pull দিয়ে ম্যানুয়ালিও আপডেট করতে পারেন।",
        pendingHeader: "💫 নতুন আপডেট পাওয়া গেছে: v%1 → v%2",
        optionalNotice: "এটি বাধ্যতামূলক নয়। আপনি v%1 ব্যবহার করেই কোনো সমস্যা ছাড়া বট চালাতে পারবেন।",
        filesHeader: "\n📦 যে ফাইলগুলো আপডেট হবে (%1):",
        deletesHeader: "\n🗑️ যে ফাইলগুলো মুছে যাবে (%1):",
        notesHeader: "\n📝 নতুন কী আছে:",
        moreFiles: "\n   …আরও %1 টি",
        confirmHint: "\n\n💡 আপডেট নিশ্চিত করতে এই মেসেজে রিঅ্যাক্ট করুন।\n🛑 ২ ঘণ্টার জন্য বন্ধ করতে: %1update refuse",
        confirmed: "🚀 নিশ্চিত হয়েছে। আপডেট ডাউনলোড হচ্ছে...",
        updating: "⏳ আপডেট বসানো হচ্ছে, অপেক্ষা করুন...",
        localChanges: "🛑 আপডেট বাতিল: লোকাল git-এ %1 টি ফাইল পরিবর্তিত আছে।\nআগে commit বা stash করুন, তারপর আবার চেষ্টা করুন।\nকোনো ফাইল পরিবর্তন করা হয়নি।",
        alreadyChanged: "⚠️ প্রম্পট খোলা থাকার সময় ভার্সন বদলে গেছে (এখন v%1)। আবার %2update চালান।",
        updateOk: "✅ আপডেট সম্পন্ন: %1 আপডেট, %2 মুছে ফেলা, %3 বাদ।\nব্যাকআপ: %4\n\nএখন বট রিস্টার্ট করুন (%5restart)। এই কমান্ড কখনো নিজে থেকে রিস্টার্ট করে না।",
        updatePartial: "⚠️ আপডেট শেষ হয়েছে কিছু সমস্যাসহ।\nআপডেট: %1 | মুছে: %2 | বাদ: %3 | ব্যর্থ: %4\nব্যাকআপ: %5\nব্যর্থ: %6\n\nসমস্যা ঠিক করে বট রিস্টার্ট করুন (%7restart)।",
        updateFailed: "❌ আপডেট প্রয়োগ করা যায়নি: %1\nআপনার বট স্বাভাবিকভাবে চলছে।",
        tooSoon: "ℹ️ রিপোতে ৫ মিনিটের কম আগে পরিবর্তন হয়েছে (%1 বাকি)। আপডেট তবুও চলবে, তবে ফাইল অসম্পূর্ণ মনে হলে একটু পরে আবার চেষ্টা করুন।",
        refused: "✅ আপডেট নোটিফিকেশন %1 এর জন্য বন্ধ (পর্যন্ত %2)।\nবট স্বাভাবিক চলবে, এবং %3update সবসময় কাজ করবে।",
        alreadyRefused: "ℹ️ আপডেট নোটিফিকেশন আরও %1 এর জন্য বন্ধ আছে।",
        nothingToRefuse: "⚠️ কোনো আপডেট পেন্ডিং নেই, তাই বন্ধ করার কিছু নেই।",
        status: "📌 বর্তমান: v%1\n📌 সর্বশেষ: v%2\n📌 পেন্ডিং: %3 ভার্সন\n📌 নোটিফিকেশন: %4",
        notesOn: "চালু",
        notesOff: "%1 এর জন্য বন্ধ",
        confirmedNoPermission: "শুধু যে অ্যাডমিন কমান্ডটি চালিয়েছেন তিনিই এটি নিশ্চিত করতে পারবেন।"
    }
};

/** getText() returns "" when the configured language is missing a key. */
function t(getText, key, ...values) {
    let text = typeof getText === "function" ? getText(key, ...values) : "";
    if (!text) {
        const fallback = module.exports.languages.en[key] || key;
        text = String(fallback).replace(/%(\d+)/g, (match, index) => {
            const value = values[Number(index) - 1];
            return value === undefined || value === null ? match : String(value);
        });
    }
    return text;
}

function prefixOf() {
    return (global.config && (global.config.PREFIX || global.config.prefix)) || "!";
}

function formatFiles(list, limit) {
    if (!list.length) return "";
    const shown = list.slice(0, limit).map((file) => `   • ${file}`).join("\n");
    const rest = list.length > limit ? list.slice(limit) : [];
    return rest.length ? `${shown}\n   …and ${rest.length} more` : shown;
}

function listFrom(update, key) {
    return Object.keys(update[key] || {}).sort();
}

module.exports.run = async function ({ api, event, args, getText }) {
    const { threadID, messageID } = event;
    const action = String((args && args[0]) || "").toLowerCase();

    if (action === "refuse" || action === "r") {
        if (isUpdateRefused()) {
            return api.sendMessage(t(getText, "alreadyRefused", formatDuration(getRefusalRemaining())), threadID, messageID);
        }
        const update = await checkForUpdate({ repoDir: global.client.mainPath });
        if (!update.ok) {
            return api.sendMessage(t(getText, "checkFailed", update.error), threadID, messageID);
        }
        if (!update.hasUpdate) {
            return api.sendMessage(t(getText, "nothingToRefuse"), threadID, messageID);
        }
        const until = refuseUpdates(REFUSE_MS);
        const untilText = new Date(until).toLocaleString();
        return api.sendMessage(
            t(getText, "refused", formatDuration(REFUSE_MS), untilText, prefixOf()),
            threadID,
            messageID
        );
    }

    if (action === "status") {
        const update = await checkForUpdate({ repoDir: global.client.mainPath });
        if (!update.ok) {
            return api.sendMessage(t(getText, "checkFailed", update.error), threadID, messageID);
        }
        const notices = isUpdateRefused()
            ? t(getText, "notesOff", formatDuration(getRefusalRemaining()))
            : t(getText, "notesOn");
        return api.sendMessage(
            t(getText, "status", update.currentVersion, update.latestVersion || update.currentVersion,
                update.pendingVersions.length, notices),
            threadID,
            messageID
        );
    }

    const update = await checkForUpdate({ repoDir: global.client.mainPath });
    if (!update.ok) {
        return api.sendMessage(t(getText, "checkFailed", update.error), threadID, messageID);
    }
    if (!update.hasUpdate) {
        return api.sendMessage(t(getText, "noUpdate", update.currentVersion), threadID, messageID);
    }

    const files = listFrom(update, "files");
    const deletes = listFrom(update, "deleteFiles");
    let body = t(getText, "pendingHeader", update.currentVersion, update.latestVersion);
    body += `\n\n${t(getText, "optionalNotice", update.currentVersion)}`;
    if (files.length) body += `\n${t(getText, "filesHeader", files.length)}\n${formatFiles(files, 10)}`;
    if (deletes.length) body += `\n${t(getText, "deletesHeader", deletes.length)}\n${formatFiles(deletes, 10)}`;
    if (update.notes.length) {
        body += `\n${t(getText, "notesHeader")}`;
        for (const entry of update.notes.slice(-3)) body += `\n   • v${entry.version}: ${String(entry.note).slice(0, 300)}`;
    }
    body += `\n${t(getText, "confirmHint", prefixOf())}`;

    return api.sendMessage(body, threadID, (error, info) => {
        if (error || !info) return;
        global.client.handleReaction.push({
            name: COMMAND_NAME,
            messageID: info.messageID,
            author: String(event.senderID),
            threadID: String(threadID),
            createdAt: Date.now(),
            ttl: 30 * 60 * 1000,
            once: true,
            plan: update
        });
    });
};

module.exports.handleReaction = async function ({ api, event, handleReaction, getText }) {
    const { threadID, messageID, userID } = event;
    if (!handleReaction || String(handleReaction.author) !== String(userID)) {
        return api.sendMessage(t(getText, "confirmedNoPermission"), threadID, messageID);
    }

    const plan = handleReaction.plan;
    if (!plan || !plan.hasUpdate) {
        return api.sendMessage(t(getText, "noUpdate", readCurrentVersion(global.client.mainPath)), threadID, messageID);
    }

    const repoDir = global.client.mainPath;
    const installed = readCurrentVersion(repoDir);
    if (installed !== plan.currentVersion) {
        return api.sendMessage(t(getText, "alreadyChanged", installed, prefixOf()), threadID, messageID);
    }

    const changes = getLocalChanges(repoDir);
    if (changes.isRepo && !changes.clean) {
        return api.sendMessage(t(getText, "localChanges", changes.changes.length), threadID, messageID);
    }

    const cooldown = await checkCommitCooldown({ timeout: 8000 });
    const tooSoonNote = cooldown.tooSoon ? `\n\n${t(getText, "tooSoon", formatDuration(cooldown.remainingMs))}` : "";

    await api.sendMessage(t(getText, "confirmed"), threadID, messageID);

    try {
        const report = await applyUpdate(plan, { repoDir });
        const backup = report.backupDir || "n/a";
        if (report.ok) {
            return api.sendMessage(
                t(getText, "updateOk", report.updated.length, report.deleted.length, report.skipped.length, backup, prefixOf()) + tooSoonNote,
                threadID,
                messageID
            );
        }
        const failures = report.failed.map((item) => `${item.path}: ${item.error}`).slice(0, 8).join("\n   ");
        return api.sendMessage(
            t(getText, "updatePartial", report.updated.length, report.deleted.length, report.skipped.length,
                report.failed.length, backup, failures, prefixOf()) + tooSoonNote,
            threadID,
            messageID
        );
    } catch (error) {
        return api.sendMessage(t(getText, "updateFailed", error && error.message ? error.message : String(error)), threadID, messageID);
    }
};
