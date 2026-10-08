// Usage: node tools/dom-dump.mjs <port> [selector] [depth=4]
// Outlines a DOM subtree as: tag#id.classes [x,y wxh] "own text". Without a selector, lists every
// visible element that has an id (geometry, nesting, text), i.e. the whole visible menu.
import { connect, waitReady } from './lib/cdp.mjs';

const [port, selector, depth = '4'] = process.argv.slice(2);
if (!port) { console.error('usage: dom-dump.mjs <port> [selector] [depth]'); process.exit(2); }
const c = await connect(port);
await waitReady(c);

const subtree = `(() => {
  const root = document.querySelector(${JSON.stringify(selector || '')});
  if (!root) return 'NOT FOUND';
  const lines = [];
  const walk = (el, d) => {
    if (d > ${Number(depth)}) return;
    const r = el.getBoundingClientRect();
    const cls = typeof el.className === 'string' ? el.className.trim() : '';
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 40);
    lines.push('  '.repeat(d) + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls.split(/\\s+/).join('.') : '') +
      ' [' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ']' + (own ? ' "' + own + '"' : ''));
    for (const ch of el.children) walk(ch, d + 1);
  };
  walk(root, 0);
  return lines.join('\\n');
})()`;

const menu = `(() => {
  const rows = [];
  const off = (s) => s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0;
  for (const el of document.querySelectorAll('[id]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 12 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    if (off(getComputedStyle(el))) continue;
    let depth = 0, hidden = false;
    for (let p = el.parentElement; p; p = p.parentElement) { depth++; if (off(getComputedStyle(p))) { hidden = true; break; } }
    if (hidden) continue;
    const cls = typeof el.className === 'string' ? el.className.slice(0, 40).trim() : '';
    rows.push('  '.repeat(Math.min(depth, 12)) + el.tagName.toLowerCase() + '#' + el.id + (cls ? '.' + cls.split(/\\s+/).join('.') : '') +
      ' [' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + '] "' +
      (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60) + '"');
  }
  return rows.join('\\n');
})()`;

console.log(await c.evaluate(selector ? subtree : menu));
c.close();
