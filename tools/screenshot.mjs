// Usage: node tools/screenshot.mjs <port> <out.png>
// Saves a Page.captureScreenshot of the Krunker page.
import { writeFileSync } from 'node:fs';
import { connect, waitReady } from './lib/cdp.mjs';

const [port, out] = process.argv.slice(2);
if (!port || !out) { console.error('usage: screenshot.mjs <port> <out.png>'); process.exit(2); }
const c = await connect(port);
await waitReady(c);
const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(data, 'base64'));
console.log(`saved ${out}`);
c.close();
