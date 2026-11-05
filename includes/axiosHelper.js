"use strict";

/**
 * Backwards-compatible helper for older scripts. New code should require
 * utils/httpClient directly.
 */

const httpClient = require("../utils/httpClient");

async function getWithRetry(url, options = {}) {
    const result = await httpClient.request(Object.assign({}, options, { url, method: "GET" }));
    if (!result.ok) throw httpClient.toError(result);
    return result.response;
}

module.exports = { getWithRetry };
