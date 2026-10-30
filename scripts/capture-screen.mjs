// Renders the start page at 1920x1280 CSS px, 2x (the 3:2 panel) to intro/screen.webp.
//   npm run intro:capture                 serves the working tree itself
//   npm run intro:capture -- --url https://lucya.sh/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1920;
const HEIGHT = 1280;
const SCALE = 2;      // the texture is seen far closer than 1:1 at the end of the dolly
const SETTLE_MS = 2500; // panel entrance and the live cards

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.cur': 'image/x-icon',
};

function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0]));
    try {
      const body = await readFile(join(root, path === '\\' || path === '/' ? 'index.html' : path));
      res.writeHead(200, { 'content-type': MIME[extname(path) || '.html'] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// The bundled Chromium has no H.264, so the wallpaper video would stay black.
async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel }); } catch { /* try the next */ }
  }
  return chromium.launch();
}

const urlFlag = process.argv.indexOf('--url');
const server = urlFlag > -1 ? null : await serve();
const url = new URL(server ? `http://127.0.0.1:${server.address().port}/` : process.argv[urlFlag + 1]);
url.searchParams.set('intro', 'off');

const browser = await launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE });
await page.goto(url.href, { waitUntil: 'load' });
await page.locator('#splashSkip').click();
await page.waitForFunction(() => document.body.classList.contains('is-ready'));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(SETTLE_MS);
const png = await page.screenshot({ type: 'png' });

// screenshot() has no WebP, the browser's encoder does. A blank page, because
// the site's own CSP would refuse the data: URL.
const encoder = await browser.newPage();
const webp = await encoder.evaluate(async (data) => {
  const bitmap = await createImageBitmap(await (await fetch(data)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return canvas.toDataURL('image/webp', 0.9).split(',')[1];
}, `data:image/png;base64,${png.toString('base64')}`);

await writeFile(join(root, 'intro', 'screen.webp'), Buffer.from(webp, 'base64'));
await browser.close();
server?.close();
console.log(`intro/screen.webp written from ${url.href}`);
