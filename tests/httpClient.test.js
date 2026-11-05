"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const httpClient = require("../utils/httpClient");

const quietLogger = {
  warn() {},
  error() {},
  info() {},
  debug() {},
};

function response(data, status = 200, headers = {}) {
  return { data, status, statusText: status === 200 ? "OK" : "", headers, config: {} };
}

function httpError(status, headers = {}, url = "https://example.test/") {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, headers, data: {}, config: { url } };
  error.config = { url };
  error.code = `HTTP_${status}`;
  return error;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fresh(transport) {
  httpClient.__testing.reset();
  httpClient.__testing.setLogger(quietLogger);
  httpClient.__testing.setTransport(transport);
}

test("100 concurrent identical GETs share one request", async () => {
  let calls = 0;
  fresh(async () => {
    calls += 1;
    await delay(20);
    return response({ value: 1 });
  });

  const results = await Promise.all(
    Array.from({ length: 100 }, () => httpClient.get("https://dedupe.test/same"))
  );

  assert.equal(calls, 1);
  assert.equal(results.length, 100);
  assert.ok(results.every((result) => result.status === 200 && result.data.value === 1));
});

test("GET responses are cached for the configured TTL", async () => {
  let calls = 0;
  fresh(async () => {
    calls += 1;
    return response({ call: calls });
  });

  const url = "https://cache.test/value";
  const first = await httpClient.get(url, { cacheTtlMs: 25 });
  const second = await httpClient.get(url, { cacheTtlMs: 25 });
  assert.equal(calls, 1);
  assert.equal(first.data.call, 1);
  assert.equal(second.data.call, 1);

  await delay(30);
  const third = await httpClient.get(url, { cacheTtlMs: 25 });
  assert.equal(calls, 2);
  assert.equal(third.data.call, 2);
});

test("429 honours Retry-After and then succeeds", async () => {
  let calls = 0;
  fresh(async (config) => {
    calls += 1;
    if (calls === 1) throw httpError(429, { "retry-after": "0.05" }, config.url);
    return response({ ok: true });
  });

  const started = Date.now();
  const result = await httpClient.get("https://retry.test/limited", { retryBaseDelayMs: 1 });
  const elapsed = Date.now() - started;

  assert.equal(calls, 2);
  assert.equal(result.status, 200);
  assert.ok(elapsed >= 45, `expected Retry-After delay, got ${elapsed}ms`);
});

test("at most two requests run concurrently per host", async () => {
  let active = 0;
  let maxActive = 0;
  fresh(async (config) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await delay(25);
    active -= 1;
    return response({ url: config.url });
  });

  await Promise.all(
    Array.from({ length: 8 }, (_, index) => httpClient.get(`https://limited.test/item-${index}`))
  );

  assert.ok(maxActive <= 2, `expected max concurrency 2, saw ${maxActive}`);
  assert.ok(maxActive >= 2, `expected concurrency to be used, saw ${maxActive}`);
});

test("request() reports graceful { ok: false } after retries", async () => {
  let calls = 0;
  fresh(async (config) => {
    calls += 1;
    throw httpError(500, {}, config.url);
  });

  const result = await httpClient.request({
    url: "https://failure.test/api",
    maxRetries: 1,
    retryBaseDelayMs: 1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(result.attempts, 2);
  assert.match(result.error, /status code 500/);
  assert.equal(calls, 2);
});

test("sanitizeUrl strips credentials, query and fragment", () => {
  assert.equal(
    httpClient.sanitizeUrl("https://user:pass@example.com/path?token=abc#frag"),
    "https://example.com/path"
  );
});

test("fetchJson parses a text JSON body", async () => {
  fresh(async () => response('{"hello":"world"}', 200, { "content-type": "text/plain" }));

  const result = await httpClient.fetchJson("https://json.test/value");
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { hello: "world" });
});
