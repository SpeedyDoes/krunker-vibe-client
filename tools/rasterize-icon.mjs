// Renders src/assets/logo.svg to src/assets/icon.png (512x512).
// @resvg/resvg-js is intentionally NOT a project dependency. Install it temporarily first:
//   npm i --no-save @resvg/resvg-js
// then run: node tools/rasterize-icon.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url);
const { Resvg } = createRequire(new URL('package.json', root))('@resvg/resvg-js');
const svg = readFileSync(new URL('src/assets/logo.svg', root));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
writeFileSync(new URL('src/assets/icon.png', root), png);
console.log(`wrote src/assets/icon.png (${png.length} bytes)`);
