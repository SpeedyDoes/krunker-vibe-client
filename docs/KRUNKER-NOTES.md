# Krunker & Electron notes (discovered facts)

Facts verified while building this client, with how they were found. Krunker changes often —
re-verify with the tools in `tools/` before relying on a selector or behaviour. Dates are when the
fact was last confirmed. Krunker web build seen: app_version 7.2.5 (Oct 2026).

## Krunker page structure
- `krunker.io` HTML is small; the game is a ~10 MB obfuscated script loaded at runtime (identifiers like
  `iîÎìiíï`, strings behind a decoder function). Search it with `tools/find-in-scripts.mjs`, not by
  downloading files. Menu UI is built with **Svelte**: classes like `svelte-1ymgnd6` are build hashes and
  change between releases — **never use them in selectors**; use ids and the readable class names.
- Load timeline (fresh profile): DOMContentLoaded ≈ 1.9 s, menu elements appear ≈ 6 s, at which point
  Krunker does a **same-document** navigation to `/?game=<REGION>:<id>` (pushState, not a reload).
  `dom-ready` therefore fires before the menu exists; global CSS inserted then still applies.
- Menu UI is scaled uniformly (`#uiBase`): ≈ 0.87 at 1920x1080, 0.58 at 1280x720, 1.16 at 2560x1440.
  CSS px in rules are pre-scale (a 302 px wide card renders 262 px at 1080p).
- `#uiBase` has class `onMenu` on the menu; `#inGameUI` is `display: none` on the menu and visible in game.
- A fresh profile shows a OneTrust/CookiePro consent dialog over the menu centre.

### Menu elements (signed-out, Oct 2026)
| Element | Selector | Notes |
|---|---|---|
| Store promo bundle + Twitch "Live Streams" panel | `#tlInfHold` (`#topLeftAdHolder`, `.streams-overlay`) | right column |
| Login or Register | `#signedOutHeaderBar .ph-login-wrap` | |
| "Get Signup Rewards" | `#signupRewardsButton` (+ `#signedOutHeaderBar .verticalSeparator`) | |
| "Register now to unlock…" banner | `#signedOutHeaderBar .ph-tooltip` | |
| Notifications (web push opt-in) | `.headerBarRight .nav-notif-section` (`.webpush-container`) | see Electron notes |
| Settings / More Krunker | `.headerBarRight .nav-item` | no ids |
| Left menu | `#menuItemContainer` → `.guideItem`, `#menuBtnShop`, `#menuBtnChall`, `#menuBtnSocial`, `#menuBtnSideCommunity` | hidden-by-default items: `#updateAd` (What's New), Turf Wars, Market, Skin Manager, Leaderboards, `#clientExit` |
| Play buttons | `#subLogoButtons > .actionCard`: `#menuBtnQuickMatch` (`.featured`), `#menuBtnRanked` (`.menuItemRankedLabel` "2x KR"), `#menuBtnHost`, `#menuBtnBrowser`, `#menuBtnCustomGames` | `#subLogoButtons` is `position:absolute; right:21px; bottom:80px; display:flex column`; Krunker sets `.cardLabel` size with a higher-specificity rule (`#subLogoButtons > .actionCard .cardLabel`) |
| Popular Now rail | `#subLogoButtons .popRail` | first child of `#subLogoButtons` |
| Now Playing bar | `#matchInfoHolder` (child of `#subLogoButtons` but `position: fixed`) | map, region, Invite/Join, ping |
| Footer links | `#termsInfo` (Contact / Terms / Changelog) | |
| Class + Customize | `#menuClassContainer`, `#menuClassName`, `#menuClassIcn`, `#customizeButton` | |
| Ad slots | `#aHolder > #aMerger > #aContainer > #krunker-io_728x90`; end screen `.endAHolder > #endAContainer` (id used twice) | `#aContainer` has `display:inline-block!important`, translucent bg, min-height → hide with `visibility` |
- Signed-in header has not been inspected (no test account) — `#signedOutHeaderBar` rules simply don't
  match there.

## Game data (for Discord presence or overlays)
- `window.getGameActivity()` → `{ id: 'FRA:hk08a', time: 188, user: 'Guest', class: { name: 'Triggerman',
  index: 0 }, map: 'Subzero', mode: 'Team Deathmatch', custom: false }`. `time` = whole seconds left,
  counts down live; available on the menu too (you are always attached to a lobby match).
  `user` is the player name — don't send it anywhere.
- Kills: `#killsVal` (in `#killCount`); also `#streakVal`, `#myScoreVal`, `#killFeed`.
- Class icons: `https://assets.krunker.io/textures/classes/icon_<index>.png` exist for 0–15 but are
  **8x8 px** (useless for Discord). `#menuClassIcn.src` is the class's **256x256 weapon art**
  (`https://assets.krunker.io/textures/previews/weapons/weapon_<n>.png?build=…`; strip the query).

## Ads
- Ads are Google **AdSense via the FRVR SDK** (`window.FRVR.config.ads.providers`: `adsbygoogle` banners
  into `#krunker-io_*` divs, `adsbygoogle-interstitial`, `adsbygoogle-reward`). Scripts:
  `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`, pings to `stats.g.doubleclick.net`.
  `fundingchoicesmessages.google.com` = Google's ad-block-recovery messaging.
- Krunker disables ads itself when `canShowAds` is false (MS Store PWA, Steam UA `io.krunker.steam`,
  Epic). Do **not** spoof those platforms — block hosts instead.
- Blocking the hosts in `AD_HOSTS` breaks nothing observed (login, matchmaking, store, streams, consent
  all load). Rewarded-ad offers can't play. No ad-block nag appeared.
- Legit third parties Krunker loads (must stay unblocked): cookie-cdn.cookiepro.com, googletagmanager /
  google-analytics, apis.google.com, twitter widgets, unpkg.com (web3), *.frvr.com, xsolla/stripe
  (payments), challenges.cloudflare.com, static-cdn.jtvnw.net, connect.facebook.net.

## "Discontinued client" popup
- Krunker's game script runs the classic **is-electron** check (renderer `process.type`,
  `process.versions.electron`, or `navigator.userAgent` containing `Electron`). With a sandboxed renderer
  only the UA check can match. If it matches (and not Steam/flag), it shows "We are discontinuing this
  version of the Krunker Client…" with links to `client2.krunker.io/setup.exe`. Also shown when
  `window.utilities` exists (old idkr client).
- Fix: remove `Electron/x` (and the app token) from `app.userAgentFallback`. Found with
  `tools/find-in-scripts.mjs <port> "We\x20are\x20discontinuing"` then reading the caller.

## Input
- Mouse flicks on fast movement: Chromium's default pointer lock re-centres the OS cursor; fast moves
  outrun it (worse with uncapped FPS keeping the main thread busy). `requestPointerLock({
  unadjustedMovement: true })` uses raw input — supported natively on Windows in Electron 44.
  Side effect: bypasses Windows pointer speed / "Enhance pointer precision".
- Krunker uses no F-keys, so F5/F6/F11/F12 are safe to intercept. Esc exits pointer lock (menu).

## Electron 44 gotchas
- Default app menu has accelerators (Ctrl+W close, Ctrl+R reload, zoom) → `Menu.setApplicationMenu(null)`.
- `browser-window-created` fires **synchronously inside the constructor**, before `new BrowserWindow`
  returns — compare against `mainWindow` lazily.
- `browser-window-created` also fires for windows created by `setWindowOpenHandler` → `action: 'allow'`.
- `will-prevent-unload`: without a handler, a page's `beforeunload` silently blocks close/reload.
  `event.preventDefault()` = proceed with unload.
- `did-fail-load` also fires for sub-frames (e.g. blocked ad iframes, `ERR_BLOCKED_BY_CLIENT`) — check
  `isMainFrame` (5th arg).
- `show: false` + `fullscreen: true` works: window stays hidden, then shows fullscreen.
- webRequest URL filter `*://*.example.com/*` matches the bare host and subdomains, not lookalikes
  (`notexample.com`, `example.com.evil.com`). Blocked requests fail with `net::ERR_BLOCKED_BY_CLIENT`.
- Web Push doesn't work: `pushManager.subscribe` rejects "AbortError: Registration failed - push service
  not available" (no push service), even though `PushManager` exists and `Notification.permission` is
  auto-granted. Krunker's "Notifications" header control is only this opt-in → hidden.
- Electron has no popup blocker: `window.open` without a user gesture still reaches the handler.
- `webContents.capturePage()` in a throwaway Electron script may need `app.disableHardwareAcceleration()`.
- `insertCSS` / `executeJavaScript` return Promises (add `.catch`); inserted CSS is per document.
- Electron 44 requires Node ≥ 22.12 (engines field of `electron` / `@electron/get`).

## Discord
- RPC over IPC accepts external `https://` URLs for `large_image` / `small_image` (≤ 256 chars).
- Text fields (details/state/large_text/small_text) must be 2–128 chars; timestamps are integer ms.
- Rate limit: 5 SET_ACTIVITY per 20 s. Presence clears when the IPC socket closes (app exit).
- The Discord application (name shown as "Playing …") must be created by the owner in the Discord
  Developer Portal; only its public Application ID goes in `DISCORD_CLIENT_ID`.

## Tooling gotchas
- With `--remote-debugging-port=0` (Chromium picks the port) Krunker's menu **never renders**
  (`getGameActivity` exists but `#menuItemContainer` doesn't appear, reproduced twice); a fixed port
  works. Cause not investigated — `tools/launch.mjs` picks a free fixed port instead.
- `@electron/asar` `extractFile` on Windows needs backslash paths for nested files
  (`path.normalize('src/assets/logo.svg')`); `listPackage` prints backslashes.
- Git on this machine has `core.autocrlf=true`; `.gitattributes` pins LF in the repo.
- GitHub release asset names replace spaces with dots: `Krunker.Vibe.Client.Setup.<ver>.exe`.
- The auto-mode permission classifier blocked a test that accepted the cookie consent and compared runs
  with/without the UA fix — don't automate consent.
