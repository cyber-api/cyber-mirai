module.exports.config = {
  name: "download",
  version: "1.1.0",
  hasPermssion: 2,
  credits: "CYBER BOT TEAM",
  description: "Download a file into Script/commands/cache/downloads (admin only)",
  commandCategory: "System",
  usages: "download <link> || download <filename> <link>",
  cooldowns: 5
};

const fs = require("fs-extra");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");

const DOWNLOAD_DIR = path.resolve(__dirname, "cache", "downloads");
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const TIMEOUT_MS = 30 * 1000;

function isPrivateAddress(address) {
  const type = net.isIP(address);
  if (type === 4) {
    const parts = address.split(".").map((part) => Number(part));
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;          // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true;          // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                        // multicast / reserved
    return false;
  }
  if (type === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("fe80")) return true;                        // link-local
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return false;
  }
  return true; // unknown format: refuse
}

async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw Object.assign(new Error("Invalid URL"), { code: "BAD_URL" });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw Object.assign(new Error("Only http/https URLs are allowed"), { code: "BAD_PROTOCOL" });
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  // Block literal private/loopback addresses before DNS.
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw Object.assign(new Error("Private address is not allowed"), { code: "PRIVATE_HOST" });
    return parsed;
  }

  let records;
  try {
    records = await dns.lookup(host, { all: true });
  } catch (error) {
    throw Object.assign(new Error("Could not resolve host"), { code: "DNS_ERROR" });
  }
  if (!records.length) throw Object.assign(new Error("Could not resolve host"), { code: "DNS_ERROR" });
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw Object.assign(new Error("Host resolves to a private address"), { code: "PRIVATE_HOST" });
    }
  }
  return parsed;
}

function safeFilename(parsed, requested) {
  const candidates = [];
  if (typeof requested === "string" && requested.trim()) candidates.push(requested.trim());
  try { candidates.push(decodeURIComponent(path.basename(parsed.pathname))); } catch (error) { /* ignore */ }
  candidates.push("download.bin");

  for (const candidate of candidates) {
    const base = path.basename(candidate).replace(/[\x00-\x1f<>:"/\\|?*]/g, "_").trim();
    if (!base || base === "." || base === "..") continue;
    // Never allow the download to replace a loadable script.
    if (/\.(js|cjs|mjs|json|sqlite|db)$/i.test(base)) continue;
    return base.slice(0, 120);
  }
  return "download.bin";
}

module.exports.run = async function ({ api, event, args }) {
  const axios = require("axios");

  if (!args.length) {
    return api.sendMessage("Usage: download <link> || download <filename> <link>", event.threadID, event.messageID);
  }

  // Treat the first argument as a filename hint only when a second exists.
  const hasFilename = args.length > 1 && !/^https?:\/\//i.test(args[0]);
  const requestedName = hasFilename ? args[0] : "";
  const link = (hasFilename ? args.slice(1) : args).join("").trim();

  try {
    const parsed = await assertPublicUrl(link);
    fs.ensureDirSync(DOWNLOAD_DIR);

    const response = await axios.get(link, {
      responseType: "arraybuffer",
      timeout: TIMEOUT_MS,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      maxRedirects: 3,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const size = response.data ? response.data.length : 0;
    if (!size) return api.sendMessage("❌ The download was empty.", event.threadID, event.messageID);
    if (size > MAX_BYTES) return api.sendMessage("❌ The file is larger than the 50 MB limit.", event.threadID, event.messageID);

    const filename = safeFilename(parsed, requestedName);
    const target = path.resolve(DOWNLOAD_DIR, filename);
    if (path.dirname(target) !== DOWNLOAD_DIR) {
      return api.sendMessage("❌ Invalid filename.", event.threadID, event.messageID);
    }

    fs.writeFileSync(target, Buffer.from(response.data), { mode: 0o600 });
    return api.sendMessage(`✅ Saved to ${path.relative(path.resolve(__dirname, "..", ".."), target)} (${size} bytes)`, event.threadID, event.messageID);
  } catch (error) {
    const code = error && error.code;
    let reason = "Download failed.";
    if (code === "BAD_URL" || code === "BAD_PROTOCOL") reason = "Only valid http/https links are allowed.";
    else if (code === "PRIVATE_HOST") reason = "Private, loopback, and metadata hosts are blocked.";
    else if (code === "DNS_ERROR") reason = "Could not resolve that host.";
    else if (code === "ECONNABORTED" || code === "ETIMEDOUT") reason = "The download timed out.";
    else if (code === "ERR_FR_MAX_BODY_LENGTH_EXCEEDED" || /maxContentLength/i.test(String(error.message))) reason = "The file is too large.";
    return api.sendMessage(`❌ ${reason}`, event.threadID, event.messageID);
  }
};

module.exports._private = { isPrivateAddress, assertPublicUrl, safeFilename, DOWNLOAD_DIR };
