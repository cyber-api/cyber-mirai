"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const fm = require("../utils/fileManager.js");

test("normalizeRelative accepts normal project paths", () => {
  assert.equal(fm.normalizeRelative("Script/commands/help.js"), "Script/commands/help.js");
  assert.equal(fm.normalizeRelative("./config.json"), "config.json");
  assert.equal(fm.normalizeRelative("assets\\image.png"), "assets/image.png");
});

test("normalizeRelative rejects traversal and absolute paths", () => {
  for (const value of ["../etc/passwd", "..\\Windows\\win.ini", "/etc/passwd", "C:\\secret", "%2e%2e%2fetc", "Script/%252e%252e/x", "a\u0000b"]) {
    assert.equal(fm.normalizeRelative(value), null, value);
  }
});

test("blockedReason blocks every documented path", () => {
  assert.equal(fm.blockedReason(".git/config"), "blocked_directory");
  assert.equal(fm.blockedReason("node_modules/axios/package.json"), "blocked_directory");
  assert.equal(fm.blockedReason(".env"), "blocked_env");
  assert.equal(fm.blockedReason(".env.local"), "blocked_env");
  assert.equal(fm.blockedReason("data.sqlite"), "blocked_database");
  assert.equal(fm.blockedReason("appstate2.json"), "blocked_appstate");
  assert.equal(fm.blockedReason("account.txt"), "blocked_account_file");
  assert.equal(fm.blockedReason("Script/commands/help.js"), null);
});

test("listRoots exposes the allow-list and no account.txt", () => {
  const roots = fm.listRoots();
  const paths = roots.roots.map((entry) => entry.path);
  for (const expected of ["Script", "assets", "languages", "includes", "utils", "public"]) {
    assert.ok(paths.includes(expected), expected);
  }
  for (const expected of ["config.json", "config.json.example", "admin.json", "admin.json.example", "package.json", "README.md"]) {
    assert.ok(paths.includes(expected), expected);
  }
  assert.ok(!paths.includes("account.txt"));
});

test("listDirectory lists Script/commands without blocked files", () => {
  const result = fm.listDirectory("Script/commands");
  assert.equal(result.ok, true);
  assert.ok(result.files.includes("help.js"));
  assert.ok(result.entries.some((entry) => entry.path === "Script/commands/help.js"));
});

test("readTextFile reads package.json and help.js", () => {
  const pkg = fm.readTextFile("package.json");
  assert.equal(pkg.ok, true);
  assert.match(pkg.content, /"name": "islamick-bot"/);

  const help = fm.readTextFile("Script/commands/help.js");
  assert.equal(help.ok, true);
  assert.match(help.content, /module\.exports\.run/);
});

test("readTextFile blocks traversal, node_modules, appstate and account.txt", () => {
  for (const target of ["../etc/passwd", "node_modules/axios/package.json", "appstate.json", "account.txt", "data.sqlite", ".env"]) {
    const result = fm.readTextFile(target);
    assert.equal(result.ok, false, target);
  }
});

test("writeTextFile requires confirmation for config.json", () => {
  const result = fm.writeTextFile("config.json", "{}", {});
  assert.equal(result.ok, false);
  assert.equal(result.code, "confirmation_required");
});

test("writeTextFile rejects traversal before touching the disk", () => {
  const result = fm.writeTextFile("../outside.js", "x", { confirm: true });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("writeTextFile createOnly refuses to overwrite an existing file", () => {
  const result = fm.writeTextFile("package.json", "{}", { confirm: true, createOnly: true });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.code, "file_exists");
});

test("deleteFile refuses root configuration files", () => {
  const result = fm.deleteFile("package.json");
  assert.equal(result.ok, false);
  assert.equal(result.code, "protected_file");
});

test("handleApi returns {ok, content} for a read", async () => {
  const result = await fm.handleApi({
    method: "GET",
    pathname: "/api/file",
    query: new URLSearchParams({ path: "package.json" }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.success, true);
  assert.match(result.payload.content, /"name": "islamick-bot"/);
});

test("handleApi returns {ok, files} for a directory listing", async () => {
  const result = await fm.handleApi({
    method: "GET",
    pathname: "/api/files",
    query: new URLSearchParams({ dir: "Script/commands" }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.ok(result.payload.files.includes("help.js"));
});

test("handleApi logs a sanitized failure without the file content", async () => {
  const lines = [];
  const result = await fm.handleApi({
    method: "GET",
    pathname: "/api/file",
    query: new URLSearchParams({ path: "../etc/passwd" }),
    logger: (message) => lines.push(message),
  });
  assert.equal(result.status, 400);
  assert.equal(result.payload.ok, false);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[FILES\] GET/);
  assert.doesNotMatch(lines[0], /root:/);
});

test("handleApi is not confused by encoded traversal", async () => {
  const result = await fm.handleApi({
    method: "GET",
    pathname: "/api/file",
    query: new URLSearchParams({ path: "%2e%2e%2fetc%2fpasswd" }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.payload.ok, false);
});
