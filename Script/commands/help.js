const logger = require("../../utils/log.js");

/**
 * Help command.
 *
 * Keeps the defensive guards added in the previous fix (commands are loaded
 * asynchronously, so `command.config` must never be read blindly), but the
 * control flow is now explicit:
 *
 *   !help                 -> categories + their commands
 *   !help all             -> same as !help
 *   !help <command>       -> command details (name, usage, permission, …)
 *   !help <category>      -> commands in that category
 *   !help <page number>   -> flat paginated list
 *   !help <unknown>       -> friendly "not found" reply
 *
 * No-prefix "help …" is handled by `handleEvent`, but only when the query
 * actually matches a command/category, so ordinary chatter like "help me"
 * never produces a reply.
 */

const COMMANDS_PER_PAGE = 20;
const MAX_NAMES_PER_CATEGORY = 40;

function safeCommands() {
  try {
    const commands = global.client && global.client.commands;
    return commands && typeof commands.values === "function" ? commands : null;
  } catch (error) {
    return null;
  }
}

/** Commands are loaded asynchronously; never assume config exists. */
function safeCommand(commands, name) {
  if (!commands || typeof commands.get !== "function") return null;
  const key = String(name == null ? "" : name).toLowerCase();
  if (!key) return null;
  const direct = commands.get(key);
  if (direct && direct.config) return direct;
  for (const [registeredName, command] of commands) {
    if (!command || !command.config) continue;
    if (String(registeredName).toLowerCase() === key) return command;
    if (String(command.config.name || "").toLowerCase() === key) return command;
    if (Array.isArray(command.config.aliases)) {
      if (command.config.aliases.some((alias) => String(alias).toLowerCase() === key)) return command;
    } else if (typeof command.config.aliases === "string") {
      if (command.config.aliases.toLowerCase() === key) return command;
    }
  }
  return null;
}

function safeConfig(command) {
  return command && command.config && typeof command.config === "object" ? command.config : null;
}

function safeString(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function safeThreadData(threadID) {
  try {
    const store = global.data && global.data.threadData;
    if (!store || typeof store.get !== "function") return {};
    return store.get(threadID) || store.get(String(threadID)) || {};
  } catch (error) {
    return {};
  }
}

function safePrefix(threadID) {
  const threadData = safeThreadData(threadID);
  if (Object.prototype.hasOwnProperty.call(threadData, "PREFIX") && threadData.PREFIX) {
    return threadData.PREFIX;
  }
  return (global.config && (global.config.PREFIX || global.config.prefix)) || "!";
}

function commandEntries(commands) {
  const entries = [];
  if (!commands) return entries;
  try {
    for (const [key, command] of commands) {
      const config = safeConfig(command);
      if (!config) continue;
      entries.push({
        key: String(key),
        name: safeString(config.name, String(key)),
        config
      });
    }
  } catch (error) {
    // A partially-built map must not break help.
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

function categoryOf(config) {
  return safeString(config && config.commandCategory, "uncategorized").toLowerCase();
}

function groupByCategory(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const category = categoryOf(entry.config);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(entry);
  }
  return groups;
}

function translate(getText, key, ...args) {
  let value = "";
  try {
    value = typeof getText === "function" ? getText(key, ...args) : "";
  } catch (error) {
    value = "";
  }
  if (!value || value === key) {
    const fallback = (module.exports.languages.en && module.exports.languages.en[key]) || key;
    value = fallback;
    args.forEach((arg, index) => {
      value = value.replace(new RegExp(`%${index + 1}`, "g"), String(arg));
    });
  }
  return value;
}

function permissionLabel(config, getText) {
  const level = Number(config && config.hasPermssion);
  if (level === 1) return translate(getText, "adminGroup");
  if (level >= 2) return translate(getText, "adminBot");
  return translate(getText, "user");
}

function usageLine(entry, prefix) {
  const config = entry.config;
  const name = safeString(config.name, entry.name);
  const usages = safeString(config.usages, "");
  return `${prefix}${name}${usages ? " " + usages : ""}`;
}

function formatDetails(entry, prefix, getText) {
  const config = entry.config;
  const name = safeString(config.name, entry.name);
  const aliases = Array.isArray(config.aliases)
    ? config.aliases.map((alias) => String(alias)).filter(Boolean)
    : (typeof config.aliases === "string" && config.aliases ? [config.aliases] : []);
  const lines = [
    "╭──────•◈•──────╮",
    `│ 🔹 ${name}`,
    `│ 📝 ${safeString(config.description, "No description")}`,
    `│ 📂 ${safeString(config.commandCategory, "uncategorized")}`,
    `│ 🔐 ${permissionLabel(config, getText)}`,
    `│ ⏱️ ${safeString(config.cooldowns, "0")}s`,
    `│ 💡 ${usageLine(entry, prefix)}`
  ];
  if (aliases.length) lines.push(`│ 🔄 ${aliases.join(", ")}`);
  lines.push(`│ 👤 ${safeString(config.credits, "Unknown")}`);
  lines.push("╰──────•◈•──────╯");
  return lines.join("\n");
}

function formatCategories(groups, prefix, total, getText) {
  const lines = [
    "╭──────•◈•──────╮",
    "│   📋 COMMAND CATEGORIES",
    "├────────────────"
  ];
  for (const category of Array.from(groups.keys()).sort()) {
    const entries = groups.get(category).slice().sort((a, b) => a.name.localeCompare(b.name));
    let names = entries.slice(0, MAX_NAMES_PER_CATEGORY).map((entry) => entry.name).join(" • ");
    if (entries.length > MAX_NAMES_PER_CATEGORY) {
      names += ` … +${entries.length - MAX_NAMES_PER_CATEGORY} more`;
    }
    lines.push(`│ ❄️ ${category.charAt(0).toUpperCase() + category.slice(1)} (${entries.length})`);
    lines.push(`│    ${names}`);
  }
  lines.push("├────────────────");
  lines.push(`│ ${translate(getText, "total", total, groups.size)}`);
  lines.push(`│ 💡 ${prefix}help <command>`);
  lines.push(`│ 💡 ${prefix}help <category>`);
  lines.push("╰──────•◈•──────╯");
  return lines.join("\n");
}

function formatCategory(category, entries, prefix) {
  const lines = [
    "╭──────•◈•──────╮",
    `│ 📂 ${category.toUpperCase()} (${entries.length})`,
    "├────────────────"
  ];
  for (const entry of entries.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const usages = safeString(entry.config.usages, "");
    lines.push(`│ • ${entry.name}${usages ? " — " + usages : ""}`);
  }
  lines.push("├────────────────");
  lines.push(`│ 💡 ${prefix}help <command>`);
  lines.push("╰──────•◈•──────╯");
  return lines.join("\n");
}

function formatPage(entries, page, totalPages, prefix, getText) {
  const lines = [
    "╭──────•◈•──────╮",
    `│ 📄 ${translate(getText, "page", page, totalPages)}`,
    "├────────────────"
  ];
  for (const entry of entries) {
    lines.push(`│ • ${entry.name}`);
  }
  lines.push("├────────────────");
  lines.push(`│ 💡 ${prefix}help <command>`);
  lines.push("╰──────•◈•──────╯");
  return lines.join("\n");
}

/**
 * Render a help reply. Returns null when `allowNotFound === false` and the
 * query matches neither a command nor a category (used by the no-prefix
 * handler so "help me" stays silent).
 */
function renderHelp({ threadID, args, getText, allowNotFound }) {
  const commands = safeCommands();
  const entries = commandEntries(commands);

  if (!entries.length) {
    // The no-prefix handler must stay silent during startup; only an explicit
    // prefixed `!help` gets the friendly loading notice.
    return allowNotFound === false ? null : translate(getText, "loading");
  }

  const rawArgs = Array.isArray(args)
    ? args.map((arg) => (arg === undefined || arg === null ? "" : String(arg).trim())).filter(Boolean)
    : [];
  const first = rawArgs[0] || "";
  const joined = rawArgs.join(" ").trim();
  const prefix = safePrefix(threadID);
  const groups = groupByCategory(entries);

  if (!first) {
    return formatCategories(groups, prefix, entries.length, getText);
  }

  // `!help all` is the explicit name for the full category list.
  if (first.toLowerCase() === "all") {
    return formatCategories(groups, prefix, entries.length, getText);
  }

  // `!help 2` -> flat paginated list.
  if (/^\d+$/.test(first)) {
    const page = Math.max(1, parseInt(first, 10));
    const totalPages = Math.max(1, Math.ceil(entries.length / COMMANDS_PER_PAGE));
    const start = (page - 1) * COMMANDS_PER_PAGE;
    const view = entries.slice(start, start + COMMANDS_PER_PAGE);
    if (!view.length) {
      return translate(getText, "emptyPage", page);
    }
    return formatPage(view, page, totalPages, prefix, getText);
  }

  // Exact command/alias lookup always wins.
  const command = safeCommand(commands, first);
  if (command) {
    const config = safeConfig(command);
    if (!config) {
      return translate(getText, "noConfig", first);
    }
    return formatDetails({ key: first, name: safeString(config.name, first), config }, prefix, getText);
  }

  // Category lookup: "QTV BOX" arrives as two args, so try the joined form
  // first and then the first token.
  const categoryCandidates = [joined.toLowerCase(), first.toLowerCase()];
  for (const candidate of categoryCandidates) {
    if (candidate && groups.has(candidate)) {
      return formatCategory(candidate, groups.get(candidate), prefix);
    }
  }

  // Partial category match (e.g. "!help admin" -> "admin-bot system").
  if (joined) {
    const partial = Array.from(groups.keys()).find((category) =>
      category.includes(joined.toLowerCase()) || joined.toLowerCase().includes(category)
    );
    if (partial) {
      return formatCategory(partial, groups.get(partial), prefix);
    }
  }

  if (allowNotFound === false) return null;
  return translate(getText, "notFound", joined || first, prefix);
}

module.exports.config = {
  name: "help",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "CYBER BOT TEAM",
  description: "Show command categories, a category, or details for one command.",
  commandCategory: "system",
  usages: "[command | category | page | all]",
  cooldowns: 5,
  envConfig: {
    autoUnsend: true,
    delayUnsend: 20
  }
};

module.exports.languages = {
  en: {
    user: "User",
    adminGroup: "Admin group",
    adminBot: "Admin bot",
    loading: "⏳ Commands are still loading. Please try again in a moment.",
    total: "Total: %1 commands in %2 categories",
    page: "Page %1/%2",
    emptyPage: "❌ Page %1 is empty. Try a smaller page number.",
    noConfig: "❌ Command \"%1\" has no configuration.",
    notFound: "❌ Command or category \"%1\" not found.\nType %2help to see all categories."
  },
  bn: {
    user: "ইউজার",
    adminGroup: "গ্রুপ অ্যাডমিন",
    adminBot: "বট অ্যাডমিন",
    loading: "⏳ কমান্ডগুলো এখনো লোড হচ্ছে। একটু পরে আবার চেষ্টা করুন।",
    total: "মোট: %1টি কমান্ড, %2টি ক্যাটাগরি",
    page: "পৃষ্ঠা %1/%2",
    emptyPage: "❌ %1 নম্বর পৃষ্ঠা খালি। ছোট পৃষ্ঠা নম্বর দিন।",
    noConfig: "❌ \"%1\" কমান্ডের কনফিগারেশন নেই।",
    notFound: "❌ \"%1\" নামে কোনো কমান্ড বা ক্যাটাগরি নেই।\nসব ক্যাটাগরি দেখতে %2help লিখুন।"
  }
};

module.exports.handleEvent = function ({ api, event, getText }) {
  try {
    const body = event && event.body;
    if (!body || typeof body !== "string") return;

    // No-prefix form only. Prefixed "!help" is dispatched through run().
    const match = body.trim().match(/^help(?:\s+|$)(.*)$/i);
    if (!match) return;

    const rest = match[1].trim();
    const args = rest ? rest.split(/\s+/) : [];
    const reply = renderHelp({
      threadID: event.threadID,
      args,
      getText,
      allowNotFound: false
    });

    // "help me" / "help please" stays silent instead of spamming the group.
    if (!reply) return;
    return api.sendMessage(reply, event.threadID, event.messageID);
  } catch (error) {
    logger.loader(`[HELP] event error: ${error && error.message ? error.message : error}`, "error");
  }
};

module.exports.run = async function ({ api, event, args, getText }) {
  const threadID = event && event.threadID;
  const messageID = event && event.messageID;

  try {
    const reply = renderHelp({
      threadID,
      args,
      getText,
      allowNotFound: true
    });
    return api.sendMessage(reply, threadID, messageID);
  } catch (error) {
    logger.loader(`[HELP] error: ${error && error.message ? error.message : error}`, "error");
    return api.sendMessage(
      "❌ Help is temporarily unavailable. Please try again.",
      threadID,
      messageID
    );
  }
};
