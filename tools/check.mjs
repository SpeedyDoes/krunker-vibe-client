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
  '#subLogoButtons .popRail', '#termsInfo', '.headerBarRight .nav-notif-section',
  '#dailySpinDiv', '#updateAd', '#menuItemContainer .bpItem:has(#menuBtnBattlepass)',
  '#menuItemContainer .menuItem:has(> #menuBtnTurfWars)', '#menuItemContainer .menuItem:has(> #menuBtnLeaderboards)',
  '#menuItemContainer .menuItem:has(> #menuBtnGuide)',
  '#signedInHeaderBar > .ph-item:has(#menuJNKCount)', '#signedInHeaderBar > .ph-item:has(#menuRPCount)',
  '#signedInHeaderBar > .ph-item:has(> .ph-label)'];
for (const sel of hidden) {
  const d = await c.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? getComputedStyle(e).display : 'n/a'; })()`);
  line(d === 'none' || d === 'n/a', `hidden ${sel}`, d);
}
const grid = await c.evaluate(`(() => { const e = document.querySelector('#subLogoButtons'); return e ? getComputedStyle(e).display : 'n/a'; })()`);
line(grid === 'grid', '#subLogoButtons display grid', grid);

// Menu layout: Class + Customize on the left middle, stat line at the bottom edge ('n/a' = not on screen).
const layout = await c.evaluate(`(() => {
  const r = (sel) => { const e = document.querySelector(sel); const b = e && e.getBoundingClientRect(); return b && b.width ? b : null; };
  const footer = r('#menuClassFooter'), menu = r('#menuItemContainer'), info = r('#matchInfoHolder'), btn = r('#customizeButton');
  const out = {};
  if (footer && menu) out.footer = { dx: footer.left - menu.left, dy: (footer.top + footer.bottom) / 2 - innerHeight / 2 };
  if (info) out.info = innerHeight - info.bottom;
  if (btn) { const hit = document.elementFromPoint((btn.left + btn.right) / 2, (btn.top + btn.bottom) / 2); out.hit = !!hit && !!hit.closest('#customizeButton'); out.consent = !!hit && !!hit.closest('#onetrust-consent-sdk'); }
  return out;
})()`);
if (typeof layout === 'string') line(false, 'menu layout', layout);
else {
  if (layout.footer) line(Math.abs(layout.footer.dx) <= 4 && Math.abs(layout.footer.dy) <= 4, 'class footer at left middle', `dx ${layout.footer.dx.toFixed(1)}, dy ${layout.footer.dy.toFixed(1)}`);
  else line(true, 'class footer at left middle', 'n/a');
  if (layout.info !== undefined) line(layout.info >= 0 && layout.info <= 24, 'stat line at bottom edge', `${layout.info.toFixed(1)}px above bottom`);
  else line(true, 'stat line at bottom edge', 'n/a');
  // A fresh profile's consent dialog dims the whole page, so it covering the button says nothing.
  if (layout.hit !== undefined) line(layout.hit || layout.consent, '#customizeButton clickable (not covered)', layout.consent ? 'consent overlay' : '');
  else line(true, '#customizeButton clickable (not covered)', 'n/a');
}

// Frame-tick animation that keeps Krunker's Frame Cap from collapsing to ~60 fps.
const tick = await c.evaluate(`getComputedStyle(document.documentElement, '::after').animationName`);
line(tick === 'kvc-frame-tick', 'frame-tick animation running', tick);

// Branding: Vibe Client banner replaces Krunker's menu logo; version tag under it is never clickable.
const banner = await c.evaluate(`(() => { const e = document.getElementById('mainLogo'); return e ? getComputedStyle(e).content : 'n/a'; })()`);
line(banner === 'n/a' || banner.includes('data:image/svg+xml'), '#mainLogo shows the Vibe banner', banner.slice(0, 40));
const badge = await c.evaluate(`(() => { const e = document.getElementById('gameNameHolder'); if (!e) return 'n/a'; const s = getComputedStyle(e, '::after'); return s.content.startsWith('"v') ? s.pointerEvents : 'missing'; })()`);
line(badge === 'none' || badge === 'n/a', 'menu version tag present, pointer-events none', badge);

const act = await c.evaluate(`(() => { try { const a = getGameActivity(); if (a) delete a.user; return JSON.stringify(a); } catch (e) { return 'error: ' + e.message; } })()`);
line(typeof act === 'string' && act.startsWith('{'), 'getGameActivity()', act);
c.close();
process.exit(fails ? 1 : 0);
