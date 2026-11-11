const crypto = require("crypto");
const { spawn } = require("child_process");
const logger = require("./utils/log");
const express = require("express");
const session = require("express-session");
const path = require("path");
const { secretsMatch, sameOriginAllowed } = require("./utils/dashboardSecurity.js");
const fileManager = require("./utils/fileManager.js");
const { healthPayload, statsPayload } = require("./utils/webServer.js");

// ==================== Load package.json & config.json ====================
let pkg = {};
try {
    pkg = require(path.join(__dirname, "package.json"));
} catch (err) {
    logger(`Failed to load package.json: ${err.message}`, "[ Error ]");
}
const BOT_NAME = pkg.name || "Islamick Bot";
const BOT_VERSION = pkg.version || "5.0.0";
const BOT_DESC = pkg.description || "Islamick Chat Bot";

let config = {};
try {
    config = require(path.join(__dirname, "config.json"));
} catch (err) {
    logger(`Failed to load config.json: ${err.message}`, "[ Error ]");
}

// ==================== Dashboard configuration ====================
const dashConfig = (config && config.dashBoard) || {};
// Render provides PORT. When it is present the dashboard must own that port;
// otherwise Render routes to Cyber.js's tiny health server, which does not
// implement /stats or /api/file and the dashboard looks "offline" with a file
// manager that fails for every file.
const RENDER_PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : null;
const DASHBOARD_ENABLED = dashConfig.enable === true;
const DASHBOARD_PORT = RENDER_PORT || (Number(dashConfig.port) > 0 ? Number(dashConfig.port) : 3000);
const DASHBOARD_HOST = process.env.DASHBOARD_HOST
    || (RENDER_PORT ? "0.0.0.0" : (dashConfig.host || "127.0.0.1"));
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD
    || dashConfig.password
    || (dashConfig.passwordProtection && dashConfig.passwordProtection.password)
    || "";

// config.json is the source of truth. A random per-process secret is used only
// when the operator has not provided dashBoard.sessionSecret.
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET
    || dashConfig.sessionSecret
    || crypto.randomBytes(32).toString("hex");
const SECURE_COOKIE = process.env.DASHBOARD_SECURE_COOKIE === "true"
    || dashConfig.secureCookie === true
    || dashConfig.https === true;

const STARTED_AT = Date.now();
const MAX_BODY_SIZE = "512kb";

// ==================== Helpers ====================
function passwordMatches(candidate) {
    return secretsMatch(candidate, DASHBOARD_PASSWORD);
}

// ==================== Bot supervisor ====================
global.countRestart = global.countRestart || 0;
let botProcess = null;

function startBot(message) {
    if (message) logger(message, "[ Starting ]");

    botProcess = spawn(process.execPath, ["--trace-warnings", "--async-stack-traces", "Cyber.js"], {
        cwd: __dirname,
        stdio: "inherit",
    });

    botProcess.on("close", (codeExit) => {
        if (codeExit !== 0 && global.countRestart < 10) {
            global.countRestart += 1;
            logger(`Bot exited with code ${codeExit}. Restarting... (${global.countRestart}/10)`, "[ Restarting ]");
            startBot();
        } else if (global.countRestart >= 10) {
            logger(`Bot stopped after ${global.countRestart} restarts. Please start manually.`, "[ Stopped ]");
        } else {
            logger(`Bot stopped normally.`, "[ Stopped ]");
        }
    });

    botProcess.on("error", (error) => {
        logger(`An error occurred: ${JSON.stringify(error)}`, "[ Error ]");
    });
}

// ==================== Dashboard server ====================
function startDashboard() {
    if (!DASHBOARD_ENABLED) {
        logger("Dashboard disabled (config.dashBoard.enable !== true).", "[ Dashboard ]");
        return;
    }
    if (!DASHBOARD_PASSWORD) {
        logger("Dashboard not started: set dashBoard.password in config.json (or DASHBOARD_PASSWORD). Authentication is mandatory.", "[ Dashboard ]");
        return;
    }
    if (!process.env.DASHBOARD_SESSION_SECRET && !dashConfig.sessionSecret) {
        logger("dashBoard.sessionSecret is not set; using a random per-process secret (sessions reset on restart).", "[ Dashboard ]");
    }

    const app = express();
    app.disable("x-powered-by");
    if (dashConfig.trustProxy === true) app.set("trust proxy", 1);

    // Security headers for every response (including static assets). Assets are
    // self-hosted under /vendor, so the CSP does not need any third-party origin.
    const CONTENT_SECURITY_POLICY = [
        "default-src 'self'",
        // The pages use inline `onclick`/inline bootstrap handlers; keeping this
        // narrowly scoped still blocks remote script injection and eval.
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join("; ");

    app.use((req, res, next) => {
        res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        if (SECURE_COOKIE) {
            res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }
        next();
    });
    app.use(express.json({ limit: MAX_BODY_SIZE }));
    app.use(express.urlencoded({ extended: false, limit: MAX_BODY_SIZE }));

    const sessionMiddleware = session({
        name: "cyber.sid",
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "strict",
            secure: SECURE_COOKIE,
            maxAge: 12 * 60 * 60 * 1000,
        },
    });
    app.use(sessionMiddleware);

    // Login throttling (per IP, in memory).
    const loginAttempts = new Map();
    const WINDOW_MS = 15 * 60 * 1000;
    const MAX_ATTEMPTS = 5;
    function throttled(ip) {
        const now = Date.now();
        const entry = loginAttempts.get(ip);
        if (!entry || now - entry.firstAt > WINDOW_MS) {
            loginAttempts.set(ip, { count: 1, firstAt: now });
            return false;
        }
        entry.count += 1;
        return entry.count > MAX_ATTEMPTS;
    }
    function resetAttempts(ip) {
        loginAttempts.delete(ip);
    }

    // Same-origin check for state-changing requests.
    function sameOrigin(req, res, next) {
        if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
        if (sameOriginAllowed(req.method, req.headers.origin, req.headers.host)) return next();
        return res.status(403).json({ success: false, message: "Cross-origin request rejected" });
    }

    function requireAuth(req, res, next) {
        if (req.session && req.session.authenticated === true) return next();
        if (req.path.startsWith("/api/") || req.path === "/stats") {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        return res.redirect("/login");
    }

    app.use(sameOrigin);

    // --- public auth routes ---
    app.get("/login", (req, res) => {
        if (req.session && req.session.authenticated === true) return res.redirect("/dashboard");
        return res.sendFile(path.join(__dirname, "public", "login.html"));
    });

    app.post("/login", (req, res) => {
        const ip = req.ip || "unknown";
        if (throttled(ip)) {
            return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
        }
        if (!passwordMatches(req.body && req.body.password)) {
            return res.status(401).json({ success: false, message: "Invalid password" });
        }
        resetAttempts(ip);
        return req.session.regenerate((error) => {
            if (error) return res.status(500).json({ success: false, message: "Session error" });
            req.session.authenticated = true;
            req.session.save(() => res.json({ success: true }));
        });
    });

    app.post("/logout", requireAuth, (req, res) => {
        req.session.destroy(() => {
            res.clearCookie("cyber.sid");
            res.json({ success: true });
        });
    });

    // --- public health endpoints (Render health check) ---
    // These are intentionally unauthenticated: Render's health checker and the
    // dashboard's status poll both need them. They expose no secrets.
    app.get("/health", (req, res) => res.json(healthPayload({ pkg, config, startedAt: STARTED_AT })));
    app.get("/api/health", (req, res) => res.json(healthPayload({ pkg, config, startedAt: STARTED_AT })));
    app.get("/api/status", (req, res) => res.json(statsPayload({ pkg, config, startedAt: STARTED_AT })));

    // Public static assets (CSS/JS/login page). No secrets live here.
    app.use(express.static(path.join(__dirname, "public")));
    app.use(requireAuth);

    app.get("/", (req, res) => res.redirect("/dashboard"));
    app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

    app.get("/stats", (req, res) => {
        res.json(statsPayload({ pkg, config, startedAt: STARTED_AT }));
    });

    // --- file manager (one shared handler for every route) ---
    // The same rules are used by utils/webServer.js, so the dashboard cannot
    // drift from the health server's allow/block list.
    async function fileApi(req, res) {
        const result = await fileManager.handleApi({
            method: req.method,
            pathname: req.path,
            query: new URLSearchParams(req.query || {}),
            body: req.body || {},
            headers: req.headers,
            config,
            logger: (message, level) => logger(message, level === "warn" ? "[ Warning ]" : "[ Files ]")
        });
        if (!result) {
            return res.status(404).json({ ok: false, success: false, code: "not_found", message: "Not found" });
        }
        return res.status(result.status).json(result.payload);
    }

    app.get("/api/files", fileApi);
    app.all("/api/file", fileApi);
    app.all("/api/file/:filename", fileApi);
    app.all("/api/scripts/:type", fileApi);
    app.all("/api/scripts/:type/:filename", fileApi);
    app.get("/api/get-fca-type", fileApi);

    app.use((req, res) => {
        res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
    });

    // Tell the child Cyber.js process that this server owns the public port.
    // Without this flag both processes would try to bind PORT; the child's
    // health-only server would win and the dashboard would lose its API.
    process.env.CYBER_DASHBOARD_MANAGED = "1";

    const server = app.listen(DASHBOARD_PORT, DASHBOARD_HOST, () => {
        logger(`Dashboard listening on http://${DASHBOARD_HOST}:${DASHBOARD_PORT} (auth required).`, "[ Dashboard ]");
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            logger(`Port ${DASHBOARD_PORT} is already in use.`, "[ Warning ]");
        } else {
            logger(`Dashboard server error: ${err.message}`, "[ Error ]");
        }
    });

    return server;
}

// ==================== Log meta info ====================
logger(BOT_NAME, "[ NAME ]");
logger(`Version: ${BOT_VERSION}`, "[ VERSION ]");
logger(BOT_DESC, "[ DESCRIPTION ]");

// ==================== Start ====================
startDashboard();
startBot();
