"use strict";

/**
 * Render / Web Service endpoint for the bot.
 *
 * A Facebook Messenger bot has no HTTP server of its own, so Render's Web
 * Service scanner never finds a port. This module binds one only when Render
 * provides `PORT` or the operator explicitly enables `config.webServer`.
 *
 * Routing contract (Problems 5 and 8):
 *   GET /              -> HTML (public/index.html) when ui = "simple"
 *                      -> 302 /dashboard when ui = "dashboard"
 *   GET /health        -> JSON health payload (Render health check)
 *   GET /api/health    -> JSON health payload
 *   GET /api/status    -> health payload + process stats
 *   GET /stats         -> dashboard stats (uptime, memory, totals)
 *   GET /dashboard     -> public/dashboard.html when present, else 302 /
 *   GET /<static>      -> safe file from public/
 *
 * The dashboard's file-manager routes live in utils/fileManager.js and are
 * only mounted here when `enableFileApi` is true. On Render the authenticated
 * Express dashboard (Ullash.js) owns PORT and mounts the same handler, so the
 * page and its API always share one origin.
 *
 * Extracted from Cyber.js so the routing can be unit-tested without booting
 * the whole bot.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const fileManager = require("./fileManager.js");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Decide whether the server should start and with which settings.
 * Returns null when disabled.
 */
function resolveWebSettings(config, env) {
  const webConfig = (config && config.webServer) || {};
  const environment = env || {};
  const envPort = Number(environment.PORT);
  const configuredPort = Number(webConfig.port);

  if (environment.PORT === undefined && webConfig.enable !== true) return null;

  const port = configuredPort > 0
    ? configuredPort
    : (Number.isInteger(envPort) && envPort > 0 ? envPort : 10000);

  const uiMode = String(webConfig.ui || "simple").toLowerCase() === "dashboard"
    ? "dashboard"
    : "simple";

  return { port, host: "0.0.0.0", uiMode };
}

/**
 * The single health payload used by /health and /api/health.
 *
 * `started` is an ISO timestamp (not a number) and `online` is always true
 * while the process is answering requests. The dashboard accepts either
 * `status === "ok"` or `online === true`, so both are present.
 */
function healthPayload({ pkg, config, startedAt }) {
  const start = Number(startedAt) || Date.now();
  const uptime = Math.max(0, Math.floor((Date.now() - start) / 1000));
  return {
    status: "ok",
    bot: (config && config.nickNameBot) || (pkg && pkg.name) || "cyber-mirai",
    version: (pkg && pkg.version) || "0.0.0",
    uptime,
    started: new Date(start).toISOString(),
    online: true,
    timestamp: new Date().toISOString(),
  };
}

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}

function readRuntimeStats() {
  const data = (typeof global !== "undefined" && global.data) || {};
  const threadIds = data.allThreadID;
  const userIds = data.allUserID;
  const memoryUsage = process.memoryUsage();
  return {
    totalThread: Array.isArray(threadIds) ? threadIds.length : "N/A",
    totalUser: Array.isArray(userIds) ? userIds.length : "N/A",
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
    },
  };
}

function statsPayload({ pkg, config, startedAt }) {
  const health = healthPayload({ pkg, config, startedAt });
  const stats = readRuntimeStats();
  return Object.assign({}, health, {
    uptime: formatUptime(health.uptime),
    uptimeSeconds: health.uptime,
    totalThread: stats.totalThread,
    totalUser: stats.totalUser,
    memory: stats.memory,
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath, statusCode) {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(statusCode || 200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300",
    });
    res.end(data);
    return true;
  } catch (error) {
    return false;
  }
}

function renderLanding({ publicDir, pkg, config, startedAt }) {
  const templatePath = path.join(publicDir, "index.html");
  let html;
  try {
    html = fs.readFileSync(templatePath, "utf8");
  } catch (error) {
    // Minimal fallback so `/` is always HTML, never JSON.
    html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>{{BOT_NAME}}</title></head>"
      + "<body style=\"font-family:system-ui;background:#070b14;color:#e8eefc;padding:40px\">"
      + "<h1>{{BOT_NAME}}</h1><p>Version {{VERSION}} • Uptime {{UPTIME}}</p>"
      + "<p><a style=\"color:#42c2ff\" href=\"/health\">Health JSON</a></p></body></html>";
  }
  const payload = healthPayload({ pkg, config, startedAt });
  return html
    .replace(/\{\{BOT_NAME\}\}/g, String(payload.bot))
    .replace(/\{\{VERSION\}\}/g, String(payload.version))
    .replace(/\{\{UPTIME_SECONDS\}\}/g, String(payload.uptime))
    .replace(/\{\{UPTIME\}\}/g, String(payload.uptime) + "s");
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    if (!req || typeof req.on !== "function") {
      resolve({});
      return;
    }
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve({ error: "too_large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        resolve({ error: "invalid_json" });
      }
    });
    req.on("error", () => resolve({ error: "read_error" }));
  });
}

/** Build the request handler. Exported so tests can call it directly. */
function createHandler(options) {
  const {
    publicDir,
    pkg,
    config,
    startedAt = Date.now(),
    uiMode = "simple",
    enableFileApi = false,
    logger = null,
  } = options;

  return async function handleRequest(req, res) {
    let url;
    try {
      url = new URL(String(req.url || "/"), "http://localhost");
    } catch (error) {
      sendJson(res, 400, { status: "bad_request" });
      return;
    }
    const pathname = url.pathname;
    const method = String(req.method || "GET").toUpperCase();

    // Render uses these for health checks — always JSON and always public.
    if (pathname === "/health" || pathname === "/api/health") {
      if (method !== "GET" && method !== "HEAD") {
        sendJson(res, 405, { status: "method_not_allowed" });
        return;
      }
      sendJson(res, 200, healthPayload({ pkg, config, startedAt }));
      return;
    }

    if (pathname === "/api/status" || pathname === "/stats") {
      if (method !== "GET" && method !== "HEAD") {
        sendJson(res, 405, { status: "method_not_allowed" });
        return;
      }
      sendJson(res, 200, statsPayload({ pkg, config, startedAt }));
      return;
    }

    // Read-only FCA info is safe without the file-manager flag.
    if (pathname === "/api/get-fca-type") {
      if (method !== "GET" && method !== "HEAD") {
        sendJson(res, 405, { status: "method_not_allowed" });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        success: true,
        fcaType: (config && (config.FCA || config.fca)) || "cyber-bot-fca",
      });
      return;
    }

    // Dashboard file manager. Mounted by the authenticated Ullash dashboard on
    // Render; optional here for tests / direct Cyber.js deployments.
    if (enableFileApi && (pathname === "/api/files" || pathname.startsWith("/api/file") || pathname.startsWith("/api/scripts"))) {
      let body = {};
      if (method === "POST" || method === "PUT" || method === "DELETE") {
        if (req.body && typeof req.body === "object") {
          body = req.body;
        } else {
          body = await readJsonBody(req);
        }
        if (body && body.error === "invalid_json") {
          sendJson(res, 400, { ok: false, success: false, code: "invalid_json", message: "Request body must be JSON" });
          return;
        }
        if (body && body.error) {
          sendJson(res, 413, { ok: false, success: false, code: body.error, message: "Request body is too large" });
          return;
        }
      }
      const result = await fileManager.handleApi({
        method,
        pathname,
        query: url.searchParams,
        body,
        headers: req.headers,
        config,
        logger,
      });
      if (result) {
        sendJson(res, result.status, result.payload);
        return;
      }
    }

    if (method !== "GET" && method !== "HEAD") {
      sendJson(res, 405, { status: "method_not_allowed" });
      return;
    }

    if (pathname === "/") {
      if (uiMode === "dashboard") {
        res.writeHead(302, { Location: "/dashboard" });
        res.end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(renderLanding({ publicDir, pkg, config, startedAt }));
      return;
    }

    if (pathname === "/index.html") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(renderLanding({ publicDir, pkg, config, startedAt }));
      return;
    }

    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      if (serveFile(res, path.join(publicDir, "dashboard.html"))) return;
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }

    // Static assets used by the landing page / dashboard.
    const relative = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
    const candidate = path.join(publicDir, relative);
    if (candidate.startsWith(publicDir + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      if (serveFile(res, candidate)) return;
    }

    sendJson(res, 404, { status: "not_found" });
  };
}

/**
 * Start the HTTP server. Returns the server instance, or null when disabled.
 */
function startWebServer(options) {
  const settings = resolveWebSettings(options.config, options.env);
  if (!settings) return null;

  const startedAt = options.startedAt || Date.now();
  const handler = createHandler({
    publicDir: options.publicDir,
    pkg: options.pkg,
    config: options.config,
    startedAt,
    uiMode: settings.uiMode,
    enableFileApi: options.enableFileApi === true,
    logger: options.logger && typeof options.logger.loader === "function"
      ? (message, level) => options.logger.loader(message, level || "warn")
      : null,
  });

  const server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      if (options.logger && typeof options.logger.loader === "function") {
        options.logger.loader(`[WEB] request failed: ${error && error.message ? error.message : error}`, "error");
      }
      try {
        sendJson(res, 500, { status: "error" });
      } catch (writeError) {
        // The response may already be closed.
      }
    });
  });
  server.on("error", (error) => {
    if (options.logger && typeof options.logger.loader === "function") {
      options.logger.loader(`[WEB] health server failed: ${error.message}`, "warn");
    }
  });
  server.listen(settings.port, settings.host, () => {
    if (options.logger && typeof options.logger.loader === "function") {
      options.logger.loader(`[WEB] Listening on ${settings.host}:${settings.port}`, "info");
    }
  });
  if (typeof server.unref === "function") server.unref();
  return server;
}

module.exports = {
  MIME_TYPES,
  resolveWebSettings,
  healthPayload,
  statsPayload,
  formatUptime,
  createHandler,
  startWebServer,
};
