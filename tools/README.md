# Dev tools

Dev-only helpers for inspecting the running client over the Chrome DevTools Protocol. They are
not packaged (`build.files` is `src/**/*`). Node 22.12+ built-ins only, no dependencies.
Shared CDP client: `lib/cdp.mjs` (`connect`, `waitReady`, `autoAttach`).

## Safety rules

- Always use a throwaway `--user-data-dir` (`launch.mjs` does this by default). Never point at the real app profile.
- Never kill processes you did not start; the user may be running the installed client. `launch.mjs` kills only its own process tree.
- The main window opens fullscreen on the user's screen. Keep runs short.
- Never click Krunker's cookie consent and never automate gameplay.

## launch.mjs

Starts the dev app (or `--exe`) with `--remote-debugging-port` and a fresh temp profile, runs tools
against it, then kills only the tree it started. Prints the port and profile used.

```
node tools/launch.mjs --run check
node tools/launch.mjs --run check --run "screenshot out.png" --run "dom-dump #subLogoButtons 3"
node tools/launch.mjs --exe "dist/win-unpacked/Krunker Vibe Client.exe" --run check
node tools/launch.mjs --port 9333      # no --run: stays up until Ctrl+C, attach tools manually
```

Each `--run` is `"<tool name> [args]"`, split on whitespace (no quoting) — run a tool directly when a
selector or path contains spaces. The port is inserted as the first argument. Without `--port`, a
random free port in 9222–9721 is used (`--remote-debugging-port=0` is avoided: Krunker's menu never
renders with it). Each tool run times out
after 3 minutes; the auto-created profile is deleted when the launcher exits.

## check.mjs

`node tools/check.mjs <port>` prints PASS/FAIL for: menu loaded, no "Electron" in the UA, no
"discontinuing this version" popup, hidden ad wrappers, `adsbygoogle` undefined, raw-input patch,
menu declutter incl. signed-in header items (`n/a` when an element is absent or not rendered yet),
`#subLogoButtons` grid, menu layout (Class + Customize at the left middle, stat line at the bottom edge,
Customize button not covered; `n/a` off the menu), the frame-tick animation, the
banner (`#mainLogo` replaced) and version tag (`pointer-events: none`), and
`getGameActivity()` (without `user`).
Exits 1 on any FAIL.

## screenshot.mjs

`node tools/screenshot.mjs <port> out.png` saves a page screenshot.

## dom-dump.mjs

`node tools/dom-dump.mjs <port> [selector] [depth]` outlines a subtree as
`tag#id.classes [x,y wxh] "own text"`. Without a selector it lists the whole visible menu.

```
node tools/dom-dump.mjs 9222 "#menuItemContainer" 3
```

## net-capture.mjs

`node tools/net-capture.mjs <port> [seconds=20]` reloads the page and lists request hosts (main
frame, iframes, workers). Requests blocked by the ad blocker are marked `BLOCKED(n)`.

## find-in-scripts.mjs

`node tools/find-in-scripts.mjs <port> <needle> [context=300]` reloads the page and prints context
around matches in every parsed script (takes about 20 s; scripts collected by the GC are skipped).

## rasterize-icon.mjs

Renders `src/assets/logo.svg` to `src/assets/icon.png` (512x512). Install the renderer temporarily:

```
npm i --no-save @resvg/resvg-js
node tools/rasterize-icon.mjs
```
