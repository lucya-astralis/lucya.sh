// Turns the vector logos in logos/ into trimmed alpha masks for make_decals.py.
//   node tools/laptop/rasterize_logos.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), 'logos');
const WIDTH = 2400;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });

for (const name of ['panasonic', 'letsnote']) {
  const svg = (await readFile(join(here, `${name}.svg`), 'utf8')).replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '');
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}
    svg{display:block;width:${WIDTH}px;height:auto}</style>${svg}`);
  await page.locator('svg').screenshot({ path: join(here, `${name}.mask.png`), omitBackground: true });
}

// the Proxmox sticker: the logo on a white label
await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}
  div{display:inline-block;padding:12px 18px;background:#fff;border-radius:24px}
  svg{display:block;width:1000px;height:auto}</style><div>${(await readFile(join(here, 'proxmox.svg'), 'utf8')).replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '')}</div>`);
await page.locator('div').screenshot({ path: join(here, '..', 'stickers', 'proxmox.png'), omitBackground: true });

await browser.close();
console.log('masks written');
