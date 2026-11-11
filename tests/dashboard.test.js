"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

test("dashboard HTML has an explicit online/offline status badge", () => {
  const html = read("public", "dashboard.html");
  assert.match(html, /id="botStatus"/);
  assert.match(html, /id="uptime"/);
});

test("dashboard JS accepts both health shapes and polls /health every 10s", () => {
  const js = read("public", "js", "dashboard.js");
  assert.match(js, /fetch\('\/health'/);
  assert.match(js, /data\.status === 'ok'/);
  assert.match(js, /data\.online === true/);
  assert.match(js, /setInterval\(refreshHealth, 10000\)/);
  assert.match(js, /function setOnlineStatus/);
  assert.match(js, /botStatus/);
});

test("dashboard JS falls back to /health when /stats fails", () => {
  const js = read("public", "js", "dashboard.js");
  assert.match(js, /Statistics refresh failed; falling back to \/health/);
  assert.match(js, /await refreshHealth\(\)/);
});

test("dashboard/public never mentions account.txt", () => {
  for (const file of ["dashboard.html", path.join("js", "dashboard.js"), "index.html", "login.html"]) {
    const text = read("public", file);
    assert.doesNotMatch(text, /account\.txt/i, file);
  }
});

test("login fallback chain is appstate.json -> appstate2.json -> appstate3.json -> config credentials", () => {
  const flow = read("utils", "loginFlow.js");
  assert.match(flow, /const APPSTATE_FILES = \["appstate\.json", "appstate2\.json", "appstate3\.json"\]/);
  assert.match(flow, /type: "credentials"/);
  assert.doesNotMatch(flow, /account\.txt/i);

  const cyber = read("Cyber.js");
  assert.match(cyber, /appstate\.json\/appstate2\.json\/appstate3\.json\/config credentials/);
  assert.doesNotMatch(cyber, /account\.txt/i);
});

test("Ullash.js owns Render PORT and serves health + the shared file API", () => {
  const ullash = read("Ullash.js");
  assert.match(ullash, /const RENDER_PORT = Number\(process\.env\.PORT\)/);
  assert.match(ullash, /DASHBOARD_PORT = RENDER_PORT/);
  assert.match(ullash, /app\.get\("\/health"/);
  assert.match(ullash, /app\.get\("\/api\/health"/);
  assert.match(ullash, /app\.get\("\/api\/status"/);
  assert.match(ullash, /fileManager\.handleApi/);
  assert.match(ullash, /CYBER_DASHBOARD_MANAGED/);
});

test("Cyber.js does not bind a second server when Ullash owns PORT", () => {
  const cyber = read("Cyber.js");
  assert.match(cyber, /process\.env\.CYBER_DASHBOARD_MANAGED === "1"/);
  assert.match(cyber, /Dashboard and \/health are served by Ullash\.js on PORT/);
});

test("the shared file manager blocks account.txt and appstate files", () => {
  const source = read("utils", "fileManager.js");
  assert.match(source, /blocked_account_file/);
  assert.match(source, /blocked_appstate/);
  assert.match(source, /blocked_database/);
  assert.match(source, /blocked_env/);
});

test("the dashboard create flow refuses to overwrite an existing script", () => {
  const js = read("public", "js", "dashboard.js");
  assert.match(js, /createOnly: true/);
});
