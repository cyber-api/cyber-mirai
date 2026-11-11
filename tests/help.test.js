"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HELP_PATH = path.join(__dirname, "..", "Script", "commands", "help.js");
const SOURCE = fs.readFileSync(HELP_PATH, "utf8");

function command(name, category, extra) {
  return {
    config: Object.assign({
      name,
      description: `${name} description`,
      commandCategory: category,
      hasPermssion: 0,
      cooldowns: 5,
      usages: `[${name}-arg]`,
      credits: "Test",
    }, extra || {}),
    run() {},
  };
}

function defaultCommands() {
  const commands = new Map();
  commands.set("help", command("help", "system", { usages: "[command]", cooldowns: 5 }));
  commands.set("admin", command("admin", "info"));
  commands.set("settings", command("settings", "admin", { hasPermssion: 2 }));
  commands.set("console", command("console", "Admin-bot system", { hasPermssion: 3, cooldowns: 0 }));
  commands.set("hi", command("hi", "QTV BOX"));
  return commands;
}

function loadHelp(options) {
  const settings = options || {};
  const sent = [];

  const fakeRequire = (id) => {
    if (id === "../../utils/adminInfo.js") {
      return { getAdminInfo: () => ({ name: "Test Owner" }) };
    }
    if (id === "../../utils/log.js") {
      return { loader() {}, error() {}, log() {} };
    }
    throw new Error(`Unexpected require: ${id}`);
  };

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    process,
    Buffer,
    require: fakeRequire,
    global: null,
  };
  sandbox.global = {
    client: { commands: settings.commands || defaultCommands() },
    data: settings.data || { threadData: new Map() },
    config: Object.assign({ PREFIX: "!", language: "en" }, settings.config || {}),
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "help.js" });

  const help = sandbox.module.exports;
  const language = (settings.config && settings.config.language) || "en";
  const getText = (key, ...args) => {
    const table = (help.languages && (help.languages[language] || help.languages.en)) || {};
    let value = table[key] || "";
    args.forEach((arg, index) => {
      value = value.replace(new RegExp(`%${index + 1}`, "g"), String(arg));
    });
    return value;
  };

  const api = {
    sendMessage(message, threadID, messageID) {
      sent.push({ message, threadID, messageID });
      return { messageID: "sent-" + sent.length };
    },
  };

  return { help, api, sent, getText, sandbox };
}

async function runHelp(options, args) {
  const loaded = loadHelp(options);
  await loaded.help.run({
    api: loaded.api,
    event: { threadID: "300000000000001", messageID: "m1" },
    args: args || [],
    getText: loaded.getText,
  });
  return loaded;
}

test("!help lists categories with their commands", async () => {
  const { sent } = await runHelp({}, []);
  assert.equal(sent.length, 1);
  const message = sent[0].message;
  assert.match(message, /COMMAND CATEGORIES/);
  assert.match(message, /System \(1\)/);
  assert.match(message, /Info \(1\)/);
  assert.match(message, /Admin \(1\)/);
  assert.match(message, /Admin-bot system \(1\)/);
  assert.match(message, /Qtv box \(1\)/);
  assert.match(message, /help/);
  assert.match(message, /Total: 5 commands in 5 categories/);
});

test("!help help shows command details", async () => {
  const { sent } = await runHelp({}, ["help"]);
  assert.equal(sent.length, 1);
  const message = sent[0].message;
  assert.match(message, /🔹 help/);
  assert.match(message, /📂 system/);
  assert.match(message, /🔐 User/);
  assert.match(message, /⏱️ 5s/);
  assert.match(message, /💡 !help \[command\]/);
});

test("!help system shows the commands in that category", async () => {
  const { sent } = await runHelp({}, ["system"]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /SYSTEM \(1\)/);
  assert.match(sent[0].message, /• help/);
  assert.doesNotMatch(sent[0].message, /• admin/);
});

test("!help <category with spaces> works", async () => {
  const { sent } = await runHelp({}, ["Admin-bot", "system"]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /ADMIN-BOT SYSTEM \(1\)/);
  assert.match(sent[0].message, /• console/);
});

test("!help <alias> resolves to the command", async () => {
  const commands = defaultCommands();
  commands.set("help", command("help", "system", { aliases: ["h", "?"] }));
  const { sent } = await runHelp({ commands }, ["h"]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /🔹 help/);
  assert.match(sent[0].message, /🔄 h, \?/);
});

test("!help xyzabc gives a friendly not-found reply", async () => {
  const { sent } = await runHelp({}, ["xyzabc"]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /Command or category "xyzabc" not found/);
  assert.match(sent[0].message, /!help/);
});

test("!help before commands finish loading is friendly, not a crash", async () => {
  const { sent } = await runHelp({ commands: new Map() }, []);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /still loading/i);
});

test("!help works when global.data.threadData is missing", async () => {
  const { sent } = await runHelp({ data: {} }, ["help"]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /💡 !help \[command\]/);
});

test("a command with no config is skipped without throwing", async () => {
  const commands = defaultCommands();
  commands.set("broken", { run() {} });
  const { sent } = await runHelp({ commands }, []);
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].message, /broken/);
});

test("!help <page> paginates the flat command list", async () => {
  const commands = new Map();
  for (let index = 1; index <= 21; index++) {
    commands.set(`cmd${index}`, command(`cmd${index}`, "system"));
  }
  const { sent } = await runHelp({ commands }, ["2"]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /Page 2\/2/);
  assert.match(sent[0].message, /• cmd\d+/);
});

test("no-prefix 'help help' replies, but 'help me' stays silent", async () => {
  const loaded = loadHelp({});
  await loaded.help.handleEvent({
    api: loaded.api,
    event: { threadID: "300000000000001", messageID: "m1", body: "help help" },
    getText: loaded.getText,
  });
  assert.equal(loaded.sent.length, 1);
  assert.match(loaded.sent[0].message, /🔹 help/);

  await loaded.help.handleEvent({
    api: loaded.api,
    event: { threadID: "300000000000001", messageID: "m2", body: "help me" },
    getText: loaded.getText,
  });
  assert.equal(loaded.sent.length, 1, "ordinary chatter must not be answered");

  await loaded.help.handleEvent({
    api: loaded.api,
    event: { threadID: "300000000000001", messageID: "m3", body: "help xyzabc" },
    getText: loaded.getText,
  });
  assert.equal(loaded.sent.length, 1, "unknown no-prefix help must be silent");
});

test("prefixed !help is not handled twice by handleEvent", async () => {
  const loaded = loadHelp({});
  await loaded.help.handleEvent({
    api: loaded.api,
    event: { threadID: "300000000000001", messageID: "m1", body: "!help" },
    getText: loaded.getText,
  });
  assert.equal(loaded.sent.length, 0);
});

test("Bengali language uses the Bengali not-found text", async () => {
  const { sent } = await runHelp({ config: { language: "bn" } }, ["xyzabc"]);
  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /কোনো কমান্ড বা ক্যাটাগরি নেই/);
});
