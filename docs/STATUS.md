# Project status

Last updated: 2026-10-08 — current release **v1.1.0** (Electron 44.7.0).

## Shipped
| Feature | Since | Where |
|---|---|---|
| Electron shell loading krunker.io, fullscreen start, secure defaults, no preload | 1.0.0 | `src/main.js` |
| Unlimited FPS (`disable-frame-rate-limit`, `disable-gpu-vsync`) | 1.0.0 | `src/main.js` |
| No app menu (no Ctrl+W/Ctrl+R/zoom accelerators) | 1.0.0 | `src/main.js` |
| Keybinds F5 reload, F6 new game (main window), F11 fullscreen, F12 DevTools | 1.0.0 | `setupWindow` |
| Link routing: krunker.io + scripted popups in client windows, other links in default browser | 1.0.0 | `setupWindow` |
| beforeunload Leave/Stay dialog | 1.0.0 | `setupWindow` |
| Raw mouse input (fixes flicks on fast movement) | 1.0.0 | `RAW_INPUT` |
| Original logo / app icon, splash screen | 1.0.0 | `src/assets`, `src/splash.html` |
| Ad blocker (network) + hidden empty ad frames | 1.0.0 | `AD_HOSTS`, `src/krunker.css` |
| Plain-Chrome UA (no "discontinued client" popup) | 1.0.0 | `app.userAgentFallback` |
| Cleaner main menu (promos/streams/nags/push opt-in/guide/popular/footer hidden; compact grouped play buttons) | 1.1.0 | `src/krunker.css` |

## In progress / dormant
- **Discord Rich Presence** — implemented and reviewed (`src/discord.js`, `publishPresence` /
  `updatePresence` in `main.js`), tested against a fake Discord IPC server, **never tested against real
  Discord**. Disabled because `DISCORD_CLIENT_ID` is `''`. Owner paused it (2026-10-08).
  To finish: owner creates an app at https://discord.com/developers/applications (name = text after
  "Playing"), sends the Application ID → set `DISCORD_CLIENT_ID`, run a live test with the owner's
  Discord, clear presence, add README bullet ("Discord status: current match, time left, kills and
  class (needs the Discord desktop app)"), release.
  Note: once `DISCORD_CLIENT_ID` is set, every dev/tools launch connects to the owner's real Discord
  (the IPC pipe is not profile-scoped) — do that only during the agreed live test, or keep the id empty
  while testing other changes. Offline re-test without Discord: run a fake IPC server on another pipe
  name (point a copy of `discord.js` at it via `pipePath`) that reads the handshake, replies with a
  FRAME `{ cmd: 'DISPATCH', evt: 'READY' }` and logs the SET_ACTIVITY frames it receives.

## Known limitations
- Installer is not code-signed → SmartScreen "Windows protected your PC" (More info → Run anyway).
- Rewarded-ad offers (free KR/spins for watching ads) can't play because of the ad blocker.
- Menu CSS was designed on the **signed-out** menu at 1920x1080 (also checked 1280x720, 2560x1440);
  the signed-in header hasn't been inspected.
- A faint orphan `.sidebarDivider` remains above "Store" after hiding Guide (removing it reliably would
  depend on Krunker's inline styles).
- Raw input bypasses Windows pointer speed / acceleration (in-game sensitivity may need adjusting).
- Krunker updates can rename ids/classes; broken selectors fail silently (element just reappears).
- No auto-update: users install new releases manually (the installer updates in place, keeps login).
- No LICENSE file (all rights reserved by default) — owner's decision pending.
- `npm start` and the installed app share the same profile directory.

## Backlog / ideas (not requested yet — ask before building)
- Discord presence completion (above).
- Release assets for macOS/Linux (code is cross-platform; only Windows builds/tested).
- Auto-update (electron-updater + GitHub releases) — would add a runtime dependency.
- Code signing.
