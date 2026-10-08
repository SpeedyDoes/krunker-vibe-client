// Usage: node tools/find-in-scripts.mjs <port> <needle> [context=300]
// Reloads the page, then searches every parsed script (via the Debugger) for <needle> and prints context.
import { connect } from './lib/cdp.mjs';

const [port, needle, ctx = '300'] = process.argv.slice(2);
if (!port || !needle) { console.error('usage: find-in-scripts.mjs <port> <needle> [context]'); process.exit(2); }
const c = await connect(port);
const scripts = [];
c.on((method, p) => { if (method === 'Debugger.scriptParsed') scripts.push(p); });
await c.send('Debugger.enable');
await c.send('Debugger.setSkipAllPauses', { skip: true }); // a `debugger;` statement must not freeze the page
await c.send('Page.reload');
await new Promise((r) => setTimeout(r, 20000));
console.log('scripts parsed:', scripts.length);
const q = needle.toLowerCase();
const n = Number(ctx);
for (const s of scripts) {
  let hits, src;
  try {
    hits = (await c.send('Debugger.searchInContent', { scriptId: s.scriptId, query: needle, caseSensitive: false })).result;
    if (!hits.length) continue;
    src = (await c.send('Debugger.getScriptSource', { scriptId: s.scriptId })).scriptSource;
  } catch { continue; } // script was garbage collected (e.g. after a navigation)
  console.log(`\n=== ${s.url || '(inline/eval ' + s.scriptId + ')'} len=${src.length} hits=${hits.length}`);
  const lower = src.toLowerCase();
  for (let i = -1, shown = 0; (i = lower.indexOf(q, i + 1)) !== -1 && shown < 6; shown++) {
    console.log('...' + src.slice(Math.max(0, i - n), i + n).replace(/\s+/g, ' ') + '...\n');
  }
}
c.close();
