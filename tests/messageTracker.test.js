"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const tracker = require("../utils/messageTracker.js");

test("tracks the message IDs the bot sends (callback form)", () => {
  tracker.reset();
  const api = {
    sendMessage(message, threadID, callback) {
      callback(null, { messageID: "msg-1", threadID });
    },
  };

  assert.equal(tracker.install(api), true);
  api.sendMessage("hello", "thread-1");

  assert.equal(tracker.isBotMessage("msg-1"), true);
  assert.equal(tracker.isBotMessage("not-ours"), false);
});

test("keeps a string reply-to message ID in the FCA position", () => {
  tracker.reset();
  let captured = null;
  const api = {
    sendMessage(message, threadID, callback, replyToMessage) {
      captured = { callback, replyToMessage };
      callback(null, { messageID: "msg-2", threadID });
    },
  };

  tracker.install(api);
  api.sendMessage("hello", "thread-1", "reply-id");

  assert.equal(captured.replyToMessage, "reply-id");
  assert.equal(tracker.isBotMessage("msg-2"), true);
});

test("does not track failed sends", () => {
  tracker.reset();
  const api = {
    sendMessage(message, threadID, callback) {
      callback(new Error("nope"), null);
    },
  };

  tracker.install(api);
  api.sendMessage("hello", "thread-1");
  assert.equal(tracker.size(), 0);
});
