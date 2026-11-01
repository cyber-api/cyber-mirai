const crypto = require("crypto");
const { spawn } = require("child_process");
const logger = require("./utils/log");
const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs-extra");
const { secretsMatch, sameOriginAllowed, createPathGuards } = require("./utils/dashboardSecurity.js");

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
const DASHBOARD_ENABLED = dashConfig.enable === true;
const DASHBOARD_PORT = Number(dashConfig.port) > 0 ? Number(dashConfig.port) : 3000;
const DASHBOARD_HOST = process.env.DASHBOARD_HOST || dashConfig.host || "127.0.0.1";
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

const SCRIPT_ROOTS = {
    commands: path.join(__dirname, "Script", "commands"),
    events: path.join(__dirname, "Script", "events"),
};

// Exact allow-list for the small config editor in the dashboard.
const CONFIG_FILES = new Set(["config.json", "config.json.example", "package.json", "README.md"]);
const MAX_BODY_SIZE = "512kb";
const MAX_SCRIPT_BYTES = 512 * 1024;

// ==================== Helpers ====================
const { safeScriptPath, safeConfigPath } = createPathGuards({
    scriptRoots: SCRIPT_ROOTS,
    baseDir: __dirname,
    configFiles: Array.from(CONFIG_FILES),
});

function bodySizeOk(content) {
    return typeof content === "string" && Buffer.byteLength(content, "utf8") <= MAX_SCRIPT_BYTES;
}

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

    // Public static assets (CSS/JS/login page). No secrets live here.
    app.use(express.static(path.join(__dirname, "public")));
    app.use(requireAuth);

    app.get("/", (req, res) => res.redirect("/dashboard"));
    app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));

    app.get("/stats", (req, res) => {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        res.json({
            uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
            totalThread: "N/A",
            totalUser: "N/A",
            memory: {
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
            },
        });
    });

    // --- script management (contained) ---
    app.get("/api/scripts/:type", async (req, res) => {
        const type = req.params.type;
        if (type !== "commands" && type !== "events") {
            return res.status(400).json({ success: false, message: "Invalid script type" });
        }
        const root = SCRIPT_ROOTS[type];
        try {
            if (!fs.existsSync(root)) return res.json({ success: true, files: [] });
            const files = await fs.readdir(root);
            return res.json({ success: true, files: files.filter((f) => f.endsWith(".js")) });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not list scripts" });
        }
    });

    app.get("/api/scripts/:type/:filename", async (req, res) => {
        const target = safeScriptPath(req.params.type, req.params.filename);
        if (!target) return res.status(400).json({ success: false, message: "Invalid file path" });
        try {
            if (!fs.existsSync(target)) return res.status(404).json({ success: false, message: "File not found" });
            const content = await fs.readFile(target, "utf8");
            return res.json({ success: true, content });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not read file" });
        }
    });

    app.post("/api/scripts/:type/:filename", async (req, res) => {
        const target = safeScriptPath(req.params.type, req.params.filename);
        if (!target) return res.status(400).json({ success: false, message: "Invalid file path" });
        const { content } = req.body || {};
        if (!bodySizeOk(content)) return res.status(400).json({ success: false, message: "Invalid or oversized content" });
        try {
            await fs.writeFile(target, content, { encoding: "utf8", mode: 0o600 });
            return res.json({ success: true, reloaded: false, loadError: "Reload requires a bot restart" });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not write file" });
        }
    });

    app.post("/api/scripts/:type", async (req, res) => {
        const { filename, content } = req.body || {};
        const target = safeScriptPath(req.params.type, filename);
        if (!target) return res.status(400).json({ success: false, message: "Invalid file path" });
        if (!bodySizeOk(content)) return res.status(400).json({ success: false, message: "Invalid or oversized content" });
        try {
            if (fs.existsSync(target)) return res.status(409).json({ success: false, message: "File already exists" });
            await fs.writeFile(target, content, { encoding: "utf8", mode: 0o600 });
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not create file" });
        }
    });

    app.delete("/api/scripts/:type/:filename", async (req, res) => {
        const target = safeScriptPath(req.params.type, req.params.filename);
        if (!target) return res.status(400).json({ success: false, message: "Invalid file path" });
        try {
            if (fs.existsSync(target)) await fs.unlink(target);
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not delete file" });
        }
    });

    // --- allow-listed config files (no traversal, no appstate) ---
    app.get("/api/file/:filename", async (req, res) => {
        const target = safeConfigPath(req.params.filename);
        if (!target) return res.status(400).json({ success: false, message: "File not allowed" });
        try {
            if (!fs.existsSync(target)) return res.status(404).json({ success: false, message: "File not found" });
            const content = await fs.readFile(target, "utf8");
            return res.json({ success: true, content });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not read file" });
        }
    });

    app.post("/api/file/:filename", async (req, res) => {
        const target = safeConfigPath(req.params.filename);
        if (!target) return res.status(400).json({ success: false, message: "File not allowed" });
        const { content } = req.body || {};
        if (!bodySizeOk(content)) return res.status(400).json({ success: false, message: "Invalid or oversized content" });
        try {
            await fs.writeFile(target, content, { encoding: "utf8", mode: 0o600 });
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not write file" });
        }
    });

    // --- read-only FCA info (no restart / cookie clearing endpoints) ---
    app.get("/api/get-fca-type", (req, res) => {
        try {
            const current = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
            return res.json({ success: true, fcaType: current.FCA || current.fca || "cyber-bot-fca" });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Could not read config" });
        }
    });

    app.use((req, res) => {
        res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
    });

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
