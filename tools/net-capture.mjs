// Usage: node tools/net-capture.mjs <port> [seconds=20]
// Reloads the page and records request hosts across the main frame, out-of-process iframes and workers.
// Hosts with requests that failed with ERR_BLOCKED_BY_CLIENT (the ad blocker) are marked BLOCKED(n).
import { connect, autoAttach } from './lib/cdp.mjs';

const [port, seconds = '20'] = process.argv.slice(2);
if (!port) { console.error('usage: net-capture.mjs <port> [seconds]'); process.exit(2); }
const c = await connect(port);
const hosts = new Map();
const requests = new Map(); // `${session}:${requestId}` -> host
const targets = new Set();
const entry = (h) => {
  if (!hosts.has(h)) hosts.set(h, { n: 0, blocked: 0, types: new Set(), sample: '' });
  return hosts.get(h);
};

c.on((method, p, session = '') => {
  if (method === 'Network.requestWillBeSent') {
    let u;
    try { u = new URL(p.request.url); } catch { return; }
    if (!u.protocol.startsWith('http')) return;
    const e = entry(u.hostname);
    e.n++;
    e.types.add(p.type);
    e.sample ||= u.href.slice(0, 100);
    requests.set(`${session}:${p.requestId}`, u.hostname);
  } else if (method === 'Network.loadingFailed' && p.errorText === 'net::ERR_BLOCKED_BY_CLIENT') {
    const h = requests.get(`${session}:${p.requestId}`);
    if (h) entry(h).blocked++;
  }
});
await c.send('Network.enable');
await autoAttach(c, (_s, info) => targets.add(`${info.type} ${info.url}`.slice(0, 140)), ['Network.enable']);
await c.send('Page.reload', { ignoreCache: true });
await new Promise((r) => setTimeout(r, Number(seconds) * 1000));

const key = (h) => h.split('.').slice(-2).join('.');
const rows = [...hosts].sort((a, b) => key(a[0]).localeCompare(key(b[0])) || a[0].localeCompare(b[0]));
for (const [h, e] of rows) {
  console.log(String(e.n).padStart(4), h.padEnd(45), (e.blocked ? `BLOCKED(${e.blocked})` : '').padEnd(11), [...e.types].join(','), e.sample);
}
console.log('\nattached targets:');
for (const t of targets) console.log(' ', t);
c.close();
