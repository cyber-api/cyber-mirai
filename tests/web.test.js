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

async function callHandler(handler, url, method, body) {
  const req = { url, method: method || "GET", headers: {}, body };
  const res = fakeResponse();
  await handler(req, res);
  return res;
}

function makeHandler(options) {
  return createHandler({
    publicDir: PUBLIC_DIR,
    pkg: PKG,
    config: { nickNameBot: "Cyber Bot" },
    startedAt: Date.now() - 5000,
    uiMode: (options && options.uiMode) || "simple",
    enableFileApi: Boolean(options && options.enableFileApi),
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

test("/ serves HTML (not JSON) in simple mode", async () => {
  const res = await callHandler(makeHandler(), "/");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Content-Type"], /text\/html/);
  assert.match(res.body, /Cyber Bot/);
  assert.match(res.body, new RegExp(PKG.version.replace(/\./g, "\\.")));
  assert.doesNotMatch(res.body, /\{\{BOT_NAME\}\}/);
  assert.doesNotMatch(res.body, /\{\{VERSION\}\}/);
});

test("/health and /api/health return the same JSON payload", async () => {
  const handler = makeHandler();
  for (const route of ["/health", "/api/health"]) {
    const res = await callHandler(handler, route);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /application\/json/);
    const payload = JSON.parse(res.body);
    assert.equal(payload.status, "ok");
    assert.equal(payload.bot, "Cyber Bot");
    assert.equal(payload.version, PKG.version);
    assert.equal(typeof payload.uptime, "number");
    assert.equal(payload.online, true);
    assert.match(payload.started, /^\d{4}-\d{2}-\d{2}T/);
  }
});

test("/health query strings do not break routing", async () => {
  const res = await callHandler(makeHandler(), "/health?check=1");
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).status, "ok");
});

test("/api/status and /stats expose online + dashboard counters", async () => {
  const handler = makeHandler();
  for (const route of ["/api/status", "/stats"]) {
    const res = await callHandler(handler, route);
    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.body);
    assert.equal(payload.status, "ok");
    assert.equal(payload.online, true);
    assert.match(payload.uptime, /^\d+h \d+m \d+s$/);
    assert.equal(typeof payload.uptimeSeconds, "number");
    assert.ok(payload.memory && typeof payload.memory.heapUsed === "number");
  }
});

test("dashboard mode redirects / to /dashboard", async () => {
  const res = await callHandler(makeHandler({ uiMode: "dashboard" }), "/");
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/dashboard");
});

test("/dashboard serves public/dashboard.html when present", async () => {
  const res = await callHandler(makeHandler(), "/dashboard");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Content-Type"], /text\/html/);
  assert.ok(res.body.length > 0);
});

test("/dashboard falls back to / when no dashboard.html exists", async () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-web-"));
  try {
    const handler = createHandler({
      publicDir: emptyDir,
      pkg: PKG,
      config: {},
      uiMode: "simple",
    });
    const res = await callHandler(handler, "/dashboard");
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/");
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("unknown routes are JSON 404, and traversal stays inside public/", async () => {
  const handler = makeHandler();
  for (const route of ["/nope", "/../Cyber.js", "/..%2fCyber.js"]) {
    const res = await callHandler(handler, route);
    assert.equal(res.statusCode, 404, route);
    assert.match(res.headers["Content-Type"], /application\/json/);
    assert.equal(JSON.parse(res.body).status, "not_found");
  }
});

test("non-GET methods are rejected with JSON 405 on static routes", async () => {
  const res = await callHandler(makeHandler(), "/health", "POST");
  assert.equal(res.statusCode, 405);
  assert.equal(JSON.parse(res.body).status, "method_not_allowed");
});

// ---------------------------------------------------------------------------
// File manager (Problem 6). The same handler is mounted by Ullash.js.
// ---------------------------------------------------------------------------
test("GET /api/files returns the allowed roots and never account.txt", async () => {
  const handler = makeHandler({ enableFileApi: true });
  const res = await callHandler(handler, "/api/files");
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.success, true);
  const paths = payload.roots.map((entry) => entry.path);
  for (const expected of ["Script", "assets", "languages", "includes", "utils", "public", "config.json", "admin.json", "package.json", "README.md"]) {
    assert.ok(paths.includes(expected), `${expected} must be listed`);
  }
  assert.ok(!paths.includes("account.txt"));
  assert.ok(!paths.includes("appstate.json"));
});

test("GET /api/file?path=package.json returns its content", async () => {
  const handler = makeHandler({ enableFileApi: true });
  const res = await callHandler(handler, "/api/file?path=package.json");
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.success, true);
  assert.match(payload.content, /"name": "islamick-bot"/);
});

test("GET /api/file?path=Script/commands/help.js returns its content", async () => {
  const handler = makeHandler({ enableFileApi: true });
  const res = await callHandler(handler, "/api/file?path=Script/commands/help.js");
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.match(payload.content, /module\.exports\.run/);
});

test("traversal and blocked paths are rejected", async () => {
  const handler = makeHandler({ enableFileApi: true });
  const cases = [
    ["/api/file?path=../etc/passwd", 400],
    ["/api/file?path=%2e%2e%2fetc%2fpasswd", 400],
    ["/api/file?path=node_modules/axios/package.json", 403],
    ["/api/file?path=.env", 403],
    ["/api/file?path=appstate.json", 403],
    ["/api/file?path=data.sqlite", 403],
    ["/api/file?path=account.txt", 403],
    ["/api/file?path=../../Cyber.js", 400],
  ];
  for (const [route, status] of cases) {
    const res = await callHandler(handler, route);
    assert.equal(res.statusCode, status, route);
    const payload = JSON.parse(res.body);
    assert.equal(payload.ok, false, route);
    assert.equal(payload.success, false, route);
  }
});

test("writing config.json requires confirmation", async () => {
  const handler = makeHandler({ enableFileApi: true });
  const res = await callHandler(handler, "/api/file?path=config.json", "POST", { content: "{}" });
  assert.equal(res.statusCode, 409);
  const payload = JSON.parse(res.body);
  assert.equal(payload.code, "confirmation_required");
});

test("GET /api/files?dir=Script/commands lists help.js", async () => {
  const handler = makeHandler({ enableFileApi: true });
  const res = await callHandler(handler, "/api/files?dir=Script%2Fcommands");
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.ok(payload.files.includes("help.js"));
  assert.ok(payload.entries.some((entry) => entry.path === "Script/commands/help.js"));
});

test("legacy /api/scripts/commands still returns a file list", async () => {
  const handler = makeHandler({ enableFileApi: true });
  const res = await callHandler(handler, "/api/scripts/commands");
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.success, true);
  assert.ok(payload.files.includes("help.js"));
});
