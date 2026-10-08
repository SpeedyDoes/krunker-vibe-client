# Krunker Vibe Client — project guide

Minimal Electron desktop client for https://krunker.io. Public repo:
https://github.com/SpeedyDoes/krunker-vibe-client (releases ship a Windows NSIS installer).

Read before working:
- `docs/STATUS.md` — what works, what is unfinished, known limitations, backlog.
- `docs/ARCHITECTURE.md` — how the code is put together (main process only: `main.js` + `discord.js`, no preload).
- `docs/KRUNKER-NOTES.md` — hard-won facts about Krunker's page and Electron gotchas. Check here
  before investigating anything about Krunker's DOM, ads, popups, game data or input.
- `docs/DEVELOPMENT.md` — running, testing with the tools in `tools/`, releasing.
- `docs/WORKLOG.md` — chronological log of what was done and why. Append to it after each work session.
- `CHANGELOG.md` — user-facing changes per release.

## Principles (from the owner)
- Minimal, light, clean. Implement exactly what is asked; no extra features, settings, or dependencies.
  The app has **no runtime dependencies** and only `electron` + `electron-builder` as dev dependencies.
- Plain CommonJS JavaScript in `src/`, no build step, no TypeScript, no bundler, no preload script.
  Style: 2-space indent, single quotes, semicolons, short comments only for non-obvious "why".
- Stay inside this project folder; never touch sibling projects.
- Workflow the owner asked for on larger tasks: write a plan first, implement with Sonnet subagents,
  then have Opus reviewer subagents check the code against the plan, then finalize. Small fixes can be
  done directly.
- Commit / push / publish releases only when the owner asks. End commit messages with the
  `Co-Authored-By` line given by the harness.

## Safety rules when testing
- The owner usually has the **installed** client running (`%LOCALAPPDATA%\Programs\krunker-vibe-client`)
  and Discord open. Never kill processes you did not start; kill only your own PID tree.
- Always launch test instances with a throwaway `--user-data-dir` (`node tools/launch.mjs` does this).
  `npm start` and the installed app share the real profile (`%APPDATA%\Krunker Vibe Client`).
- The main window opens **fullscreen on the owner's screen** — keep live tests short.
- Never click/accept Krunker's cookie consent or automate joining/playing matches in tests.
- Don't connect to the real Discord IPC pipe in tests unless the owner asked for a live presence test.

## Commands
```
npm install           # Node 22.12+ (Electron 44 requirement)
npm start             # dev run (uses the real profile)
npm run dist          # Windows installer -> dist/Krunker Vibe Client Setup <version>.exe
node --check src/main.js && node --check src/discord.js
node tools/launch.mjs --run check   # throwaway-profile launch + feature health check
```
