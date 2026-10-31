const chalk = require("chalk");
const fs = require("fs");
const path = require("path");

/**
 * Structured-ish console logger with levels and secret redaction.
 *
 * The previous logger was a raw `console.log` wrapper: no timestamps, no levels,
 * and no filtering, so cookies/tokens/URLs could be printed verbatim and then
 * replayed through the dashboard log stream (F-19, F-40).
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// config.json is the source of truth; environment variables are an optional
// override. Read lazily so `load`/restart pick up changes without a re-require.
let cachedFileConfig = null;
function fileConfig() {
  if (cachedFileConfig) return cachedFileConfig;
  try {
    cachedFileConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"));
  } catch (error) {
    cachedFileConfig = {};
  }
  return cachedFileConfig;
}

function setting(key, fallback) {
  const envValue = process.env[key];
  if (envValue !== undefined && envValue !== "") return envValue;
  if (global.config && global.config[key] !== undefined && global.config[key] !== "") return global.config[key];
  const configured = fileConfig()[key];
  return configured === undefined || configured === "" ? fallback : configured;
}

function minLevel() {
  const configuredLevel = String(setting("LOG_LEVEL", "info")).toLowerCase();
  return LEVELS[configuredLevel] || LEVELS.info;
}

function auditSettings() {
  const dir = setting("AUDIT_LOG_DIR", path.join(__dirname, "..", "logs"));
  const file = setting("AUDIT_LOG_FILE", path.join(dir, "audit.log"));
  const enabled = String(setting("AUDIT_LOG", "true")).toLowerCase() !== "false";
  return { dir, file, enabled };
}

// Patterns are applied in order. Keep them conservative: redact values that are
// unambiguously credentials, not arbitrary tokens in normal prose.
const SECRET_PATTERNS = [
  // Facebook app access tokens
  [/\bEAA[A-Za-z0-9]{10,}\b/g, "[REDACTED_FB_TOKEN]"],
  // Authorization headers
  [/((?:authorization|proxy-authorization)\s*[:=]\s*)(?:Bearer\s+)?[^\r\n"']+/gi, "$1[REDACTED]"],
  // Cookie headers / cookie jar strings
  [/((?:cookie|set-cookie)\s*[:=]\s*)[^\r\n"']+/gi, "$1[REDACTED]"],
  // key=value credentials
  [/((?:password|passwd|secret|api[_-]?key|session[_-]?secret|access_token|token)\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s&,;"']+)/gi, "$1[REDACTED]"],
  // Query-string credentials
  [/([?&](?:access_token|token|api_key|apikey|password|secret)=)[^&\s"']+/gi, "$1[REDACTED]"],
  // Facebook session cookies written as cookie pairs
  [/\b(c_user|xs|datr|fr|sb|presence|spin|dpr)=([^;\s"']+)/gi, "$1=[REDACTED]"],
  // appstate.json entries: {"key":"...","value":"..."}
  [/("key"\s*:\s*"[^"]+"\s*,\s*"value"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"'],
  // Bearer tokens
  [/(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi, "$1[REDACTED]"],
];

function redact(input) {
  let text;
  if (typeof input === "string") {
    text = input;
  } else if (input instanceof Error) {
    text = input.stack || input.message || String(input);
  } else {
    try {
      text = JSON.stringify(input);
    } catch (error) {
      text = String(input);
    }
  }
  if (typeof text !== "string") text = String(text);
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function timestamp() {
  return new Date().toISOString();
}

function formatLine(level, message) {
  return `[${timestamp()}] [${level.toUpperCase()}] ${redact(message)}`;
}

// Function: Generates a random hex color (like #A1B2C3)
function randomColor() {
  let color = '';
  for (let i = 0; i < 3; i++) {
    let part = Math.floor(Math.random() * 256).toString(16);
    color += part.length === 1 ? '0' + part : part;
  }
  return '#' + color;
}

function shouldLog(level) {
  return LEVELS[level] >= minLevel();
}

function write(level, message) {
  if (!shouldLog(level)) return;
  const line = formatLine(level, message);
  if (level === "error" || level === "warn") {
    console.error(chalk.bold.hex("#ff0000").bold("» Log « ") + line);
  } else {
    console.log(chalk.bold.hex(randomColor()).bold("» Log « ") + line);
  }
}

// Main exported logger function (backwards compatible: logger(msg, "error"))
module.exports = (message, type) => {
  const level = LEVELS[String(type).toLowerCase()] ? String(type).toLowerCase() : "info";
  write(level, message);
};

// Loader function (for showing load/status messages)
module.exports.loader = (message, type) => {
  const level = String(type).toLowerCase() === "error"
    ? "error"
    : String(type).toLowerCase() === "warn"
      ? "warn"
      : "info";
  if (!shouldLog(level)) return;
  const line = formatLine(level, message);
  const prefix = chalk.bold.hex(randomColor()).bold(" 𝐂𝐘𝐁𝐄𝐑 ☢️_𖣘 -𝐁𝐎𝐓 ⚠️ 𝑻𝑬𝑨𝑴_ ☢️ ");
  const body = level === "error"
    ? chalk.bold.hex("#ff0000").bold(line)
    : chalk.bold.hex("#8B8878").bold(line);
  console.log(prefix + body);
};

// Error function
module.exports.error = (message, type) => {
  write("error", (typeof type === "string" && type ? type + " " : "") + message);
};

module.exports.warn = (message) => write("warn", message);
module.exports.info = (message) => write("info", message);
module.exports.debug = (message) => write("debug", message);
module.exports.redact = redact;
module.exports.LEVELS = LEVELS;

/**
 * Append-only audit trail for privileged actions. Never throws into callers.
 * @param {{ action: string, actor?: string, target?: string, detail?: string, result?: string }} entry
 */
module.exports.audit = function audit(entry) {
  const { dir, file, enabled } = auditSettings();
  if (!enabled) return;
  const record = {
    time: timestamp(),
    action: String((entry && entry.action) || "unknown"),
    actor: entry && entry.actor != null ? String(entry.actor) : undefined,
    target: entry && entry.target != null ? String(entry.target) : undefined,
    result: entry && entry.result != null ? String(entry.result) : undefined,
    detail: entry && entry.detail != null ? redact(entry.detail) : undefined,
  };
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.appendFileSync(file, JSON.stringify(record) + "\n", { encoding: "utf8", mode: 0o600 });
  } catch (error) {
    // Auditing must not take the bot down; surface the failure on stderr only.
    console.error("audit log write failed: " + redact(error));
  }
};
