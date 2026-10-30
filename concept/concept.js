import { rackData } from '../js/systems-data.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const boot = document.getElementById('boot');

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

const rack = document.getElementById('rack');
for (const host of rackData) {
  if (!host.chassis) continue;
  const li = document.createElement('li');
  const name = document.createElement('b');
  name.textContent = host.id;
  li.append(name);
  for (const text of [host.role, host.chassis, host.cpu || host.os || '']) {
    const cell = document.createElement('span');
    cell.textContent = text;
    li.append(cell);
  }
  rack.append(li);
}

// the same layout as the model's lid: file, x, y (mm from top left), width, rotation
const STICKERS = [
  ['rei', 30.6, 131, 56, 0], ['arasaka', 33.6, 184, 62.4, 0], ['japan', 244.8, 184, 49.5, 0],
  ['esa', 32, 58, 36, -6], ['frieren', 232, 72, 40, 4], ['eu', 84, 112, 32, 5], ['kuromi', 128, 100, 30, -5],
  ['pride', 176, 108, 38, -8], ['potato', 234, 133, 24, 7], ['jaxa', 112, 156, 50, 5], ['clawd', 173, 168, 44, -4],
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

const strip = document.getElementById('strip');
for (const name of ['server', 'datacenter', 'iphone-crt', 'wald', 'lain', 'server-macbook', 'iphones', 'blahaj']) {
  const img = new Image();
  img.src = `images/photos/${name}.jpeg`;
  img.alt = '';
  img.loading = 'lazy';
  strip.append(img);
}

const seen = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-in');
      seen.unobserve(entry.target);
    }
  }
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.rise').forEach((el) => seen.observe(el));

// ---- start-up: picks up from the intro's last frame ------------------------
const POST = [
  ['Model', 'CF-QV9'], ['Host', 'kira'], ['CPU', 'Core i5-10310U'], ['Display', '12.0" 2880 × 1920'], ['Handing over', 'lucya.systems'],
];

function ready() {
  document.body.classList.add('is-ready');
  window.dispatchEvent(new CustomEvent('lucya:ready'));
}

function startUp() {
  if (REDUCED) {
    boot.classList.add('is-done');
    root.classList.remove('is-scrolllock');
    ready();
    return;
  }
  root.classList.add('is-scrolllock');
  const post = document.getElementById('bootPost');
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
  POST.forEach(([key, value], i) => at(420 + i * 240, () => {
    const li = document.createElement('li');
    li.innerHTML = '<span></span><b></b>';
    li.firstChild.textContent = key;
    li.lastChild.textContent = value;
    post.append(li);
    requestAnimationFrame(() => li.classList.add('is-on'));
  }));
  at(2050, () => boot.classList.add('is-mark'));
  at(3300, end);
}

// the intro's gate holds the page; without an intro the page starts by itself
if (window.LUCYA_INTRO) window.addEventListener('lucya:intro-done', startUp, { once: true });
else startUp();
