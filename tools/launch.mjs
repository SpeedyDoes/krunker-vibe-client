// Usage: node tools/launch.mjs [--exe <path>] [--port <n>] [--profile <dir>] [--run "<tool> [args]"]...
// Launches the dev app (or --exe) with remote debugging and a throwaway profile, optionally runs
// tools against it (each --run is "<tool name> [args]"; the port is inserted as the first arg),
// then kills ONLY the process tree it started. Without --run it stays up until Ctrl+C.
// Example: node tools/launch.mjs --run check --run "screenshot out.png" --run "dom-dump #subLogoButtons 3"
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './lib/cdp.mjs';

const TOOL_TIMEOUT_MS = 180000;
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const opts = { run: [] };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--run') opts.run.push(argv[++i]);
  else if (a === '--exe' || a === '--port' || a === '--profile') opts[a.slice(2)] = argv[++i];
  else { console.error(`unknown argument: ${a}`); process.exit(2); }
}

// Never the real app profile: always a fresh directory under the OS temp dir unless one is given.
const tempProfile = !opts.profile;
const profile = tempProfile ? mkdtempSync(join(tmpdir(), 'kvc-profile-')) : resolve(opts.profile);
// A port already owned by another browser would make the tools attach to *its* krunker.io tab, so
// only use a free one. (Not --remote-debugging-port=0: Krunker's menu never renders with it.)
const port = Number(opts.port) || await freePort();
const flags = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`];

async function freePort() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = 9222 + Math.floor(Math.random() * 500);
    const free = await new Promise((done) => {
      const server = createServer().once('error', () => done(false));
      server.listen(candidate, '127.0.0.1', () => server.close(() => done(true)));
    });
    if (free) return candidate;
  }
  throw new Error('no free debugging port found');
}

let cmd, args;
if (opts.exe) {
  cmd = resolve(opts.exe);
  args = flags;
} else {
  cmd = join(root, 'node_modules', win() ? 'electron/dist/electron.exe' : '.bin/electron');
  args = ['.', ...flags];
}
function win() { return process.platform === 'win32'; }
if (!existsSync(cmd)) { console.error(`not found: ${cmd}`); process.exit(2); }

console.log(`profile: ${profile}\nlaunching: ${cmd}`);
const child = spawn(cmd, args, { cwd: root, stdio: 'ignore', detached: !win() });
let exitCode = 0;

// Kills only the tree rooted at the process we spawned, then removes an auto-created profile.
function cleanup() {
  if (child.pid && child.exitCode === null) {
    if (win()) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }
  }
  if (tempProfile) {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch { console.error(`could not remove ${profile}`); }
  }
}
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(sig, () => process.exit(130));
child.on('error', (e) => { console.error(e.message); process.exit(2); });

try {
  console.log(`port: ${port}`);
  if (!opts.run.length) {
    console.log('running; Ctrl+C to stop');
    await new Promise(() => {});
  }
  const page = await connect(port, { timeout: 60000 }); // wait for the Krunker page target
  page.close();
  for (const spec of opts.run) {
    const [tool, ...rest] = spec.trim().split(/\s+/);
    console.log(`\n--- ${tool} ${rest.join(' ')}`);
    const r = spawnSync(process.execPath, [join(root, 'tools', `${tool}.mjs`), String(port), ...rest],
      { stdio: 'inherit', timeout: TOOL_TIMEOUT_MS });
    if (r.error) console.error(`${tool}: ${r.error.message}`);
    if (r.status || r.error) exitCode = r.status || 1;
  }
} catch (e) {
  console.error(e.message);
  exitCode = 1;
}
console.log(`\nstopping pid ${child.pid}`);
process.exit(exitCode);
