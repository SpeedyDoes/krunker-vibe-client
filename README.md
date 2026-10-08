# Krunker Vibe Client

Minimal Krunker.io desktop client built on Electron. Not affiliated with Krunker or FRVR.

## Requirements

Node.js 22.12+.

## Usage

```
npm install
npm start
npm run dist
```

`npm run dist` builds a Windows installer into `dist/`.

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
