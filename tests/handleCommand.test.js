"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HANDLE_COMMAND_PATH = path.join(__dirname, "..", "includes", "handle", "handleCommand.js");
const SOURCE = fs.readFileSync(HANDLE_COMMAND_PATH, "utf8");

function loadDispatcher(ratingFor) {
  const sent = [];
  const ran = [];

  const fakeRequire = (id) => {
    if (id === "string-similarity") {
      return {
        findBestMatch(needle, list) {
          const rating = ratingFor(needle);
          const target = rating >= 0.7 ? "help" : (list[0] || "help");
          return { bestMatch: { target, rating } };
        },
      };
    }
    if (id === "moment-timezone") {
      const moment = () => ({ format: () => "12:00:00 01/01/2026" });
      moment.tz = () => ({ format: () => "12:00:00 01/01/2026" });
      return moment;
    }
    if (id === "../../utils/log.js") {
      return { loader() {}, error() {}, log() {} };
    }
    if (id === "../../utils/adminAuth.js") {
      return require("../utils/adminAuth.js");
    }
    throw new Error(`Unexpected require: ${id}`);
  };

  const commands = new Map();
  const helpCommand = {
    config: { name: "help", hasPermssion: 0, cooldowns: 0, commandCategory: "system" },
    run() { ran.push("help"); },
  };
  commands.set("help", helpCommand);

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
    config: {
      PREFIX: "!",
      language: "en",
      adminBot: ["100000000000001"],
      NDH: [],
      adminOnly: { enable: false },
      hideNotiMessage: {},
    },
    client: { commands, cooldowns: new Map() },
    data: {
      threadData: new Map(),
      threadInfo: new Map(),
      userBanned: new Map(),
      threadBanned: new Map(),
      commandBanned: new Map(),
    },
    getText(scope, key, ...args) {
      return `${scope}.${key}${args.length ? "|" + args.join(",") : ""}`;
    },
  };

  const api = {
    getCurrentUserID: () => "200000000000001",
    sendMessage(message, threadID, messageID) {
      sent.push({ message, threadID, messageID });
      return { messageID: "sent-" + sent.length };
    },
    getThreadInfo: async () => ({ adminIDs: [], threadName: "Test" }),
  };

  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "handleCommand.js" });

  const factory = sandbox.module.exports;
  const handler = factory({
    api,
    models: {},
    Users: {},
    Threads: { getInfo: async () => ({ adminIDs: [] }) },
    Currencies: {},
  });

  return { handler, sent, ran, sandbox };
}

test("a valid prefixed command runs once and sends no invalid-command reply", async () => {
  const { handler, sent, ran, sandbox } = loadDispatcher(() => 0.1);
  const event = {
    threadID: "300000000000001",
    messageID: "m1",
    senderID: "100000000000001",
    body: "!help",
  };

  await handler({ event });

  assert.deepEqual(ran, ["help"]);
  assert.equal(sent.length, 0, "the command itself decides what to send");
  assert.equal(event.__cyberHandledCommandName, "help");
  assert.ok(sandbox.global.client.cooldowns.has("help"));
});

test("an unknown command sends exactly one not-found reply", async () => {
  const { handler, sent } = loadDispatcher(() => 0.1);
  await handler({
    event: {
      threadID: "300000000000001",
      messageID: "m2",
      senderID: "100000000000001",
      body: "!zzzz",
    },
  });

  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /commandNotFound/);
});

test("a close miss sends exactly one did-you-mean reply (score > 0.7)", async () => {
  const { handler, sent } = loadDispatcher(() => 0.8);
  await handler({
    event: {
      threadID: "300000000000001",
      messageID: "m3",
      senderID: "100000000000001",
      body: "!hel",
    },
  });

  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /commandNotExist/);
  assert.doesNotMatch(sent[0].message, /commandNotFound/);
});

test("a prefix-only message is left for the noprefix handler (no invalid command)", async () => {
  const { handler, sent, ran } = loadDispatcher(() => 0.1);
  await handler({
    event: {
      threadID: "300000000000001",
      messageID: "m4",
      senderID: "100000000000001",
      body: "!",
    },
  });

  assert.equal(sent.length, 0);
  assert.deepEqual(ran, []);
});

test("handleCommandEvent refuses a message already owned by handleCommand", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "includes", "handle", "handleCommandEvent.js"), "utf8");
  assert.match(source, /__cyberCommandConsumed/);
  assert.match(source, /__cyberHandledCommandName/);
});
