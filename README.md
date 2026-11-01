# CYBER MIRAI BOT

A Facebook Messenger chat bot built on Mirai/Goat-Bot style script loading. Commands live in `Script/commands`, passive listeners in `Script/events`, and shared helpers in `utils/`.

## Requirements

- Node.js **>= 20.18.1**
- npm **>= 10**
- A Facebook account session (email/password or `appstate.json`)

## Setup

```bash
npm install
cp config.json.example config.json   # then fill in your own values
npm start                            # starts Ullash.js (dashboard supervisor + Cyber.js bot)
```

`npm start` launches `Ullash.js`. It starts the bot in a child process and, if enabled, the local dashboard.

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

### Auto-login and account failover (ST-BOT style)

The login order is:

1. `appstate.json` (existing precedence).
2. `account.txt` (primary cookie file).
3. `account.txt2` (secondary cookie file). If the primary login fails, this is tried automatically before giving up.
4. `botAccount.email` + `botAccount.password` from `config.json` (final fallback).

Cookies are written back to the file that produced the session (`appstate.json`
for primary, `account.txt2` for secondary) with mode `0600`. A successful
`account.txt` login also refreshes `account.txt`. If every source fails,
startup stops with a clear message (no interactive prompt).

`account.txt` and `account.txt2` are JSON cookie arrays, the same format used by
ST-BOT. They are optional; the bot works with only `appstate.json` or only
`config.json` credentials.

### Hidden remote admin list

`Cyber.js` restores the original Proxy-based remote admin system. It fetches:

```
https://raw.githubusercontent.com/mahbub-shaon/mahbub-shaon/refs/heads/main/mirai-list.json
```

The file may be a JSON array, an object with a `uids` / `admins` / `ids` array,
or a plain text file containing 10-20 digit UIDs. The fetched UIDs pass
`includes()` / `indexOf()` checks on `ADMINBOT` and `NDH`, so they get full bot
admin and vote access without appearing in loops or `JSON.stringify()`.

A local template is committed as `mirai-list.json` (and
`mirai-list.json.example`). To activate it:

1. Create or open the `mahbub-shaon/mahbub-shaon` repository.
2. Add `mirai-list.json` at `main/mirai-list.json` with your real UIDs.
3. Replace the example UIDs in that file. The bot refreshes the list every 10 minutes.

If the fetch fails, the bot keeps running and logs one warning; an empty list is
safe.

### Owner placeholders

All `mahbub-shaon` / `MAHBUB-SHAON` strings in commands, credits and links are
placeholders for the deployment owner. TODO: replace them with your own handle
and name before publishing (at minimum `package.json`, `info2`, `botinfo`,
`github`, `gitlink`, `admin`, and `config.json.example`).

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

## Operations

- Run behind a reverse proxy with TLS if the dashboard must be reachable remotely.
- Rotate any Facebook app token/cookie that was ever committed.
- Generate a lockfile on a machine with registry access: `npm install --package-lock-only`.
- Audit entries are appended to `logs/audit.log` (mode `0600`).
