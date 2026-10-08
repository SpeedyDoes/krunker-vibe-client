# Work log

Chronological record of work sessions: what was asked, decided, discovered and shipped.
Append a new dated section after each session (newest at the bottom).

## 2026-10-08 — Session 1 (v1.0.0 → v1.1.0)

### 1. Initial client (v1.0.0 core)
- Ask: a working, minimal, light, clean Krunker.io client; plan first, implement with Sonnet subagents,
  review with Opus subagents.
- Research: latest Electron 44.7.0 / electron-builder 26.15.3; looked at the Crankshaft client for
  conventions (FPS switches, link routing). Decided: plain CommonJS, no preload, no runtime deps.
- Built `src/main.js`: FPS switches, no app menu (Ctrl+W close risk), window-open routing, F5/F6/F11/F12,
  will-prevent-unload dialog. Reviewers: no code bugs; README Node requirement fixed to 22.12+.
- Packaged with electron-builder (NSIS), smoke-tested via `--remote-debugging-port` + `/json`.

### 2. Mouse flicks on fast movement
- Cause: Chromium pointer-lock cursor re-centring outrun by fast moves (worse with uncapped FPS).
- Fix: `RAW_INPUT` patch forcing `requestPointerLock({ unadjustedMovement: true })` with fallback.
  Verified in-page that raw lock is natively supported.

### 3. Logo, splash screen, ad blocker
- Original crosshair logo (SVG → 512 PNG via resvg), splash window until `ready-to-show`.
- Ad research: ads are AdSense via FRVR SDK → host blocklist with a webRequest URL filter (zero overhead
  for game traffic). Reviewer found the empty translucent ad frame remains → hid `#aContainer` /
  `#endAContainer` via CSS.
- Bug caught in review: blocked ad iframes fire `did-fail-load` and would drop the splash early →
  only react to main-frame failures.
- Reviewer found Krunker's "We are discontinuing this version of the Krunker Client" popup. Traced in the
  obfuscated game script to an is-electron UA check → strip `Electron/` and app tokens from the UA.

### 4. Public GitHub repo + installer release
- Repo `SpeedyDoes/krunker-vibe-client` (public), README "not affiliated", release **v1.0.0** with the
  NSIS installer; verified packaged files byte-identical to the commit and the download checksum.

### 5. Cleaner main menu + Discord presence (v1.1.0)
- Screenshot + DOM analysis of the menu → hid store promo + streams (`#tlInfHold`), signup nags,
  web-push "Notifications" opt-in (verified Web Push can't work in Electron), oversized Guide,
  Popular Now, footer links; compacted Quick Match/Ranked and grouped Host/Find/Custom into a 3-up row.
  CSS moved to `src/krunker.css`. Reviewed live (hover, 1280/1080/1440p, selector scope).
- Discord Rich Presence implemented (`src/discord.js`, no deps) using `getGameActivity()`, `#killsVal`,
  `#inGameUI`, `#menuClassIcn`; tested against a fake IPC server. Owner paused it before providing a
  Discord Application ID → shipped dormant (`DISCORD_CLIENT_ID = ''`).
- Owner reported "new UI shows, then the old UI comes back". Investigation: the dev build kept the CSS for
  60 s+; the owner's **installed** client was v1.0.0 (asar had no `krunker.css`) — the new UI they saw was
  a fullscreen test window. Fix = release v1.1.0 and update the install.
- Released **v1.1.0**; verified packaged build (menu CSS, UA, ads, raw input) and download checksum.

### 6. Project organization
- Added `CLAUDE.md`, `docs/` (ARCHITECTURE, KRUNKER-NOTES, STATUS, DEVELOPMENT, WORKLOG), `CHANGELOG.md`,
  `tools/` (CDP launch/check/screenshot/dom-dump/net-capture/find-in-scripts, icon rasterizer),
  `.gitattributes`.
