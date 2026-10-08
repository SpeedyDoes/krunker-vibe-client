// Usage: node tools/check.mjs <port>
// One-shot health check of the client's features; prints PASS/FAIL lines, exits 1 on any FAIL.
import { connect, waitReady } from './lib/cdp.mjs';

const port = process.argv[2];
if (!port) { console.error('usage: check.mjs <port>'); process.exit(2); }
const c = await connect(port);
const ready = await waitReady(c);
let fails = 0;
const line = (ok, name, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
};

line(ready, 'menu loaded');
const ua = await c.evaluate('navigator.userAgent');
line(!/Electron/i.test(ua), 'UA has no "Electron"', ua);
// evaluate() returns an "EXCEPTION: ..." string on page errors, so boolean checks compare with === true.
line(await c.evaluate(`!document.body.innerText.includes('discontinuing this version')`) === true, 'no "discontinuing this version" popup');
const ads = await c.evaluate(`['aContainer','endAContainer'].map((id) => { const e = document.getElementById(id); return e ? id + ':' + getComputedStyle(e).visibility : id + ':absent'; })`);
line(ads.every((s) => !s.endsWith(':visible')), 'ad wrappers hidden', ads.join(', '));
line(await c.evaluate('typeof window.adsbygoogle') === 'undefined', 'window.adsbygoogle undefined');
line(await c.evaluate(`!Element.prototype.requestPointerLock.toString().includes('[native code]')`) === true, 'raw-input patch active');

// Menu declutter: these must be display:none when present ('n/a' = element absent).
const hidden = ['#tlInfHold', '#signupRewardsButton', '#signedOutHeaderBar .ph-tooltip', '#menuItemContainer .guideItem',
  '#subLogoButtons .popRail', '#termsInfo', '.headerBarRight .nav-notif-section'];
for (const sel of hidden) {
  const d = await c.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? getComputedStyle(e).display : 'n/a'; })()`);
  line(d === 'none' || d === 'n/a', `hidden ${sel}`, d);
}
const grid = await c.evaluate(`(() => { const e = document.querySelector('#subLogoButtons'); return e ? getComputedStyle(e).display : 'n/a'; })()`);
line(grid === 'grid', '#subLogoButtons display grid', grid);

const act = await c.evaluate(`(() => { try { const a = getGameActivity(); if (a) delete a.user; return JSON.stringify(a); } catch (e) { return 'error: ' + e.message; } })()`);
line(typeof act === 'string' && act.startsWith('{'), 'getGameActivity()', act);
c.close();
process.exit(fails ? 1 : 0);
