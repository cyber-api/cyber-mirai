# v5.1.0 — Cleanup & Text Fixes

## Version
- Previous: 5.0.0
- New: 5.1.0

## Deleted Commands (66 total)

### Obfuscated (34)
- autoseen.js — obfuscated, no source available
- allah.js — obfuscated
- bf.js — obfuscated
- date.js — obfuscated
- date2.js — obfuscated
- decode.js — obfuscated
- fyoutoo.js — obfuscated
- inbox.js — obfuscated (eval-packed)
- listbanbybot.js — obfuscated
- lyrics.js — obfuscated
- meno.js — obfuscated
- moon.js — obfuscated
- nastik.js — obfuscated
- repository.js — obfuscated
- rules.js — obfuscated
- stalk.js — obfuscated
- tictactoe.js — obfuscated
- x.js — obfuscated
- 4k.js — obfuscated
- approve.js — obfuscated
- autoban.js — obfuscated
- botinfo.js — obfuscated
- crush.js — obfuscated
- flop.js — obfuscated
- gitlink.js — obfuscated
- give.js — obfuscated
- hack.js — obfuscated
- hot.js — obfuscated
- hug.js — obfuscated
- islamick.js — obfuscated
- kiss.js — obfuscated
- mp3.js — obfuscated
- namaz-time.js — obfuscated
- prefix.js — obfuscated

### Unused / Redundant (32)
- Work-beta.js — beta variant of Work
- artifay.js — unused fun command
- automention.js — unused
- autoreact.js — unused
- birthday.js — personal event, not bot feature
- bro.js — duplicate of hugv2/hugv3
- by.js — unused
- choose.js — unused fun
- download.js — superseded by sendfile.js
- delmsg.js — superseded by unsend.js
- fact.js — unused fun
- fact2.js — unused fun
- filter.js — unused
- fire.js — unused fun
- fish.js — unused fun
- giveaway.js — unused
- hi.js — duplicate greeting
- ip.js — duplicate of ip2.js
- mlstalk.js — unused
- mycoins.js — unused
- nhentai.js — NSFW content
- night.js — unused
- penis.js — immature content
- petmonsters.js — unused game
- pooh.js — unused fun
- rainbow.js — unused
- randomicon.js — unused
- steal.js — unused
- stt.js — unused speech-to-text
- tile.js — unused
- war.js — unused fun
- wednesday.js — unused fun

## Text Fixes
- `Script/commands/help.js` — closed every box separator (`├──────•◈•──────┤`), added explicit `Command:`, `Description:`, `Category:`, `Permission:`, `Cooldown:`, `Usage:`, `Aliases:`, `Credits:` labels, expanded the Mirai `{pn}` placeholder, rendered object `usages` safely instead of `[object Object]`, kept multi-line usages inside the box, unified permission labels to `User` / `Group admin` / `Bot admin`.
- `Script/commands/helpall.js` — replaced `|` with `│` inside the box, renamed `Waiting time` to `Cooldown`, expanded `{pn}`, handled object `usages`, unified permission labels, replaced the leftover `ISLAMICK CHAT` header with `CYBER BOT`.
- `Script/commands/menu.js` — renamed labels to canonical `ᴅᴇsᴄʀɪᴘᴛɪᴏɴ`, `ᴜsᴀɢᴇ`, `ᴄᴏᴏʟᴅᴏᴡɴ`, `ᴘᴇʀᴍɪssɪᴏɴ`, expanded `{pn}`, handled object `usages`, capitalized `Message by number`, replaced the stale `ISLAMICK CHAT` menu title.
- `Script/commands/sendnoti.js` — fixed double-encoded mojibake in the Vietnamese `sendSuccess` / `sendFail` strings.
- `Script/commands/tag.js` — replaced the empty `sendMessage("")` fallback with a readable `❌ Could not find that user.` message.
- `Script/commands/imgur.js` — removed the stray quotes/comma around the returned upload link (`"url",` → `url`).
- `Script/commands/bot.js` — removed the dead `mess = "{name}"` placeholder assignment (it also leaked a global).
- `Script/commands/info.js` — removed a stale, unused Vietnamese profanity array that also referenced the deleted `birthday` command.
- `README.md` — dropped the deleted `inbox` entry and updated the manifest example to `5.1.0`.
- `admin.json.docs.json` — removed references to the deleted `autoban.js` and `birthday.js`.
- `tests/help.test.js` — updated assertions to the new labelled help output.
- `tests/credentials.test.js` — replaced the deleted `birthday.js` token test with a guard that all 66 removed files stay removed.
- Total files with text fixes: 8 command files (+ 4 docs/tests files updated).

### Issue table (severity)

| File | Line | Current text (short) | Check | Fix | Severity | Applied |
|---|---|---|---|---|---|---|
| `sendnoti.js` | 14–15 | `"ÄÃ£ gá»­i thÃ¡nh chá»‰..."` | 1 | proper Vietnamese text | critical | yes |
| `help.js` | 181/199/214 | `├────────────────` | 6 | closed separator `├──────•◈•──────┤` | high | yes |
| `help.js` | 150–158 | `│ 🔹 ${name}` (no labels) | 3 | explicit labels | high | yes |
| `help.js` | 150 | `[object Object]` for `ai.js` usages | 5 | safe object `usages` reader | high | yes |
| `help.js` | 146 | `{pn}` shown literally | 5 | expand `{pn}` | medium | yes |
| `help.js` | 156 | multi-line usage broke the box | 6 | keep newlines inside the box | medium | yes |
| `helpall.js` | 20 | `\|●𝗪𝗮𝗶𝘁𝗶𝗻𝗴 𝘁𝗶𝗺𝗲:` | 3/6 | `│●𝗖𝗼𝗼𝗹𝗱𝗼𝘄𝗻:` | high | yes |
| `helpall.js` | 20 | `{pn}` / object usages | 5 | `usageText()` helper | medium | yes |
| `menu.js` | 25–28 | `ᴅᴇsᴄʀɪʙᴇ` / `ᴜsɪɴɢ` / `ᴘᴏᴡᴇʀ` | 3 | canonical labels | medium | yes |
| `menu.js` | 26 | `{pn}` / object usages | 5 | inline expansion | medium | yes |
| `tag.js` | 30 | `api.sendMessage("", ...)` | 10 | friendly error text | high | yes |
| `imgur.js` | 22 | `` `"${img}",` `` | 10 | plain link | medium | yes |
| `bot.js` | 204 | `mess = "{name}"` | 5 | removed dead assignment | medium | yes |
| `info.js` | 49–69 | Vietnamese profanity array | 4/9 | removed (unused) | medium | yes |
| `album.js` | 6 | `// TODO: ...` | 2 | API catalogue missing | high | needs live test |
| `sing.js` | 3 | `// TODO: ...` | 2 | API catalogue missing | high | needs live test |
| `song.js` | 3 | `// TODO: ...` | 2 | API catalogue missing | high | needs live test |
| `video.js` | 4 | `// TODO: ...` | 2 | API catalogue missing | high | needs live test |
| `helpall.js` | 111 | `loidsenpaihelpapi...repl.co` | 9 | dead host | high | needs live test |
| `gpt.js` | 14 | `...codersensui.repl.co` | 9 | dead host | high | needs live test |
| `kanna.js` | 16 | `...repl.co` | 9 | dead host | medium | needs live test |
| `pinterest.js` | 19 | `...repl.co` | 9 | dead host | medium | needs live test |
| `siesta.js` | 16 | `...repl.co` | 9 | dead host | medium | needs live test |
| `virgin.js` | 16 | `...repl.co` | 9 | dead host | medium | needs live test |
| `world.js` | 39 | `...repl.co` | 9 | dead host | medium | needs live test |
| `menu.js` | 118/146 | `Math.ceil(x / 2222222222)` | 5 | placeholder page size (logic) | medium | not changed (logic) |
| `allbox.js` | 77 | `catch { console.log(e) }` | 10 | silent failure | low | listed only |
| `music.js` | 98 | `catch { console.error(...) }` | 10 | silent failure | low | listed only |
| `info.js` | 106 | `thanks for using` lowercase | 3 | cosmetic | low | listed only |

## Breaking Changes
- 66 commands removed — if you relied on any, please use the corresponding alternative listed above
- `help.js` output layout changed (fixed) — any script that parsed it may need updates
- `menu.js` detail labels changed to the canonical names

## Upgrade Steps
1. `git pull origin main`
2. `npm install` (no new deps, but ensures lockfile match)
3. Restart bot
4. Run `!help` to verify
