"use strict";

const axios = require("axios");

/**
 * Helpers for event images that draw user-controlled text and fetch remote
 * pictures. Canvas output is not HTML, but unbounded/odd text can break layout
 * and remote fetches can be pointed at huge or non-image resources (F-18).
 */

// Strip control characters and bidi overrides, collapse whitespace, bound length.
function sanitizeCanvasText(value, maxLength) {
  const limit = Number(maxLength) > 0 ? Number(maxLength) : 48;
  let text = value == null ? "" : String(value);
  text = text.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > limit) text = text.slice(0, limit - 1) + "…";
  return text;
}

function safeId(value) {
  const id = String(value == null ? "" : value).replace(/\D/g, "");
  return id || "unknown";
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

/**
 * Fetch an image with a timeout, byte cap, and image content-type check.
 * @param {string} url
 * @param {{ maxBytes?: number, timeoutMs?: number, allowedHosts?: string[] }} options
 */
async function fetchImageBuffer(url, options) {
  const opts = options || {};
  const maxBytes = Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : 8 * 1024 * 1024;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 15000;

  if (!isHttpUrl(url)) throw new Error("Image URL must be http(s)");
  if (Array.isArray(opts.allowedHosts) && opts.allowedHosts.length) {
    const host = new URL(String(url)).hostname.toLowerCase();
    if (!opts.allowedHosts.map((item) => String(item).toLowerCase()).includes(host)) {
      throw new Error(`Image host not allowed: ${host}`);
    }
  }

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: timeoutMs,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    maxRedirects: 2,
    validateStatus: (status) => status >= 200 && status < 300,
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  const contentType = String((response.headers && response.headers["content-type"]) || "").toLowerCase();
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`Refusing non-image response (${contentType})`);
  }
  const data = response.data ? Buffer.from(response.data) : Buffer.alloc(0);
  if (!data.length || data.length > maxBytes) throw new Error("Image response is empty or too large");
  return data;
}

module.exports = { sanitizeCanvasText, safeId, isHttpUrl, fetchImageBuffer };
