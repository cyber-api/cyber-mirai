# `admin.json` field reference

`admin.json` (repository root) holds the owner / admin identity used by the
bot. `admin.json.example` is the safe template for fresh forks. Both files are
valid JSON and are read by `utils/adminInfo.js`.

- Human-readable reference: this file.
- Machine-readable reference: [`admin.json.docs.json`](admin.json.docs.json).
- Loader: `utils/adminInfo.js` (`loadAdminInfo`, `normalizeAdminInfo`, `mergeAdminUids`).
- Runtime wiring: `Cyber.js` (startup) and `Script/commands/load.js` (reload).

> The hidden remote-admin list URL is **not** an `admin.json` field. It lives
> only as a private constant inside `Cyber.js`.

## How this list was generated

The field inventory comes from grepping the code for `getAdminInfo()` usage,
then following `const info = getAdminInfo()` aliases and the loader:

```bash
# direct field access
grep -rhoE "getAdminInfo\(\)\.[A-Za-z0-9_.]+|getAdminInfo\(['\"][A-Za-z0-9_]+['\"]\)" \
  --include=*.js Script includes utils Cyber.js | sort -u

# aliases: const info = getAdminInfo(); / const ownerInfo = getAdminInfo();
grep -rn "= getAdminInfo()" --include=*.js Script includes Cyber.js

# nested field access on those aliases
grep -rnE "info\.(name|nickname|legalName|gender|relationship|age|religion|education|address|birthday|avatar\.|social\.)|ownerInfo\." \
  --include=*.js Script includes Cyber.js

# loader / permissions
grep -rn "permissions\.\|mergeAdminUids\|normalizeAdminInfo" \
  --include=*.js utils Cyber.js
```

Regenerate `admin.json.docs.json` from the same inventory whenever a command
starts or stops reading a field.

## Top-level fields

| Field | Type | Default | Used by | Purpose |
| --- | --- | --- | --- | --- |
| `_readme` | string | — | none (metadata) | Pointer to this file and the machine-readable docs. Ignored by the loader. |
| `name` | string | `""` | `Cyber.js`, `admin`, `adbot`, `allbox`, `autoban`, `birthday`, `bot`, `help`, `helpall`, `info`, `info2`, `minari` | Display name of the owner / admin. |
| `nickname` | string | `""` (falls back to `name`) | `bot`, `cbto`, `info2`, `minari` | Short name used in chat replies. |
| `legalName` | string | `""` | none currently | Reserved for future display. Stored but not rendered. |
| `gender` | string | `""` | `admin` | Owner gender line. |
| `relationship` | string | `""` | `admin` | Owner relationship line. |
| `age` | string or number | `""` | `admin` | Owner age line. Numbers are coerced to strings. |
| `religion` | string | `""` | `admin` | Owner religion line. |
| `education` | string | `""` | `admin` | Owner education line. |
| `address` | string | `""` | `admin`, `minari` | Owner location / chatbot birthplace. |
| `birthday` | string | `""` | `birthday` | Date parsable by `Date.parse`, e.g. `September 12, 2025 00:00:00`. |

## `avatar`

| Field | Type | Default | Used by | Purpose |
| --- | --- | --- | --- | --- |
| `avatar.uid` | string of 5–20 digits | `""` | `admin`, `adbot`, `birthday`, `help` | Facebook UID for the Graph profile picture. Invalid values are ignored. |
| `avatar.url` | string | `""` | `admin`, `adbot`, `birthday` | Explicit image URL. Takes precedence over `avatar.uid`. |

## `social`

| Field | Type | Default | Used by | Purpose |
| --- | --- | --- | --- | --- |
| `social.facebook` | string (URL) | `""` | `admin`, `adbot`, `bot`, `cbto`, `info`, `info2` | Facebook profile / inbox link. |
| `social.facebookUid` | string of 5–20 digits | `""` | `help` | Facebook UID used for owner mentions. Derived from `social.facebook` (`?id=...`) when omitted. |
| `social.telegram` | string (URL) | `""` | `admin`, `info2` | Telegram link. |
| `social.tiktok` | string | `""` | `admin`, `info2` | TikTok handle. |
| `social.github` | string (URL) | `""` | none currently | Reserved for future display. Stored but not rendered. |
| `social.youtube` | string (URL) | `""` | none currently | Reserved for future display. Stored but not rendered. |
| `social.whatsapp` | string | `""` | `bot`, `info` | WhatsApp number shown to users. |

## `permissions`

| Field | Type | Default | Used by | Purpose |
| --- | --- | --- | --- | --- |
| `permissions.adminUids` | array of UID strings | `[]` | `utils/adminInfo.js` → `utils/config.js` | Extra UIDs appended to `config.ADMINBOT`. Never removes IDs. |
| `permissions.ownerUids` | array of UID strings | `[]` | `utils/adminInfo.js` → `utils/config.js` | Extra UIDs appended to both `config.ADMINBOT` and `config.NDH`. Never removes IDs. |

## Validation and fallbacks

- Fields accept strings; `age` also accepts a finite number (coerced to text).
- Strings are trimmed. Placeholder-looking values (`Your ...`, `<...>`,
  `[...]`) are treated as empty.
- `avatar.uid`, `social.facebookUid` and every `permissions.*Uids` entry must be
  5–20 digits. Invalid UIDs are skipped; invalid permission entries also log a
  warning.
- `nickname` falls back to `name` when empty.
- `social.facebook` and `social.facebookUid` are kept in sync when only one is
  supplied.
- A missing or malformed `admin.json` never stops the bot. The loader returns
  empty identity values and each command keeps its own original hardcoded
  fallback (for example `Script/commands/admin.js`).
- `permissions.*` only **adds** admins. `config.json` (`ADMINBOT`, `NDH`) and
  `BOT_ADMIN_IDS` stay authoritative.
- Unknown keys (including `_readme`) are ignored by the loader, so extra
  comments in the JSON object are harmless.

## Related files

- `utils/adminInfo.js` — loader, normalization, defaults, UID merging.
- `Cyber.js` — loads identity at startup and prints the banner name.
- `Script/commands/load.js` — reloads `admin.json` without a restart.
- `admin.json` / `admin.json.example` — live values / template.
- `admin.json.docs.json` — same inventory in machine-readable form.
