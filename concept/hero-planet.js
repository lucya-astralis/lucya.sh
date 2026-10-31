// Orikaia Prime rising behind the hero, drawn by the renderer of the Concordia set.
// The sun stands behind the limb, so the words sit on the night side under one
// lit arc. Where drawing is not an option, a render of the same view stands in.
import { createPlanetLayer, faceMatrix } from '../planet-gl.js';

const MAPS = {
  day: 'images/concordia/orikaia-prime-day.webp',
  data: 'images/concordia/orikaia-prime-data.webp',
  mask: 'images/concordia/seiki-to-mask.webp',
  night: 'images/concordia/orikaia-prime-night.webp',
};
// the capital and the aerial photograph on the moon, as in concordia.js
const unit = (lat, lon) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
};
const FRAME = {
  lon0: 139.7,
  capB: unit(35.6, 139.7),
  aerE: [-0.64679, 0.0, -0.762668],
  aerN: [0.443967, 0.813101, -0.376511],
  aerial: [0.012, 740 / 1536, 432 / 1024],
};
const SUN = [-0.34, -0.66, -0.67];
const SEIKI_TO = [30, 139.7];   // the capital's seas face the viewer
const ROLL = -12;
const DAY_S = 420;              // one turn, seconds: it should barely seem to move
const FRAME_MS = 50;            // the clouds need no more than 20 frames a second
const SLOW_MS = 90;             // a frame gap past this and the planet holds still
const PARALLAX = 0.22;

// seen from far enough out to show the curve, its top where --horizon says in concept.css
const place = (w, h) => {
  const r = Math.max(w * 1.15, h * 0.8);
  return { cx: w * 0.5, cy: h * 0.46 + r, r };
};

export function startPlanet(hero, canvas, reduced) {
  const weak = window.LUCYA_LITE || navigator.hardwareConcurrency <= 2 || navigator.deviceMemory < 2;
  let planet = null;
  if (!weak) {
    try { planet = createPlanetLayer(canvas); } catch { planet = null; }
  }
  if (!planet) {
    hero.classList.add('is-still');
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let W = 0, H = 0, ready = false, seen = true, moving = !reduced;

  planet.define('prime', { kind: 'terrestrial', maps: MAPS, flat: [5 / 255, 14 / 255, 33 / 255], cloud: true, frame: FRAME, atm: { halo: 0.42 } });

  const draw = (seconds) => {
    if (!ready || !W) return;
    const { cx, cy, r } = place(W, H);
    const spin = (seconds / DAY_S) * Math.PI * 2;
    planet.draw([{
      id: 'prime', cx: cx * dpr, cy: cy * dpr, r: r * dpr, sun: SUN, toBody: faceMatrix(...SEIKI_TO, ROLL, spin), dpr,
    }], seconds);
  };

  const resize = () => {
    W = hero.clientWidth;
    H = hero.clientHeight;
    planet.resize(W, H, dpr);
    draw(performance.now() / 1000);
  };
  new ResizeObserver(resize).observe(hero);

  // a machine that cannot keep up keeps the planet it has: the page must not pay for it
  let last = 0, late = 0, count = 0;
  function tick(now) {
    if (!moving) return;
    requestAnimationFrame(tick);
    if (!seen) { last = 0; return; }
    if (now - last < FRAME_MS) return;
    if (last && ++count > 6 && now - last > SLOW_MS && ++late > 8) moving = false;
    last = now;
    draw(now / 1000);
  }

  const loaded = () => {
    if (ready || !planet.allReady('prime')) return;
    ready = true;
    resize();
    canvas.classList.add('is-risen');
    if (moving) requestAnimationFrame(tick);
  };
  planet.onLoad = loaded;
  loaded();

  new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; }).observe(hero);

  if (!reduced) {
    const follow = () => { canvas.style.transform = `translate3d(0,${(scrollY * PARALLAX).toFixed(1)}px,0)`; };
    addEventListener('scroll', follow, { passive: true });
    follow();
  }
}
