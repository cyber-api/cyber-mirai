"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HANDLE_COMMAND_PATH = path.join(__dirname, "..", "includes", "handle", "handleCommand.js");
const SOURCE = fs.readFileSync(HANDLE_COMMAND_PATH, "utf8");

function loadDispatcher(ratingFor, options) {
  const settings = options || {};
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
  // A command with BOTH run and handleEvent. The prefixed dispatcher must run
  // `run` and the event dispatcher must not run `handleEvent` for the same
  // message. Before this fix, such commands silently did nothing.
  const helpCommand = {
    config: { name: "help", hasPermssion: 0, cooldowns: 0, commandCategory: "system" },
    run() { ran.push("help"); },
    handleEvent() { ran.push("help:event"); },
  };
  commands.set("help", helpCommand);

  const adminCommand = {
    config: { name: "admin", hasPermssion: 0, cooldowns: 0, commandCategory: "info" },
    run() { ran.push("admin"); },
  };
  commands.set("admin", adminCommand);

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
    config: Object.assign({
      PREFIX: "!",
      language: "en",
      adminBot: ["100000000000001"],
      NDH: [],
      adminOnly: { enable: false },
      hideNotiMessage: {},
    }, settings.config || {}),
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

function eventFor(body, extra) {
  return Object.assign({
    threadID: "300000000000001",
    messageID: "m",
    senderID: "100000000000001",
    body,
  }, extra || {});
}

test("a valid prefixed command runs once and sends no invalid-command reply", async () => {
  const { handler, sent, ran, sandbox } = loadDispatcher(() => 0.1);
  const event = eventFor("!help");

  await handler({ event });

  assert.deepEqual(ran, ["help"]);
  assert.equal(sent.length, 0, "the command itself decides what to send");
  assert.equal(event.__cyberHandledCommandName, "help");
  assert.ok(sandbox.global.client.cooldowns.has("help"));
});

test("a command with both run and handleEvent runs run (regression)", async () => {
  const { handler, ran } = loadDispatcher(() => 0.1);
  await handler({ event: eventFor("!help") });

  assert.deepEqual(ran, ["help"], "handleEvent must not also fire");
});

test("an unknown command sends exactly one not-found reply by default", async () => {
  const { handler, sent } = loadDispatcher(() => 0.1);
  await handler({ event: eventFor("!zzzz") });

  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /commandNotFound/);
});

test("commandNotFoundBehavior=silent suppresses the not-found reply", async () => {
  const { handler, sent } = loadDispatcher(() => 0.1, {
    config: { commandNotFoundBehavior: "silent" },
  });
  await handler({ event: eventFor("!zzzz") });

  assert.equal(sent.length, 0);
});

test("a close miss sends exactly one did-you-mean reply (score > 0.7)", async () => {
  const { handler, sent } = loadDispatcher(() => 0.8);
  await handler({ event: eventFor("!hel") });

  assert.equal(sent.length, 1);
  assert.match(sent[0].message, /commandNotExist/);
  assert.doesNotMatch(sent[0].message, /commandNotFound/);
});

test("a prefix-only message is left for the noprefix handler (no invalid command)", async () => {
  const { handler, sent, ran } = loadDispatcher(() => 0.1);
  await handler({ event: eventFor("!") });

  assert.equal(sent.length, 0);
  assert.deepEqual(ran, []);
});

test("a wrong prefix is silent (does not run or reply)", async () => {
  for (const body of ["/admin", ".admin", "?admin"]) {
    const { handler, sent, ran } = loadDispatcher(() => 0.9);
    await handler({ event: eventFor(body) });

    assert.equal(sent.length, 0, `${body} must be silent`);
    assert.deepEqual(ran, [], `${body} must not run a command`);
  }
});

test("plain no-prefix chatter is silent", async () => {
  for (const body of ["হাই", "admin", "hello everyone"]) {
    const { handler, sent, ran } = loadDispatcher(() => 0.9);
    await handler({ event: eventFor(body) });

    assert.equal(sent.length, 0, `${body} must be silent`);
    assert.deepEqual(ran, [], `${body} must not run a command`);
  }
});

test("respondToAllPrefixes accepts !, / and .", async () => {
  for (const body of ["!admin", "/admin", ".admin"]) {
    const { handler, sent, ran } = loadDispatcher(() => 0.1, {
      config: { respondToAllPrefixes: true },
    });
    await handler({ event: eventFor(body) });

    assert.deepEqual(ran, ["admin"], `${body} should run admin`);
    assert.equal(sent.length, 0);
  }
});

test("the bot nickname still works as an invocation prefix", async () => {
  const { handler, ran } = loadDispatcher(() => 0.1);
  await handler({ event: eventFor("CYBER MIRAI BOT admin") });

  assert.deepEqual(ran, ["admin"]);
});

test("handleCommandEvent refuses a message already owned by handleCommand", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "includes", "handle", "handleCommandEvent.js"), "utf8");
  assert.match(source, /__cyberCommandConsumed/);
  assert.match(source, /__cyberHandledCommandName/);
});
