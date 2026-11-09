"use strict";

/**
 * Render / Web Service endpoint for the bot.
 *
 * A Facebook Messenger bot has no HTTP server of its own, so Render's Web
 * Service scanner never finds a port. This module binds one only when Render
 * provides `PORT` or the operator explicitly enables `config.webServer`.
 *
 * Routing contract (Problem 8):
 *   GET /              -> HTML (public/index.html) when ui = "simple"
 *                      -> 302 /dashboard when ui = "dashboard"
 *   GET /health        -> JSON health payload (Render health check)
 *   GET /api/health    -> JSON health payload
 *   GET /dashboard     -> public/dashboard.html when present, else 302 /
 *   GET /<static>      -> safe file from public/
 *
 * Extracted from Cyber.js so the routing can be unit-tested without booting
 * the whole bot.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

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

function healthPayload({ pkg, config, startedAt }) {
  const uptime = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return {
    status: "ok",
    bot: (config && config.nickNameBot) || (pkg && pkg.name) || "cyber-mirai",
    version: (pkg && pkg.version) || "0.0.0",
    uptime,
    timestamp: new Date().toISOString(),
  };
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

/** Build the request handler. Exported so tests can call it directly. */
function createHandler(options) {
  const {
    publicDir,
    pkg,
    config,
    startedAt = Date.now(),
    uiMode = "simple",
  } = options;

  return function handleRequest(req, res) {
    const pathname = String(req.url || "").split("?")[0];

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { status: "method_not_allowed" });
      return;
    }

    // Render uses these for health checks — always JSON.
    if (pathname === "/health" || pathname === "/api/health") {
      sendJson(res, 200, healthPayload({ pkg, config, startedAt }));
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
  });

  const server = http.createServer(handler);
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
  createHandler,
  startWebServer,
};
