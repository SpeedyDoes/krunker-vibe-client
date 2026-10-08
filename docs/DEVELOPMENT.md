# Development

## Setup
- Node.js 22.12+ (Electron 44 requirement), npm. Windows is the tested platform.
- `npm install` downloads Electron 44.7.0 (pinned) and electron-builder.
- `npm start` runs the dev app. It uses the **real** profile (`%APPDATA%\Krunker Vibe Client`, shared with
  the installed app), so you stay logged in, but don't run destructive experiments there.

## Testing
There is no unit-test suite; the app is a thin shell around a live website, so changes are verified
against the real page over the Chrome DevTools Protocol with the scripts in `tools/` (see
`tools/README.md`).

Standard check after any change:
```
node --check src/main.js && node --check src/discord.js
node tools/launch.mjs --run check --run "screenshot kvc.png"
```
`launch.mjs` uses a throwaway profile (deleted afterwards), so a fresh Krunker consent dialog appears —
leave it alone. Screenshots in the repo root are gitignored (`/*.png`).
Look at the screenshot (menu layout) and expect every `check` line to be `PASS`.

Verify the packaged app too before a release:
```
npm run dist
node tools/launch.mjs --exe "dist/win-unpacked/Krunker Vibe Client.exe" --run check
```

Safety (also in `CLAUDE.md`): never kill processes you did not start, keep fullscreen test runs short,
never click Krunker's consent dialog or automate matches.

## Common tasks
- **Hide / restyle a menu element**: find it with `node tools/launch.mjs --port 9333` +
  `node tools/dom-dump.mjs 9333 "<selector>" 3`, then add a commented rule to `src/krunker.css`.
  Use ids and readable class names only (never `svelte-xxxx`). Use `visibility: hidden !important`
  when Krunker forces `display` with `!important`. Update the table in `docs/KRUNKER-NOTES.md`.
- **Investigate Krunker behaviour** (popups, game data): `node tools/find-in-scripts.mjs <port> "<text>"`
  searches the obfuscated game script (strings appear escaped, e.g. `We\x20are`).
- **Ad blocking**: `node tools/net-capture.mjs <port> 40` lists hosts and `BLOCKED(n)` marks. Add hosts to
  `AD_HOSTS` only when they are ad-serving; record legit hosts in KRUNKER-NOTES.
- **Logo change**: edit `src/assets/logo.svg`, then `npm i --no-save @resvg/resvg-js` and
  `node tools/rasterize-icon.mjs` to regenerate `src/assets/icon.png`. `mark.svg` (tile-less mark) and
  `banner.svg` (menu banner, lettering as paths) are hand-made derivatives — update them by hand.
- **Discord presence**: set `DISCORD_CLIENT_ID` in `src/main.js` (see `docs/STATUS.md` for the remaining
  steps).

## Release process
1. Bump `version` in `package.json` (semver; minor for features, patch for fixes).
2. Update `CHANGELOG.md`, `docs/STATUS.md`, and append to `docs/WORKLOG.md`.
3. `npm run dist`, then verify the packaged build (above). Optionally confirm the asar contents:
   `node -e "console.log(require('@electron/asar').listPackage('dist/win-unpacked/resources/app.asar').join('\n'))"`.
4. Commit and push (only when the owner asks).
5. Publish (the asset name becomes `Krunker.Vibe.Client.Setup.<ver>.exe`):
   ```
   gh release create v<ver> "dist/Krunker Vibe Client Setup <ver>.exe" --target main \
     --title "Krunker Vibe Client <ver>" --notes "<changes + SHA-256>"
   ```
6. Verify the download: `curl -sL https://github.com/SpeedyDoes/krunker-vibe-client/releases/latest/download/Krunker.Vibe.Client.Setup.<ver>.exe | sha256sum`
   matches `sha256sum "dist/Krunker Vibe Client Setup <ver>.exe"`.
7. The owner's installed copy only changes when the new installer is run (close the client first).
