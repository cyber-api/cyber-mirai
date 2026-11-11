"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { normalizeConfig } = require("../utils/config");

test("fresh config defaults admin-only to OFF", () => {
  const config = normalizeConfig({}, { warn() {} });
  assert.equal(config.adminOnly.enable, false);
  assert.deepEqual(config.adminOnly.ignoreCommand, []);
  assert.equal(config.hideNotiMessage.adminOnly, false);
});

test("an existing adminOnly.enable=true is respected", () => {
  const config = normalizeConfig({
    adminOnly: { enable: true, ignoreCommand: ["help"] },
    hideNotiMessage: { adminOnly: true },
  }, { warn() {} });

  assert.equal(config.adminOnly.enable, true);
  assert.deepEqual(config.adminOnly.ignoreCommand, ["help"]);
  assert.equal(config.hideNotiMessage.adminOnly, true);
});

test("0admin on/off still persists the toggle", async () => {
  const configPath = path.join(__dirname, "tmp-config.json");
  let persisted = {
    PREFIX: "!",
    adminOnly: { enable: false, ignoreCommand: [] },
    hideNotiMessage: { adminOnly: false },
    ADMINBOT: ["10001"],
    NDH: ["10001"],
  };
  const sent = [];

  const fakeRequire = (id) => {
    if (id === "request") return () => {};
    if (id === "../../utils/adminAuth.js") return require("../utils/adminAuth.js");
    if (id === "fs-extra") {
      return {
        readdirSync() { return []; },
        readFileSync() { return "{}"; },
        writeFileSync(target, value) {
          if (String(target) === configPath) persisted = JSON.parse(value);
        },
        existsSync() { return true; },
        copySync() {},
        createWriteStream() {},
        createReadStream() {},
      };
    }
    if (id === "path") return path;
    if (id === configPath) return persisted;
    return require(id);
  };
  fakeRequire.resolve = (id) => id;
  fakeRequire.cache = {};

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require: fakeRequire,
    __dirname: path.dirname(path.join(__dirname, "..", "Script", "commands", "0admin.js")),
    __filename: path.join(__dirname, "..", "Script", "commands", "0admin.js"),
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    global: {
      client: { configPath },
      config: { ADMINBOT: ["10001"], NDH: ["10001"] },
    },
  };
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "Script", "commands", "0admin.js"), "utf8"),
    sandbox,
    { filename: "0admin.js" }
  );

  const run = sandbox.module.exports.run;
  const api = { sendMessage(message) { sent.push(message); } };
  const event = { threadID: "1", messageID: "2", mentions: {} };
  const getText = (key) => key;

  await run({ api, event, args: ["on"], Users: {}, permssion: 3, getText });
  assert.equal(persisted.adminOnly.enable, true);
  assert.equal(sandbox.global.config.adminOnly.enable, true);

  await run({ api, event, args: ["off"], Users: {}, permssion: 3, getText });
  assert.equal(persisted.adminOnly.enable, false);
  assert.equal(sandbox.global.config.adminOnly.enable, false);
  assert.deepEqual(sent, ["adminOnlyEnabled", "adminOnlyDisabled"]);
});

test("webServer defaults to disabled with a null port and simple UI", () => {
  const config = normalizeConfig({}, { warn() {} });
  assert.equal(config.webServer.enable, false);
  assert.equal(config.webServer.port, null);
  assert.equal(config.webServer.ui, "simple");
});

test("webServer keeps an explicit enable flag and numeric port", () => {
  const config = normalizeConfig({
    webServer: { enable: true, port: "10000" },
  }, { warn() {} });
  assert.equal(config.webServer.enable, true);
  assert.equal(config.webServer.port, 10000);
  assert.equal(config.webServer.ui, "simple");
});

test("webServer.ui supports dashboard and rejects unknown values", () => {
  const dashboard = normalizeConfig({
    webServer: { enable: true, port: 10000, ui: "Dashboard" },
  }, { warn() {} });
  assert.equal(dashboard.webServer.ui, "dashboard");

  const unknown = normalizeConfig({
    webServer: { enable: true, port: 10000, ui: "fancy" },
  }, { warn() {} });
  assert.equal(unknown.webServer.ui, "simple");
});

test("prefix behaviour defaults are safe", () => {
  const config = normalizeConfig({}, { warn() {} });
  assert.equal(config.usePrefix.enable, true);
  assert.equal(config.respondToAllPrefixes, false);
  assert.equal(config.commandNotFoundBehavior, "reply");
});

test("commandNotFoundBehavior only accepts silent or reply", () => {
  assert.equal(normalizeConfig({ commandNotFoundBehavior: "SILENT" }, { warn() {} }).commandNotFoundBehavior, "silent");
  assert.equal(normalizeConfig({ commandNotFoundBehavior: "reply" }, { warn() {} }).commandNotFoundBehavior, "reply");
  assert.equal(normalizeConfig({ commandNotFoundBehavior: "banana" }, { warn() {} }).commandNotFoundBehavior, "reply");
});

test("respondToAllPrefixes is only enabled by an explicit true", () => {
  assert.equal(normalizeConfig({ respondToAllPrefixes: true }, { warn() {} }).respondToAllPrefixes, true);
  assert.equal(normalizeConfig({ respondToAllPrefixes: "true" }, { warn() {} }).respondToAllPrefixes, false);
});
