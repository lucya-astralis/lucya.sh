// lucya.sh curl card — Cloudflare Worker.
//
// `curl lucya.sh` (also wget / httpie / xh) gets a neofetch-style ANSI card
// instead of HTML. Everyone else is passed through to the origin untouched.
// /curl shows the card to any client (colours stripped for browsers),
// ?plain strips colours for terminals too.
//
// Live values (spec, kpis) come from the site's own data.json so the card
// never drifts from the page; FALLBACK keeps it working if that fetch fails.

const TERMINAL_UA = /^(curl|wget|httpie|xh|aria2|libfetch|fetch)\b/i;

const LOGO_VIEWBOX = [964, 543];
// same polygons as images/logo/lucya_logo.svg
const LOGO = [
  'M112,148L260,217L409.69,379.66L467.26,264.53L400,222.08L400,204.02L0,0L112,148Z',
  'M964,0L564,204.02L564,222.08L496.74,264.53L554.31,379.66L704,217L852,148L964,0Z',
  'M172.93,266.68L315.8,308.65L247.36,234.28L59.81,146.84L172.93,266.68Z',
  'M904.19,146.84L716.64,234.28L648.2,308.65L791.07,266.68L904.19,146.84Z',
  'M289.78,367.82L400.19,400.35L343.4,338.64L191.3,293.96L289.78,367.82Z',
  'M772.7,293.96L620.6,338.64L563.81,400.35L674.22,367.82L772.7,293.96Z',
  'M518,67L415,100L403,120L454,122L421,210.5L482,249L543,210.5L538,85L518,67Z',
  'M482,282L544.5,407L482,543L419.5,407L482,282Z',
];

const LINKS = [
  ['web', 'https://lucya.sh'],
  ['status', 'https://status.lucya.systems'],
  ['github', 'https://github.com/lucya-astralis'],
  ['bluesky', 'https://bsky.app/profile/lucya.systems'],
  ['x', 'https://x.com/lucya_systems'],
  ['instagram', 'https://instagram.com/lucya.systems'],
  ['steam', 'https://steamcommunity.com/id/lucya_systems/'],
];

const FALLBACK = {
  kpis: [
    { key: 'uptime', since: '2007-08-26' },
    { key: 'services', value: '15 / 15' },
    { key: 'domains', value: '21' },
  ],
  spec: [
    { k: 'DESIGNATION', v: 'LUC-Y4' },
    { k: 'OPERATING SYS', v: 'MacOS / Linux' },
    { k: 'DISTRO PREFS', v: 'Arch · Debian · Fedora' },
    { k: 'SHELL', v: 'zsh / fish' },
    { k: 'EDITOR', v: 'nano / VIM' },
  ],
};

// ---------------------------------------------------------------- colours
const CY = [91, 138, 255];
const MAG = [165, 148, 255];
const TEXT = [238, 240, 255];
const DIM = [118, 120, 148];
const OK = [61, 255, 165];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const fg = (c) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m`;
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const paint = (c, s) => fg(c) + s + RESET;

// ---------------------------------------------------------------- logo
// Rasterised once per isolate: half-block cells (▀▄█) give square pixels,
// 4×4 supersampling per pixel, then a blue → violet sweep left to right.
const LOGO_COLS = 44;

function polygons() {
  return LOGO.map((d) => {
    const n = d.match(/-?\d*\.?\d+/g).map(Number);
    const pts = [];
    for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    return pts;
  });
}

function inside(polys, x, y) {
  for (const p of polys) {
    let hit = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    if (hit) return true;
  }
  return false;
}

function renderLogo() {
  const [vw, vh] = LOGO_VIEWBOX;
  const polys = polygons();
  const scale = vw / LOGO_COLS;
  const rows = Math.ceil(vh / scale);
  const SS = 4;
  const px = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < LOGO_COLS; x++) {
      let n = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++)
          if (inside(polys, (x + (sx + 0.5) / SS) * scale, (y + (sy + 0.5) / SS) * scale)) n++;
      row.push(n / (SS * SS) >= 0.4);
    }
    px.push(row);
  }
  if (rows % 2) px.push(new Array(LOGO_COLS).fill(false));
  const lines = [];
  for (let y = 0; y < px.length; y += 2) {
    let plain = '', color = '';
    for (let x = 0; x < LOGO_COLS; x++) {
      const t = px[y][x], b = px[y + 1][x];
      const ch = t && b ? '█' : t ? '▀' : b ? '▄' : ' ';
      plain += ch;
      color += ch === ' ' ? ' ' : fg(mix(CY, MAG, x / (LOGO_COLS - 1))) + ch;
    }
    lines.push({ plain, color: color + RESET });
  }
  while (lines.length && !lines.at(-1).plain.trim()) lines.pop();
  return lines;
}

let LOGO_LINES;

// ---------------------------------------------------------------- data
const DAY = 86400000;
const daysUntil = (iso, now) => Math.max(0, Math.ceil((new Date(iso) - now) / DAY));

function yearsMonthsSince(since, now) {
  const s = new Date(since);
  let y = now.getFullYear() - s.getFullYear();
  let m = now.getMonth() - s.getMonth();
  if (now.getDate() < s.getDate()) m--;
  if (m < 0) { y--; m += 12; }
  return `${y}y ${String(m).padStart(2, '0')}m`;
}

// mirrors the JAPAN kpi in script.js: count to target, then to end, then done
function japan(k, now) {
  const toStart = daysUntil(k.target, now);
  if (toStart > 0) return `trip in ${toStart}d · ${k.target}`;
  const toEnd = k.end ? daysUntil(k.end, now) : 0;
  if (toEnd > 0) return `in japan · back in ${toEnd}d`;
  return 'trip complete';
}

async function loadData(request) {
  try {
    const r = await fetch(new URL('/data.json', request.url), { cf: { cacheTtl: 300 } });
    if (r.ok) return await r.json();
  } catch {}
  return FALLBACK;
}

// ---------------------------------------------------------------- card
function card(data, color) {
  const now = new Date();
  const kpi = Object.fromEntries((data.kpis || []).map((k) => [k.key, k]));
  const c = (col, s, bold = false) => (color ? paint(col, (bold ? BOLD : '') + s) : s);

  const info = [];
  const row = (k, v, col = TEXT) =>
    info.push(c(CY, k.toLowerCase().padEnd(14), true) + c(col, v));

  info.push(c(MAG, 'lucya', true) + c(DIM, '@') + c(CY, 'lucya.sh', true) + c(DIM, '  ルシア'));
  info.push(c(DIM, '─'.repeat(30)));
  row('ROLE', 'Sysadmin · Bavaria, DE');
  if (kpi.uptime) row('UPTIME', `${yearsMonthsSince(kpi.uptime.since, now)} (since ${kpi.uptime.since})`);
  for (const s of data.spec || []) row(s.k, s.v);
  if (kpi.services) row('WEBSERVICES', `${kpi.services.value} self-hosted`, OK);
  if (kpi.domains) row('DOMAINS', `${kpi.domains.value} registered`);
  if (kpi.japan) row('JAPAN', japan(kpi.japan, now));
  info.push('');
  info.push(
    color
      ? [CY, mix(CY, MAG, 0.33), mix(CY, MAG, 0.66), MAG, OK, TEXT, DIM]
          .map((col) => `\x1b[48;2;${col[0]};${col[1]};${col[2]}m   `).join('') + RESET
      : ''
  );

  LOGO_LINES ||= renderLogo();
  const logo = LOGO_LINES.map((l) => (color ? l.color : l.plain));
  const pad = ' '.repeat(LOGO_COLS);
  const top = Math.max(0, Math.floor((info.length - logo.length) / 2));
  const height = Math.max(info.length, logo.length + top);

  const out = [''];
  for (let i = 0; i < height; i++) {
    const l = logo[i - top] ?? pad;
    out.push(`  ${l}   ${info[i] ?? ''}`.trimEnd());
  }

  out.push('');
  out.push('  ' + c(TEXT, 'Sysadmin from Bavaria - building homelabs, reviving retro hardware,'));
  out.push('  ' + c(TEXT, 'and running more servers than one bedroom should hold.'));
  out.push('');
  for (const [k, url] of LINKS) out.push('  ' + c(MAG, '▸ ') + c(DIM, k.padEnd(11)) + c(CY, url));
  out.push('');
  out.push('  ' + c(DIM, 'open https://lucya.sh in a browser for the full experience · ?plain for no colour'));
  out.push('');
  return out.join('\n');
}

// ---------------------------------------------------------------- handler
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const isTerm = TERMINAL_UA.test(ua);
    const isRoot = url.pathname === '/' || url.pathname === '/index.html';
    const wantsCard = url.pathname === '/curl' || (isRoot && isTerm);

    if (!wantsCard || !['GET', 'HEAD'].includes(request.method)) return fetch(request);

    const color = isTerm && !url.searchParams.has('plain');
    const body = card(await loadData(request), color);
    return new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        vary: 'User-Agent',
        'x-content-type-options': 'nosniff',
      },
    });
  },
};
