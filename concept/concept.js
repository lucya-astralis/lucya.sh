import { rackData } from '../js/systems-data.js?v=20261102-fetch';
import { initSystems } from '../js/systems.js?v=20261102-lamps';
import { initWeather } from '../js/weather.js?v=20261102-sky';
import { initSpotify } from '../js/spotify.js?v=20261102-classic';
import { initShelves } from '../js/shelves.js?v=20261102-media';
import { shelves } from '../js/media-data.js?v=20261102-media';
import { createScrambler } from '../js/text-scramble.js';
import { buttons, friends } from './buttons.js';
import { seasons } from './seasons.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const boot = document.getElementById('boot');
// their place in a set, for entries that arrive one after another
const number = (els) => els.forEach((el, i) => el.style.setProperty('--i', i));

// ---- content, read from the same data as the live site -------------------
const SPEC = [
  ['Operating sys', 'MacOS / Linux'], ['Primary lang', 'DE / EN'], ['Distro prefs', 'Arch · Debian · Fedora'],
  ['Shell', 'zsh / fish'], ['Editor', 'nano / VIM'], ['Keyboard', 'ISO · 65%'], ['Fav anime', 'Evangelion / Frieren'],
];
document.getElementById('spec').append(...SPEC.flatMap(([k, v]) => {
  const dt = document.createElement('dt');
  dt.textContent = k;
  const dd = document.createElement('dd');
  dd.textContent = v;
  return [dt, dd];
}));

// the same layout as the model's lid: file, x, y (mm from top left), width, rotation
const STICKERS = [
  ['rei', 30.6, 131, 56, 0], ['arasaka', 33.6, 184, 62.4, 0], ['japan', 244.8, 184, 49.5, 0],
  ['esa', 32, 58, 36, -6], ['frieren', 232, 72, 40, 4], ['eu', 84, 112, 32, 5], ['kuromi', 128, 100, 30, -5],
  ['pride', 176, 108, 38, -8], ['potato', 234, 133, 24, 7], ['jaxa', 112, 156, 50, 5], ['clawd', 173, 168, 44, -4],
  ['proxmox', 184, 34, 62, -3], ['delacy', 72, 62, 30, -6],
  ['inter-astra', 117, 33, 52, -2], ['uwu', 158, 141, 25, 6],
  ['mac', 24, 19, 24, 4], ['disco', 240, 20, 20, 6], ['sprout', 125, 183, 28, -6],
];
const deck = document.getElementById('deck');
const logo = document.createElement('div');
logo.className = 'deck__logo';
deck.append(logo);
for (const [name, x, y, width, rotation] of STICKERS) {
  const img = new Image();
  img.src = `tools/laptop/stickers/${name}.png`;
  img.alt = '';
  img.loading = 'lazy';
  img.style.cssText = `left:${x / 2.73}%;top:${y / 2.092}%;width:${width / 2.73}%;--r:${rotation}deg`;
  deck.append(img);
}
number(deck.querySelectorAll('img'));

const seen = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-in');
      seen.unobserve(entry.target);
    }
  }
}, { rootMargin: '0px 0px 8% 0px' });   // begins just below the fold: on a fast scroll it is under way as it arrives
document.querySelectorAll('.rise').forEach((el) => seen.observe(el));

// a thing's own entrance is there to be watched: it waits for the thing itself, at the fold
const arrived = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-here');
      arrived.unobserve(entry.target);
    }
  }
});
document.querySelectorAll('.unitlist,.rackphoto,.who__pfp,.deck,.stamps,.walls__set,.strip').forEach((el) => arrived.observe(el));
// the terminal prints for whoever reads it, so it waits until its screen is well up, not its top edge
const reading = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add('is-here');
  reading.disconnect();
}, { rootMargin: '0px 0px -30% 0px' });
reading.observe(document.querySelector('.neobay'));

// ---- live data, the same files and rules as the main page -----------------
// /status.json is polled once and shared; null means no probe, and everything
// reading it falls back to an honest offline state.
const statusFeed = (() => {
  const subs = [];
  let last = null;
  const every = 30000;
  const refresh = async () => {
    try {
      const r = await fetch(`/status.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`http ${r.status}`);
      last = await r.json();
    } catch {
      last = null;
    }
    subs.forEach((fn) => fn(last));
  };
  refresh();
  setInterval(refresh, every);
  return { every, subscribe(fn) { subs.push(fn); fn(last); } };
})();

// the pill under the nav follows the same track as the card
const nowPill = document.getElementById('nowPill');
const spotifyOpen = document.getElementById('spotifyOpen');
// the card opens the library on any click or key; this link is the one exception
for (const type of ['click', 'keydown']) spotifyOpen.addEventListener(type, (e) => e.stopPropagation());
const readAlong = (el) => {
  el.classList.remove('is-long');
  const over = el.offsetWidth - el.parentElement.clientWidth;
  if (over <= 1) return;
  el.style.setProperty('--shift', `${-over}px`);
  el.style.setProperty('--secs', `${(over / 26 + 2.5).toFixed(1)}s`);
  el.classList.add('is-long');
};
window.addEventListener('lucya:track', ({ detail: track }) => {
  nowPill.classList.toggle('is-on', !!track);
  if (!track) return;
  nowPill.hidden = false;
  nowPill.title = `${track.title} · ${track.artist || ''}`;
  document.getElementById('nowPillCover').src = track.cover || 'images/profile/sociallinks/spotify_color.svg';
  document.getElementById('nowPillTitle').textContent = track.title;
  document.getElementById('nowPillArtist').textContent = track.artist || '';
  requestAnimationFrame(() => ['nowPillTitle', 'nowPillArtist'].forEach((id) => readAlong(document.getElementById(id))));
});

const scrambleTo = createScrambler(!!window.LUCYA_LITE);
initSystems(statusFeed, scrambleTo, { fullSheet: true });
initWeather();
initSpotify(scrambleTo);
initShelves(shelves, document.getElementById('shelfTabs'), document.getElementById('shelfPanels'));

// the manifest's first albums and artists beside the card; a click opens the whole sheet
const peekFrom = (from, to, count, n) => {
  const items = [...document.querySelectorAll(`#${from} > li`)];
  document.getElementById(to).append(...items.slice(0, n).map((li) => li.cloneNode(true)));
  // the peek is a way into the sheet; its copies are not links of their own
  for (const a of document.querySelectorAll(`#${to} a`)) a.removeAttribute('href');
  document.getElementById(count).textContent = items.length;
};
peekFrom('manifestAlbums', 'peekAlbums', 'peekAlbumCount', 6);
peekFrom('manifestArtists', 'peekArtists', 'peekArtistCount', 8);
for (const peek of document.querySelectorAll('[data-peek]')) peek.addEventListener('click', () => document.getElementById('spotifyCard').click());

const wallButton = (file, name, href) => {
  const el = document.createElement(href ? 'a' : 'span');
  el.className = 'b81';
  el.title = name;
  if (href) {
    el.href = href;
    el.target = '_blank';
    el.rel = 'noopener';
  }
  const img = new Image(88, 31);
  img.src = `images/88x31 buttons/${file}`;
  img.alt = name;
  img.loading = 'lazy';
  el.append(img);
  return el;
};
document.getElementById('buttonWall').append(...buttons.map(([file, name]) => wallButton(file, name)));
document.getElementById('friendWall').append(...friends.map(([file, name, href]) => wallButton(file, name, href)));
number(document.querySelectorAll('.walls__set .b81'));
const snippet = document.getElementById('friendSnippet');
snippet.addEventListener('click', () => {
  navigator.clipboard?.writeText(snippet.textContent.trim()).then(() => {
    snippet.classList.add('is-copied');
    setTimeout(() => snippet.classList.remove('is-copied'), 1200);
  }, () => {});
});

const $ = (id) => document.getElementById(id);
const percent = (n, d) => (d > 0 ? Math.min(100, n / d * 100) : 0);
const DAY = 86400000;
// the trip keeps Japan's clock: dates and the gallery's stops carry no zone
const jst = (t) => Date.parse(t.length > 10 ? `${t}+09:00` : `${t}T00:00:00+09:00`);
let fleet = null;

function paintFleet() {
  if (!fleet) return;
  const s = fleet.summary || fleet;
  const up = +s.hosts_up || 0, hosts = +s.hosts_total || 0;
  const ok = +s.services_ok || 0, warn = +s.services_warn || 0, crit = +s.services_crit || 0;
  const services = +s.services_total || ok + warn + crit;
  const age = Math.max(0, Math.floor(Date.now() / 1000) - Number(fleet.ts || 0));
  const stale = !(Number(fleet.ts) > 0) || age > 120;
  const healthy = hosts > 0 && services > 0 && up === hosts && ok === services && !warn && !crit;

  $('fleetHosts').textContent = `${up} / ${hosts}`;
  $('fleetSvc').textContent = `${ok} / ${services}`;
  $('fleetHostsBar').style.transform = `scaleX(${percent(up, hosts) / 100})`;
  $('fleetSvcBar').style.transform = `scaleX(${percent(ok, services) / 100})`;
  $('fleetAlerts').textContent = warn || crit ? `${crit} crit · ${warn} warn` : '0';
  $('fleetAge').textContent = age < 60 ? `${age}s ago` : age < 3600 ? `${Math.floor(age / 60)}m ago` : `${Math.floor(age / 3600)}h ago`;
  $('fleetTag').textContent = stale ? 'Checkmk · stale' : 'Checkmk · live';
  $('fleetSummary').textContent = stale ? 'Telemetry outdated.' : healthy ? 'All systems operational.' : 'Systems require attention.';
  for (const h of fleet.hosts || []) {
    document.querySelector(`.ru[data-unit="${h?.name}"]`)?.setAttribute('data-live', String(h.state).toLowerCase());
  }
}
statusFeed.subscribe((data) => { fleet = data; paintFleet(); });
setInterval(paintFleet, 5000);

fetch('data.json').then((r) => r.json()).then(({ kpis }) => {
  const kpi = (key) => kpis.find((k) => k.key === key);
  const japan = kpi('japan');
  const start = jst(japan.target), end = jst(japan.end);
  const now = Date.now();
  const total = Math.round((end - start) / DAY);
  if (now < start) {
    $('kpiJapan').textContent = `${Math.ceil((start - now) / DAY)} d`;
    $('kpiJapanSub').textContent = japan.sub;
  } else if (now < end) {
    const today = Math.floor((now - start) / DAY) + 1;
    $('kpiJapan').innerHTML = `${today}<small lang="ja">日目</small>`;
    $('kpiJapanSub').textContent = `OF ${total} · ${Math.ceil((end - now) / DAY)} LEFT`;
    $('tripBar').style.transform = `scaleX(${(now - start) / (end - start)})`;
    const local = new Date(now + 9 * 3600000);
    const [, name, reading, meaning] = seasons.findLast(([from]) => from <= (local.getUTCMonth() + 1) * 100 + local.getUTCDate());
    $('wxSeason').textContent = name;
    $('wxSeasonEn').textContent = meaning;
    $('wxSeasonLine').title = `${reading} · one of the 72 micro-seasons of the old calendar`;
    $('wxRoad').hidden = false;
  } else {
    $('kpiJapan').innerHTML = `${total}<small lang="ja">日</small>`;
    $('kpiJapanSub').textContent = `おかえり · ${japan.subAfter}`;
  }
}).catch(() => {});

// ---- photos, live from the gallery ----------------------------------------
// Thumbs only: the gallery sends CORP: cross-origin on /thumb and not on /preview,
// and originals run past 30 MB. A failed call leaves the local set standing.
const GALLERY = 'https://images.lucya.sh';
const ALBUMS = [
  ['stripJapan', `${GALLERY}/api/showcase?album=japan_2026&limit=14`, []],
  ['stripTech', `${GALLERY}/api/photos?album=tech&sort=date_desc&subtree=1&limit=14`,
    ['server', 'datacenter', 'iphone-crt', 'wald', 'lain', 'server-macbook', 'iphones', 'blahaj']],
];

function photoCard(src, href, alt) {
  const link = document.createElement(href ? 'a' : 'span');
  if (href) {
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
  }
  const img = new Image();
  img.addEventListener('load', () => img.classList.add('is-dev'), { once: true });   // a print can only develop once it is there
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  link.append(img);
  return link;
}

for (const [id, url, fallback] of ALBUMS) {
  const strip = document.getElementById(id);
  const local = () => {
    strip.append(...fallback.map((n) => photoCard(`images/photos/${n}.jpeg`, null, '')));
    number(strip.querySelectorAll('img'));
  };
  fetch(url, { mode: 'cors' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
    .then(({ items }) => {
      if (!Array.isArray(items) || !items.length) throw new Error('album empty');
      strip.append(...items.map((it) => photoCard(it.urls.thumb_abs, it.urls.page_abs, it.album || '')));
      number(strip.querySelectorAll('img'));
    })
    .catch(() => {
      if (fallback.length) local();
      else strip.closest('.album').hidden = true;
    });
}

// ---- the trip's stamps ------------------------------------------------------
// One seal per stop, the way stations hand them out. Collected ones link to
// their album, the ones still ahead stay an outline. A side trip outranks the
// stop it leaves from, so only one seal is ever the current one.
fetch(`${GALLERY}/api/album/japan_2026`, { mode: 'cors' })
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`http ${r.status}`))))
  .then(({ trip }) => {
    const sides = trip.side_trips || [];
    const stops = [...trip.stops, ...sides].sort((a, b) => jst(a.start) - jst(b.start));
    const now = Date.now();
    const inside = (s) => jst(s.start) <= now && now < jst(s.end);
    const current = sides.find(inside) || trip.stops.find(inside);
    $('wxStamps').append(...stops.map((s) => {
      const li = document.createElement('li');
      const seal = document.createElement(s.href ? 'a' : 'span');
      if (s.href) {
        seal.href = GALLERY + s.href;
        seal.target = '_blank';
        seal.rel = 'noopener';
      }
      seal.className = `seal${s.jp.length > 2 ? ' seal--long' : ''}${s === current ? ' is-here' : now < jst(s.start) ? ' is-ahead' : ''}`;
      seal.lang = 'ja';
      seal.textContent = s.jp;
      const from = s.start_h || s.arrive_h;
      seal.title = `${s.city} · ${from}${s.end_h ? ` – ${s.end_h}` : ''}`;
      li.append(seal);
      return li;
    }));
    number($('wxStamps').querySelectorAll('.seal'));
    $('wxStamps').hidden = false;
  })
  .catch(() => {});

// ---- nav: follows the page -------------------------------------------------
// On a phone the bar is wider than the screen; it brings the current section
// into view by itself instead of leaving that to a sideways swipe.
const island = document.querySelector('.island');
const islandLinks = island.querySelector('.island__links');
const navLinks = new Map([...island.querySelectorAll('a[href^="#"]:not(.island__home)')]
  .map((a) => [document.querySelector(a.getAttribute('href')), a]).filter(([el]) => el));

function markCurrent(link) {
  island.querySelector('.is-current')?.classList.remove('is-current');
  link.classList.add('is-current');
  islandLinks.scrollTo({ left: link.offsetLeft - (islandLinks.clientWidth - link.offsetWidth) / 2, behavior: REDUCED ? 'auto' : 'smooth' });
}
const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) markCurrent(navLinks.get(entry.target));
  }
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((_, section) => spy.observe(section));

// ---- start-up: picks up from the intro's last frame ------------------------
// Loads behind the intro, near 800 KB of maps, so it is ready when the boot lifts;
// it stays out of sight and draws nothing until show().
const planet = import('./hero-planet.js?v=20261102-sky')
  .then(({ startPlanet }) => startPlanet($('hero'), $('heroPlanet'), REDUCED))
  .catch((err) => {
    console.warn('[planet] standing in the render:', err);
    $('hero').classList.add('is-still');
  });
window.addEventListener('lucya:sky', ({ detail }) => planet.then((p) => p?.sky(detail)));

function ready() {
  document.body.classList.add('is-ready');
  window.dispatchEvent(new CustomEvent('lucya:ready'));
  planet.then((p) => p?.show());
}

function startUp() {
  if (REDUCED) {
    boot.classList.add('is-done');
    root.classList.remove('is-scrolllock');
    ready();
    return;
  }
  root.classList.add('is-scrolllock');
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  const end = () => {
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', end);
    boot.removeEventListener('pointerdown', end);
    boot.classList.add('is-done');
    // after the intro its scroll stop lifts this, once the wheel has rested
    if (!window.LUCYA_INTRO) root.classList.remove('is-scrolllock');
    ready();
  };

  // nobody should have to sit through it twice
  at(300, () => {
    window.addEventListener('keydown', end);
    boot.addEventListener('pointerdown', end);
  });
  // the intro's own fade takes the first second of this
  at(900, () => boot.classList.add('is-spin'));
  at(3000, () => boot.classList.add('is-fade'));
  at(4200, end);
}

// the intro's gate holds the page; without an intro the page starts by itself
if (window.LUCYA_INTRO) window.addEventListener('lucya:intro-done', startUp, { once: true });
else startUp();
