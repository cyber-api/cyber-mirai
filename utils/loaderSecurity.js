"use strict";

/**
 * Heuristics for spotting minified/obfuscated modules at load time.
 *
 * This is an optional heuristic utility for operators who want to inspect
 * modules before loading them. The default `Cyber.js` loader does not call it:
 * every shipped command/event must load (ST-BOT parity), including the ~50
 * minified modules. Keep it available for external tooling, but do not wire it
 * back in as a default-deny gate.
 */

const HEX_IDENT = /_0x[0-9a-f]{3,}/gi;
const HEX_ESCAPE = /\\x[0-9a-f]{2}/gi;
const STRING_ARRAY = /(?:var|let|const)\s+_0x[0-9a-f]{3,}\s*=\s*\[/i;
const DECODER_FN = /function\s+_0x[0-9a-f]{3,}\s*\(/i;

function countMatches(text, pattern) {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
}

/**
 * @returns {{ obfuscated: boolean, score: number, reasons: string[] }}
 */
function scanSource(source) {
    const text = typeof source === "string" ? source : "";
    const reasons = [];
    let score = 0;

    const hexIdentifiers = countMatches(text, HEX_IDENT);
    const hexEscapes = countMatches(text, HEX_ESCAPE);
    const hasStringArray = STRING_ARRAY.test(text);
    const hasDecoder = DECODER_FN.test(text);

    if (hexIdentifiers >= 30) {
        score += 3;
        reasons.push(`${hexIdentifiers} _0x identifiers`);
    } else if (hexIdentifiers >= 10) {
        score += 1;
        reasons.push(`${hexIdentifiers} _0x identifiers`);
    }

    if (hexEscapes >= 100) {
        score += 3;
        reasons.push(`${hexEscapes} \\x escapes`);
    } else if (hexEscapes >= 25) {
        score += 1;
        reasons.push(`${hexEscapes} \\x escapes`);
    }

    if (hasStringArray) {
        score += 2;
        reasons.push("string-array obfuscation");
    }
    if (hasDecoder) {
        score += 2;
        reasons.push("decoder function");
    }

    return { obfuscated: score >= 4, score, reasons };
}

/**
 * Decide whether a module may be loaded.
 * @param {{ source: string, name?: string, allowObfuscated?: boolean, allowlist?: string[] }} options
 */
function checkModuleSource(options) {
    const { source, name, allowObfuscated, allowlist } = options || {};
    const scan = scanSource(source);

    if (!scan.obfuscated) return Object.assign({ allowed: true }, scan);

    const allowList = Array.isArray(allowlist) ? allowlist.map((item) => String(item).toLowerCase()) : [];
    const key = String(name || "").toLowerCase();
    if (allowObfuscated === true || (key && allowList.includes(key))) {
        return Object.assign({ allowed: true, optedIn: true }, scan);
    }

    return Object.assign({ allowed: false }, scan);
}

module.exports = { scanSource, checkModuleSource };
