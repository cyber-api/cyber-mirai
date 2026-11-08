"use strict";

/**
 * Central HTTP client for the whole bot.
 *
 * Why this exists
 * - Render's filesystem is ephemeral, so every cold start re-downloaded all
 *   command assets. ~20 `onLoad()` handlers fired at once and GitHub/Imgur
 *   answered with bursts of HTTP 429.
 * - Before this module, 70+ files required axios directly. There was no retry,
 *   no backoff, no request coalescing, and no per-host limit.
 *
 * Behaviour
 * - GET responses are cached for 5 minutes (in memory, bounded).
 * - Concurrent identical GETs share one in-flight request.
 * - At most 2 requests are in flight per host; the rest queue.
 * - Transient failures retry with exponential backoff + jitter.
 * - `Retry-After` is honoured for 429/503/408 responses.
 * - URLs written to logs never contain query strings, credentials, or hashes.
 * - `request()` returns `{ ok: false, ... }` instead of throwing. The
 *   axios-compatible `get()`/`post()` methods still throw, because the existing
 *   command modules rely on try/catch around axios.
 *
 * The module intentionally requires axios lazily. That keeps unit tests (which
 * inject a fake transport) independent from node_modules and avoids a circular
 * require while Cyber.js is building `global.nodemodule`.
 */

const crypto = require("crypto");
const { URL } = require("url");
const imageResolver = require("./imageResolver.js");

const DEFAULTS = {
  timeout: 30 * 1000,
  cacheTtlMs: 5 * 60 * 1000,
  cacheMaxBytes: 2 * 1024 * 1024,
  cacheMaxTotalBytes: 32 * 1024 * 1024,
  cacheMaxEntries: 300,
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 60 * 1000,
  maxConcurrentPerHost: 2,
  streamSlotTimeoutMs: 120 * 1000,
  rejectionDedupeMs: 60 * 1000,
};

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "ERR_NETWORK",
  "ERR_SOCKET_CONNECTION_TIMEOUT",
]);
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

let transport = null;
let logger = null;

/**axios-compatible transport. Kept lazy so tests can run without axios. */
function getTransport() {
  if (!transport) {
    const axios = require("axios");
    transport = (config) => axios(config);
  }
  return transport;
}

function getLogger() {
  if (logger === null) {
    try {
      logger = require("./log.js");
    } catch (error) {
      // Under `node --test` the optional chalk dependency may not be installed.
      logger = {
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
        info: (message) => console.log(message),
        debug: () => {},
      };
    }
  }
  return logger;
}

function log(level, message) {
  try {
    const target = getLogger();
    const write = typeof target[level] === "function" ? target[level] : target.info;
    if (typeof write === "function") write.call(target, message);
  } catch (error) {
    // Logging must never break an HTTP request.
  }
}

// ---------------------------------------------------------------------------
// URL / error sanitising
// ---------------------------------------------------------------------------

/**
 * Strip credentials, query string, and fragment before a URL reaches a log.
 * Only origin + pathname is useful for debugging and cannot leak access tokens.
 */
function sanitizeUrl(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch (error) {
    return String(value).split(/[?#]/)[0].slice(0, 300);
  }
}

function sanitizeMessage(value) {
  if (value == null) return "";
  return String(value)
    .replace(/https?:\/\/[^\s"'<>]+/gi, (match) => sanitizeUrl(match))
    .slice(0, 800);
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return undefined;
  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

function getStatus(error) {
  const response = error && error.response;
  const status = response && response.status;
  return Number.isFinite(Number(status)) ? Number(status) : undefined;
}

function isRateLimited(error) {
  const status = getStatus(error);
  if (status === 429) return true;
  // GitHub's unauthenticated rate limit answers 403 with this header.
  const headers = error && error.response && error.response.headers;
  return status === 403 && String(headerValue(headers, "x-ratelimit-remaining")) === "0";
}

function isRetryableError(error) {
  if (!error) return false;
  if (isRateLimited(error)) return true;
  const status = getStatus(error);
  if (status && RETRYABLE_STATUS.has(status)) return true;
  if (status) return false;
  const code = String(error.code || "").toUpperCase();
  return RETRYABLE_CODES.has(code);
}

function isRetryableStatus(status, headers) {
  if (RETRYABLE_STATUS.has(status)) return true;
  return status === 403 && String(headerValue(headers, "x-ratelimit-remaining")) === "0";
}

function describeError(error) {
  const status = getStatus(error);
  const code = error && error.code ? String(error.code) : undefined;
  const config = (error && error.config) || {};
  const responseUrl = error && error.response && error.response.config && error.response.config.url;
  const url = sanitizeUrl(config.url || (error && error.url) || responseUrl || "");
  const message = sanitizeMessage(error && error.message ? error.message : error) || "HTTP request failed";
  return {
    status,
    code,
    url,
    message,
    retryable: isRetryableError(error),
    rateLimited: isRateLimited(error),
  };
}

// ---------------------------------------------------------------------------
// Request normalisation / keys
// ---------------------------------------------------------------------------

function normaliseConfig(input, second, third) {
  let config;
  if (typeof input === "string") {
    config = Object.assign({}, second && typeof second === "object" ? second : {});
    config.url = input;
    if (third !== undefined) config.data = third;
  } else if (input && typeof input === "object") {
    config = Object.assign({}, input);
  } else {
    throw new TypeError("httpClient: a URL string or axios config object is required");
  }

  config.method = String(config.method || "GET").toUpperCase();
  if (!config.url || typeof config.url !== "string") {
    throw new TypeError("httpClient: request URL is required");
  }
  if (!/^https?:\/\//i.test(config.url)) {
    throw new TypeError("httpClient: only http(s) URLs are supported");
  }

  // Rewrite migrated Imgur URLs and fail fast on pending ones. This is the one
  // choke point every command reaches through, including the legacy
  // `global.utils.downloadFile` helper and obfuscated `onLoad` handlers.
  const resolved = imageResolver.resolveUrl(config.url);
  if (resolved.changed) {
    config.__imageMigrationOriginal = resolved.original;
    config.url = resolved.url;
  }
  return config;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value instanceof URLSearchParams) return JSON.stringify(Array.from(value.entries()));
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function safeStableStringify(value) {
  try {
    return stableStringify(value);
  } catch (error) {
    return String(value);
  }
}

function headersFingerprint(headers) {
  if (!headers || typeof headers !== "object" || Object.keys(headers).length === 0) return "";
  return crypto.createHash("sha256").update(safeStableStringify(headers)).digest("hex").slice(0, 16);
}

function hasSensitiveHeaders(headers) {
  if (!headers || typeof headers !== "object") return false;
  return Object.keys(headers).some((name) => {
    const key = name.toLowerCase();
    return key === "authorization" || key === "proxy-authorization" || key === "cookie";
  });
}

function requestCacheControl(config) {
  return String(headerValue(config.headers, "cache-control") || "").toLowerCase();
}

function makeKey(config) {
  return [
    config.method,
    config.url,
    safeStableStringify(config.params || null),
    String(config.responseType || "json"),
    headersFingerprint(config.headers),
  ].join("|");
}

function isCacheable(config) {
  if (config.method !== "GET") return false;
  if (config.cache === false) return false;
  if (config.responseType === "stream") return false;
  if (config.data !== undefined) return false;
  if (hasSensitiveHeaders(config.headers)) return false;
  const cacheControl = requestCacheControl(config);
  if (cacheControl.includes("no-cache") || cacheControl.includes("no-store")) return false;
  return true;
}

function isDedupeable(config) {
  if (config.dedupe === false) return false;
  if (config.responseType === "stream") return false;
  if (config.method !== "GET" && config.method !== "HEAD") return false;
  return config.data === undefined;
}

function cacheTtl(config) {
  const value = Number(config.cacheTtlMs);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULTS.cacheTtlMs;
}

function retryCount(config) {
  if (config.retry === false) return 0;
  const value = config.maxRetries !== undefined ? config.maxRetries : config.retries;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? Math.min(number, 5) : DEFAULTS.maxRetries;
}

function retryBase(config) {
  const value = Number(config.retryBaseDelayMs);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULTS.baseDelayMs;
}

function retryMax(config) {
  const value = Number(config.retryMaxDelayMs);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULTS.maxDelayMs;
}

function stripClientOptions(config) {
  const axiosConfig = Object.assign({}, config);
  for (const key of [
    "cache",
    "cacheTtlMs",
    "dedupe",
    "maxRetries",
    "retries",
    "retry",
    "retryBaseDelayMs",
    "retryMaxDelayMs",
    "retryNonIdempotent",
  ]) {
    delete axiosConfig[key];
  }
  if (axiosConfig.timeout === undefined) axiosConfig.timeout = DEFAULTS.timeout;
  return axiosConfig;
}

// ---------------------------------------------------------------------------
// Per-host concurrency (max 2)
// ---------------------------------------------------------------------------

const hostStates = new Map();

function acquireHostSlot(url) {
  let host;
  try {
    host = new URL(url).host.toLowerCase();
  } catch (error) {
    return Promise.resolve(() => {});
  }

  let state = hostStates.get(host);
  if (!state) {
    state = { active: 0, queue: [] };
    hostStates.set(host, state);
  }

  return new Promise((resolve) => {
    state.queue.push(resolve);
    drainHost(host, state);
  });
}

function drainHost(host, state) {
  while (state.active < DEFAULTS.maxConcurrentPerHost && state.queue.length > 0) {
    const resolve = state.queue.shift();
    state.active += 1;
    let released = false;
    resolve(() => {
      if (released) return;
      released = true;
      state.active = Math.max(0, state.active - 1);
      drainHost(host, state);
      if (state.active === 0 && state.queue.length === 0) hostStates.delete(host);
    });
  }
}

// ---------------------------------------------------------------------------
// Cache / in-flight tables
// ---------------------------------------------------------------------------

const responseCache = new Map();
const inFlight = new Map();
let cachedBytes = 0;

function dropCachedEntry(key) {
  const entry = responseCache.get(key);
  if (!entry) return;
  responseCache.delete(key);
  cachedBytes = Math.max(0, cachedBytes - (entry.bytes || 0));
}

function cloneValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    return new value.constructor(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  try {
    if (typeof structuredClone === "function") return structuredClone(value);
  } catch (error) {
    // Fall through to JSON cloning for plain objects.
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

function cloneResponse(response) {
  return {
    data: cloneValue(response.data),
    status: response.status,
    statusText: response.statusText,
    headers: Object.assign({}, response.headers),
    config: Object.assign({}, response.config),
    request: undefined,
  };
}

function responseSize(data) {
  if (data == null) return 0;
  if (Buffer.isBuffer(data)) return data.length;
  if (typeof data === "string") return Buffer.byteLength(data);
  try {
    return Buffer.byteLength(JSON.stringify(data));
  } catch (error) {
    return DEFAULTS.cacheMaxBytes + 1;
  }
}

function readCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    dropCachedEntry(key);
    return null;
  }
  // Refresh insertion order for the simple LRU eviction below.
  responseCache.delete(key);
  responseCache.set(key, entry);
  return cloneResponse(entry.value);
}

function writeCache(key, config, response) {
  if (!isCacheable(config)) return;
  if (!response || response.status < 200 || response.status >= 300) return;
  const cacheControl = String(headerValue(response.headers, "cache-control") || "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) return;
  const bytes = responseSize(response.data);
  if (bytes > DEFAULTS.cacheMaxBytes) return;

  dropCachedEntry(key);

  const value = {
    data: cloneValue(response.data),
    status: response.status,
    statusText: response.statusText,
    headers: Object.assign({}, response.headers),
    config: { url: config.url, method: config.method },
  };

  responseCache.set(key, { expiresAt: Date.now() + cacheTtl(config), value, bytes });
  cachedBytes += bytes;
  while (
    responseCache.size > DEFAULTS.cacheMaxEntries ||
    cachedBytes > DEFAULTS.cacheMaxTotalBytes
  ) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    dropCachedEntry(oldest);
  }
}

// ---------------------------------------------------------------------------
// Retry timing
// ---------------------------------------------------------------------------

function parseRetryAfter(headers) {
  const value = headerValue(headers, "retry-after");
  if (value == null || value === "") return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, DEFAULTS.maxDelayMs);
  }
  const date = Date.parse(String(value));
  if (Number.isFinite(date)) {
    return Math.min(Math.max(0, date - Date.now()), DEFAULTS.maxDelayMs);
  }
  return null;
}

function retryDelay(error, attempt, config) {
  const response = error && error.response;
  const retryAfter = parseRetryAfter(response && response.headers);
  if (retryAfter !== null) return retryAfter;

  const base = retryBase(config);
  const cap = retryMax(config);
  const exponential = Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1)));
  // +/- 30% jitter avoids a cold start synchronising every queued request.
  return Math.round(exponential * (0.7 + Math.random() * 0.6));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function destroyResponse(response) {
  const data = response && response.data;
  if (data && typeof data.destroy === "function") {
    try { data.destroy(); } catch (error) { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Core request pipeline
// ---------------------------------------------------------------------------

function logRetry(config, attempt, attempts, error, delay) {
  const status = getStatus(error) || (error && error.code) || "network";
  log("warn", `[HTTP] ${status} ${config.method} ${sanitizeUrl(config.url)} ` +
    `attempt ${attempt}/${attempts}, retrying in ${Math.round(delay)}ms`);
}

function logFinalFailure(config, attempts, error) {
  const info = describeError(error);
  const status = info.status || info.code || "error";
  const suffix = attempts > 1 ? ` after ${attempts} attempts` : "";
  log(info.retryable || info.rateLimited ? "warn" : "error",
    `[HTTP] ${status} ${config.method} ${info.url || sanitizeUrl(config.url)} failed${suffix}: ${info.message}`);
}

async function executeWithRetry(config) {
  const attempts = retryCount(config) + 1;
  const canRetryMethod = IDEMPOTENT_METHODS.has(config.method) || config.retryNonIdempotent === true;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const release = await acquireHostSlot(config.url);
    try {
      const response = await getTransport()(stripClientOptions(config));
      const status = Number(response && response.status) || 0;

      // `validateStatus` may have accepted a transient status; retry it unless
      // the caller explicitly asked not to.
      if (canRetryMethod && attempt < attempts && isRetryableStatus(status, response.headers)) {
        destroyResponse(response);
        release();
        const retryAfter = parseRetryAfter(response.headers);
        const delay = retryAfter !== null ? retryAfter : retryDelay({ response }, attempt, config);
        logRetry(config, attempt, attempts, { response }, delay);
        await sleep(delay);
        continue;
      }

      if (config.responseType === "stream" && response && response.data && typeof response.data.once === "function") {
        // Keep the per-host slot until the body is consumed, not merely until
        // response headers arrive. This is what serialises asset downloads.
        holdStreamSlot(config.url, response, release);
      } else {
        release();
      }
      return { response, attempts: attempt, url: config.url };
    } catch (error) {
      release();
      lastError = error;
      const retryable = isRetryableError(error);
      if (attempt >= attempts || !canRetryMethod || !retryable) {
        error.__httpAttempts = attempt;
        logFinalFailure(config, attempt, error);
        error.__httpLogged = true;
        throw error;
      }
      const delay = retryDelay(error, attempt, config);
      logRetry(config, attempt, attempts, error, delay);
      await sleep(delay);
    }
  }

  if (!lastError) lastError = new Error("HTTP request failed");
  logFinalFailure(config, attempts, lastError);
  lastError.__httpLogged = true;
  throw lastError;
}

function holdStreamSlot(url, response, release) {
  const data = response.data;
  let released = false;
  let timer;
  const finish = () => {
    if (released) return;
    released = true;
    if (timer) clearTimeout(timer);
    if (typeof data.removeListener === "function") {
      data.removeListener("end", finish);
      data.removeListener("close", finish);
      data.removeListener("error", finish);
    }
    release();
  };

  data.once("end", finish);
  data.once("close", finish);
  data.once("error", finish);
  timer = setTimeout(finish, DEFAULTS.streamSlotTimeoutMs);
  if (timer && typeof timer.unref === "function") timer.unref();

  // If a downstream command never consumes the stream, the timeout above
  // prevents the host queue from being blocked forever.
  return finish;
}

async function runRequest(rawConfig) {
  const config = normaliseConfig(rawConfig);
  const key = makeKey(config);
  const cacheable = isCacheable(config);
  const dedupeable = isDedupeable(config);

  if (cacheable) {
    const cached = readCache(key);
    if (cached) return { response: cached, attempts: 0, url: config.url, cached: true, deduped: false };
  }

  if (dedupeable && inFlight.has(key)) {
    const shared = await inFlight.get(key);
    return {
      response: cloneResponse(shared.response),
      attempts: shared.attempts,
      url: shared.url,
      cached: false,
      deduped: true,
    };
  }

  const task = executeWithRetry(config)
    .then((result) => {
      writeCache(key, config, result.response);
      return result;
    })
    .catch((error) => {
      throw error;
    });

  if (dedupeable) {
    inFlight.set(key, task);
    task.then(() => inFlight.delete(key), () => inFlight.delete(key));
  }

  const result = await task;
  return Object.assign({ cached: false, deduped: false }, result);
}

async function compatRequest(input, second, third) {
  const result = await runRequest(normaliseConfig(input, second, third));
  return result.response;
}

/** Graceful API: never throws for network/HTTP failures. */
async function request(input, second, third) {
  let config;
  try {
    config = normaliseConfig(input, second, third);
  } catch (error) {
    return {
      ok: false,
      status: undefined,
      code: error.code,
      error: sanitizeMessage(error.message),
      url: sanitizeUrl(error.url || ""),
      attempts: 0,
      retryable: false,
      rateLimited: false,
    };
  }

  try {
    const result = await runRequest(config);
    return {
      ok: true,
      status: result.response.status,
      statusText: result.response.statusText,
      headers: result.response.headers,
      data: result.response.data,
      response: result.response,
      url: sanitizeUrl(config.url),
      attempts: result.attempts,
      cached: result.cached,
      deduped: result.deduped,
    };
  } catch (error) {
    const info = describeError(error);
    return {
      ok: false,
      status: info.status,
      code: info.code,
      error: info.message,
      url: info.url || sanitizeUrl(config.url),
      attempts: Number(error && error.__httpAttempts) || 0,
      retryable: info.retryable,
      rateLimited: info.rateLimited,
      cause: error,
    };
  }
}

async function fetchJson(url, options) {
  const opts = Object.assign({}, options || {});
  const result = await request(Object.assign({}, opts, {
    url,
    method: opts.method || "GET",
    responseType: "json",
  }));
  if (result.ok && typeof result.data === "string") {
    try {
      result.data = JSON.parse(result.data);
    } catch (error) {
      return Object.assign({}, result, {
        ok: false,
        error: "invalid JSON response",
        cause: error,
      });
    }
  }
  return result;
}

async function fetchText(url, options) {
  const opts = Object.assign({}, options || {});
  return request(Object.assign({}, opts, {
    url,
    method: opts.method || "GET",
    responseType: "text",
  }));
}

async function fetchBuffer(url, options) {
  const opts = Object.assign({}, options || {});
  return request(Object.assign({}, opts, {
    url,
    method: opts.method || "GET",
    responseType: "arraybuffer",
  }));
}

function toError(result) {
  const error = new Error((result && result.error) || "HTTP request failed");
  error.status = result && result.status;
  error.code = result && result.code;
  error.url = result && result.url;
  error.result = result;
  return error;
}

function get(url, config) {
  return compatRequest(Object.assign({}, config || {}, { url, method: "GET" }));
}

function post(url, data, config) {
  return compatRequest(Object.assign({}, config || {}, { url, method: "POST", data }));
}

function put(url, data, config) {
  return compatRequest(Object.assign({}, config || {}, { url, method: "PUT", data }));
}

function del(url, config) {
  return compatRequest(Object.assign({}, config || {}, { url, method: "DELETE" }));
}

function patch(url, data, config) {
  return compatRequest(Object.assign({}, config || {}, { url, method: "PATCH", data }));
}

function head(url, config) {
  return compatRequest(Object.assign({}, config || {}, { url, method: "HEAD" }));
}

function create(defaults) {
  const base = Object.assign({}, defaults || {});
  const instance = (input, config) => {
    if (typeof input === "string") {
      return compatRequest(Object.assign({}, base, config || {}, { url: input }));
    }
    return compatRequest(Object.assign({}, base, input || {}));
  };
  instance.request = instance;
  instance.get = (url, config) => compatRequest(Object.assign({}, base, config || {}, { url, method: "GET" }));
  instance.post = (url, data, config) => compatRequest(Object.assign({}, base, config || {}, { url, method: "POST", data }));
  instance.put = (url, data, config) => compatRequest(Object.assign({}, base, config || {}, { url, method: "PUT", data }));
  instance.delete = (url, config) => compatRequest(Object.assign({}, base, config || {}, { url, method: "DELETE" }));
  instance.patch = (url, data, config) => compatRequest(Object.assign({}, base, config || {}, { url, method: "PATCH", data }));
  instance.head = (url, config) => compatRequest(Object.assign({}, base, config || {}, { url, method: "HEAD" }));
  return instance;
}

// axios-compatible callable object. Requiring files can keep using
// `axios.get(...)`, `axios({...})`, and `axios.post(...)` unchanged.
const axiosCompat = function axiosCompat(input, config) {
  return compatRequest(input, config);
};
axiosCompat.request = compatRequest;
axiosCompat.get = get;
axiosCompat.post = post;
axiosCompat.put = put;
axiosCompat.delete = del;
axiosCompat.patch = patch;
axiosCompat.head = head;
axiosCompat.create = create;
axiosCompat.defaults = {};
axiosCompat.default = axiosCompat;

module.exports = axiosCompat;
module.exports.request = request;
module.exports.fetchJson = fetchJson;
module.exports.fetchText = fetchText;
module.exports.fetchBuffer = fetchBuffer;
module.exports.fetchWithRetry = request;
module.exports.toError = toError;
module.exports.sanitizeUrl = sanitizeUrl;
module.exports.sanitizeMessage = sanitizeMessage;
module.exports.describeError = describeError;
module.exports.isRetryableError = isRetryableError;
module.exports.isRateLimited = isRateLimited;
module.exports.DEFAULTS = DEFAULTS;

// Test-only hooks. They are deliberately prefixed and documented as unstable.
module.exports.__testing = {
  setTransport(fn) {
    transport = typeof fn === "function" ? fn : null;
  },
  setLogger(value) {
    logger = value || null;
  },
  reset() {
    transport = null;
    logger = null;
    responseCache.clear();
    inFlight.clear();
    hostStates.clear();
    cachedBytes = 0;
  },
  cacheSize() {
    return responseCache.size;
  },
  hostStates,
};
