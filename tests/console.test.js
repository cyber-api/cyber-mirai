"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CONSOLE_PATH = path.join(__dirname, "..", "Script", "commands", "console.js");
const SOURCE = fs.readFileSync(CONSOLE_PATH, "utf8");
const BANNER = "◆━━━━━━━━━◆𝐂𝐘𝐁𝐄𝐑 𝐁𝐎𝐓 𝐂𝐎𝐌𝐌𝐔𝐍𝐈𝐓𝐘◆━━━━━━━━◆";

function loadConsole() {
  const logs = [];

  const fakeRequire = (id) => {
    if (id === "chalk") {
      return {
        hex() {
          return (text) => String(text);
        },
      };
    }
    if (id === "moment-timezone") {
      const moment = () => ({ format: () => "Monday, 01 January 2026 12:00" });
      moment.tz = () => ({ format: () => "Monday, 01 January 2026 12:00" });
      return moment;
    }
    throw new Error(`Unexpected require: ${id}`);
  };

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console: {
      log(...args) { logs.push(args.join(" ")); },
      error() {},
      warn() {},
    },
    process,
    Buffer,
    require: fakeRequire,
    global: null,
  };
  sandbox.global = {
    config: { PREFIX: "!" },
    data: {
      threadData: new Map(),
      threadInfo: new Map([["300000000000001", { threadName: "Cyber Group" }]]),
    },
  };

  const api = {
    getCurrentUserID: () => "200000000000001",
    getThreadInfo: async () => ({ threadName: "Cyber Group" }),
    getUserInfo: async (uid) => ({ [uid]: { name: "Mahbub" } }),
    sendMessage() { return { messageID: "x" }; },
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "console.js" });
  return { module: sandbox.module.exports, sandbox, api, logs };
}

test("console command is owner-only and grouped as Admin-bot system", () => {
  const { module } = loadConsole();
  assert.equal(module.config.name, "console");
  assert.equal(module.config.hasPermssion, 3);
  assert.equal(module.config.commandCategory, "Admin-bot system");
  assert.equal(module.config.cooldowns, 0);
});

test("handleEvent prints exactly the 7 coloured Mirai lines", async () => {
  const { module, api, logs } = loadConsole();
  await module.handleEvent({
    api,
    event: {
      threadID: "300000000000001",
      senderID: "100000000000001",
      body: "hello world",
      messageID: "m1",
    },
  });

  assert.equal(logs.length, 7);
  assert.match(logs[0], /^\[💓\]→ Group name: Cyber Group$/);
  assert.match(logs[1], /^\[🔎\]→ Group ID: 300000000000001$/);
  assert.match(logs[2], /^\[🔱\]→ User name: Mahbub$/);
  assert.match(logs[3], /^\[📝\]→ User ID: 100000000000001$/);
  assert.match(logs[4], /^\[📩\]→ Content: hello world$/);
  assert.match(logs[5], /^\[ Monday, 01 January 2026 12:00 \]$/);
  assert.equal(logs[6], BANNER);
});

test("threadData.console === true means silence", async () => {
  const { module, sandbox, api, logs } = loadConsole();
  sandbox.global.data.threadData.set("300000000000001", { console: true });

  await module.handleEvent({
    api,
    event: {
      threadID: "300000000000001",
      senderID: "100000000000001",
      body: "should not log",
      messageID: "m2",
    },
  });

  assert.equal(logs.length, 0);
});

test("the bot's own messages are not logged", async () => {
  const { module, api, logs } = loadConsole();
  await module.handleEvent({
    api,
    event: {
      threadID: "300000000000001",
      senderID: "200000000000001",
      body: "bot message",
      messageID: "m3",
    },
  });

  assert.equal(logs.length, 0);
});

test("run toggles the silence flag and reports the correct state", async () => {
  const { module, sandbox } = loadConsole();
  const sent = [];
  const api = { sendMessage(message) { sent.push(message); } };

  await module.run({
    api,
    event: { threadID: "300000000000001", messageID: "m4" },
  });
  assert.equal(sandbox.global.data.threadData.get("300000000000001").console, true);
  assert.match(sent[0], /silenced/);

  await module.run({
    api,
    event: { threadID: "300000000000001", messageID: "m5" },
  });
  assert.equal(sandbox.global.data.threadData.get("300000000000001").console, false);
  assert.match(sent[1], /active/);
});

test("the 26-colour palette is preserved exactly", () => {
  const match = SOURCE.match(/const COLOR_PALETTE = \[([\s\S]*?)\];/);
  assert.ok(match, "palette block should exist");
  const colours = match[1].match(/"[0-9A-F]{6}"/g).map((entry) => entry.slice(1, -1));
  assert.equal(colours.length, 26);
  assert.deepEqual(colours.slice(0, 5), ["FF9900", "FFFF33", "33FFFF", "FF99FF", "FF3366"]);
  assert.equal(colours[25], "FF7396");
});
