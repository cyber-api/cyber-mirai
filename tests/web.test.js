"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  resolveWebSettings,
  createHandler,
} = require("../utils/webServer.js");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const PKG = require("../package.json");

function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers || {};
    },
    end(chunk) {
      if (chunk !== undefined) this.body += String(chunk);
    },
  };
}

function callHandler(handler, url, method) {
  const req = { url, method: method || "GET" };
  const res = fakeResponse();
  handler(req, res);
  return res;
}

function makeHandler(options) {
  return createHandler({
    publicDir: PUBLIC_DIR,
    pkg: PKG,
    config: { nickNameBot: "Cyber Bot" },
    startedAt: Date.now() - 5000,
    uiMode: (options && options.uiMode) || "simple",
  });
}

test("web server is disabled without PORT or webServer.enable", () => {
  assert.equal(resolveWebSettings({ webServer: { enable: false } }, {}), null);
  assert.equal(resolveWebSettings({}, {}), null);
});

test("PORT alone enables the server", () => {
  const settings = resolveWebSettings({}, { PORT: "8080" });
  assert.deepEqual(settings, { port: 8080, host: "0.0.0.0", uiMode: "simple" });
});

test("an explicit webServer.port wins over PORT", () => {
  const settings = resolveWebSettings(
    { webServer: { enable: true, port: 10000 } },
    { PORT: "8080" }
  );
  assert.equal(settings.port, 10000);
});

test("webServer.ui selects simple or dashboard", () => {
  assert.equal(resolveWebSettings({ webServer: { enable: true, ui: "dashboard" } }, {}).uiMode, "dashboard");
  assert.equal(resolveWebSettings({ webServer: { enable: true, ui: "SIMPLE" } }, {}).uiMode, "simple");
  assert.equal(resolveWebSettings({ webServer: { enable: true, ui: "unknown" } }, {}).uiMode, "simple");
});

test("public/index.html exists and uses the documented placeholders", () => {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  assert.match(html, /\{\{BOT_NAME\}\}/);
  assert.match(html, /\{\{VERSION\}\}/);
  assert.match(html, /\{\{UPTIME\}\}/);
  assert.match(html, /<!DOCTYPE html>/i);
});

test("/ serves HTML (not JSON) in simple mode", () => {
  const res = callHandler(makeHandler(), "/");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Content-Type"], /text\/html/);
  assert.match(res.body, /Cyber Bot/);
  assert.match(res.body, new RegExp(PKG.version.replace(/\./g, "\\.")));
  assert.doesNotMatch(res.body, /\{\{BOT_NAME\}\}/);
  assert.doesNotMatch(res.body, /\{\{VERSION\}\}/);
});

test("/health and /api/health return the same JSON payload", () => {
  const handler = makeHandler();
  for (const route of ["/health", "/api/health"]) {
    const res = callHandler(handler, route);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /application\/json/);
    const payload = JSON.parse(res.body);
    assert.equal(payload.status, "ok");
    assert.equal(payload.bot, "Cyber Bot");
    assert.equal(payload.version, PKG.version);
    assert.equal(typeof payload.uptime, "number");
  }
});

test("/health query strings do not break routing", () => {
  const res = callHandler(makeHandler(), "/health?check=1");
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
});

test("dashboard mode redirects / to /dashboard", () => {
  const res = callHandler(makeHandler({ uiMode: "dashboard" }), "/");
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/dashboard");
});

test("/dashboard serves public/dashboard.html when present", () => {
  const res = callHandler(makeHandler(), "/dashboard");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Content-Type"], /text\/html/);
  assert.ok(res.body.length > 0);
});

test("/dashboard falls back to / when no dashboard.html exists", () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-web-"));
  try {
    const handler = createHandler({
      publicDir: emptyDir,
      pkg: PKG,
      config: {},
      uiMode: "simple",
    });
    const res = callHandler(handler, "/dashboard");
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/");
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("unknown routes are JSON 404, and traversal stays inside public/", () => {
  const handler = makeHandler();
  for (const route of ["/nope", "/../Cyber.js", "/..%2fCyber.js"]) {
    const res = callHandler(handler, route);
    assert.equal(res.statusCode, 404, route);
    assert.match(res.headers["Content-Type"], /application\/json/);
    assert.equal(JSON.parse(res.body).status, "not_found");
  }
});

test("non-GET methods are rejected with JSON 405", () => {
  const res = callHandler(makeHandler(), "/health", "POST");
  assert.equal(res.statusCode, 405);
  assert.equal(JSON.parse(res.body).status, "method_not_allowed");
});
