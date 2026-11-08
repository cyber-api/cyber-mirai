"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { normalizeConfig } = require("../utils/config.js");
const adminAuth = require("../utils/adminAuth.js");
const { resolveUrl, MIGRATION_PATH } = require("../utils/imageResolver.js");

test("a placeholder uppercase list never hides a valid camelCase list", () => {
  const config = normalizeConfig({
    ADMINBOT: ["YOUR_ADMIN_UID"],
    adminBot: ["100000409853576"],
    NDH: ["YOUR_OWNER_UID"],
    ndh: ["100000409853576"],
  }, { warn() {}, env: {} });

  assert.deepEqual(Array.from(config.ADMINBOT), ["100000409853576"]);
  assert.deepEqual(Array.from(config.NDH), ["100000409853576"]);
  assert.equal(config.adminBot, config.ADMINBOT);
  assert.equal(config.ndh, config.NDH);
  assert.equal(adminAuth.isAdmin("100000409853576", config), true);
  assert.equal(adminAuth.isOwner("100000409853576", config), true);
  assert.equal(adminAuth.isAdmin("999999999", config), false);
});

test("adminBotIds and BOT_ADMIN_IDS are merged into the canonical list", () => {
  const config = normalizeConfig({
    adminBotIds: ["100000000000001"],
    NDH: [],
  }, { warn() {}, env: { BOT_ADMIN_IDS: "100000000000002, 100000000000003" } });

  assert.deepEqual(Array.from(config.ADMINBOT).sort(), [
    "100000000000001",
    "100000000000002",
    "100000000000003",
  ]);
  assert.equal(adminAuth.isAdmin("100000000000002", config), true);
});

test("admin counts use the merged, de-duplicated list", () => {
  const config = normalizeConfig({
    ADMINBOT: ["100000000000001", "100000000000009"],
    adminBot: ["100000000000001"],
    ndh: ["100000000000009"],
  }, { warn() {}, env: {} });

  assert.deepEqual(adminAuth.getAdminCounts(config), {
    adminBot: 2,
    ndh: 1,
    total: 2,
  });
});

test("antiReact keeps the minimal example shape and fills safe defaults", () => {
  const config = normalizeConfig({
    antiReact: { enable: true, onlyAdminBot: false, removeBotMessage: true },
  }, { warn() {}, env: {} });

  assert.equal(config.antiReact.enable, true);
  assert.equal(config.antiReact.onlyAdminBot, false);
  assert.equal(config.antiReact.removeBotMessage, true);
  assert.deepEqual(config.antiReact.reactByUnsend.emojis, ["👍"]);
  assert.equal(config.antiReact.reactByRemove.enable, false);
});

test("antiReact defaults to disabled when the key is absent", () => {
  const config = normalizeConfig({}, { warn() {}, env: {} });
  assert.equal(config.antiReact.enable, false);
});

test("every onLoad Imgur asset is either migrated or explicitly pending", () => {
  // These were extracted from the obfuscated onLoad handlers (bf, crush, kiss,
  // date2, married). None of them may fall through to a live Imgur fetch.
  const onLoadUrls = [
    "https://i.imgur.com/iaOiAXe.jpeg",
    "https://i.imgur.com/PlVBaM1.jpg",
    "https://i.imgur.com/j96ooUs.jpeg",
    "https://i.imgur.com/ha8gxu5.jpg",
    "https://i.imgur.com/txnRTKf.png",
  ];

  for (const url of onLoadUrls) {
    try {
      const resolved = resolveUrl(url);
      assert.match(resolved.url, /^https:\/\//);
    } catch (error) {
      assert.equal(error.code, "IMAGE_MIGRATION_PENDING", url);
    }
  }
});

test("image resolver rewrites migrated URLs and rejects pending ones", () => {
  const data = JSON.parse(fs.readFileSync(MIGRATION_PATH, "utf8"));
  const migrated = data.entries.find((entry) => entry.status === "migrated");
  const pending = data.entries.find((entry) => entry.status !== "migrated");

  assert.ok(migrated, "expected at least one migrated entry");
  assert.ok(pending, "expected at least one pending entry");

  assert.equal(resolveUrl(migrated.old).url, migrated.newUrl);

  assert.throws(
    () => resolveUrl(pending.old),
    (error) => error.code === "IMAGE_MIGRATION_PENDING"
  );

  // Non-Imgur URLs pass through untouched.
  const untouched = "https://files.catbox.moe/example.jpg";
  assert.equal(resolveUrl(untouched).url, untouched);
});
