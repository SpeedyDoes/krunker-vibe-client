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
  CSS px in rules are pre-scale (a 302 px wide card renders 262 px at 1080p). Krunker sets inline
  `transform: scale(s); width; height` on it (2210x1243.12 at 1080p), so it is the containing block for
  `position: fixed` menu elements. Krunker's sheet also gives it `position:absolute; width:100%; height:100%`, so
  `container-type: size` (size + style containment) does not change its size; it is the parent of `#inGameUI`,
  `#menuHolder`, `#chatHolder`, `#endUI` etc. (not of the OneTrust dialog) and no Krunker rule relies on counters/quotes.
- Krunker's stylesheet is applied after our `insertCSS`, so equal-specificity overrides of its rules need
  `!important`.
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
| Now Playing bar ("stat line") | `#matchInfoHolder` (child of `#subLogoButtons`) | map, region, Invite/Join, FPS, ping. Krunker CSS `position:fixed; bottom:148px; left:50%; transform:translateX(-50%)`; its containing block is the transformed `#uiBase`. Since the session-3 change: `bottom: 12px` (needs `!important`, Krunker's sheet loads after ours) |
| Footer links | `#termsInfo` (Contact / Terms / Changelog) | |
| Class + Customize | `#menuClassContainer` > `canvas#classPreviewCanvas` (3D class preview, inline 750x600, `margin-bottom:-50px`) + `#menuClassFooter` (`display:flex; width:fit-content; margin:0 auto; position:relative`) > `#menuClassContainerInner` (`#menuClassName`, `#menuClassIcn`) + `#customizeButton` | container: `position:absolute; left:50%; bottom:200px; transform:translateX(-50%) scale(0.8); transform-origin:bottom center` → a local point (x, y-from-bottom b) lands at `#uiBase` (W/2 + 0.8(x − 375), H − 200 − 0.8b). The footer is moved to the left middle with `#uiBase { container-type: size }` + `left: calc(400px - 62.5cqw); bottom: calc(62.5cqh - 250px); transform: translateY(50%)` (checked at 1920x1080, 1280x720, 2560x1080, 1920x1200). The `-62.5cqw` term assumes the container is 750 wide (shrink-to-fit; holds while `#uiBase` is ≥ 1500 wide). Taking the footer out of flow shortens the container, so the class preview sits ≈ 57 px lower at 1080p |
| Ad slots | `#aHolder > #aMerger > #aContainer > #krunker-io_728x90`; end screen `.endAHolder > #endAContainer` (id used twice) | `#aContainer` has `display:inline-block!important`, translucent bg, min-height → hide with `visibility` |
| Menu logo | `#gameNameHolder` (absolute, ~365x170, hidden by Krunker in game) > `img#mainLogo` (`height:200px; margin-top:10px; margin-bottom:-40px` → overhangs the holder by ~40 px) | since v1.2.0 swapped for our banner with `#mainLogo { content: var(--kvc-banner) }` — Chromium renders `content: url()` on an `<img>` instead of its `src` in the same box, so Krunker's seasonal logo changes don't matter; it also overrides resource-pack logos (`textures/logo.png` → `mainLogo.src`) |

### Signed-in menu (from Krunker's Svelte templates in the game script, Oct 2026)
No test account exists, so these come from the template strings (extract them by saving the game script
via CDP `Debugger.getScriptSource` and searching for the component's `svelte-xxxx` hash) and from the
owner's screenshot.
| Element | Markup |
|---|---|
| Left menu template | `#menuItemContainer`: `<!> <!> <!> <!> <div id="updateAd" style="display:none">…</div> <!>×7 <div class="sidebarDivider"></div> <!>×3`. Slots before `#updateAd`: Battle Pass (signed in), Daily Spin (signed in), a `.sidebarDivider` (signed in), Guide; first slot after it: a divider shown signed out or at level ≤ 20 |
| Battle Pass | `.menuItem.bpItem` > `img.bpLogo` + `.bpInfo` > `#menuBtnBattlepass` (+ `.bpBar`, `.bpComplete`) — signed out, Guide is also `.bpItem` (`.guideItem`); signed in (level ≤ 20 only) it is a plain `.menuItem > #menuBtnGuide` |
| Daily Spin | `#dailySpinDiv.menuItem.dsItem` (`.dsLogo`, `.dsInfo`, `.dsTooltip`, `.dsClaim`, `.dsDone`) |
| What's New | `#updateAd` (inline `display` toggled by Krunker), `#updateAdVersion` |
| Generic items | `.menuItem` > `.menuItemTitle#menuBtnX` (direct child): `menuBtnTurfWars`, `menuBtnMarket`, `menuBtnSkinManager`, `menuBtnLeaderboards`, … — hide with `.menuItem:has(> #menuBtnX)` |
| Header | `#signedInHeaderBar` children in order: `.ph-item` avatar/name/level (`.ph-avatar`, `.ph-name`, `.ph-level-badge`, `.ph-xp-bar`) · `.verticalSeparator` · `.ph-item` KR (`.ph-currency-icon` + `#menuKRCount`) · sep · `.ph-item` Junk (material icon `plumbing` = the pink "wrench", `#menuJNKCount`) · sep · `.ph-item` ranked points (icon `emoji_events` = trophy, `#menuRPCount`) · sep · `.ph-item` Wallet (icon `backpack` + `span.ph-label`, the only item with a direct `.ph-label`). Right side adds Inbox (`.nav-item` with `#mailCount`) |
| Loading screen | `#loadingBg` (empty, under overlays; gets inline `display:none` ≈ 6.5 s), spinner; `#instructionsFadeBG` is the visible backdrop that fades out |
- The owner (signed in) keeps Market & Trading; Battle Pass, Daily Spin, What's New, Turf Wars and
  Leaderboards are hidden since v1.2.0. Junk, ranked points, Wallet and the separators after KR are hidden
  since session 3 (verified on an injected replica of the header template).

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

## Freezes while shooting ("aim freeze") — solved by a working Frame Cap (v1.3.0)
- **Uncapped FPS (`disable-frame-rate-limit`) is an owner requirement — keep it.** Don't remove or cap it
  as a fix; discuss options with the owner first. Krunker's own "Aim Freeze Fix" setting caps FPS at 125
  (Steam settings guide) — the owner rejected that kind of fix.
- Owner's report (session 3): **other players freeze** (you can still look around), only **while holding
  fire**; worst at 8000 Hz but **also at 500 / 1000 Hz**. Krunker's "Raw Mouse Input" is **off**.
- Krunker's "Aim Freeze Fix" (`aimFreezeFix`): its main loop normally re-requests `requestAnimFrame`
  (= native `requestAnimationFrame`); with the setting on and fire held, every other frame goes through
  `requestAnimFrameF` = `setTimeout` paced to 16 ms — a normal-priority task that lets queued network
  tasks run, at the cost of FPS.
- **Frame Cap (`updRate`, "Frame Cap", localStorage `kro_setngss_updRate`) is a frame skipper:** each
  rAF tick returns early (re-requesting rAF) until `1000 / cap` ms have passed. With uncapped Chromium,
  ticks that draw nothing make Chromium slow its frame ticks (~110/s in the harness), so **a 400 cap
  rendered ~56 fps** (owner saw ~60). Fixed since session 3 by a 1x1 `html::after` with an infinite
  compositor opacity animation (`kvc-frame-tick`): ticks stay at full speed and the cap is exact
  (400 → 398–401 fps, 500 → 497); uncapped FPS unchanged (1355 vs 1342).
- **A working cap set below the GPU-bound maximum removes the freeze:** in the harness's GPU-bound scene
  (~650 fps uncapped, WebSocket delay up to 214 ms while firing, ~60 ms gaps even idle) a 400 or 500
  Frame Cap gave 1–3 ms. Uncapped + GPU-saturated is what starves the page. The client still never caps;
  it is the player's in-game choice. **Owner confirmed (v1.3.0 dev build, 8000 Hz): Frame Cap works and the
  freeze is gone.**
- Mechanism (Chromium 152 source, `third_party/blink/renderer/platform/scheduler/main_thread/main_thread_scheduler_impl.cc`):
  `ShouldPrioritizeInputEvent` treats mouse down / mouse moves **with the left button held** as a
  continuous gesture (100 ms window per event, `user_model.h` `kGestureEstimationLimit`) → use case
  `kMainThreadCustomInputHandling` → compositor (frame) tasks get `kHighestPriority` while main-thread
  compositing is "fast"; input tasks are always `kHighestPriority`; WebSocket / timer / postMessage tasks
  are `kNormalPriority` and there is no anti-starvation. With `disable-frame-rate-limit` a new frame is
  always due, so normal tasks can starve. No Chromium feature flag turns the boost off (checked every
  `BASE_FEATURE` in that file; `kLowerPriorityForCompositorGestures` only covers compositor-driven gestures).
  bigjakk/Electron-Websocket-Fix patches exactly this (`ComputePriority` / `ComputeCompositorPriority`).
- **Possible amplifier (untested on real hardware): the raw-input patch.** With
  `unadjustedMovement: true` Chromium reads `WM_INPUT` and turns **every mouse report** into its own mouse
  event (`ui/views/win/hwnd_message_handler.cc` `OnInputEvent`) → 8000 events/s into the renderer at 8 kHz.
  Krunker itself never asks for raw movement (it calls `requestPointerLock()` or passes
  `{ unadjustedMovement: false }`), so in Chrome the OS-coalesced `WM_MOUSEMOVE` path is used. Next step:
  the owner A/B-tests a build without `RAW_INPUT` at 8 kHz while holding fire (trade-off if confirmed: the
  flick fix and raw sensitivity — owner decides). Lower priority now: the freeze also happens at 500 Hz.
- Synthetic harness (session 3; rebuild from this description): Electron 44 app with both FPS switches, a
  1280x720 window loading a local page served by a Node server that also pushes a 16-byte WebSocket message
  every 5 ms (busy `setImmediate` loop for timing; message = seq + send time). Page: WebGL2 full-screen
  shader drawn in `requestAnimationFrame` with N ms of busy JS per frame (N = 0.4 → ~1950 fps, 2 → ~460,
  5 → ~190), `pointermove` listener, optional `pointerrawupdate` listener, a `setTimeout(…, 1)` chain as
  a timer probe; it records the largest gap/delay per phase. Main process: 3 s idle, then
  `sendInputEvent` mouseDown + mouseMove with `modifiers: ['leftButtonDown']` at R events/s for 5 s,
  then mouseUp. Results (worst WebSocket delay while held):
  - no `pointerrawupdate` listener, CPU-bound frames: 4–12 ms at every load and rate up to 8 kHz.
    Note `sendInputEvent` does not go through `WM_INPUT`, so this does not model the raw-input path above.
  - no listener, **GPU-bound** (fragment shader loop of 1500 iterations, ~575–650 fps, 1 kHz): 137–214 ms
    while held, ~60 ms gaps even idle; 600 iterations (~1350 fps): 40–59 ms. Switches tried without effect:
    `disable-main-frame-before-activation`; `disable-threaded-compositing` stops rendering entirely.
  - with a `pointerrawupdate` listener (= Krunker's Raw Mouse Input on), ~460 fps: 1 kHz 16 ms, 2 kHz
    18 ms, 4 kHz 32 ms, 8 kHz 39–53 ms and sometimes a **full 5 s stall** (no WebSocket message, no timer);
    ~190 fps: 1.2 s. Button not held: fine. Chromium posts an un-coalesced top-priority input task per
    report when a page has `pointerrawupdate` listeners (`main_thread_event_queue.cc`).
  - Session 2's harness (CDP-dispatched moves, ≈ 410 fps) also starved without a raw listener in 2 of 5 runs.
- Krunker's Raw Mouse Input (`kro_setngss_rawMouse`): `toggleMouseInputs(on)` removes its listeners and
  adds one `pointerrawupdate` listener on the game `<canvas>` (no id) when supported
  (`'onpointerrawupdate' in target && PointerEvent.prototype.getCoalescedEvents`), else its normal handler on
  two other event types. The raw handler loops over `event.getCoalescedEvents()`. Recommendation: keep it
  **off** with high polling-rate mice.
- Tried and rejected (session 3):
  - Redirecting `pointerrawupdate` listeners to `pointermove` (frame-aligned, same coalesced samples): fixed
    the raw case in the harness with no FPS cost, **but patching `EventTarget.prototype.addEventListener`
    on dom-ready stops Krunker's menu from ever building** (4 of 4 runs; early injection via CDP
    `Page.addScriptToEvaluateOnNewDocument` loads). Krunker apparently checks that function (anti-tamper)
    → ban risk; the owner declined. Also moot: the owner has Raw Mouse Input off.
  - Requesting each frame from a normal-priority task (MessageChannel hop before `requestAnimationFrame`):
    no starvation but **halves FPS while firing**. An adaptive version (hop only after 8 ms without a
    normal task) cost ~6 % FPS at high frame rates and wraps `requestAnimationFrame` (same tamper risk).
  - WebSocket in a Worker + SharedArrayBuffer ring drained at the start of each frame: WebSocket delay stayed
    ≤ 9 ms, but needs `--enable-features=SharedArrayBuffer` process-wide and replacing `window.WebSocket`.
  - Remaining non-FPS options: a patched Electron (bigjakk/Electron-Websocket-Fix, third-party binaries).
- Krunker's Experimental settings (Settings → Experimental): `rawMouse` "Raw Mouse Input", `aimFreezeFix`
  "Aim Freeze Fix" ("Possible fix for jittery/freezing aiming"), `flickClamp` "Mouse Flick Fix" (default 200),
  `mouseAccel`. Settings persist in localStorage as `kro_setngss_<key>` (absent until changed).

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
- Many test launches in a short time trigger Krunker's Cloudflare "Verify you are human" challenge
  (and once "Connection limited"); it clears on its own. Don't click it from automation — pause testing.
- An SVG used as an image (data URI in CSS) can't load fonts — draw all lettering as paths.
- With `--remote-debugging-port=0` (Chromium picks the port) Krunker's menu **never renders**
  (`getGameActivity` exists but `#menuItemContainer` doesn't appear, reproduced twice); a fixed port
  works. Cause not investigated — `tools/launch.mjs` picks a free fixed port instead.
- `@electron/asar` `extractFile` on Windows needs backslash paths for nested files
  (`path.normalize('src/assets/logo.svg')`); `listPackage` prints backslashes.
- Git on this machine has `core.autocrlf=true`; `.gitattributes` pins LF in the repo.
- GitHub release asset names replace spaces with dots: `Krunker.Vibe.Client.Setup.<ver>.exe`.
- The auto-mode permission classifier blocked a test that accepted the cookie consent and compared runs
  with/without the UA fix — don't automate consent.
