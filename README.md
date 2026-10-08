# Krunker Vibe Client

Minimal Krunker.io desktop client built on Electron. Not affiliated with Krunker or FRVR.

## Download

Windows: download `Krunker.Vibe.Client.Setup.<version>.exe` from the
[latest release](https://github.com/SpeedyDoes/krunker-vibe-client/releases/latest) and run it.
No Node.js needed.

The installer is not code-signed, so Windows SmartScreen may warn about it:
click **More info**, then **Run anyway**.

## Build from source

Requires Node.js 22.12+.

```
npm install
npm start
npm run dist
```

`npm run dist` builds a Windows installer into `dist/`. See `docs/DEVELOPMENT.md` for testing and releases, and `CHANGELOG.md` for changes.

## Keybinds

| Key | Action |
| --- | --- |
| F5 | Reload |
| F6 | New game (main window only) |
| F11 | Toggle fullscreen |
| F12 | Toggle DevTools |

## Notes

- Unlimited FPS (vsync off).
- Raw mouse input in-game (fixes flicks on fast mouse movement; bypasses Windows pointer speed and acceleration).
- krunker.io links open in a new client window; other links open in the default browser.
- Built-in ad blocker (blocks ad networks and hides the empty ad boxes; rewarded ads for in-game rewards will not play).
- Identifies as plain Chrome; Krunker shows a "discontinued client" popup to any Electron user agent.
- Cleaner main menu (hides promos, streams, sign-up nags, Battle Pass, Daily Spin and other clutter; compact play buttons).
- Vibe Client branding: banner replacing the Krunker logo on the menu, version tag, brand-coloured play buttons, loading screen, window title.
