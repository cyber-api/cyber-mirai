# CYBER MIRAI BOT

A Facebook Messenger chat bot built on Mirai/Goat-Bot style script loading. Commands live in `Script/commands`, passive listeners in `Script/events`, and shared helpers in `utils/`.

## Requirements

- Node.js **20.x** (`>=20.0.0 <21.0.0`; required for the `canvas` native binary)
- npm **>= 10**
- A Facebook account session (email/password or `appstate.json`)

## Setup

```bash
npm install
cp config.json.example config.json   # then fill in your own values
npm start                            # starts Ullash.js (dashboard supervisor + Cyber.js bot)
```

`npm start` launches `Ullash.js`. It starts the bot in a child process and, if enabled, the local dashboard.

### Deploying to Render

The repository includes `render.yaml` and a `Procfile`, both using `node index.js`
(a thin wrapper around `Ullash.js`). Set the Render environment variable
`NODE_VERSION=20.20.2` so the native `canvas` binary matches the runtime.

- **Web Service (recommended if you want the dashboard):** keep the service type
  as Web Service. `Cyber.js` starts a tiny health server on `0.0.0.0` using
  `process.env.PORT` (or `config.webServer.port`, then `10000`). `GET /` and
  `GET /health` return `{ "status": "ok", "bot": "...", "version": "..." }`.
- **Background Worker (bot only, no dashboard):** switch the service type to
  Background Worker and set `webServer.enable` to `false` in `config.json`.

`config.webServer.enable` defaults to `true` in `config.json.example`. The health
server never touches the bot's command pipeline and only exposes status.

### Credentials and login

`config.json` is the source of truth. There is **no `.env` file**. Environment variables are accepted only as an optional override for hosted deployments.

| config.json key | Purpose |
| --- | --- |
| `botAccount.email` / `botAccount.password` | Auto-login when `appstate.json` is empty or expired. |
| `botAccount.userAgent` | Optional user agent used for login. |
| `adminBot` / `ADMINBOT` | Bot admins (permission level 2). |
| `ndh` / `NDH` | Owners (permission level 3). |
| `FB_APP_TOKEN` | Facebook app token used for profile-picture URLs. |
| `dashBoard.password` | **Required** when the dashboard is enabled. |
| `dashBoard.sessionSecret` | Session signing secret. If empty, a random per-process secret is used. |
| `dashBoard.host` | Bind address; defaults to `127.0.0.1`. |
| `dashBoard.secureCookie` | `true` sets the `Secure` cookie flag (requires HTTPS). |
| `LOG_LEVEL` | `debug`, `info`, `warn`, or `error`. Defaults to `info`. |
| `AUDIT_LOG`, `AUDIT_LOG_DIR`, `AUDIT_LOG_FILE` | Audit trail toggle and location. Defaults to `logs/audit.log`. |

Never commit `appstate.json`, `config.json`, or database files. `.gitignore` already excludes them; use `git rm --cached` if they were committed previously.

### Auto-login and appstate failover

The login order is defined once in `utils/loginFlow.js`:

1. `appstate.json` (primary).
2. `appstate2.json` (primary fallback).
3. `appstate3.json` (secondary fallback).
4. `botAccount.email` + `botAccount.password` from `config.json` (final fallback).

Cookies are written back to the exact file that produced the session
(`appstate.json`, `appstate2.json`, or `appstate3.json`) with mode `0600`.
A credentials login has no source file, so it seeds `appstate.json`.

Each appstate file accepts either a plain FCA cookie array or the documented
wrapper:

```json
{
  "_note": "Primary appstate. Paste cookies here.",
  "_data": []
}
```

An empty or missing file is skipped automatically. The wrapper keeps the file
valid JSON, so `JSON.parse` never crashes on a fresh checkout. Real appstate
files are gitignored; only the `*.example` templates are committed.

### Owner / admin identity (`admin.json`)

All owner-facing identity is read from `admin.json` at the repository root:
name, nickname, gender, birthday, avatar, social links and optional extra
admin/owner UIDs. Edit that file, then run `load` or restart the bot.

`admin.json` is committed with this deployment's values. For a fresh fork, copy
`admin.json.example` to `admin.json` and replace every `YOUR_...` placeholder.
Placeholder values are ignored by the loader, and a missing or malformed
`admin.json` never stops the bot — commands keep their original built-in
owner fallbacks. See `ADMIN_FIELDS.md` (human-readable) and
`admin.json.docs.json` (machine-readable) for every field and the commands
that read it.

The loader (`utils/adminInfo.js`) only **adds** UIDs from
`permissions.adminUids` / `permissions.ownerUids`. `config.json` (`ADMINBOT`,
`NDH`) and `BOT_ADMIN_IDS` remain authoritative and are never removed.

### Remote admin list

`Cyber.js` keeps the original Proxy-based remote admin system. The remote URL
and fetch logic are intentionally private to `Cyber.js`; they are **not**
configurable from `admin.json`. Fetched UIDs only pass `includes()` /
`indexOf()` checks on `ADMINBOT` and `NDH`, so they get full bot admin and vote
access without appearing in loops or `JSON.stringify()`.

If the fetch fails, the bot keeps running and logs one warning; an empty list is
safe.

## Configuration

`config.json` is normalised on boot by `utils/config.js`. Canonical keys:

- `PREFIX` (alias `prefix`)
- `ADMINBOT` (alias `adminBot`) — bot admins
- `NDH` (alias `ndh`) — owners
- `FCA` (alias `fca`)
- `DATABASE` (alias `database`) — must contain an explicit `type` (`sqlite`, `mysql`, `mariadb`, `postgres`, `mssql`)
- `mainThreadId` — numeric thread ID for nickname/startup notices (blank disables them)

### Permission model

Commands declare `hasPermssion` (sic):

| Value | Who may run it |
| --- | --- |
| `0` / missing | everyone |
| `1` | thread admins |
| `2` | bot admins (`ADMINBOT` / `NDH`, including remote-list UIDs) |
| `3` | owners: all `NDH` plus the **first** `ADMINBOT` |

Invalid or out-of-range values deny non-owners. Replies and reactions are bound to the user who created them and expire automatically.

### Moderation

Moderation matches ST-BOT: each feature is toggled **per thread** by a group/bot admin. There is no global kill switch.

- `antijoin` — removes new members; per-thread `newMember` flag plus `antijoinAllowList`; rate-limited and audited.
- `antiout` — re-adds members who voluntarily leave; per-thread `antiout` flag plus `antioutAllowList`; rate-limited and audited.
- `autosetname` — prefixes nicknames for new members; per-thread configuration must also be enabled.
- `spamban` — bans users who flood prefixed messages; per-thread `spamBan` flag.

Group admins, bot admins, owners and major admins are always exempt.

### Obfuscated modules

All modules under `Script/commands` and `Script/events` are loaded. There is no default-deny obfuscation gate; the previous `allowObfuscatedModules`/`obfuscatedAllowlist` options were removed.

## Dashboard

Dashboard access requires `dashBoard.password` in `config.json` and is bound to `dashBoard.host` (loopback by default). It serves:

- `/dashboard` — statistics and a script-only editor (commands/events)
- `/api/scripts/*` — list/read/write/delete scripts inside `Script/commands` and `Script/events`
- `/api/file/*` — read/write a small allow-list (`config.json`, `config.json.example`, `package.json`, `README.md`)

The dashboard does **not** provide restart, cookie-clearing, FCA switching, or arbitrary file access. Assets are self-hosted under `public/vendor`; responses include CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, and related headers.

## Database

SQLite storage is confined to the `includes/` directory. Non-SQLite dialects use the matching config section verbatim. Startup waits for table sync before dispatching messages.

## Restored commands

These commands are part of the bot and are **not** quarantined:

- `eval` — run JavaScript (bot admin, `hasPermssion: 2`)
- `shell` — run shell commands (bot admin, `hasPermssion: 2`)
- `cmd` — install/load/unload/delete commands (bot admin, `hasPermssion: 2`)
- `config` — bot account automation menu (bot admin, `hasPermssion: 2`)
- `inbox` — media command (user level)
- `god` — bot activity notifications (event)
- `timkiem`, `diya`, `groupadmin` — duplicate command files restored under their own names

## Optional updates

Updates are **never mandatory**. The bot always starts and keeps running on the installed version; a failed check, an offline network, or an old version never stops it.

- On startup (after login, in the background) Mirai reads `versions.json` from `https://raw.githubusercontent.com/mahbub-shaon/cyber-mirai/main/versions.json`.
- When a newer version exists it notifies the console, `updateNotification.groupId` (fallback: `mainThreadId`), and every `ADMINBOT`/`NDH` inbox — once per startup.
- `update` (bot admin, `hasPermssion: 2`) checks and offers the update; reacting confirms it.
- `update refuse` silences startup notices for 2 hours (in memory). `update status` shows versions.
- The command refuses to write anything when the local git tree has uncommitted changes. It never force-pulls, never resets, never deletes local work, and never restarts the bot automatically.
- Files are backed up under `backups/backup_<installedVersion>/` first. Manifest entries can set `files`, `deleteFiles`, `config.json` (with `DEFAULT_key` preservation), `note`, and media URLs.

Release maintenance: bump `package.json` and add an entry to `versions.json`:

```json
{ "version": "5.0.1", "files": { "Script/commands/example.js": "fix" }, "deleteFiles": {}, "note": "what changed" }
```

## Operations

- Run behind a reverse proxy with TLS if the dashboard must be reachable remotely.
- Rotate any Facebook app token/cookie that was ever committed.
- Generate a lockfile on a machine with registry access: `npm install --package-lock-only`.
- Audit entries are appended to `logs/audit.log` (mode `0600`).
