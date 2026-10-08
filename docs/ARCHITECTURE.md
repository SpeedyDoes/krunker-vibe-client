# Architecture

Everything runs in Electron's **main process**. Krunker itself is loaded unmodified from
`https://krunker.io/` in a normal sandboxed `BrowserWindow` (Electron's secure defaults:
`contextIsolation`, `sandbox`, no `nodeIntegration`, **no preload**). Page tweaks are applied from
the main process with `webContents.insertCSS` / `executeJavaScript` on `dom-ready`.

## Files
| File | Role |
|---|---|
| `src/main.js` | The whole app: switches, UA fix, ad blocker, windows, keybinds, page tweaks, presence wiring. |
| `src/krunker.css` | CSS inserted into krunker.io pages: menu declutter (signed-out + signed-in), hidden ad wrappers, branding (banner replacing `#mainLogo`, version tag, accents, loading screen). |
| `src/discord.js` | Dependency-free Discord IPC client (Rich Presence). Dormant until `DISCORD_CLIENT_ID` is set. |
| `src/splash.html` | Static splash page (no JS, strict CSP) shown while Krunker loads. |
| `src/assets/logo.svg` | Logo source of truth (original artwork). |
| `src/assets/icon.png` | 512x512 render of the logo: window icon + electron-builder icon (converted to .ico). |
| `src/assets/mark.svg` | The logo mark without its dark tile, used inside Krunker's page (loading screen). |
| `src/assets/banner.svg` | "ViBE CLIENT" banner (all lettering as paths — SVG-as-image can't load fonts) shown instead of Krunker's menu logo. |
| `tools/` | Dev-only CDP scripts (never packaged; `build.files` is `src/**/*`). See `tools/README.md`. |
| `package.json` | Scripts and electron-builder config (`win.target: nsis`, `icon`, output `dist/`). |

## Startup sequence (`src/main.js`)
Top level, before `ready`:
1. `app.userAgentFallback` — strips the `<AppName>/<ver>` and `Electron/<ver>` tokens so the UA is
   plain Chrome (see KRUNKER-NOTES: "discontinued client" popup). Applies to every window/request.
2. Chromium switches `disable-frame-rate-limit` + `disable-gpu-vsync` (unlimited FPS — an owner requirement; see KRUNKER-NOTES for its known side effect).
3. `Menu.setApplicationMenu(null)` — removes the default menu and its accelerators (Ctrl+W would close
   the game while crouch-walking; Ctrl+R, zoom, Alt menu).
4. `app.on('browser-window-created', (_event, win) => setupWindow(win))` — every window (splash, main, popups) gets the same
   handlers. Fires synchronously inside the `BrowserWindow` constructor.

In `whenReady`:
1. Ad blocker: one `session.defaultSession.webRequest.onBeforeRequest` with a URL filter built from
   `AD_HOSTS` (`*://*.host/*` also matches the bare host). Only ad requests ever reach the listener,
   so game traffic has zero main-process overhead. All windows share the default session.
2. Splash window (480x270 frameless, `#111118`), loads `splash.html`.
3. Main window: `fullscreen: true, show: false`, title "Krunker Vibe Client" (page title changes are prevented via `page-title-updated`), black background, icon.
4. `showMain()` (idempotent): show main, then destroy splash. Triggered by `ready-to-show` or a
   **main-frame** `did-fail-load` (offline start). Closing the splash before that quits the app.
5. `mainWindow.loadURL(GAME_URL)`.
6. If `DISCORD_CLIENT_ID` is set: `setInterval(updatePresence, 15000).unref()`.

## `setupWindow(win)` (every window)
- **Window open handler**: krunker.io URLs and scripted popups (`disposition === 'new-window'`, e.g.
  payment/auth that need `window.opener`) open as client windows (1280x720); other http(s) links go to
  the default browser via `shell.openExternal`; everything else is denied.
- **Keybinds** (`before-input-event`, keyDown only, `preventDefault` only for handled keys, actions
  skipped on auto-repeat): F5 reload, F6 `loadURL(GAME_URL)` (main window only — checked at key-press
  time because `mainWindow` is assigned after the constructor fires `browser-window-created`),
  F11 fullscreen toggle, F12 DevTools.
- **`dom-ready` on krunker.io pages**: `executeJavaScript(RAW_INPUT)` (pointer-lock raw input patch)
  and `insertCSS(KRUNKER_CSS)`. Both are per document and re-applied on every load (F5/F6). Krunker's
  `?game=` URL change is a same-document navigation, so the CSS persists. `KRUNKER_CSS` is
  `src/krunker.css` prefixed with `:root { --kvc-logo: url("data:image/svg+xml;base64,<mark.svg>");
  --kvc-banner: url("data:image/svg+xml;base64,<banner.svg>"); --kvc-version: "v<app version>"; }`
  (built by `svgUri()`) — the page can't load local files, so the branding rules get the logo mark,
  banner and version through these variables.
- **`will-prevent-unload`**: Electron silently cancels close/reload when a page's `beforeunload` objects;
  a Leave/Stay dialog restores browser behaviour.

## Raw input patch (`RAW_INPUT`)
Wraps `Element.prototype.requestPointerLock` to pass `{ unadjustedMovement: true }`, falling back to
the original options on `NotSupportedError`. Fixes random camera flicks on fast mouse movement.

## Discord Rich Presence (dormant)
- `READ_ACTIVITY` (page-side string) returns `{ id, time, class: { name }, map, mode, kills, playing,
  classIcon }` or `null` — never the username.
- `publishPresence(info)` builds `details: "<mode> on <map>"`, `state: "1 kill" | "<n> kills" | "In menu"`,
  `timestamps: { end }` when `time > 0` else `{ start }` (per match id), `assets` (logo via the public
  raw GitHub URL + class weapon art). Sends only on real change or > 5 s end drift (Discord allows
  5 updates / 20 s). Clears presence when there is no activity / not on krunker.io.
- `src/discord.js`: tries `discord-ipc-0..9` (Windows named pipe / `$XDG_RUNTIME_DIR|TMPDIR|…`),
  8-byte frame header (int32LE op + length) + JSON, handshake `{ v: 1, client_id }`, waits for
  `READY`, answers PING with PONG, one unref'd 15 s retry timer, swallows all errors, no logging.
  Presence clears automatically when the process exits (socket closes).

## Build / packaging
`electron-builder` (NSIS one-click, per-user install to `%LOCALAPPDATA%\Programs\krunker-vibe-client`).
Files are packed into `resources/app.asar`; `__dirname`-relative reads (`krunker.css`, `splash.html`,
`icon.png`) work inside asar. The installer is unsigned (SmartScreen warning).
