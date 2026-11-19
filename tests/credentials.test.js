"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const credentials = require("../utils/credentials.js");

const COMMANDS_DIR = path.join(__dirname, "..", "Script", "commands");

test("the recovered public Facebook app token has the expected shape", () => {
  assert.match(credentials.DEFAULT_FB_APP_TOKEN, /^\d+\|[0-9a-f]{20,}$/);
});

test("getFbAppToken prefers an explicit config value", () => {
  const previous = global.config;
  global.config = { fbAccessToken: "configured-token" };
  try {
    assert.equal(credentials.getFbAppToken(), "configured-token");
  } finally {
    global.config = previous;
  }
});

test("getFbAppToken falls back to the recovered token when config is empty", () => {
  const previous = global.config;
  const previousEnv = process.env.FB_APP_TOKEN;
  delete process.env.FB_APP_TOKEN;
  global.config = { fbAccessToken: "", FB_APP_TOKEN: "" };
  try {
    assert.equal(credentials.getFbAppToken(), credentials.DEFAULT_FB_APP_TOKEN);
  } finally {
    global.config = previous;
    if (previousEnv !== undefined) process.env.FB_APP_TOKEN = previousEnv;
  }
});

test("every access_token consumer reads the restored credential helper", () => {
  const offenders = [];
  for (const file of fs.readdirSync(COMMANDS_DIR).filter((name) => name.endsWith(".js"))) {
    const full = path.join(COMMANDS_DIR, file);
    const source = fs.readFileSync(full, "utf8");
    for (const line of source.split(/\r?\n/)) {
      if (!line.includes("access_token=")) continue;
      if (line.includes("getFbAppToken")) continue;
      if (line.includes("${TOKEN}")) continue; // family.js derives TOKEN from the helper
      offenders.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("v5.1.0 removed the obsolete command files", () => {
  const removed = [
    "4k.js", "Work-beta.js", "allah.js", "approve.js", "artifay.js", "autoban.js",
    "automention.js", "autoreact.js", "autoseen.js", "bf.js", "birthday.js", "botinfo.js",
    "bro.js", "by.js", "choose.js", "crush.js", "date.js", "date2.js", "decode.js",
    "delmsg.js", "download.js", "fact.js", "fact2.js", "filter.js", "fire.js", "fish.js",
    "flop.js", "fyoutoo.js", "gitlink.js", "give.js", "giveaway.js", "hack.js", "hi.js",
    "hot.js", "hug.js", "inbox.js", "ip.js", "islamick.js", "kiss.js", "listbanbybot.js",
    "lyrics.js", "meno.js", "mlstalk.js", "moon.js", "mp3.js", "mycoins.js", "namaz-time.js",
    "nastik.js", "nhentai.js", "night.js", "penis.js", "petmonsters.js", "pooh.js",
    "prefix.js", "rainbow.js", "randomicon.js", "repository.js", "rules.js", "stalk.js",
    "steal.js", "stt.js", "tictactoe.js", "tile.js", "war.js", "wednesday.js", "x.js"
  ];
  const stillPresent = removed.filter((name) => fs.existsSync(path.join(COMMANDS_DIR, name)));
  assert.deepEqual(stillPresent, []);
});
