import { pad2, escHtml } from './js/utils.js';
import { createScrambler } from './js/text-scramble.js';
import { initSystems } from './js/systems.js?v=20261031-kira';
import { initSpotify } from './js/spotify.js?v=20261027-lang';
import { initPhotos } from './js/photos.js';
import { initWeather } from './js/weather.js';

/* ================================================================
   LUCYA // lucya.sh  —  interactions
   ================================================================ */

(() => {

  // ---------- LITE MODE -------------------------------------------
  // decided by the head script lite.js (auto-detect + manual override);
  // here it gates everything that costs CPU/GPU/bandwidth at runtime.
  const LITE = !!window.LUCYA_LITE;
  const scrambleTo = createScrambler(LITE);

  // ---------- SPLASH : boot mode -----------------------------------
  // The full boot runs on every load. It used to shorten itself to ~1.6s
  // once a sessionStorage flag said you'd seen it, which meant the same URL
  // opened differently depending on invisible state — the second visit felt
  // broken rather than fast, and it was impossible to actually watch the boot
  // again without clearing storage. The skip control carries that job now:
  // it's on screen from 1.6s, and any key or tap takes it.
  // lite mode still gets the short boot — that's a device budget, not a
  // guess about whether you've been here before.
  //
  // 5.4s, down from 7.4s. The tail is deliberate, not slack:
  //   ~3.15s logo build ends, wordmark settled, idle pulse starts breathing
  //   the bar under the mark fills toward this handoff; the stamp
  //   turns READY on the page's load event
  //   ~5.4s  a full second of settled logo, then the handoff
  // Nothing was cut from the sequence — only the dead time that used to sit
  // between the build finishing and the old 7.4s timer.
  const BOOT_READY_MS = LITE ? 1100 : 5400;

  // ---------- WALLPAPER VIDEO : single-instance handoff ------------
  // both <video> tags ship without src; the splash copy starts here,
  // the wallpaper copy takes over in finishSplash. never both at once,
  // and in lite mode neither ever loads a byte.
  const splashVideo = document.querySelector('.splash__video');
  const wallVideo = document.querySelector('.wallpaper-video');
  if (!LITE && splashVideo && splashVideo.dataset.src){
    splashVideo.src = splashVideo.dataset.src;
    splashVideo.autoplay = true;
    splashVideo.play?.().catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (!wallVideo || !wallVideo.src) return;
    if (document.hidden) wallVideo.pause();
    else wallVideo.play().catch(() => {});
  });

  // ---------- SPLASH : session stamp ----------------------------
  const sessionEl = document.getElementById('splashSession');
  if (sessionEl){
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    sessionEl.innerHTML = `SESSION <b>${stamp}</b>`;
  }

  // ---------- SPLASH : live log ----------------------------------
  // Like the old boot log, but nothing in it is made up: one line per file
  // this page fetches, read from the Resource Timing feed as each one
  // lands (size, or CACHE, and how long it took), plus the boot's own
  // milestones. Files that were in before this script ran come from the
  // buffer, so the log starts at the document. Lines are paced a few
  // frames apart so a burst stays readable; they are never invented.
  const bootLog = (() => {
    const el = document.getElementById('splashLog');
    const MAX = 16, PACE = LITE ? 0 : 45;
    const queue = [];
    let busy = false, po = null;
    // the figures under the mark: the same entries, summed
    const stat = { files: 0, bytes: 0, cached: 0, issues: 0 };
    const statEl = id => document.getElementById(id);
    const kb = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
    const tallyStats = () => {
      const put = (id, v) => { const e = statEl(id); if (e) e.textContent = v; };
      put('bootFiles', String(stat.files));
      put('bootBytes', kb(stat.bytes));
      put('bootCached', stat.files ? Math.round(stat.cached / stat.files * 100) + '%' : '0%');
      put('bootIssues', String(stat.issues));
      statEl('bootIssues')?.classList.toggle('is-bad', stat.issues > 0);
    };
    const write = ([lv, kind, text, meta, milestone]) => {
      const li = document.createElement('li');
      if (milestone) li.className = 'is-milestone';
      const cls = lv === 'OK' ? 'lv' : lv === 'ERR' ? 'lv lv--err' : 'lv lv--wait';
      li.innerHTML = `<span class="${cls}">${escHtml(lv)}</span><span class="lk">${escHtml(kind)}</span>` +
        `<span class="ll">${escHtml(text)}</span><span class="lh">${escHtml(meta || '')}</span>`;
      el.appendChild(li);
      while (el.children.length > MAX) el.firstElementChild.remove();
    };
    const pump = () => {
      if (!queue.length){ busy = false; return; }
      busy = true;
      write(queue.shift());
      setTimeout(pump, PACE);
    };
    const line = (...args) => {
      if (!el) return;
      queue.push(args);
      if (!busy) pump();
    };
    const KIND = { css: 'CSS', js: 'JS', mjs: 'JS', json: 'DATA', woff2: 'FONT', woff: 'FONT', otf: 'FONT',
      webp: 'IMG', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', gif: 'IMG', svg: 'SVG', mp4: 'VID', cur: 'CUR', ico: 'ICO' };
    const size = e => e.transferSize === 0 && e.decodedBodySize > 0 ? 'CACHE'
      : e.transferSize ? (e.transferSize >= 1048576 ? (e.transferSize / 1048576).toFixed(1) + 'M'
        : Math.max(1, Math.round(e.transferSize / 1024)) + 'K') : '';
    const entry = e => {
      let u;
      try { u = new URL(e.name); } catch (_) { return; }
      const file = decodeURIComponent(u.pathname.split('/').pop() || u.pathname) || '/';
      const ext = (file.split('.').pop() || '').toLowerCase();
      const kind = e.entryType === 'navigation' ? 'DOC' : KIND[ext] || (e.initiatorType || 'NET').slice(0, 4).toUpperCase();
      const name = (u.origin !== location.origin ? u.host + ' · ' : '') + file;
      const st = e.responseStatus || 0;
      // a missing now-playing file just means nothing is playing
      const lv = st >= 500 ? 'ERR' : st === 404 && file === 'nowplaying.json' ? 'IDLE' : st >= 400 ? 'MISS' : 'OK';
      const meta = [st >= 400 ? String(st) : size(e), Math.round(e.duration) + 'MS'].filter(Boolean).join(' ');
      stat.files++;
      stat.bytes += e.transferSize || 0;
      if (e.transferSize === 0 && e.decodedBodySize > 0) stat.cached++;
      if (lv === 'MISS' || lv === 'ERR') stat.issues++;
      tallyStats();
      line(lv, kind, name, meta);
    };
    if ('PerformanceObserver' in window){
      performance.getEntriesByType('navigation').forEach(entry);
      try {
        po = new PerformanceObserver(list => list.getEntries().forEach(entry));
        po.observe({ type: 'resource', buffered: true });
      } catch (_) { po = null; }
      document.addEventListener('DOMContentLoaded', () => line('OK', 'BOOT', 'DOM READY', Math.round(performance.now()) + 'MS', true));
      document.fonts?.ready.then(f => line('OK', 'BOOT', 'FONTS READY', `${[...f].filter(x => x.status === 'loaded').length} FACES`, true));
    }
    return { line, done(){ po?.disconnect(); } };
  })();

  // ---------- SPLASH : clock + ready ------------------------------
  // The bar is the boot's own clock, filling toward the handoff; the
  // counter beside it is page time. The stamp turns READY when the
  // page's load event is in — not on a timer.
  (function bootClock(){
    const splashEl = document.getElementById('splash');
    const fill = document.getElementById('splashProgressFill');
    const elapsed = document.getElementById('splashElapsed');
    const stampEl = document.getElementById('splashStamp');
    // a 100ms timer, not rAF: a background tab throttles rAF to nothing
    const step = () => {
      const t = performance.now();
      if (elapsed) elapsed.textContent = (t / 1000).toFixed(1) + ' S';
      if (fill) fill.style.width = Math.min(100, t / BOOT_READY_MS * 100) + '%';
      if (t >= BOOT_READY_MS || splashEl?.classList.contains('is-done')) clearInterval(iv);
    };
    const iv = setInterval(step, 100);
    step();
    const ready = () => {
      bootLog.line('OK', 'BOOT', 'PAGE LOADED', Math.round(performance.now()) + 'MS', true);
      splashEl?.classList.add('is-complete');
      if (stampEl){
        stampEl.className = 'stamp stamp--ok';
        stampEl.innerHTML = '<span lang="ja">完了</span> · READY';
      }
    };
    if (document.readyState === 'complete') ready();
    else window.addEventListener('load', ready, { once: true });
  })();

  // ---------- REVEAL : mark below-fold blocks (observer starts post-splash) ----------
  const revealSelectors = ['.about', '.interests', '.rack', '.buttons', '.friends', '.neofetch', '.spotify', '.photos', '.foot'];
  const revealTargets = revealSelectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
  revealTargets.forEach(el => el.classList.add('reveal-block'));

  // splash lockdown — released by the boot handoff at the end of this file
  document.body.style.overflow = 'hidden';

  // ---------- SPLASH LOGO BUILD ----------------------------------
  (function splashLogoBuild(){
    const mainSvg = document.getElementById('splashLogoSvg');
    if (!mainSvg) return;
    const glitchLogo = document.getElementById('glitchLogo');
    const label = document.querySelector('.splash__label');
    // reduced-motion gets the same treatment as lite: the CSS kill-switch
    // can't touch inline styles, so a shake driven from JS would run straight
    // through it. Land on the finished logo instead.
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (LITE || REDUCED){
      // no draw-in, no shake/burst intervals — final state immediately
      mainSvg.querySelectorAll('.piece').forEach(el => {
        el.classList.add('drawn', 'filled');
      });
      return;
    }
    const rgbR = document.getElementById('rgbR');
    const rgbB = document.getElementById('rgbB');
    // The mark is mirror-symmetric, so it builds in PAIRS rather than one
    // piece at a time. Drawing a left feather and then its right twin a beat
    // later reads as a stutter, not as assembly — the eye sees the symmetry
    // break and waits for it to be repaired. Stepping outward from the centre
    // spine keeps the mark balanced on every frame of the build.
    //
    // Durations are set from each path's own length so the stroke travels at
    // roughly one speed everywhere (~1250-1450 user units/sec). Reusing one
    // duration for every group would draw the 1245-unit wings at more than
    // twice the pace of the 481-unit feathers, and a mark whose parts appear
    // at different speeds reads as several animations rather than one hand.
    // The tail is the deliberate exception — slower, because it is the
    // opening beat with nothing else on screen to race.
    //
    // Groups overlap rather than queue: the wings start third but are the
    // longest stroke, so they land last, at ~1.4s, and the big sweep closing
    // the outline is the payoff of phase 1 instead of a straggler.
    const order = [
      { ids: ['pc-tail'],                  dur: 0.66 },  // 579u -> ~880 u/s
      { ids: ['pc-head'],                  dur: 0.46 },  // 574u -> ~1250
      { ids: ['pc-wing-l',  'pc-wing-r'],  dur: 0.86 },  // 1245u -> ~1450
      { ids: ['pc-mid-l',   'pc-mid-r'],   dur: 0.46 },  // 622u -> ~1350
      { ids: ['pc-small-l', 'pc-small-r'], dur: 0.36 },  // 481u -> ~1340
    ];
    const groupEls = g => g.ids.map(id => document.getElementById(id)).filter(Boolean);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rgbSplit = dx => {
      if (rgbR){ rgbR.style.opacity = '0.4'; rgbR.style.transform = `translate(${-dx}px, ${dx*0.3}px)`; }
      if (rgbB){ rgbB.style.opacity = '0.4'; rgbB.style.transform = `translate(${dx}px, ${-dx*0.3}px)`; }
    };
    const rgbClear = () => {
      if (rgbR){ rgbR.style.opacity = '0'; rgbR.style.transform = ''; }
      if (rgbB){ rgbB.style.opacity = '0'; rgbB.style.transform = ''; }
    };
    const shake = (el, count, intensity) => new Promise(res => {
      let i = 0;
      const iv = setInterval(() => {
        el.style.transform = `translate(${(Math.random()-.5)*intensity}px, ${(Math.random()-.5)*intensity*.6}px)`;
        if (++i >= count){ clearInterval(iv); el.style.transform=''; res(); }
      }, 35);
    });
    const burst = (el, rounds, intensity) => new Promise(res => {
      let i = 0;
      const iv = setInterval(() => {
        el.style.transform = `translate(${(Math.random()-.5)*intensity}px, ${(Math.random()-.5)*intensity*.5}px) skewX(${(Math.random()-.5)*3}deg)`;
        rgbSplit(3 + Math.random()*5);
        if (++i >= rounds){ clearInterval(iv); el.style.transform=''; rgbClear(); res(); }
      }, 45);
    });

    // CRT signal drop: the tube blooms, cuts to black, comes back weak, then
    // settles. Used once, as the hinge between the outline and the fill —
    // the logo doesn't just start filling, the signal drops and it comes back
    // solid. Runs on the wrapper so the RGB layers bloom with it; that also
    // means the wrapper's drop-shadow glow dies during the cut, which is
    // exactly right for a dropout.
    const signalLoss = (el, duration) => new Promise(res => {
      el.style.filter = 'brightness(2.4) contrast(.55)';
      el.style.transform = `skewX(${(Math.random()-.5)*4}deg)`;
      rgbSplit(8 + Math.random()*6);
      setTimeout(() => {
        el.style.filter = 'brightness(0)';
        el.style.transform = '';
        rgbClear();
      }, duration * 0.3);
      setTimeout(() => { el.style.filter = 'brightness(.6) contrast(1.2)'; }, duration * 0.6);
      setTimeout(() => { el.style.filter = ''; el.style.transform = ''; res(); }, duration);
    });

    // hard on/off flicker — the last unstable moment before the wordmark
    const flicker = (el, times) => new Promise(res => {
      let i = 0;
      const iv = setInterval(() => {
        el.style.opacity = i % 2 === 0 ? '0' : '1';
        if (++i >= times){ clearInterval(iv); el.style.opacity=''; res(); }
      }, 42 + Math.random()*26);
    });

    // The wordmark resolves instead of fading: it lands wide and overshoots
    // its tracking a few times before settling on the CSS value (.22em). Read
    // as type being locked in by the same system that just drew the mark.
    const nameGlitchIn = async (el) => {
      if (!el) return;
      el.style.opacity = '1';
      const frames = [
        { ls: '1.05em', x:  9, skew:  3 },
        { ls: '.10em',  x: -6, skew: -2.4 },
        { ls: '.46em',  x:  4, skew:  1.6 },
        { ls: '.15em',  x: -2, skew: -0.8 },
        { ls: '.22em',  x:  0, skew:  0 },
      ];
      for (let i = 0; i < frames.length; i++){
        const f = frames[i];
        el.style.letterSpacing = f.ls;
        el.style.transform = `translateX(${f.x}px) skewX(${f.skew}deg)`;
        if (i < frames.length - 1) rgbSplit(2 + Math.abs(f.x)*0.5); else rgbClear();
        // ~125ms per frame instead of ~73ms: at the old pace the tracking
        // overshoots were over before the eye could follow one, so it read as
        // a single smear rather than as type being searched for and found.
        await wait(100 + Math.random()*45);
      }
      // hand tracking back to the stylesheet so the responsive tier still wins
      el.style.transform = 'none';
      el.style.letterSpacing = '';
    };

    // Skipping the boot has to stop the build, not just hide it. The sequence
    // is a chain of awaited timers; without this it keeps shaking, splitting
    // and re-rendering a logo nobody can see, and it does it while the page's
    // own entrance animations are running — the one moment the compositor is
    // busiest. Checked between phases, which is granular enough to stop
    // within ~100ms of the skip.
    const splashEl = document.getElementById('splash');
    const aborted = () => !!splashEl && splashEl.classList.contains('is-done');

    (async () => {
      order.forEach(g => groupEls(g).forEach(el => {
        try {
          const len = el.getTotalLength();
          el.style.setProperty('--len', len);
          el.style.setProperty('--dur', g.dur + 's');
        } catch(e){}
      }));
      // the wordmark is held back and glitched in at the end (phase 3)
      if (label) label.style.opacity = '0';

      // --- phase 1: draw the outline ---
      await wait(200);
      for (let i = 0; i < order.length; i++){
        if (aborted()) return;
        groupEls(order[i]).forEach(el => el.classList.add('drawn'));
        if (i === 1 || i === 3) await shake(mainSvg, 3, 3);
        // 130ms, up from 105: five groups instead of six pieces, so the gap
        // widens to land the build on the same ~2.9s mark the splash timings
        // and the idle-pulse delay are cut against.
        await wait(130);
      }
      // The loop only STARTS each stroke — it hands off to a CSS transition
      // and moves on, so it returns (~1.06s) well before the last stroke has
      // landed. The wings start third but run 0.86s, finishing at ~1.43s, so
      // this wait covers the gap. Too short and the signal drop cuts across
      // wings that are still drawing, which turns the hinge of the sequence
      // into an interruption of it — the dropout has to land on a finished
      // outline to read as one.
      await wait(380);
      if (aborted()) return;

      // --- phase 2: signal drops, logo comes back solid ---
      await signalLoss(glitchLogo || mainSvg, 260);
      await burst(mainSvg, 6, 15);
      for (let i = 0; i < order.length; i++){
        if (aborted()) return;
        groupEls(order[i]).forEach(el => el.classList.add('filled'));
        if (i % 2 === 0){ rgbSplit(2 + Math.random()*3); await wait(22); rgbClear(); }
        await wait(36);
      }
      // tail trimmed so the wordmark gets going sooner — the burst and the
      // flicker are the run-up, not the event, and at 5/4 rounds they were
      // holding the payoff back by about a sixth of a second
      await burst(mainSvg, 3, 12);
      if (aborted()) return;

      // --- phase 3: the wordmark locks in ---
      await flicker(glitchLogo || mainSvg, 3);
      await nameGlitchIn(label);

      // --- permanent baseline RGB-split after build (hero-style) ---
      const baseline = () => {
        if (rgbR){ rgbR.style.opacity = '0.55'; rgbR.style.transform = 'translate(-2px, 0.5px)'; }
        if (rgbB){ rgbB.style.opacity = '0.55'; rgbB.style.transform = 'translate(2px, -0.5px)'; }
      };
      baseline();

      const idle = setInterval(async () => {
        const splash = document.getElementById('splash');
        if (splash && splash.classList.contains('is-done')){
          clearInterval(idle);
          if (rgbR){ rgbR.style.opacity=''; rgbR.style.transform=''; }
          if (rgbB){ rgbB.style.opacity=''; rgbB.style.transform=''; }
          mainSvg.style.transform='';
          mainSvg.style.clipPath='';
          mainSvg.style.filter='';
          return;
        }
        const r = Math.random();
        if (r > 0.82){
          // heavy burst: shake + strong rgb + clip slice
          const rounds = 3 + Math.floor(Math.random()*4);
          for (let i = 0; i < rounds; i++){
            const dx = (Math.random()-.5)*10;
            mainSvg.style.transform = `translate(${dx}px, 0) skewX(${(Math.random()-.5)*3}deg)`;
            const top = Math.floor(Math.random()*70);
            const bot = Math.floor(Math.random()*70);
            mainSvg.style.clipPath = `inset(${top}% 0 ${bot}% 0)`;
            mainSvg.style.filter = `hue-rotate(${(Math.random()-.5)*70}deg)`;
            rgbSplit(5 + Math.random()*7);
            await new Promise(r2 => setTimeout(r2, 45));
          }
          mainSvg.style.transform='';
          mainSvg.style.clipPath='';
          mainSvg.style.filter='';
          baseline();
        } else if (r > 0.5){
          // medium flicker: brief rgb widen
          rgbSplit(4 + Math.random()*4);
          const dx = (Math.random()-.5)*2;
          mainSvg.style.transform = `translate(${dx}px, 0)`;
          setTimeout(() => { mainSvg.style.transform=''; baseline(); }, 80 + Math.random()*90);
        } else {
          // subtle opacity twitch on main layer
          mainSvg.style.opacity = '0.7';
          setTimeout(() => { mainSvg.style.opacity = ''; }, 40);
        }
      }, 520);
    })();
  })();

  // ---------- CLOCK ----------------------------------------------
  // the site's box lives in Bavaria, so "server time" == Europe/Berlin
  const SERVER_TZ = 'Europe/Berlin';
  const hmsTz = (d, tz) => new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(d);
  const navTime   = document.getElementById('navTime');
  const footTime  = document.getElementById('footTime');

  const updateClock = () => {
    const now = new Date();
    const hms = hmsTz(now, SERVER_TZ);
    if (navTime)  navTime.textContent  = `${hms} SRV`;
    if (footTime) footTime.textContent = hms;
  };
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- YEAR -----------------------------------------------
  const y = document.getElementById('thisYear');
  if (y) y.textContent = new Date().getFullYear();

  // ---------- POKEMON WALK ---------------------------------------
  const pokemon = [
    'eevee.gif', 'vaporeon.gif', 'jolteon.gif', 'flareon.gif',
    'espeon.gif', 'umbreon.gif', 'leafeon.gif', 'glaceon.gif',
    'sylveon.gif'
  ];
  const pokeTrack = document.getElementById('pokewalkTrack');
  if (pokeTrack) {
    // width/height: every sprite is 50x50, and the track is width:max-content
    // animated by -50% — so its width has to be right before the bytes land,
    // or the first cycles run short and the walk looks like it's crawling.
    // Not lazy for the same reason: these sit in the profile card, above the
    // fold, and a late load changes the distance mid-animation.
    const mkRow = () => pokemon.map(f =>
      `<img src="images/pokemon/${f}" alt="" width="50" height="50" decoding="async" />`).join('');
    // two copies for seamless loop
    pokeTrack.innerHTML = mkRow() + mkRow();
  }

  // ---------- 88x31 BUTTON WALL ----------------------------------
  const buttons = [
    ['pride.png','pride'],['adhd.png','adhd'],['autism-new.png','autism'],
    ['eu.gif','eu'],['binbows.gif','binbows.net'],['lucya.gif','lucya.sh'],
    ['bluesky-invert.webp','bluesky'],['twitter.gif','twitter'],['discord.gif','discord'],
    ['steam.gif','steam'],['transnow2.gif','transrights'],
    ['landshut.png','landshut'],['pilsting.png','pilsting'],
    ['think.gif','think'],['gif8.gif','gif'],['gif16.gif','gif'],
    ['ie.gif','internet explorer'],
    ['amd.gif','amd'],['archlinux.gif','arch linux'],
    ['archive.gif','archive'],['astra.gif','astra'],
    ['linuxnow.jpg','linux now'],['computer.png','my computer'],
    ['dance.gif','dance'],['frieren.gif','frieren'],
    ['face.gif','face'],['debian.gif','debian'],
    ['gif15.gif','gif'],['gif2.gif','gif'],
    ['gif6.gif','gif'],
    ['lain.gif','lain'],
    ['miku.gif','hatsune miku'],['mspaint.jpg','ms paint'],['nerv.png','nerv'],
    ['smile.gif','smile'],
    
  ];
  const wall = document.getElementById('buttonWall');
  if (wall) {
    const frag = document.createDocumentFragment();
    buttons.forEach(([file, name]) => {
      // deliberately no href — these are collectibles, not links; a real
      // href="#" would scroll-jump to the top on click.
      const a = document.createElement('a');
      a.className = 'b81';
      a.title = name;
      a.innerHTML =
        `<img src="images/88x31 buttons/${file}" alt="${name}" loading="lazy" decoding="async" />` +
        `<span class="b81__name">${name}</span>`;
      frag.appendChild(a);
    });
    wall.appendChild(frag);
  }

  // ---------- FRIENDS (linked 88x31s) ---------------------------
  const friends = [
    ['aspectra.gif', 'aspectra.world', 'https://aspectra.world'],
  ];
  const fWall = document.getElementById('friendWall');
  if (fWall) {
    const frag = document.createDocumentFragment();
    friends.forEach(([file, name, href]) => {
      const a = document.createElement('a');
      a.className = 'b81';
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = name;
      a.innerHTML =
        `<img src="images/88x31 buttons/${file}" alt="${name}" width="88" height="31" loading="lazy" decoding="async" />` +
        `<span class="b81__name">${name}</span>`;
      frag.appendChild(a);
    });
    fWall.appendChild(frag);
  }
  const fSnip = document.getElementById('friendSnippet');
  if (fSnip) {
    fSnip.addEventListener('click', () => {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(fSnip.textContent.trim()).then(() => {
        fSnip.classList.add('is-copied');
        setTimeout(() => fSnip.classList.remove('is-copied'), 1200);
      }, () => {});
    });
  }




  // ---------- STATUS FEED : one poll, many consumers --------------
  // /status.json is written server-side by a CheckMK puller. Both the
  // fleet overview in the header and the live lines in the neofetch
  // sheets read it, so it is polled once here and fanned out — two
  // independent 30s pollers for the same file would be wasteful and
  // could disagree with each other for a tick.
  // null is a valid payload: it means "no probe", and every consumer
  // has to fall back to its honest offline state.
  const statusFeed = (() => {
    const subs = [];
    let last = null;
    const emit = () => subs.forEach(fn => { try { fn(last); } catch (_) {} });
    const refresh = async () => {
      try {
        const r = await fetch('/status.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw new Error('http ' + r.status);
        last = await r.json();
      } catch (_) {
        last = null;
      }
      emit();
    };
    refresh();
    setInterval(refresh, 30000);
    return {
      subscribe(fn){ subs.push(fn); fn(last); },
      host(name){
        const hs = (last && Array.isArray(last.hosts)) ? last.hosts : [];
        return hs.find(h => h && h.name === name) || null;
      },
      get ts(){ return last ? Number(last.ts || 0) : 0; }
    };
  })();

  // Capacity is taken from named hosts, never inferred from the aggregate.
  statusFeed.subscribe(data => {
    const hosts = Array.isArray(data?.hosts) ? data.hosts : [];
    const find = name => hosts.find(h => h?.name === name);
    const number = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    const put = (id, text) => { document.getElementById(id).textContent = text; };
    const fill = (id, pct) => { document.getElementById(id).style.width = `${Math.min(100, Math.max(0, pct))}%`; };
    const nas = find('vega');
    const valid = number(nas?.fs_used_gib) && number(nas?.fs_total_gib) && nas.fs_total_gib > 0 && nas.fs_used_gib <= nas.fs_total_gib;
    put('nasUsed', valid ? (nas.fs_used_gib / 1024).toFixed(2) : '—');
    put('nasTotal', valid ? ` / ${(nas.fs_total_gib / 1024).toFixed(2)} TiB` : ' / — TiB');
    put('nasFree', valid ? `${((nas.fs_total_gib - nas.fs_used_gib) / 1024).toFixed(2)} TiB FREE` : 'AWAITING TELEMETRY');
    fill('nasFill', valid ? nas.fs_used_gib / nas.fs_total_gib * 100 : 0);
    document.getElementById('nasFree').classList.toggle('kpi__sub--ok', valid && nas.fs_used_gib / nas.fs_total_gib < .85);
    put('nasPct', valid ? `${(nas.fs_used_gib / nas.fs_total_gib * 100).toFixed(1)}% USED` : '—');
    put('nasUp', number(nas?.uptime_s) ? `UP ${Math.floor(nas.uptime_s / 86400)}D ${Math.floor(nas.uptime_s % 86400 / 3600)}H` : 'UP —');
    put('nasTemp', typeof nas?.temp_c === 'number' && Number.isFinite(nas.temp_c) ? `${nas.temp_c.toFixed(1)} °C` : '— °C');
    for (const name of ['lynx', 'chimera']) {
      const host = find(name);
      const validRam = number(host?.mem_pct) && host.mem_pct <= 100;
      put(`${name}Cpu`, number(host?.cpu_pct) ? `CPU ${host.cpu_pct.toFixed(1)}%` : 'CPU —');
      put(`${name}Ram`, validRam ? `${host.mem_pct.toFixed(1)}%` : '—');
      fill(`${name}Fill`, validRam ? host.mem_pct : 0);
    }
    for (const id of ['nasMetric', 'ramMetric']) {
      const el = document.getElementById(id);
      el.title = data?.ts ? `CheckMK snapshot · ${new Date(Number(data.ts) * 1000).toLocaleString()}` : 'No telemetry available';
    }
  });

  // Detailed measurements complement the aggregate header without repeating it.
  const tickerTrack = document.getElementById('tickerTrack');
  let tickerContent = '';
  statusFeed.subscribe(data => {
    if (!tickerTrack) return;
    const hosts = Array.isArray(data?.hosts) ? data.hosts : [];
    const number = value => typeof value === 'number' && Number.isFinite(value);
    const items = hosts.filter(h => h && typeof h.name === 'string').map(h => {
      const readings = [];
      if (typeof h.state === 'string') readings.push(h.state);
      if (number(h.cpu_pct)) readings.push(`CPU ${h.cpu_pct.toFixed(1)}%`);
      if (number(h.mem_pct)) readings.push(`RAM ${h.mem_pct.toFixed(1)}%`);
      if (number(h.temp_c)) readings.push(`${h.temp_c.toFixed(1)} °C`);
      if (number(h.uptime_s)) readings.push(`UP ${Math.floor(h.uptime_s / 86400)}d ${Math.floor(h.uptime_s % 86400 / 3600)}h`);
      if (number(h.ports_up) && number(h.ports_monitored)) readings.push(`PORTS ${h.ports_up}/${h.ports_monitored}`);
      if (number(h.traffic_bps)) readings.push(`${(h.traffic_bps / 1e6).toFixed(2)} Mbit/s`);
      return `<span class="ticker__item"><b>${escHtml(h.name)}</b>${escHtml(readings.join(' · ') || 'no measurements')}</span><span class="ticker__sep">◇</span>`;
    }).join('');
    const content = items || '<span class="ticker__item">No host measurements available</span>';
    if (content === tickerContent) return;
    tickerContent = content;
    tickerTrack.innerHTML = `<span class="ticker__group">${content}</span><span class="ticker__group" aria-hidden="true">${content}</span>`;
  });

  initSystems(statusFeed, scrambleTo);

  initSpotify(scrambleTo);

  initWeather();

  // ---------- DATA.JSON : single source of truth -----------------
  const daysUntil = (target) => {
    const t = new Date(target);
    return Math.max(0, Math.ceil((t - new Date()) / 86400000));
  };
  const yearsMonthsSince = (since) => {
    const s = new Date(since);
    const now = new Date();
    let y = now.getFullYear() - s.getFullYear();
    let m = now.getMonth() - s.getMonth();
    if (now.getDate() < s.getDate()) m--;
    if (m < 0) { y--; m += 12; }
    return `${y}y ${String(m).padStart(2, '0')}m`;
  };

  fetch('data.json?v=20261025b', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      // -- KPIs --
      if (Array.isArray(data.kpis)) {
        for (const kpi of data.kpis) {
          const el = document.querySelector(`.kpi[data-kpi="${kpi.key}"]`);
          if (!el) continue;
          const valEl = el.querySelector('[data-kpi-value]');
          const labEl = el.querySelector('.kpi__label');
          const subEl = el.querySelector('.kpi__sub');
          if (kpi.label && labEl) labEl.textContent = kpi.label;
          if (kpi.sub && subEl) subEl.textContent = kpi.sub;
          if (subEl) {
            subEl.classList.toggle('kpi__sub--ok', kpi.subClass === 'ok');
          }
          const countVisual = el.querySelector('[data-count-visual]');
          if (countVisual) {
            const count = Number(kpi.value);
            countVisual.replaceChildren();
            if (Number.isInteger(count) && count >= 0 && count <= 100) {
              for (let i = 0; i < count; i++) countVisual.appendChild(document.createElement('i'));
            }
          }
          if (!valEl) continue;
          if (kpi.since) {
            valEl.textContent = yearsMonthsSince(kpi.since);
          } else if (kpi.target) {
            // JP trip: counts down to `target`, then — while there — down
            // to `end`; afterwards shows the total stay + subAfter.
            const start = new Date(kpi.target).getTime();
            const end = new Date(kpi.end).getTime();
            const progress = end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : 0;
            el.style.setProperty('--journey', `${(progress * 100).toFixed(2)}%`);
            const stamp = t => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
            const setText = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
            setText('tripPct', `${Math.round(progress * 100)}% ELAPSED`);
            setText('tripDep', `DEP ${stamp(kpi.target)}`);
            if (kpi.end) setText('tripRet', `RET ${stamp(kpi.end)}`);
            const toStart = daysUntil(kpi.target);
            const toEnd   = kpi.end ? daysUntil(kpi.end) : 0;
            let d = toStart;
            if (kpi.end && toStart <= 0) {
              d = toEnd > 0
                ? toEnd
                : Math.round((new Date(kpi.end) - new Date(kpi.target)) / 86400000);
              const phaseSub = toEnd > 0 ? kpi.subIn : kpi.subAfter;
              if (phaseSub && subEl) subEl.textContent = phaseSub;
            }
            valEl.innerHTML = `${d} <em>${escHtml(kpi.unit || 'd')}</em>`;
          } else if (kpi.value !== undefined) {
            if (kpi.unit) {
              valEl.innerHTML = `${escHtml(kpi.value)} <em>${escHtml(kpi.unit)}</em>`;
            } else {
              valEl.textContent = kpi.value;
            }
          }
        }
      }

      // -- SPEC SHEET --
      const specList = document.querySelector('.specsheet__list');
      if (specList && Array.isArray(data.spec)) {
        specList.innerHTML = data.spec.map(({ k, v }) => {
          const value = escHtml(v).replace(/\n/g, '<br/>');
          return `<div class="specsheet__row"><dt>${escHtml(k)}</dt><dd>${value}</dd></div>`;
        }).join('');
      }
    })
    .catch(err => console.warn('[lucya] data.json unavailable, using fallback HTML', err));

  initPhotos(LITE);

  // ---------- CHECKMK STATUS : fleet overview -------------------
  // The header overview reads the shared statusFeed (aggregate counts).
  // A server-side puller writes /status.json. The per-host block in the
  // same file feeds the neofetch sheets; here only the summary is used.
  // Shows a clearly-labelled "sample" until live data arrives; never fakes
  // "live".
  (() => {
    const ov = document.getElementById('thermal');   // header fleet overview (therm shell)
    if (!ov) return;
    const $ = (id) => document.getElementById(id);

    const ovTag=$('ovTag'), ovHosts=$('ovHosts'), ovHostsBar=$('ovHostsBar'),
          ovWarn=$('ovWarn'), ovCrit=$('ovCrit'), ovSvc=$('ovSvc'),
          ovSvcBar=$('ovSvcBar'), ovSrc=$('ovSrc'), ovAge=$('ovAge');

    let last = null;
    const pct = (n, d) => d > 0 ? Math.min(100, Math.max(0, n / d * 100)) : 0;
    const fmtAge = () => {
      if (!last) return 'awaiting probe';
      const a = Math.max(0, Math.floor(Date.now()/1000) - Number(last.ts || 0));
      return a < 60 ? `${a}s ago` : a < 3600 ? `${Math.floor(a/60)}m ago`
           : a < 86400 ? `${Math.floor(a/3600)}h ago` : `${Math.floor(a/86400)}d ago`;
    };
    const isStale = () => !Number.isFinite(Number(last?.ts)) || Number(last.ts) <= 0 || Date.now()/1000 - Number(last.ts) > 120;
    const renderHeader = () => {
      if (!ov || !last) return;
      const s = last.summary || last;
      const hu = +s.hosts_up||0, ht = +s.hosts_total||0;
      const ok = +s.services_ok||0, warn = +s.services_warn||0, crit = +s.services_crit||0;
      const st = +s.services_total || (ok + warn + crit);
      if (ovHosts) ovHosts.textContent = `${hu} / ${ht}`;
      if (ovSvc)   ovSvc.textContent   = `${ok} / ${st}`;
      if (ovWarn){ ovWarn.textContent = warn; ovWarn.style.color = warn>0 ? 'var(--acc-amb)' : ''; }
      if (ovCrit){ ovCrit.textContent = crit; ovCrit.style.color = crit>0 ? 'var(--acc-red)' : ''; }
      if (ovHostsBar){ ovHostsBar.style.width = pct(hu,ht).toFixed(1)+'%';
        ovHostsBar.parentElement.dataset.band = hu<ht ? (hu===0?'crit':'warm') : 'ok'; }
      if (ovSvcBar){ ovSvcBar.style.width = pct(ok,st).toFixed(1)+'%';
        ovSvcBar.parentElement.dataset.band = crit>0?'crit':warn>0?'warm':'ok'; }
      const healthy = ht > 0 && st > 0 && hu === ht && ok === st && !warn && !crit;
      const stale = isStale();
      ov.dataset.state = stale ? 'stale' : crit > 0 || (ht > 0 && hu === 0) ? 'dead' : healthy ? 'ok' : 'stale';
      $('ovAlerts').hidden = !warn && !crit;
      $('ovSummary').textContent = stale ? 'TELEMETRY OUTDATED' : healthy ? 'ALL SYSTEMS OPERATIONAL' : 'SYSTEMS REQUIRE ATTENTION';
      if (ovTag) ovTag.textContent = stale ? 'CHECKMK · STALE' : 'CHECKMK · LIVE';
      const room = last.room;
      const hasRoom = room?.temp_c != null && Number.isFinite(Number(room.temp_c));
      $('ovRoom').hidden = !hasRoom;
      $('ovRoom').textContent = hasRoom ? `ROOM ${Number(room.temp_c).toFixed(1)} °C` : '';
      $('ovRoom').title = hasRoom ? `Room temperature · ${String(room.state || 'unknown')}` : '';
      $('ovRoom').dataset.state = room?.state || 'unknown';
      if (ovSrc) ovSrc.textContent = String(last.source || 'checkmk');
      if (ovAge) ovAge.textContent = fmtAge();
    };

    const sample = () => {
      if (ov){ ov.dataset.state='down'; if(ovTag)ovTag.textContent='CHECKMK · OFFLINE';
        $('ovRoom').hidden=true; if(ovHosts)ovHosts.textContent='— / —'; if(ovSvc)ovSvc.textContent='— / —'; if(ovHostsBar)ovHostsBar.style.width='0%'; if(ovSvcBar)ovSvcBar.style.width='0%'; $('ovSummary').textContent='AWAITING LIVE TELEMETRY'; $('ovAlerts').hidden=true; if(ovSrc)ovSrc.textContent='sample data'; if(ovAge)ovAge.textContent='awaiting probe'; }
    };

    const tickAge = () => {
      if (!last) return;
      renderHeader();
    };

    sample();          // honest neutral state until the first response
    statusFeed.subscribe((data) => {
      last = data;
      if (last) renderHeader(); else sample();
    });
    setInterval(tickAge, 1000);
  })();

  // ---------- SPLASH : handoff to page (timed boot or skip) -------
  // flips body -> ready as the splash fade starts, so nav/pcard/hero-side
  // flicker in while the splash fades away. runs once, from the boot timer
  // or earlier via the skip listeners.
  const splashEl = document.getElementById('splash');

  let revealStarted = false;
  const startReveal = () => {
    if (revealStarted) return;
    revealStarted = true;
    // observe below-fold blocks — reveal as the user scrolls past them
    if ('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting){
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      // .about and .photos sit high enough to already be in view on load, so the
      // observer would reveal them without any scroll. Gate them behind the first
      // user scroll so they always play the reveal animation on scroll instead.
      const scrollGated = revealTargets.filter(el => el.matches('.about, .photos'));
      revealTargets.filter(el => !scrollGated.includes(el)).forEach(el => io.observe(el));
      if (scrollGated.length){
        // the page scrolls on <body> (overflow-y:auto), whose scroll events don't
        // bubble to window — capture on document so we catch the first scroll.
        document.addEventListener('scroll', () => {
          scrollGated.forEach(el => io.observe(el));
        }, { passive: true, once: true, capture: true });
      }
    } else {
      revealTargets.forEach(el => el.classList.add('is-visible'));
    }
    // Static labels used to run a decoder reveal here (scrambleOnView on
    // section titles, stat values and doc-bar values). It fired on scroll and
    // painted magenta .scramble-char glyphs over half the page — removed.
    // scrambleTo() itself stays: the Spotify track title still decodes, but
    // only when the track actually changes.
  };

  let splashFinished = false;
  const finishSplash = () => {
    if (splashFinished) return;
    splashFinished = true;
    clearTimeout(bootTimer);
    window.removeEventListener('keydown', skipBoot);
    if (splashEl){
      splashEl.removeEventListener('pointerdown', skipBoot);
      // is-complete snaps the progress UI to done, is-done starts the fade
      splashEl.classList.add('is-complete', 'is-done');
    }
    document.body.classList.add('is-ready');
    // nobody sees the log once the splash fades
    bootLog.done();
    // set-nav waits for this to play the first panel's entrance — running it
    // at DOM-ready would hide the whole animation behind the splash
    window.dispatchEvent(new CustomEvent('lucya:ready'));
    // video handoff: wallpaper copy starts, splash copy is torn down after
    // the fade so only one instance ever decodes
    if (!LITE && wallVideo && wallVideo.dataset.src && !wallVideo.src){
      wallVideo.src = wallVideo.dataset.src;
      wallVideo.play?.().catch(() => {});
    }
    setTimeout(() => {
      if (splashVideo){
        splashVideo.pause?.();
        splashVideo.removeAttribute('src');
        splashVideo.load?.();
      }
    }, 700);
    startReveal();
    // unlock scroll once the .6s fade is over
    setTimeout(() => { document.body.style.overflow = ''; }, 600);
  };
  const skipBoot = () => finishSplash();

  const bootTimer = setTimeout(finishSplash, BOOT_READY_MS);
  window.addEventListener('keydown', skipBoot);
  if (splashEl) splashEl.addEventListener('pointerdown', skipBoot);
  // The boot no longer shortens itself on a repeat visit, so skipping has to
  // be a real control and not just a hint: focusable, and reachable by anyone
  // who navigates by keyboard or screen reader rather than "any key".
  const splashSkipBtn = document.getElementById('splashSkip');
  if (splashSkipBtn) splashSkipBtn.addEventListener('click', skipBoot);

  // ---------- KPI BAR RELOCATION (mobile under profile) ----------
  const kpiBar = document.querySelector('.kpibar');
  const profileSection = document.getElementById('profile');
  const docstrip = document.querySelector('.ticker');
  if (kpiBar && profileSection && docstrip) {
    const mq = matchMedia('(max-width: 767.98px)');
    const place = () => {
      if (mq.matches) {
        if (kpiBar.previousElementSibling !== profileSection) {
          profileSection.insertAdjacentElement('afterend', kpiBar);
        }
      } else {
        if (kpiBar.previousElementSibling !== docstrip) {
          docstrip.insertAdjacentElement('afterend', kpiBar);
        }
      }
    };
    place();
    mq.addEventListener('change', place);
  }

  // ---------- SPOTIFY RELOCATION (mobile under the profile card) ----
  // On a phone the player is the first thing worth touching after the
  // card, so it moves into the hero grid right behind .pcard. A comment
  // node keeps its sidebar slot so desktop gets it back in place.
  const spotifySection = document.getElementById('spotify');
  const profileCard = document.querySelector('.hero__grid > .pcard');
  if (spotifySection && profileCard) {
    const mq = matchMedia('(max-width: 767.98px)');
    const slot = document.createComment('spotify');
    spotifySection.before(slot);
    const place = () => {
      if (mq.matches) {
        if (profileCard.nextElementSibling !== spotifySection) profileCard.after(spotifySection);
      } else if (slot.nextSibling !== spotifySection) {
        slot.after(spotifySection);
      }
    };
    place();
    mq.addEventListener('change', place);
  }

  // ---------- LITE TOGGLE : manual override, persists ------------
  // small fixed chip; switching reloads so every load-time decision
  // (video, splash, fonts already cached) is applied consistently.
  (() => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'liteToggle';
    btn.className = 'lite-toggle mono';
    btn.innerHTML = `LITE · <b>${LITE ? 'ON' : 'OFF'}</b>`;
    btn.title = LITE
      ? 'lite mode: animations/video off for weak devices — click for the full experience'
      : 'click to switch to lite mode (less CPU/GPU/data)';
    btn.setAttribute('aria-pressed', String(LITE));
    btn.addEventListener('click', () => {
      try { localStorage.setItem('lucya-lite', LITE ? '0' : '1'); } catch (e) {}
      location.reload();
    });
    document.body.appendChild(btn);
  })();

  // ---------- MOBILE NAV : see mpage.js (one page per tab) ---------

})();
