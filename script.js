/* ================================================================
   LUCYA // lucya.sh  —  interactions
   ================================================================ */

(() => {

  // ---------- SHARED HELPERS --------------------------------------
  const pad2 = n => String(n).padStart(2, '0');
  const escHtml = (s) => String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));

  // ---------- LITE MODE -------------------------------------------
  // decided by the head script lite.js (auto-detect + manual override);
  // here it gates everything that costs CPU/GPU/bandwidth at runtime.
  const LITE = !!window.LUCYA_LITE;

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
  //   ~2.9s  logo build ends, wordmark settled, idle pulse starts breathing
  //   ~3.4s  progress bar reaches 100%
  //   ~4.5s  the .is-complete blink across the boot chrome finishes
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

  // ---------- SPLASH : session id + boot log ---------------------
  const sessionEl = document.getElementById('splashSession');
  if (sessionEl){
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    sessionEl.textContent = `SESSION · ${stamp}`;
  }

  const logEl = document.getElementById('splashLog');
  if (logEl){
    const hex = () => Math.random().toString(16).slice(2, 8).toUpperCase();
    const lines = [
      ['OK',   'LUCYA-CORE // COLD BOOT'],
      ['OK',   'MOUNTING /dev/coffee'],
      ['OK',   'LOAD KERNEL 7.0.1'],
      ['WAIT', 'HANDSHAKE · ATLAS'],
      ['OK',   'AUTH KEYRING · LUCYA@CORE'],
      ['OK',   'NET · SECURE CHANNEL UP'],
      ['OK',   'LOADING FONTS · ICONS'],
      ['WAIT', 'WARMING UP CRT TUBES'],
      ['OK',   'LOCALE · DE-BY'],
      ['OK',   'CALIBRATING HUE BUFFER'],
      ['OK',   'SPAWN COMPOSITOR'],
      ['OK',   'READY · HANDOFF TO UI'],
    ];
    const frag = document.createDocumentFragment();
    lines.forEach((l, i) => {
      const li = document.createElement('li');
      const cls = l[0] === 'OK' ? 'lv' : (l[0] === 'WAIT' ? 'lv lv--wait' : 'lv lv--err');
      li.innerHTML = `<span class="${cls}">[${l[0]}]</span><span class="ll">${l[1]}</span><span class="lh">0x${hex()}</span>`;
      frag.appendChild(li);
    });
    logEl.appendChild(frag);
  }
  const logItems = logEl ? Array.from(logEl.children) : [];

  // ---------- SPLASH : progress bar ------------------------------
  // progress only starts once the whole splash UI has built in.
  // UI reveal timing (CSS): corners 0.05-0.42s, log 0.55s, bottom 0.7s.
  // Log lines stream in with progress, so this also sets when they start.
  const PROGRESS_START_DELAY = 900;
  const progressPct = document.getElementById('splashProgress');
  const progressFill = document.getElementById('splashProgressFill');
  if (progressPct && progressFill) {
    let p = 0;
    const revealLogs = () => {
      if (!logItems.length) return;
      const target = Math.min(logItems.length, Math.ceil(p * logItems.length / 100));
      for (let j = 0; j < target; j++){
        if (!logItems[j].classList.contains('is-in')) logItems[j].classList.add('is-in');
      }
    };
    const tick = () => {
      if (p >= 100) {
        progressPct.textContent = '100%';
        progressFill.style.width = '100%';
        logItems.forEach(li => li.classList.add('is-in'));
        const splashEl = document.getElementById('splash');
        if (splashEl) splashEl.classList.add('is-complete');
        return;
      }
      // Bigger steps on a shorter interval. The jitter is what makes it read
      // as work being done rather than a timer, but the old spread (2-11% per
      // tick every 160-420ms) put the finish anywhere between 2s and 6s — far
      // too loose once the whole boot is 4.2s. Tighter on both axes: ~12.5
      // ticks at ~195ms lands the bar at ~3.4s, still visibly uneven.
      p += Math.round(4 + Math.random() * 8);
      if (p > 100) p = 100;
      progressPct.textContent = `${pad2(p)}%`;
      progressFill.style.width = p + '%';
      revealLogs();
      setTimeout(tick, LITE ? 60 + Math.random() * 90 : 110 + Math.random() * 170);
    };
    setTimeout(tick, LITE ? 100 : PROGRESS_START_DELAY);
  }

  // ---------- REVEAL : mark below-fold blocks (observer starts post-splash) ----------
  const revealSelectors = ['.about', '.interests', '.rack', '.buttons', '.neofetch', '.services', '.spotify', '.photos', '.foot'];
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
      ['p0','p1','p2','p3','p4','p5'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('drawn', 'filled');
      });
      return;
    }
    const rgbR = document.getElementById('rgbR');
    const rgbB = document.getElementById('rgbB');
    // Stroke durations, shortened along with the rest of the boot. Each piece
    // still finishes drawing before the next one is halfway, which is what
    // makes it read as an assembly rather than six things happening at once.
    const order = [
      { id: 'p2', dur: 0.75 },
      { id: 'p5', dur: 0.62 },
      { id: 'p3', dur: 0.62 },
      { id: 'p0', dur: 0.45 },
      { id: 'p4', dur: 0.3 },
      { id: 'p1', dur: 0.3 },
    ];
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
      order.forEach(p => {
        const el = document.getElementById(p.id);
        if (!el) return;
        try {
          const len = el.getTotalLength();
          el.style.setProperty('--len', len);
          el.style.setProperty('--dur', p.dur + 's');
        } catch(e){}
      });
      // the wordmark is held back and glitched in at the end (phase 3)
      if (label) label.style.opacity = '0';

      // --- phase 1: draw the outline ---
      await wait(200);
      for (let i = 0; i < order.length; i++){
        if (aborted()) return;
        const el = document.getElementById(order[i].id);
        if (el) el.classList.add('drawn');
        if (i === 1 || i === 3) await shake(mainSvg, 3, 3);
        await wait(105);
      }
      await wait(150);
      if (aborted()) return;

      // --- phase 2: signal drops, logo comes back solid ---
      await signalLoss(glitchLogo || mainSvg, 260);
      await burst(mainSvg, 6, 15);
      for (let i = 0; i < order.length; i++){
        if (aborted()) return;
        const el = document.getElementById(order[i].id);
        if (el) el.classList.add('filled');
        if (i % 2 === 0){ rgbSplit(2 + Math.random()*3); await wait(22); rgbClear(); }
        await wait(30);
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

  // ---------- TEXT SCRAMBLE --------------------------------------
  // decoder-style transition. Random glyphs flicker, then resolve to the
  // target text one char at a time. Used for section headers, hero stats,
  // and the spotify track title on rotation.
  const SCRAMBLE_CHARS = '!<>-_\\/[]{}=+*^?#$&%01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ';
  // per-char start/end below are authored in 60fps frame units, but they are
  // read against elapsed wall-clock time, not against a frame counter. A
  // frame-counted reveal has no fixed duration — it stretches by exactly the
  // factor the frame rate drops by, so the same ~0.6s decode that reads as a
  // flicker on desktop crawls for several seconds on a busy phone. Timing it
  // off the clock makes a dropped frame skip glyphs instead of adding time.
  const SCRAMBLE_FPS = 60;
  class TextScrambler {
    constructor(el){ this.el = el; this.queue = []; this.frame = 0; }
    setText(newText){
      const oldText = this.el.textContent;
      const len = Math.max(oldText.length, newText.length);
      this.queue = [];
      for (let i = 0; i < len; i++){
        const start = Math.floor(Math.random() * 14);
        const end = start + 12 + Math.floor(Math.random() * 22);
        this.queue.push({ from: oldText[i] || '', to: newText[i] || '', start, end, char: '' });
      }
      cancelAnimationFrame(this.rafId);
      this.frame = 0;
      this.startedAt = 0;
      // first frame still paints synchronously (it renders the outgoing text,
      // so the element is never briefly empty); rAF drives everything after.
      return new Promise(res => { this.resolve = res; this._tick(performance.now()); });
    }
    _tick = (now) => {
      if (!this.startedAt) this.startedAt = now;
      this.frame = (now - this.startedAt) / (1000 / SCRAMBLE_FPS);
      let out = '';
      let done = 0;
      for (let i = 0; i < this.queue.length; i++){
        const q = this.queue[i];
        if (this.frame >= q.end){ done++; out += escHtml(q.to); }
        else if (this.frame >= q.start){
          if (!q.char || Math.random() < 0.28){
            q.char = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }
          out += `<span class="scramble-char">${escHtml(q.char)}</span>`;
        } else {
          out += escHtml(q.from);
        }
      }
      this.el.innerHTML = out;
      if (done === this.queue.length){ this.resolve(); }
      else { this.rafId = requestAnimationFrame(this._tick); }
    };
  }
  const scramblers = new WeakMap();
  const scrambleTo = (el, text) => {
    if (!el) return;
    if (LITE){ el.textContent = String(text); return Promise.resolve(); }
    let s = scramblers.get(el);
    if (!s){ s = new TextScrambler(el); scramblers.set(el, s); }
    return s.setText(String(text));
  };

  // ---------- CLOCK ----------------------------------------------
  const fmt12 = d => {
    let h = d.getHours(); const m = d.getMinutes();
    const am = h < 12 ? 'AM' : 'PM';
    h = h % 12 || 12;
    return `${h}:${pad2(m)} ${am}`;
  };
  const navTime   = document.getElementById('navTime');
  const footTime  = document.getElementById('footTime');
  const tzLocal   = document.getElementById('tzLocal');
  const tzYours   = document.getElementById('tzYours');

  const updateClock = () => {
    const now = new Date();
    const hms = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    if (navTime)  navTime.textContent  = `${hms} CET`;
    if (footTime) footTime.textContent = `CET ${hms} · 通信中`;
    if (tzLocal)  tzLocal.textContent  = fmt12(now);
    if (tzYours)  tzYours.textContent  = fmt12(now);
  };
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- JP TRIP COUNTDOWN : あとXX日 ------------------------
  // three phases, same anchor dates as the JAPAN kpi in data.json:
  //   pre  — days until departure
  //   in   — days left in Japan (counts down to the return flight)
  //   post — trip over: the badge disappears
  const JP_START = new Date('2026-08-09T00:00:00');
  const JP_END   = new Date('2027-01-02T00:00:00');
  const jpTrip = () => {
    const now = new Date();
    const left = t => Math.ceil((t - now) / 86400000);
    if (left(JP_START) > 0) return { phase: 'pre',  days: left(JP_START) };
    if (left(JP_END)   > 0) return { phase: 'in',   days: left(JP_END) };
    return { phase: 'post', days: 0 };
  };
  const updateCountdown = () => {
    const s = jpTrip();
    const a = document.getElementById('countdownDays');
    const b = document.getElementById('pcardCountdown');
    if (a) a.textContent = s.days;
    if (b) b.textContent = s.days;
    const badge = a && a.closest('.pcard__countdown');
    if (badge) badge.style.display = s.phase === 'post' ? 'none' : '';
  };
  updateCountdown();
  setInterval(updateCountdown, 60_000);

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
    ['eu.gif','eu'],['binbows.gif','binbows.net'],['lucya.png','lucya.sh'],
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

  // ---------- DOMAINS --------------------------------------------
  const domains = [
    ['lucya.sh',           'lucya_logo_text.svg',     'Personal homepage',                   'PRIMARY', true, 'logo'],
    ['images.lucya.sh',    'gallery.svg',             'Image gallery',                       'ACTIVE',  true],
    ['aizaku.com',         'aizaku.com.svg',          'Defence industry',                    'ACTIVE',  true],
    ['astraos.app',        'astraos.app.svg',         'AstraOS · main product site',         'ACTIVE',  true],
    ['beta.astraos.app',   'beta.astraos.app.svg',    'AstraOS public beta portal',          'ACTIVE',  true],
    ['status.lucya.systems', 'status.lucya.systems.svg',  'System status · uptime monitor',      'ACTIVE',  true],
    ['binbows.net',        'binbows.net.svg',         'Official Binbows site',               'ACTIVE',  true],
    ['inter-astra.net',    'inter-astra.net.svg',     'inter-astra Corp.',              'PARKED',  true],
    ['gov.inter-astra.net','gov.inter-astra.net.svg', 'Internal governance portal',          'ACTIVE',  true],
    ['wirtaufendeinauto.de','wirtaufendeinauto.de.svg','Lass dein Auto taufen',         'ACTIVE',  true],
  ];
  const dGrid = document.getElementById('domainGrid');
  if (dGrid) {
    const frag = document.createDocumentFragment();
    domains.forEach(([url, img, role, status, ok, src]) => {
      const path = src === 'logo' ? `images/logo/${img}` : `images/projects/${img}`;
      const card = document.createElement('a');
      card.className = 'dcard';
      card.href = `https://${url}`;
      card.target = '_blank';
      card.rel = 'noopener';
      card.innerHTML = `
        <div class="dcard__logo"><img src="${path}" alt="${url}" loading="lazy" decoding="async" /></div>
        <div class="dcard__url">${url}</div>
        <div class="dcard__role">${role}</div>
        <div class="dcard__row">
          <span class="${ok ? 'ok' : 'dim'}">● ${status}</span>
          <span>TLS · OK</span>
        </div>
      `;
      frag.appendChild(card);
    });
    dGrid.appendChild(frag);
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

  // ---------- NEOFETCH : real systems ----------------------------
  // raw content uses inline <span style="color:..."> and occasionally
  // malformed <span/> as closers — we sanitize on inject.
  // Sheets are hand-transcribed snapshots. Entries with a `live` id get
  // their volatile figures (uptime, memory, cpu, temperature) rewritten
  // from status.json; those spans carry .nlive so the dotted underline
  // says which numbers are current and which are from the dump.
  const sanitize = s => s.replace(/<span\/>/g, '</span>');

  const neofetchData = [
    {
      id: 'lynx',
      tab: 'lynx',
      group: 'server',
      title: 'lynx.lucya.intra // homelab core hypervisor',
      width: 800,
      live: 'lynx',        // host name in status.json
      memTotal: 15.53,     // GiB — fallback for feeds that only know the percentage
      content: `<span style="color: #e7e7e7;">         .://:'              '://:.<span/>             <span style="color: #E57000;">root<span/><span style="color: #e7e7e7;">@<span/><span style="color: #E57000;">lynx</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'<span/>           <span style="color: #E57000;">---------<span/>
<span style="color: #e7e7e7;">        'sMMMMMMMd:      :mMMMMMMMs'<span/>            <span style="color: #e7e7e7;">OS: Proxmox VE 9.x.x x86_64<span/>
<span style="color: #E57000;">'-/+oo+/:<span/><span style="color: #e7e7e7;">'.yMMMMMMMh-  -hMMMMMMMy.'<span/><span style="color: #E57000;">:/+oo+/-'    <span/><span style="color: #e7e7e7;">Host: Macmini6,2 (1.0)<span/>
<span style="color: #E57000;">':oooooooo/<span/><span style="color: #e7e7e7;">'-hMMMMMMMyyMMMMMMMh-'<span/><span style="color: #E57000;">/oooooooo:'    <span/><span style="color: #e7e7e7;">Kernel: Linux 6.17.4-2-pve<span/>
<span style="color: #E57000;">  '/oooooooo:<span/><span style="color: #e7e7e7;">':mMMMMMMMMMMMMm:'<span/><span style="color: #E57000;">:oooooooo/'      <span/><span style="color: #e7e7e7;">Uptime: <span class="nlive" data-live="uptime">23 days, 22 hours, 54 mins</span><span/>
<span style="color: #E57000;">    ./ooooooo+-<span/><span style="color: #e7e7e7;"> +NMMMMMMMMN+ <span/><span style="color: #E57000;">-+ooooooo/.        <span/><span style="color: #e7e7e7;">Packages: 738 (dpkg)<span/>
<span style="color: #E57000;">      .+ooooooo+-<span/><span style="color: #e7e7e7;">'oNMMMMNo'<span/><span style="color: #E57000;">-+ooooooo+.          <span/><span style="color: #e7e7e7;">Shell: bash 5.2.37<span/>
<span style="color: #E57000;">        -+ooooooo/.<span/><span style="color: #e7e7e7;">'sMMs'<span/><span style="color: #E57000;">./ooooooo+-            <span/><span style="color: #e7e7e7;">Terminal: termproxy<span/>
<span style="color: #E57000;">          :oooooooo/<span/><span style="color: #e7e7e7;">'..'<span/><span style="color: #E57000;">/oooooooo:              <span/><span style="color: #e7e7e7;">CPU: Intel(R) Core(TM) i7-3615QM (8) @ 3.30 GHz <span class="nlive" data-live="temp"></span><span/>
<span style="color: #E57000;">          :oooooooo/'<span/><span style="color: #e7e7e7;">..<span/><span style="color: #E57000;">'/oooooooo:              <span/><span style="color: #e7e7e7;">CPU Usage: <span class="nlive" data-live="cpu">—</span><span/>
<span style="color: #E57000;">        -+ooooooo/.'<span/><span style="color: #e7e7e7;">sMMs<span/><span style="color: #E57000;">'./ooooooo+-            <span/><span style="color: #e7e7e7;">GPU: Intel 3rd Gen Core processor Graphics Controller<span/>
<span style="color: #E57000;">      .+ooooooo+-'<span/><span style="color: #e7e7e7;">oNMMMMNo<span/><span style="color: #E57000;">'-+ooooooo+.          <span/><span style="color: #e7e7e7;">Memory: <span class="nlive" data-live="mem-used">12.66 GiB</span> / <span class="nlive" data-live="mem-total">15.53 GiB</span> (<span/><span class="nlive" data-live="mem-pct" style="color: #da0a0a;">82%<span/><span style="color: #e7e7e7;">)<span/>
<span style="color: #E57000;">    ./ooooooo+- <span/><span style="color: #e7e7e7;">+NMMMMMMMMN+ <span/><span style="color: #E57000;">-+ooooooo/.        <span/><span style="color: #e7e7e7;">Swap: 124.55 MiB / 8.00 GiB (<span/><span style="color: #06e236;">2%<span/><span style="color: #e7e7e7;">)<span/>
<span style="color: #E57000;">  '/oooooooo:'<span/><span style="color: #e7e7e7;">:mMMMMMMMMMMMMm:<span/><span style="color: #E57000;">':oooooooo/'      <span/><span style="color: #e7e7e7;">Disk (/): 21.41 GiB / 93.93 GiB (<span/><span style="color: #06e236;">23%<span/><span style="color: #e7e7e7;">) - ext4<span/>
<span style="color: #E57000;">':oooooooo/'<span/><span style="color: #e7e7e7;">-hMMMMMMMyyMMMMMMMh-<span/><span style="color: #E57000;">'/oooooooo:'    <span/><span style="color: #e7e7e7;">Local IP (vmbr0): 192.168.178.252/24<span/>
<span style="color: #E57000;">'-/+oo+/:'<span/><span style="color: #e7e7e7;">.yMMMMMMMh-  -hMMMMMMMy.<span/><span style="color: #E57000;">':/+oo+/-'    <span/><span style="color: #e7e7e7;">Locale: en_US.UTF-8<span/>
<span style="color: #e7e7e7;">        'sMMMMMMMm:      :dMMMMMMMs'<span/>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'<span/>
<span style="color: #e7e7e7;">         '://:'              '://:'<span/> `
    },
    {
      id: 'vega',
      tab: 'vega',
      group: 'server',
      title: 'vega.lucya.intra // synology nas',
      width: 780,
      live: 'vega',
      memTotal: 8.00,
      // DSM has no fastfetch, so this sheet is transcribed by hand from
      // Systemsteuerung > Info-Center (Allgemein / Speicher / Netzwerk).
      // Only what those pages actually show — the serial number and the MAC
      // stay off a public page. The logo is the DSM app icon in ASCII.
      content: `  <span style="color:#2074cf;">#############################</span>     <span style="color:#44a9fe;">astra</span><span style="color:#8a8f98;">@</span><span style="color:#44a9fe;">vega</span>
 <span style="color:#2074cf;">###############################</span>    <span style="color:#8a8f98;">----------</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">OS:</span><span style="color:#e7e7e7;"> DSM 7.x.x-xxxx</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Host:</span><span style="color:#e7e7e7;"> Synology DS918+ (4-bay)</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Uptime:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="uptime">27 days, 13 hours, 47 mins</span></span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">CPU:</span><span style="color:#e7e7e7;"> Intel Celeron J3455 (4) @ 1.50 GHz</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">#######</span><span style="color:#2074cf;">####</span><span style="color:#ffffff;">#######</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">CPU Usage:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="cpu">—</span></span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">########</span><span style="color:#ffffff;">###</span><span style="color:#2074cf;">###</span><span style="color:#ffffff;">###</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Memory:</span><span style="color:#e7e7e7;"> <span class="nlive" data-live="mem-used">—</span> / <span class="nlive" data-live="mem-total">8.00 GiB</span> (<span class="nlive" data-live="mem-pct">—</span>)</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">######</span><span style="color:#2074cf;">###</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#</span><span style="color:#ffffff;">###</span><span style="color:#2074cf;">#</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Volume 1 (SSD RAID 1):</span><span style="color:#e7e7e7;"> 502.7 GB / 884.2 GB (56%)</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#########</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">#</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Volume 2 (HDD RAID 1):</span><span style="color:#e7e7e7;"> 1.7 TB / 3.5 TB (49%)</span>
<span style="color:#2074cf;">##</span><span style="color:#ffffff;">#######</span><span style="color:#2074cf;">###</span><span style="color:#ffffff;">########</span><span style="color:#2074cf;">##</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">#####</span><span style="color:#ffffff;">##</span><span style="color:#2074cf;">##</span>   <span style="color:#44a9fe;">Drives:</span><span style="color:#e7e7e7;"> 2 x Samsung 870 EVO 1 TB - 34/35 °C</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Drives:</span><span style="color:#e7e7e7;"> 2 x WD Red WD40EFRX 4 TB - 41/40 °C</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Cache:</span><span style="color:#e7e7e7;"> HP SSD EX900 120 GB</span>
<span style="color:#2074cf;">#################################</span>   <span style="color:#44a9fe;">Thermal:</span><span style="color:#06e236;"> Normal</span>
 <span style="color:#2074cf;">###############################</span>    <span style="color:#44a9fe;">Fan:</span><span style="color:#e7e7e7;"> Quiet Mode</span>
  <span style="color:#2074cf;">#############################</span>     <span style="color:#44a9fe;">USB:</span><span style="color:#e7e7e7;"> Transcend StoreJet (external)</span>
                                    <span style="color:#44a9fe;">Network (bond1):</span><span style="color:#e7e7e7;"> 2000 Mbit/s full duplex - MTU 1500</span>
                                    <span style="color:#44a9fe;">Local IP:</span><span style="color:#e7e7e7;"> 192.168.178.xxx/xx</span>
                                    <span style="color:#44a9fe;">DNS:</span><span style="color:#e7e7e7;"> 192.168.178.xxx</span>
                                    <span style="color:#44a9fe;">NTP:</span><span style="color:#e7e7e7;"> time.google.com</span>
                                    <span style="color:#44a9fe;">Timezone:</span><span style="color:#e7e7e7;"> Europe/Berlin (GMT+01:00)</span>
                                    <span style="color:#44a9fe;">Locale:</span><span style="color:#e7e7e7;"> de-DE</span>`
    },
    {
      id: 'chimera',
      tab: 'chimera',
      group: 'server',
      title: 'chimera.lucya.intra // homelab hypervisor',
      width: 850,
      live: 'chimera',
      memTotal: 62.69,
      content: `<span style="color: #e7e7e7;">         .://:'              '://:.</span>             <span style="color: #E57000;">root</span><span style="color: #e7e7e7;">@</span><span style="color: #E57000;">chimera</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'</span>           <span style="color: #E57000;">------------</span>
<span style="color: #e7e7e7;">        'sMMMMMMMd:      :mMMMMMMMs'</span>            <span style="color: #e7e7e7;">OS: Proxmox VE 9.2.4 x86_64</span>
<span style="color: #E57000;">'-/+oo+/:</span><span style="color: #e7e7e7;">'.yMMMMMMMh-  -hMMMMMMMy.'</span><span style="color: #E57000;">:/+oo+/-'    </span><span style="color: #e7e7e7;">Host: SYS-5018D-FN4T (0123456789)</span>
<span style="color: #E57000;">':oooooooo/</span><span style="color: #e7e7e7;">'-hMMMMMMMyyMMMMMMMh-'</span><span style="color: #E57000;">/oooooooo:'    </span><span style="color: #e7e7e7;">Kernel: Linux 7.0.14-5-pve</span>
<span style="color: #E57000;">  '/oooooooo:</span><span style="color: #e7e7e7;">':mMMMMMMMMMMMMm:'</span><span style="color: #E57000;">:oooooooo/'      </span><span style="color: #e7e7e7;">Uptime: <span class="nlive" data-live="uptime">17 hours, 29 mins</span></span>
<span style="color: #E57000;">    ./ooooooo+-</span><span style="color: #e7e7e7;"> +NMMMMMMMMN+ </span><span style="color: #E57000;">-+ooooooo/.        </span><span style="color: #e7e7e7;">Packages: 753 (dpkg)</span>
<span style="color: #E57000;">      .+ooooooo+-</span><span style="color: #e7e7e7;">'oNMMMMNo'</span><span style="color: #E57000;">-+ooooooo+.          </span><span style="color: #e7e7e7;">Shell: bash 5.2.37</span>
<span style="color: #E57000;">        -+ooooooo/.</span><span style="color: #e7e7e7;">'sMMs'</span><span style="color: #E57000;">./ooooooo+-            </span><span style="color: #e7e7e7;">Display (VGA-1): 1024x768 @ 60 Hz</span>
<span style="color: #E57000;">          :oooooooo/</span><span style="color: #e7e7e7;">'..'</span><span style="color: #E57000;">/oooooooo:              </span><span style="color: #e7e7e7;">Terminal: termproxy</span>
<span style="color: #E57000;">          :oooooooo/'</span><span style="color: #e7e7e7;">..</span><span style="color: #E57000;">'/oooooooo:              </span><span style="color: #e7e7e7;">CPU: Intel(R) Xeon(R) D-1541 (16) @ 2.70 GHz <span class="nlive" data-live="temp"></span></span>
<span style="color: #E57000;">        -+ooooooo/.'</span><span style="color: #e7e7e7;">sMMs</span><span style="color: #E57000;">'./ooooooo+-            </span><span style="color: #e7e7e7;">CPU Usage: <span class="nlive" data-live="cpu">—</span></span>
<span style="color: #E57000;">      .+ooooooo+-'</span><span style="color: #e7e7e7;">oNMMMMNo</span><span style="color: #E57000;">'-+ooooooo+.          </span><span style="color: #e7e7e7;">GPU 1: ASPEED Technology, Inc. ASPEED Graphics Family</span>
<span style="color: #E57000;">    ./ooooooo+- </span><span style="color: #e7e7e7;">+NMMMMMMMMN+ </span><span style="color: #E57000;">-+ooooooo/.        </span><span style="color: #e7e7e7;">GPU 2: NVIDIA Quadro M2000 [Discrete]</span>
<span style="color: #E57000;">  '/oooooooo:'</span><span style="color: #e7e7e7;">:mMMMMMMMMMMMMm:</span><span style="color: #E57000;">':oooooooo/'      </span><span style="color: #e7e7e7;">Memory: <span class="nlive" data-live="mem-used">31.92 GiB</span> / <span class="nlive" data-live="mem-total">62.69 GiB</span> (</span><span class="nlive" data-live="mem-pct" style="color: #06e236;">51%</span><span style="color: #e7e7e7;">)</span>
<span style="color: #E57000;">':oooooooo/'</span><span style="color: #e7e7e7;">-hMMMMMMMyyMMMMMMMh-</span><span style="color: #E57000;">'/oooooooo:'    </span><span style="color: #e7e7e7;">Swap: Disabled</span>
<span style="color: #E57000;">'-/+oo+/:'</span><span style="color: #e7e7e7;">.yMMMMMMMh-  -hMMMMMMMy.</span><span style="color: #E57000;">':/+oo+/-'    </span><span style="color: #e7e7e7;">Disk (/): 3.13 GiB / 430.18 GiB (</span><span style="color: #06e236;">1%</span><span style="color: #e7e7e7;">) - zfs</span>
<span style="color: #e7e7e7;">        'sMMMMMMMm:      :dMMMMMMMs'</span>            <span style="color: #e7e7e7;">Disk (/rpool): 128.00 KiB / 427.05 GiB (</span><span style="color: #06e236;">0%</span><span style="color: #e7e7e7;">) - zfs</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'</span>           <span style="color: #e7e7e7;">Local IP (vmbr0): 192.168.178.242/24</span>
<span style="color: #e7e7e7;">         '://:'              '://:'</span>             <span style="color: #e7e7e7;">Locale: en_US.UTF-8</span>`
    },
    {
      id: 'esx-01',
      tab: 'esx-01',
      group: 'server',
      title: 'esx-01.lucya.intra // homelab virtualization host #01',
      width: 750,
      content: `<span style="color:#8dc242;">          ---------===========++  </span>  <span style="color:#56b6c2;">root@esx-01</span>
<span style="color:#8dc242;">         --------============+++  </span>  <span style="color:#56b6c2;">--------------------</span>
<span style="color:#8dc242;">         -----             =+++++ </span>  <span style="color:#e5c07b;">OS:</span> <span style="color:#ffffff;">VMware ESXi-8.0U3e</span>
<span style="color:#8dc242;">         -----   <span style="color:#fcba03;">::::::::</span>   <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Host:</span> <span style="color:#ffffff;">PowerEdge R720</span>
<span style="color:#8dc242;">   ----------=  <span style="color:#fcba03;">::::------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Kernel:</span> <span style="color:#ffffff;">VMkernel 24677879</span>
<span style="color:#8dc242;">  ---------===  <span style="color:#fcba03;">:::-------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Uptime:</span> <span style="color:#ffffff;">20 days 2 hours 11 mins</span>
<span style="color:#8dc242;"> :-----         <span style="color:#fcba03;">::--------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Shell:</span> <span style="color:#ffffff;">BusyBox + ESXi Shell</span>
<span style="color:#8dc242;"> :----          <span style="color:#fcba03;">:---------</span>  <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Display:</span> <span style="color:#ffffff;">N/A (Headless)</span>
<span style="color:#8dc242;"> :----  <span style="color:#fcba03;">::::::::--------</span>    <span style="color:#8dc242;">=++++ </span>  <span style="color:#e5c07b;">Hypervisor:</span> <span style="color:#ffffff;">vSphere 8.0.3 Enterprise+</span>
<span style="color:#8dc242;"> :---=  <span style="color:#fcba03;">:::::::---</span>         <span style="color:#8dc242;">=+++++ </span>  <span style="color:#e5c07b;">vCenter:</span> <span style="color:#ffffff;">Connected</span>
<span style="color:#8dc242;"> --===  <span style="color:#fcba03;">::::::----</span>  <span style="color:#8dc242;">-+++++++++++  </span>  <span style="color:#e5c07b;">CPU:</span> <span style="color:#ffffff;">2 x Intel(R) Xeon(R) E5-2670 0 (32) @ 3.60GHz</span>
<span style="color:#8dc242;"> -====  <span style="color:#fcba03;">:::::-----</span>  <span style="color:#8dc242;">-++++++++++   </span>  <span style="color:#e5c07b;">Memory:</span> <span style="color:#ffffff;">403.20 GiB / 863.94 GiB</span>
<span style="color:#8dc242;"> =====   <span style="color:#fcba03;">::::----</span>   <span style="color:#8dc242;">-++++         </span>  <span style="color:#e5c07b;">Swap:</span> <span style="color:#ffffff;">0 B / 44.00 GiB</span>
<span style="color:#8dc242;"> ======             =++++         </span>  <span style="color:#e5c07b;">Datastore (SSD1):</span> <span style="color:#ffffff;">47.69 GiB / 58.37 GiB (82%)</span>
<span style="color:#8dc242;">  ======+++++++++++++++++         </span>  <span style="color:#e5c07b;">Datastore (HDD1):</span> <span style="color:#ffffff;">68.32 GiB / 1.82 TiB (4%)</span>
<span style="color:#8dc242;">   ====+++++++++++++++++          </span>  <span style="color:#e5c07b;">Management IP:</span> <span style="color:#ffffff;">10.0.3.1/8</span>
                                    <span style="color:#e5c07b;">Locale:</span> <span style="color:#ffffff;">de-DE</span>`
    },
    {
      id: 'esx-02',
      tab: 'esx-02',
      group: 'server',
      title: 'esx-02.lucya.intra // homelab virtualization host #02',
      width: 750,
      content: `<span style="color:#FFB3BA;">          ---------===========++  </span>  <span style="color:#56b6c2;">root@esx-02</span>
<span style="color:#FFCCB3;">         --------============+++  </span>  <span style="color:#56b6c2;">--------------------</span>
<span style="color:#FFDAB3;">         -----             =+++++ </span>  <span style="color:#e5c07b;">OS:</span> <span style="color:#ffffff;">VMware ESXi-8.0U3e</span>
<span style="color:#FFE8B3;">         -----   </span><span style="color:#FFFFB3;">::::::::</span><span style="color:#FFE8B3;">   =++++ </span>  <span style="color:#e5c07b;">Host:</span> <span style="color:#ffffff;">IBM System x3650 M5</span>
<span style="color:#FFFFB3;">   ----------=  </span><span style="color:#E8FFB3;">::::------</span><span style="color:#FFFFB3;">  =++++ </span>  <span style="color:#e5c07b;">Kernel:</span> <span style="color:#ffffff;">VMkernel 24677879</span>
<span style="color:#E8FFB3;">  ---------===  </span><span style="color:#CCFFB3;">:::-------</span><span style="color:#E8FFB3;">  =++++ </span>  <span style="color:#e5c07b;">Uptime:</span> <span style="color:#ffffff;">27 days 2 hours 11 mins</span>
<span style="color:#CCFFB3;"> :-----         </span><span style="color:#B3FFB3;">::--------</span><span style="color:#CCFFB3;">  =++++ </span>  <span style="color:#e5c07b;">Shell:</span> <span style="color:#ffffff;">BusyBox + ESXi Shell</span>
<span style="color:#B3FFB3;"> :----          </span><span style="color:#B3FFCC;">:---------</span><span style="color:#B3FFB3;">  =++++ </span>  <span style="color:#e5c07b;">Display:</span> <span style="color:#ffffff;">N/A (Headless)</span>
<span style="color:#B3FFCC;"> :----  </span><span style="color:#B3FFE8;">::::::::--------</span><span style="color:#B3FFCC;">    =++++ </span>  <span style="color:#e5c07b;">Hypervisor:</span> <span style="color:#ffffff;">vSphere 8.0.3 Enterprise+</span>
<span style="color:#B3FFE8;"> :---=  </span><span style="color:#B3FFFF;">:::::::---</span><span style="color:#B3FFE8;">         =+++++ </span>  <span style="color:#e5c07b;">vCenter:</span> <span style="color:#ffffff;">Connected</span>
<span style="color:#B3FFFF;"> --===  </span><span style="color:#B3E8FF;">::::::----</span><span style="color:#B3FFFF;">  -+++++++++++  </span>  <span style="color:#e5c07b;">CPU:</span> <span style="color:#ffffff;">2 x Intel(R) Xeon(R) E5-2640 v3 (16) @ 2.60GHz</span>
<span style="color:#B3E8FF;"> -====  </span><span style="color:#B3CCFF;">:::::-----</span><span style="color:#B3E8FF;">  -++++++++++   </span>  <span style="color:#e5c07b;">Memory:</span> <span style="color:#ffffff;">203.22 GiB / 335,31 GiB</span>
<span style="color:#B3CCFF;"> =====   </span><span style="color:#CCB3FF;">::::----</span><span style="color:#B3CCFF;">   -++++         </span>  <span style="color:#e5c07b;">Swap:</span> <span style="color:#ffffff;">0 B / 44.00 GiB</span>
<span style="color:#CCB3FF;"> ======             =++++         </span>  <span style="color:#e5c07b;">Datastore (SSD1):</span> <span style="color:#ffffff;">49.23 GiB / 58.37 GiB</span>
<span style="color:#E8B3FF;">  ======+++++++++++++++++         </span>  <span style="color:#e5c07b;">Datastore (HDD1):</span> <span style="color:#ffffff;">248.22 GiB / 1.82 TiB</span>
<span style="color:#FFB3E8;">   ====+++++++++++++++++          </span>  <span style="color:#e5c07b;">Management IP:</span> <span style="color:#ffffff;">10.0.3.2/8</span>
                                    <span style="color:#e5c07b;">Locale:</span> <span style="color:#ffffff;">de-DE</span>`
    },
    {
      id: 'backup-01',
      tab: 'backup-01',
      group: 'server',
      title: 'backup-01.lucya.intra // thinkstation c20x / old backup pc',
      width: 1020,
      content: `<span style="color:#ee0303;">        ,.=:!!t3Z3z.,</span>                   <span style="color:#08e008;">astra@backup-01</span>
<span style="color:#ee0303;">       :tt:::tt333EE3</span>                   <span style="color:#08e008;">---------------</span>
<span style="color:#ee0303;">       Et:::ztt33EEEL</span> <span style="color:#08e008;">@Ee.,      ..,</span>    <span style="color:#e5c07b;">OS:</span> <span style="color:#ffffff;">Windows 7 Professional x86_64</span>
<span style="color:#ee0303;">      ;tt:::tt333EE7</span> <span style="color:#08e008;">;EEEEEEttttt33#</span>    <span style="color:#e5c07b;">Host:</span> <span style="color:#ffffff;">4269A55 (ThinkStation C20X)</span>
<span style="color:#ee0303;">     :Et:::zt333EEQ.</span> <span style="color:#08e008;">$EEEEEttttt33QL</span>    <span style="color:#e5c07b;">Kernel:</span> <span style="color:#ffffff;">WIN32_NT 6.1.7601.0 (Service Pack 1)</span>
<span style="color:#ee0303;">     it::::tt333EEF</span> <span style="color:#08e008;">@EEEEEEttttt33F</span>     <span style="color:#e5c07b;">Uptime:</span> <span style="color:#ffffff;">3 mins</span>
<span style="color:#ee0303;">    ;3=*^..."*4EEV</span> <span style="color:#08e008;">:EEEEEEttttt33@.</span>     <span style="color:#e5c07b;">Shell:</span> <span style="color:#ffffff;">CMD 6.1.7601.17514</span>
<span style="color:#12a0e7;">    ,.=::::!t=.,  </span> <span style="color:#08e008;">@EEEEEEtttz33QF</span>      <span style="color:#e5c07b;">DE:</span> <span style="color:#ffffff;">Aero</span>
<span style="color:#12a0e7;">   ;::::::::zt33)</span>   <span style="color:#08e008;">"4EEEtttji3P*"</span>      <span style="color:#e5c07b;">WM:</span> <span style="color:#ffffff;">Internal</span>
<span style="color:#12a0e7;">  :t::::::::tt33.<span style="color:#f3dd14;">:Z3z..</span>  <span style="color:#f3dd14;">.. ,..g.</span>       <span style="color:#e5c07b;">WM Theme:</span> <span style="color:#ffffff;">Aero - #74B8FC</span>
<span style="color:#12a0e7;">  i::::::::zt33F</span> <span style="color:#f3dd14;">AEEEtttt::::ztF</span>        <span style="color:#e5c07b;">Font:</span> <span style="color:#ffffff;">Segoe UI (12pt) [Caption / Menu / Message / Status]</span>
<span style="color:#12a0e7;"> ;:::::::::t33V</span> <span style="color:#f3dd14;">;EEEttttt::::t3</span>         <span style="color:#e5c07b;">Cursor:</span> <span style="color:#ffffff;">Windows-Aero</span>
<span style="color:#12a0e7;"> E::::::::zt33L</span> <span style="color:#f3dd14;">@EEEtttt::::z3F</span>         <span style="color:#e5c07b;">Terminal:</span> <span style="color:#ffffff;">ConEmuC64 230724</span>
<span style="color:#12a0e7;">{3=*^..."*4E3)</span> <span style="color:#f3dd14;">;EEEtttt:::::tZ.</span>         <span style="color:#e5c07b;">Terminal Font:</span> <span style="color:#ffffff;">Consola (14pt)</span>
<span style="color:#12a0e7;">             .</span> <span style="color:#f3dd14;">:EEEEtttt::::z7</span>          <span style="color:#e5c07b;">CPU:</span> <span style="color:#ffffff;">Intel(R) Xeon(R) X5690 (12) @ 3.47 GHz</span>
<span style="color:#f3dd14;">                 "VEzjt:;;z>*.</span>          <span style="color:#e5c07b;">GPU:</span> <span style="color:#ffffff;">NVIDIA Quadro 2000</span>
                                        <span style="color:#e5c07b;">Memory:</span> <span style="color:#ffffff;">3.74 GiB / 23.99 GiB (16%)</span>
                                        <span style="color:#e5c07b;">Swap:</span> <span style="color:#ffffff;">0 B / 23.99 GiB (0%)</span>
                                        <span style="color:#e5c07b;">Disk (C:\\):</span> <span style="color:#ffffff;">65.60 GiB / 476.84 GiB (14%) - NTFS</span>
                                        <span style="color:#e5c07b;">Disk (D:\\):</span> <span style="color:#ffffff;">331.20 GiB / 931.39 GiB (36%) - NTFS</span>
                                        <span style="color:#e5c07b;">Local IP (LAN-Verbindung 2):</span> <span style="color:#ffffff;">10.174.110.143/24</span>
                                        <span style="color:#e5c07b;">Locale:</span> <span style="color:#ffffff;">de-DE</span>`
    },
    {
      id: 'vanta',
      tab: 'vanta',
      group: 'desktop',
      title: 'vanta.lucya.intra // main system',
      width: 680,
      content: `<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">astra@vanta</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#767676;">-----------</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">OS:</span> <span style="color:#F2F2F2;">Windows 11 Pro [64-bit]</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Host:</span> <span style="color:#F2F2F2;">Gigabyte A520 AORUS ELITE</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Kernel:</span> <span style="color:#F2F2F2;">WIN32_NT 10.0.26100.0</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Motherboard:</span> <span style="color:#F2F2F2;">Gigabyte A520 AORUS ELITE</span>
<span style="color:#F14F21;"> lllllllllllllll</span>   <span style="color:#7EB900;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Uptime:</span> <span style="color:#F9F1A5;">30 minutes</span>
                                    <span style="color:#F9F1A5;">Packages:</span> <span style="color:#F2F2F2;">1 (scoop)</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Shell:</span> <span style="color:#F2F2F2;">PowerShell v5.1.26100.2161</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Resolution:</span> <span style="color:#F2F2F2;">1050x1680, 2560x1440</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Terminal:</span> <span style="color:#F2F2F2;">Windows Terminal</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">CPU:</span> <span style="color:#F2F2F2;">AMD Ryzen 7 5800X3D (8) @ 3.39 GHz</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">GPU 1:</span> <span style="color:#F2F2F2;">Parsec Virtual Display Adapter</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">GPU 2:</span> <span style="color:#F2F2F2;">Meta Virtual Monitor</span>
<span style="color:#00A3EE;"> lllllllllllllll</span>   <span style="color:#FEB800;">lllllllllllllll</span>  <span style="color:#F9F1A5;">GPU 3:</span> <span style="color:#F2F2F2;">NVIDIA GeForce RTX 3060 12GB</span>
                                    <span style="color:#F9F1A5;">CPU Usage:</span> [ <span style="color:#16C60C;">■</span><span style="color:#F2F2F2;">--------</span>]
                                    <span style="color:#F9F1A5;">Memory:</span> <span style="color:#F2F2F2;">11.39 GiB / 31.89 GiB</span> [ <span style="color:#16C60C;">■■■■</span>------ ]
                                    <span style="color:#F9F1A5;">Disk (C:\\):</span> [ <span style="color:#16C60C;">■■■■■■■</span>--- ] <span style="color:#F2F2F2;">638 GiB / 930 GiB</span>
                                    <span style="color:#F9F1A5;">Locale:</span> <span style="color:#F2F2F2;">Japan - ja-JP</span>
                                    <span style="color:#F9F1A5;">Local IP:</span> <span style="color:#F2F2F2;">192.168.200.5</span>`
    },
    {
      id: 'orcus',
      tab: 'orcus',
      group: 'desktop',
      title: 'orcus.lucya.intra // imac mid 2011 21.5 inch',
      width: 730,
      content: `<span style="color:#61BB46;">                     ..'</span>          <span style="color: #33cc33;">astra@Orcus</span>
<span style="color:#61BB46;">                 ,xNMM.</span>           <span style="color: #33cc33;">-----------</span>
<span style="color:#61BB46;">               .OMMMMo</span>            <span style="color: #e5c07b;">OS:</span> <span style="color: #ffffff;">macOS Sequoia 15.1.1 x86_64</span>
<span style="color:#61BB46;">               lMM"</span>               <span style="color: #e5c07b;">Host:</span> <span style="color: #ffffff;">iMac (21.5-inch, Mid 2011)</span>
<span style="color:#61BB46;">     .;loddo:.  .olloddol;.</span>       <span style="color: #e5c07b;">Kernel:</span> <span style="color: #ffffff;">Darwin 24.1.0</span>
<span style="color:#61BB46;">   cKMMMMMMMMMMNWMMMMMMMMMM0:</span>     <span style="color: #e5c07b;">Uptime:</span> <span style="color: #ffffff;">11 mins</span>
<span style="color:#FDB827;"> .KMMMMMMMMMMMMMMMMMMMMMMMWd.</span>     <span style="color: #e5c07b;">Packages:</span> <span style="color: #ffffff;">1 (brew)</span>
<span style="color:#FDB827;"> XMMMMMMMMMMMMMMMMMMMMMMMX.</span>       <span style="color: #e5c07b;">Shell:</span> <span style="color: #ffffff;">zsh 5.9</span>
<span style="color:#E03A3E;">;MMMMMMMMMMMMMMMMMMMMMMMM:</span>        <span style="color: #e5c07b;">Display (iMac):</span> <span style="color: #ffffff;">1920x1080 @ 60 Hz in 21" [Built-in]</span>
<span style="color:#E03A3E;">:MMMMMMMMMMMMMMMMMMMMMMMM:</span>        <span style="color: #e5c07b;">DE:</span> <span style="color: #ffffff;">Aqua</span>
<span style="color:#E03A3E;">.MMMMMMMMMMMMMMMMMMMMMMMX.</span>        <span style="color: #e5c07b;">WM:</span> <span style="color: #ffffff;">Quartz Compositor 278.1.10</span>
<span style="color:#E03A3E;"> kMMMMMMMMMMMMMMMMMMMMMMMMWd.</span>     <span style="color: #e5c07b;">WM Theme:</span> <span style="color: #ffffff;">Multicolor (Dark)</span>
<span style="color:#963D97;"> 'XMMMMMMMMMMMMMMMMMMMMMMMMMMk</span>    <span style="color: #e5c07b;">Font:</span> <span style="color: #ffffff;">.AppleSystemUIFont [System], Helvetica [User]</span>
<span style="color:#963D97;">  'XMMMMMMMMMMMMMMMMMMMMMMMMK.</span>    <span style="color: #e5c07b;">Cursor:</span> <span style="color: #ffffff;">Fill - Black, Outline - White (32px)</span>
<span style="color:#009DDC;">    kMMMMMMMMMMMMMMMMMMMMMMd</span>      <span style="color: #e5c07b;">Terminal:</span> <span style="color: #ffffff;">Apple Terminal 455</span>
<span style="color:#009DDC;">     ;KMMMMMMMWXXWMMMMMMMk.</span>       <span style="color: #e5c07b;">Terminal Font:</span> <span style="color: #ffffff;">SFMono-Regular (11pt)</span>
<span style="color:#009DDC;">       "cooc*"    "*coo'"</span>         <span style="color: #e5c07b;">CPU:</span> <span style="color: #ffffff;">Intel(R) Core(TM) i5-2500S (4) @ 2.70 GHz</span>
                                  <span style="color: #e5c07b;">GPU 1:</span> <span style="color: #ffffff;">AMD Radeon HD 6770M [Discrete]</span>
                                  <span style="color: #e5c07b;">GPU 2:</span> <span style="color: #ffffff;">Intel HD Graphics 3000 [Integrated]</span>
                                  <span style="color: #e5c07b;">Memory:</span> <span style="color: #ffffff;">5.35 GiB / 8.00 GiB (67%)</span>
                                  <span style="color: #e5c07b;">Swap:</span> <span style="color: #ffffff;">Disabled</span>
                                  <span style="color: #e5c07b;">Disk (/):</span> <span style="color: #ffffff;">63.28 GiB / 111.60 GiB (57%) - apfs</span>
                                  <span style="color: #e5c07b;">Local IP (en1):</span> <span style="color: #ffffff;">192.168.178.109/24</span>
                                  <span style="color: #e5c07b;">Locale:</span> <span style="color: #ffffff;">C</span>`
    },
    {
      id: 'aoi',
      tab: 'aoi',
      group: 'mobile',
      title: 'aoi.lucya.intra // mobile workstation',
      width: 890,
      content: `<span style="color: #50FA7B;">                                  astra</span><span style="color: #BFBFBF;">@</span><span style="color: #50FA7B;">aoi</span>
<span style="color: #BFBFBF;">                                  ---------</span>

<span style="color: #F1FA8C;">                                  모Hardware</span>
<span style="color: #F1FA8C;">                                  ├ Model</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Apple Inc. MacBook Pro (16-inch, 2019) 1.0</span>
<span style="color: #50FA7B;">                     ..'</span><span style="color: #F1FA8C;">          ├ Screen</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 4096 x 2560 px @  60 Hz in 16" (302 ppi) - 8 bit - HDR: true</span>
<span style="color: #50FA7B;">                 ,xNMM.</span><span style="color: #F1FA8C;">           ├ Bright</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 100%</span>
<span style="color: #50FA7B;">               .OMMMMo</span><span style="color: #F1FA8C;">            ├ CPU</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Intel(R) Core(TM) i7-9750H - 12 core @ 2.60 GHz - 73.8°C</span>
<span style="color: #50FA7B;">               lMM"</span><span style="color: #F1FA8C;">               ├ GPU</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Intel UHD Graphics 630 - -1 core @  - 62.6°C - Metal 3</span>
<span style="color: #50FA7B;">     .;loddo:.  .olloddol;.</span><span style="color: #F1FA8C;">       ├ GPU</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> AMD Radeon Pro 5300M - -1 core @  - 47.6°C - Metal 3</span>
<span style="color: #50FA7B;">   cKMMMMMMMMMMNWMMMMMMMMMM0:</span><span style="color: #F1FA8C;">     ├ Memory</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 13.13 GiB / 16.00 GiB (82%)</span>
<span style="color: #F1FA8C;"> .KMMMMMMMMMMMMMMMMMMMMMMMWd.     ├ Disk</span>   <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> MacintoshHD (/) - 213.43 GiB / 278.47 GiB (77%) - apfs</span>
<span style="color: #F1FA8C;"> XMMMMMMMMMMMMMMMMMMMMMMMX.       ├ Disk</span>   <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> BOOTCAMP (/Volumes/BOOTCAMP) - 155.79 GiB / 186.42 GiB (84%) - ntfs</span>
<span style="color: #FF6E67;">;MMMMMMMMMMMMMMMMMMMMMMMM:</span><span style="color: #F1FA8C;">        ├ Charge</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 53% - 192 cycles - 35.4°C</span>
<span style="color: #FF6E67;">:MMMMMMMMMMMMMMMMMMMMMMMM:</span><span style="color: #F1FA8C;">        ├ Camera</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> FaceTime HD Camera (Built-in) - 640 x 480 px</span>
<span style="color: #FF5555;">.MMMMMMMMMMMMMMMMMMMMMMMMX.</span><span style="color: #F1FA8C;">       └ Sound</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> MacBook Pro Speakers - 60%</span>
<span style="color: #FF5555;"> kMMMMMMMMMMMMMMMMMMMMMMMMWd.</span>
<span style="color: #FF79C6;"> 'XMMMMMMMMMMMMMMMMMMMMMMMMMMk    Software</span>
<span style="color: #FF79C6;">  'XMMMMMMMMMMMMMMMMMMMMMMMMK.    ├ OS Ver</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> macOS Tahoe 26.2 - x86_64</span>
<span style="color: #BD93F9;">    kMMMMMMMMMMMMMMMMMMMMMMd</span><span style="color: #FF79C6;">      ├ Uptime</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 3 days, 23 hours, 33 mins</span>
<span style="color: #BD93F9;">     ;KMMMMMMMWXXWMMMMMMMk.</span><span style="color: #FF79C6;">       ├ Shell</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> zsh 5.9</span>
<span style="color: #BD93F9;">       "cooc*"    "*coo'"</span><span style="color: #FF79C6;">         ├ Tasks</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 921</span>
<span style="color: #FF79C6;">                                  └ Apps</span>   <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Total: 150 - User: 84 - System: 66</span>

<span style="color: #BD93F9;">                                  ᯤ Connectivity</span>
<span style="color: #BD93F9;">                                  ├ DNS</span>    <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 192.168.178.1</span>
<span style="color: #BD93F9;">                                  ├ Wi-Fi</span>  <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> Varuna - 98% - 5 GHz - 802.11ac (Wi-Fi 5) - WPA2 Personal</span>
<span style="color: #BD93F9;">                                  └ BT Ver</span> <span style="color: #BFBFBF;">-></span><span style="color: #F8F8F2;"> 5.2</span>`
    },
    {
      id: 'kolibri',
      tab: 'kolibri',
      group: 'mobile',
      title: 'kolibri.lucya.intra // main laptop / tablet',
      width: 1000,
      content: `<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#56b6c2;">Astra@kolibri</span>
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#56b6c2;">--------------</span>
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">OS:</span> Windows 11 Pro x86_64
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Host:</span> Surface Pro 7
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Kernel:</span> WIN32_NT 10.0.26100.3194 (24H2)
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Uptime:</span> 2 days, 2 hours, 48 mins
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Shell:</span> CMD 10.0.26100.3037
<span style="color:#08a1f7;">/////////////////</span>  <span style="color:#09e0fe;">/////////////////</span>    <span style="color:#e5c07b;">Display (Default_Monitor):</span> 2560x1440 @ 32 Hz
                                        <span style="color:#e5c07b;">DE:</span> Fluent
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">WM:</span> Desktop Window Manager 10.0.26100.3037
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">WM Theme:</span> Custom - #3A3A3A (System: Dark, Apps: Dark)
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Icons:</span> Recycle Bin
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Font:</span> Segoe UI (12pt) [Caption / Menu / Message / Status]
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Cursor:</span> Windows Aero (48px)
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Terminal:</span> Windows Terminal 1.21.10351.0
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">Terminal Font:</span> Cascadia Mono (12pt)
<span style="color:#004fe1;">/////////////////</span>  <span style="color:#03c1f4;">/////////////////</span>    <span style="color:#e5c07b;">CPU:</span> Intel(R) Core(TM) i5-1035G4 (8) @ 1,50 GHz
                                        <span style="color:#e5c07b;">GPU 1:</span> Intel Meta Virtual Monitor (128,00 MiB) [Discrete]
                                        <span style="color:#e5c07b;">GPU 2:</span> Intel Parsec Virtual Display Adapter (128,00 MiB) [Discrete]
                                        <span style="color:#e5c07b;">GPU 3:</span> Intel(R) Iris(R) Plus Graphics (128,00 MiB) [Integrated]
                                        <span style="color:#e5c07b;">Memory:</span> 6,07 GiB / 7,60 GiB (<span style="color: #e5c07b;">80%</span>)
                                        <span style="color:#e5c07b;">Swap:</span> 175,52 MiB / 1,94 GiB (<span style="color: #e5c07b;">9%</span>)
                                        <span style="color:#e5c07b;">Disk (C:\\):</span> 102,81 GiB / 118,14 GiB (<span style="color: #e5c07b;">87%</span>) - NTFS
                                        <span style="color:#e5c07b;">Disk (D:\\):</span> 101,03 GiB / 119,08 GiB (<span style="color: #e5c07b;">85%</span>) - NTFS [External]
                                        <span style="color:#e5c07b;">Local IP (Wi-Fi):</span> 192.168.178.98/24
                                        <span style="color:#e5c07b;">Battery:</span> 100% [AC Connected]
                                        <span style="color:#e5c07b;">Locale:</span> en-DE`
    },
    {
      id: 'rubicon',
      tab: 'rubicon',
      group: 'mobile',
      title: 'rubicon.lucya.intra // linux macbook',
      width: 820,
      content: `<span style="color: #EDAECA;">                                           </span><span style="color: #D26BA4;">astra</span><span style="color: #EDAECA;">@</span><span style="color: #D26BA4;">Rubicon</span>
<span style="color: #D26BA4;">           ..:/ossyyyysso/:.</span>               <span style="color: #EDAECA;">-------------</span>
<span style="color: #D26BA4;">        .:oyyyyyyyyyyyyyyyyyyo:.</span>           <span style="color: #56C4EB;">OS:</span> <span style="color: #EDAECA;">Kubuntu 25.10 x86_64</span>
<span style="color: #EDAECA;">      -oyyyyyyyo</span><span style="color: #FFFFFF;">dMM</span><span style="color: #EDAECA;">yyyyyyyysyyyyo-</span>         <span style="color: #56C4EB;">Host:</span> <span style="color: #EDAECA;">MacBookPro11,1 1.0</span>
<span style="color: #EDAECA;">    -syyyyyyyyyy</span><span style="color: #FFFFFF;">dMM</span><span style="color: #EDAECA;">yoyyyy</span><span style="color: #FFFFFF;">dmMM</span><span style="color: #EDAECA;">yyyyys-</span>       <span style="color: #56C4EB;">Kernel:</span> <span style="color: #EDAECA;">6.17.0-6-generic</span>
<span style="color: #EDAECA;">   oyyys</span><span style="color: #FFFFFF;">dM</span><span style="color: #EDAECA;">ysyyyy</span><span style="color: #FFFFFF;">dMMMMMMMMMMMMM</span><span style="color: #EDAECA;">yyyyyyyo</span>     <span style="color: #56C4EB;">Uptime:</span> <span style="color: #EDAECA;">50 secs</span>
<span style="color: #FFFFFF;">  oyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">ysyysoooooo</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">yyyyyyyyyo </span>    <span style="color: #56C4EB;">Packages:</span> <span style="color: #EDAECA;">2525 (dpkg), 7 (flatpak-system), 25 (snap)</span>
<span style="color: #FFFFFF;"> oyyyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">yyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMM</span><span style="color: #FFFFFF;">ysssssyyyo</span>    <span style="color: #56C4EB;">Shell:</span> <span style="color: #EDAECA;">zsh 5.9</span>
<span style="color: #FFFFFF;">-yyyyyyyy</span><span style="color: #FFFFFF;">dM</span><span style="color: #FFFFFF;">ysyyyyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #FFFFFF;">ysyyy-</span>   <span style="color: #56C4EB;">Resolution:</span> <span style="color: #EDAECA;">2560x1600</span>
<span style="color: #56C4EB;">oyyyysoo</span><span style="color: #FFFFFF;">dM</span><span style="color: #56C4EB;">yyyyyyyyyyyyyyyyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #56C4EB;">ysyyyo</span>   <span style="color: #56C4EB;">DE:</span> <span style="color: #EDAECA;">Plasma 6.4.5 [KF 6.17.0] [Qt 6.9.2] (wayland)</span>
<span style="color: #56C4EB;">yyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #56C4EB;">yyyyyyyyyyyyyyyyyyysosyyyyyyyy</span>   <span style="color: #56C4EB;">WM:</span> <span style="color: #EDAECA;">kwin_wayland_wr</span>
<span style="color: #56C4EB;">yyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #56C4EB;">yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy</span>   <span style="color: #56C4EB;">Theme:</span> <span style="color: #EDAECA;">Breeze-Dark [GTK2/3]</span>
<span style="color: #56C4EB;">oyyyyysosdyyyyyyyyyyyyyyyyyyy</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #56C4EB;">ysyyyo</span>   <span style="color: #56C4EB;">Icons:</span> <span style="color: #EDAECA;">kora [GTK2/3]</span>
<span style="color: #FFFFFF;">-yyyyyyyy</span><span style="color: #FFFFFF;">dM</span><span style="color: #FFFFFF;">ysyyyyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMMMMM</span><span style="color: #FFFFFF;">ysyyy-</span>   <span style="color: #56C4EB;">Cursor:</span> <span style="color: #EDAECA;">WinSur-dark-cursors [GTK2/3]</span>
<span style="color: #FFFFFF;"> oyyyyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #FFFFFF;">ysyyyyyyyyyyys</span><span style="color: #FFFFFF;">dMM</span><span style="color: #FFFFFF;">yoyyyoyyyo</span>    <span style="color: #56C4EB;">Terminal:</span> <span style="color: #EDAECA;">konsole</span>
<span style="color: #FFFFFF;">  oyyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #FFFFFF;">ysyyyoooooo</span><span style="color: #FFFFFF;">dMMMM</span><span style="color: #FFFFFF;">yoyyyyyyyyo</span>     <span style="color: #56C4EB;">CPU:</span> <span style="color: #EDAECA;">Intel i5-4278U (4) @ 3.1GHz</span>
<span style="color: #EDAECA;">   oyyysyyoyyyys</span><span style="color: #FFFFFF;">dMMMMMMMMMMM</span><span style="color: #EDAECA;">yyyyyyyyo</span>      <span style="color: #56C4EB;">GPU:</span> <span style="color: #EDAECA;">Intel Haswell-ULT</span>
<span style="color: #EDAECA;">    -syyyyyyyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #EDAECA;">ysyyy</span><span style="color: #FFFFFF;">dMMM</span><span style="color: #EDAECA;">ysyyyys-</span>       <span style="color: #56C4EB;">Memory:</span> <span style="color: #EDAECA;">1.87 GiB / 7.66 GiB (24%)</span>
<span style="color: #EDAECA;">      -oyyyyyyy</span><span style="color: #FFFFFF;">dMM</span><span style="color: #EDAECA;">yyyyyyysosyyyyo-</span>         <span style="color: #56C4EB;">Network:</span> <span style="color: #EDAECA;">Wifi</span>
<span style="color: #D26BA4;">        ./oyyyyyyyyyyyyyyyyyyo/.</span>           <span style="color: #56C4EB;">Bluetooth:</span> <span style="color: #EDAECA;">Broadcom Corp. BCM2046B1 USB 2.0 Hub</span>
<span style="color: #D26BA4;">            .:/oosyyyysso/:. </span>              <span style="color: #56C4EB;">BIOS:</span> <span style="color: #EDAECA;">Apple Inc. 0.1 (01/13/2023)</span>`
    },
    {
      id: 'delta',
      tab: 'delta',
      group: 'mobile',
      title: 'delta.lucya.intra // main system',
      width: 680,
      content: `<span style="color: #61FFCA;">                  -'                     </span><span style="color: #EDECEE;">astra</span><span style="color: #A277FF;">@</span><span style="color: #EDECEE;">delta</span>
<span style="color: #61FFCA;">                 .o+'                    </span><span style="color: #A277FF;">-------------</span>
<span style="color: #61FFCA;">                'ooo/                    </span><span style="color: #A277FF;">OS:</span><span style="color: #EDECEE;"> Arch Linux x86_64</span>
<span style="color: #61FFCA;">               '+oooo:                   </span><span style="color: #A277FF;">Host:</span><span style="color: #EDECEE;"> HP EliteBook 2570p (A1029D1102)</span>
<span style="color: #61FFCA;">              '+oooooo:                  </span><span style="color: #A277FF;">Kernel:</span><span style="color: #EDECEE;"> Linux 6.18.9-arch1-2</span>
<span style="color: #61FFCA;">              -+oooooo+:                 </span><span style="color: #A277FF;">Uptime:</span><span style="color: #EDECEE;"> 41 seconds</span>
<span style="color: #61FFCA;">            '/:-:++oooo+:                </span><span style="color: #A277FF;">Packages:</span><span style="color: #EDECEE;"> 820 (pacman)</span>
<span style="color: #61FFCA;">           '/++++/+++++++:               </span><span style="color: #A277FF;">Shell:</span><span style="color: #EDECEE;"> zsh 5.9</span>
<span style="color: #61FFCA;">          '/++++++++++++++:              </span><span style="color: #A277FF;">Display (AUO206C):</span><span style="color: #EDECEE;"> 1366x768 in 13", 60 Hz [Built-in]</span>
<span style="color: #61FFCA;">         '/+++ooooooooooooo/'            </span><span style="color: #A277FF;">DE:</span><span style="color: #EDECEE;"> KDE Plasma 6.5.5</span>
<span style="color: #61FFCA;">        ./ooosssso++osssssso+'           </span><span style="color: #A277FF;">WM:</span><span style="color: #EDECEE;"> KWin (Wayland)</span>
<span style="color: #61FFCA;">       .oossssso-''''/ossssss+'          </span><span style="color: #A277FF;">WM Theme:</span><span style="color: #EDECEE;"> Breeze</span>
<span style="color: #61FFCA;">      -osssssso.      :ssssssso.         </span><span style="color: #A277FF;">Theme:</span><span style="color: #EDECEE;"> Breeze (Dark) [Qt], Breeze-Dark [GTK2], Breeze [GTK3]</span>
<span style="color: #61FFCA;">     :osssssss/        osssso+++.        </span><span style="color: #A277FF;">Icons:</span><span style="color: #EDECEE;"> Papirus [Qt], Papirus [GTK2/3/4]</span>
<span style="color: #61FFCA;">    /ossssssss/        +ssssooo/-        </span><span style="color: #A277FF;">Font:</span><span style="color: #EDECEE;"> Noto Sans (10pt) [Qt], Noto Sans (10pt) [GTK2/3/4]</span>
<span style="color: #61FFCA;">  '/ossssso+/:-        -:/+osssso+-      </span><span style="color: #A277FF;">Cursor:</span><span style="color: #EDECEE;"> volantes (24px)</span>
<span style="color: #61FFCA;"> '+sso+:-'                 '.-/+oso:     </span><span style="color: #A277FF;">Terminal:</span><span style="color: #EDECEE;"> konsole 25.12.2</span>
<span style="color: #61FFCA;">'++:.                           '-/+/    </span><span style="color: #A277FF;">CPU:</span><span style="color: #EDECEE;"> Intel(R) Core(TM) i5-3360M (4) @ 3.50 GHz</span>
<span style="color: #61FFCA;">.'                                 '/    </span><span style="color: #A277FF;">GPU:</span><span style="color: #EDECEE;"> Intel 3rd Gen Core processor Graphics Controller @ 1.20 GHz</span>
                                         <span style="color: #A277FF;">Memory:</span><span style="color: #EDECEE;"> 1.03 GiB / 7.62 GiB (13%)</span>
                                         <span style="color: #A277FF;">Swap:</span><span style="color: #EDECEE;"> 0 B / 4.00 GiB (0%)</span>
                                         <span style="color: #A277FF;">Disk (/):</span><span style="color: #EDECEE;"> 17.15 GiB / 163.00 GiB (11%) - ext4</span>
                                         <span style="color: #A277FF;">Local IP (wlo1):</span><span style="color: #EDECEE;"> 192.168.178.167/24</span>
                                         <span style="color: #A277FF;">Battery (Primary):</span><span style="color: #EDECEE;"> 89% (4 hours, 57 mins remaining) [Discharging]</span>
                                         <span style="color: #A277FF;">Locale:</span><span style="color: #EDECEE;"> de_DE.UTF-8</span>`
    },
    {
      id: 'motte',
      tab: 'motte',
      group: 'mobile',
      title: 'motte.lucya.intra // garbage 1st gen lenovo yogabook',
      width: 950,
      content: `<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Astra@motte</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#767676;">--------------</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">OS:</span> <span style="color:#F2F2F2;">Windows 11 Pro x86_64</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Host:</span> <span style="color:#F2F2F2;">ZA150085DE (X91F)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Kernel:</span> <span style="color:#F2F2F2;">WIN32_NT 10.0.26100.4202 (24H2)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Uptime:</span> <span style="color:#F2F2F2;">34 mins</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Shell:</span> <span style="color:#F2F2F2;">Windows PowerShell</span>
                                    <span style="color:#F9F1A5;">Display (AUO71D8):</span> <span style="color:#F2F2F2;">1920x1200 @ 60 Hz (as 1280x800) in 10" [Built-in]</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">DE:</span> <span style="color:#F2F2F2;">Fluent</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">WM:</span> <span style="color:#F2F2F2;">Desktop Window Manager 10.0.26100.3624</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">WM Theme:</span> <span style="color:#F2F2F2;">Custom - #0F5E66 (System: Dark, Apps: Dark)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Icons:</span> <span style="color:#F2F2F2;">Recycle Bin</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Font:</span> <span style="color:#F2F2F2;">Segoe UI (12pt) [Caption / Menu / Message / Status]</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Cursor:</span> <span style="color:#F2F2F2;">Windows-Voreinstellung (32px)</span>
<span style="color:#E2232A;"> lllllllllllllll</span>   <span style="color:#E2232A;">lllllllllllllll</span>  <span style="color:#F9F1A5;">Terminal:</span> <span style="color:#F2F2F2;">Windows Terminal 1.18.10301.0</span>
                                    <span style="color:#F9F1A5;">Terminal Font:</span> <span style="color:#F2F2F2;">Cascadia Mono (12pt)</span>
                                    <span style="color:#F9F1A5;">CPU:</span> <span style="color:#F2F2F2;">Intel(R) Atom(TM) x5-Z8550 (4) @ 1,49 GHz</span>
                                    <span style="color:#F9F1A5;">GPU:</span> <span style="color:#F2F2F2;">Intel(R) HD Graphics (114,00 MiB) [Integrated]</span>
                                    <span style="color:#F9F1A5;">Memory:</span> <span style="color:#F2F2F2;">2,72 GiB / 3,92 GiB (69%)</span>
                                    <span style="color:#F9F1A5;">Swap:</span> <span style="color:#F2F2F2;">138,64 MiB / 1,38 GiB (10%)</span>
                                    <span style="color:#F9F1A5;">Disk (C:\\):</span> <span style="color:#F2F2F2;">27,17 GiB / 57,48 GiB (47%) - NTFS</span>
                                    <span style="color:#F9F1A5;">Local IP (WLAN):</span> <span style="color:#F2F2F2;">192.168.178.54/24</span>
                                    <span style="color:#F9F1A5;">Battery (SR Real Battery):</span> <span style="color:#F2F2F2;">77% (3 hours, 56 mins remaining) [Discharging]</span>
                                    <span style="color:#F9F1A5;">Locale:</span> <span style="color:#F2F2F2;">de-DE</span>`
    },
  ];

  const nTabs  = document.getElementById('nTabs');
  const nPanes = document.getElementById('nPanes');
  if (nTabs && nPanes) {
    // One labelled row per category instead of one long strip: thirteen tabs
    // in a single scrolling line read as noise, and half of them were off
    // screen. Each row is a label cell plus a wrapping set of tabs, so every
    // machine stays visible and the grouping does the sorting work.
    // An entry with an unknown group still shows up — it just lands in a
    // trailing bucket instead of silently disappearing.
    const NEOFETCH_GROUPS = [
      { id: 'server',  label: 'SERVER · RACK' },
      { id: 'desktop', label: 'DESKTOP' },
      { id: 'mobile',  label: 'LAPTOP · MOBILE' }
    ];
    // which machine the section opens on, independent of group order
    const NEOFETCH_DEFAULT = 'aoi';

    const buckets = NEOFETCH_GROUPS
      .map(g => ({ label: g.label, items: neofetchData.filter(e => e.group === g.id) }))
      .filter(b => b.items.length);
    const loose = neofetchData.filter(e => !NEOFETCH_GROUPS.some(g => g.id === e.group));
    if (loose.length) buckets.push({ label: 'OTHER', items: loose });

    const openId = neofetchData.some(e => e.id === NEOFETCH_DEFAULT)
      ? NEOFETCH_DEFAULT
      : (buckets[0] && buckets[0].items[0] || {}).id;

    buckets.forEach(bucket => {
      const label = document.createElement('span');
      label.className = 'ntabs__grp';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = bucket.label;
      nTabs.appendChild(label);

      const set = document.createElement('div');
      set.className = 'ntabs__set';
      nTabs.appendChild(set);

      bucket.items.forEach(entry => {
        const open = entry.id === openId;
        const btn = document.createElement('button');
        btn.className = 'ntab' + (open ? ' is-active' : '');
        btn.dataset.tab = entry.id;
        btn.textContent = entry.tab;
        set.appendChild(btn);

        const pane = document.createElement('div');
        pane.className = 'nterm' + (open ? ' is-active' : '');
        pane.dataset.pane = entry.id;
        if (entry.live) {
          pane.dataset.liveHost = entry.live;
          pane.dataset.liveState = 'off';
          if (entry.memTotal) pane.dataset.memTotal = String(entry.memTotal);
        }
        pane.innerHTML = `
          <div class="nterm__bar">
            <span class="nterm__dot"></span><span class="nterm__dot"></span><span class="nterm__dot"></span>
            <span class="nterm__title">${entry.title}</span>
            ${entry.live ? '<span class="nterm__live" data-live="badge">snapshot</span>' : ''}
          </div>
          <pre class="nterm__body">${sanitize(entry.content)}</pre>
        `;
        nPanes.appendChild(pane);
      });
    });

    // tab switching
    nTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.ntab');
      if (!btn) return;
      const target = btn.dataset.tab;
      nTabs.querySelectorAll('.ntab').forEach(t => t.classList.toggle('is-active', t === btn));
      nPanes.querySelectorAll('.nterm').forEach(p => p.classList.toggle('is-active', p.dataset.pane === target));
    });

    // ---- live figures from the checkmk feed ---------------------
    // Only the .nlive spans are rewritten — the rest of a sheet stays
    // the hand-transcribed dump. When the probe is missing or the host
    // is down, every cell falls back to its dump value and the pane
    // drops the "live" marking, so nothing on screen ever claims to be
    // current when it is not.
    const livePanes = Array.from(nPanes.querySelectorAll('.nterm[data-live-host]'));
    if (livePanes.length) {
      const fmtUptime = (s) => {
        const t = Math.max(0, Math.floor(Number(s) || 0));
        const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60);
        const unit = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
        const out = [];
        if (d) out.push(unit(d, 'day'));
        if (d || h) out.push(unit(h, 'hour'));
        out.push(unit(m, 'min'));
        return out.join(', ');
      };
      // sheet palette: green / amber / red, same hexes the dumps use
      const band = (v, warn, crit) => v >= crit ? '#da0a0a' : v >= warn ? '#e5c07b' : '#06e236';
      const fmtAge = (ts) => {
        const a = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts || 0));
        return a < 60 ? `${a}s` : a < 3600 ? `${Math.floor(a / 60)}m`
             : a < 86400 ? `${Math.floor(a / 3600)}h` : `${Math.floor(a / 86400)}d`;
      };

      let feedTs = 0;

      const paint = (data) => {
        feedTs = Number((data && data.ts) || 0);
        const hosts = (data && Array.isArray(data.hosts)) ? data.hosts : [];

        livePanes.forEach(pane => {
          const h = hosts.find(x => x && x.name === pane.dataset.liveHost) || null;
          const cells = Array.from(pane.querySelectorAll('.nlive'));
          const badge = pane.querySelector('[data-live="badge"]');

          // remember the dump value once, then always start from it
          cells.forEach(el => {
            if (el.dataset.snap === undefined) {
              el.dataset.snap = el.textContent;
              el.dataset.snapColor = el.style.color || '';
            }
            el.textContent = el.dataset.snap;
            el.style.color = el.dataset.snapColor;
          });

          const put = (key, text, color) => {
            pane.querySelectorAll(`.nlive[data-live="${key}"]`).forEach(el => {
              el.textContent = text;
              if (color) el.style.color = color;
            });
          };

          if (!h || String(h.state).toLowerCase() !== 'up') {
            pane.dataset.liveState = 'off';
            if (badge) {
              badge.dataset.state = h ? 'down' : 'off';
              badge.textContent = h ? `${h.state || 'down'}` : 'snapshot';
            }
            return;
          }

          pane.dataset.liveState = 'on';
          const crit = Number(h.svc_crit) || 0, warn = Number(h.svc_warn) || 0;
          if (badge) {
            badge.dataset.state = crit > 0 ? 'crit' : warn > 0 ? 'warn' : 'on';
            badge.dataset.svc = crit > 0 ? `${crit} crit` : warn > 0 ? `${warn} warn` : '';
          }

          if (h.uptime_s != null) put('uptime', fmtUptime(h.uptime_s));

          // the feed ships absolute memory when the check reports bytes;
          // where it only knows the percentage, fall back to that percent
          // of the installed memory from the sheet
          const memPct = Number(h.mem_pct);
          const usedGib = Number(h.mem_used_gib), totalGib = Number(h.mem_total_gib);
          const memTotal = totalGib > 0 ? totalGib : Number(pane.dataset.memTotal);
          if (totalGib > 0) put('mem-total', `${totalGib.toFixed(2)} GiB`);
          if (isFinite(memPct)) {
            put('mem-pct', `${memPct.toFixed(1)}%`, band(memPct, 75, 90));
            if (usedGib > 0) put('mem-used', `${usedGib.toFixed(2)} GiB`);
            else if (memTotal > 0) put('mem-used', `${(memTotal * memPct / 100).toFixed(2)} GiB`);
          }

          const cpu = Number(h.cpu_pct);
          if (isFinite(cpu)) {
            const load = Number(h.load1);
            put('cpu', `${cpu.toFixed(1)}%` + (isFinite(load) ? ` (load ${load.toFixed(2)})` : ''),
                band(cpu, 60, 85));
          }

          const temp = Number(h.temp_c);
          if (isFinite(temp) && h.temp_c != null) put('temp', `[${temp.toFixed(0)} °C]`, band(temp, 75, 85));
        });

        tickBadges();
      };

      // the badge carries the feed age and, when the host has failing
      // services, how many — the sheet itself stays a spec sheet
      const tickBadges = () => {
        livePanes.forEach(pane => {
          const badge = pane.querySelector('[data-live="badge"]');
          if (!badge || pane.dataset.liveState !== 'on') return;
          badge.textContent = `live · ${fmtAge(feedTs)}` + (badge.dataset.svc ? ` · ${badge.dataset.svc}` : '');
        });
      };

      statusFeed.subscribe(paint);
      setInterval(tickBadges, 1000);
    }
  }

  // switch the neofetch collection to a given host. The rack sits next to
  // this section in the same set, so selecting a unit there just retunes
  // the terminal — no navigation, no scrolling.
  const showNeofetch = (tabId) => {
    const btn = nTabs && nTabs.querySelector(`.ntab[data-tab="${tabId}"]`);
    if (btn) btn.click();
  };

  // ---------- RACK : interactive front elevation ------------------
  // One entry per physical unit, top to bottom. `u` is the height in rack
  // units; `ext: true` marks the boxes that sit on top of the cabinet —
  // those aren't rack-mounted, so `u` there is only how tall they're drawn
  // and no U figure is shown. `state` drives the colour (on / standby /
  // off) and `neofetch` links a unit to its tab in section 05. Specs come
  // from the neofetch dumps above — anything not measured stays empty and
  // renders as a dash rather than an invented value.
  const rackData = [
    {
      id: 'lynx', ext: true, u: 2, state: 'on',
      role: 'core hypervisor', chassis: 'Apple Mac mini (Macmini6,2)',
      os: 'Proxmox VE 9.x', cpu: 'Intel Core i7-3615QM (8) @ 3.30 GHz',
      mem: '15.53 GiB', ip: '192.168.178.252/24', neofetch: 'lynx',
      note: 'Sits on top of the cabinet. Runs the always-on core services, which is why it is the one machine that never gets powered down.'
    },
    {
      id: 'vega', ext: true, u: 3, state: 'on',
      role: 'nas', chassis: 'Synology DS918+',
      os: 'DSM 7.3.1-86003 U1', cpu: 'Intel Celeron J3455 (4) @ 1.50 GHz',
      mem: '8.00 GiB', ip: '192.168.178.154/24', neofetch: 'vega',
      note: 'Sits on top of the cabinet next to lynx. Four bays in two RAID 1 pairs — SSD volume plus HDD volume — on a 2 Gbit/s bond. Always on.'
    },
    {
      id: 'chimera', u: 1, state: 'on',
      role: 'hypervisor', chassis: 'Supermicro SYS-5018D-FN4T',
      os: 'Proxmox VE 9.2.4', cpu: 'Intel Xeon D-1541 (16) @ 2.70 GHz',
      mem: '62.69 GiB', ip: '192.168.178.242/24', neofetch: 'chimera',
      note: 'Short-depth 1U board in a low-power SoC chassis — quiet enough to run around the clock.'
    },
    {
      id: 'backup-01', u: 3, state: 'off',
      role: 'cold backup', chassis: 'Lenovo ThinkStation C20x (4269A55)',
      os: 'Windows 7 Professional', cpu: 'Intel Xeon X5690 (12) @ 3.47 GHz',
      mem: '23.99 GiB', ip: '10.174.110.143/24', neofetch: 'backup-01',
      note: 'Powered off by default. Comes up only for backup runs.'
    },
    {
      id: 'unnamed-01', u: 1, state: 'off',
      role: 'unassigned', note: 'Not named, not in service. Data sheet pending.'
    },
    {
      id: 'esxi-02', u: 2, state: 'off',
      role: 'virtualization host', chassis: 'IBM System x3650 M5',
      os: 'VMware ESXi 8.0U3e', cpu: '2 x Intel Xeon E5-2640 v3 (16) @ 2.60 GHz',
      mem: '335.31 GiB', ip: '10.0.3.2/8', neofetch: 'esx-02',
      note: 'Second vSphere host. Off unless the lab needs the capacity — the power draw is not worth it idle.'
    },
    {
      id: 'sw-01', u: 1, state: 'on',
      role: 'switch', note: 'Rack switch — everything in the cabinet hangs off it, so it stays up with lynx.'
    },
    {
      id: 'esxi-01', u: 2, state: 'standby',
      role: 'virtualization host', chassis: 'Dell PowerEdge R720',
      os: 'VMware ESXi 8.0U3e', cpu: '2 x Intel Xeon E5-2670 (32) @ 3.60 GHz',
      mem: '863.94 GiB', ip: '10.0.3.1/8', neofetch: 'esx-01',
      note: 'Booted on demand for lab work, then shut down again.'
    },
    {
      id: 'unnamed-02', u: 4, state: 'off',
      role: 'unassigned', note: 'Not named, not in service. Data sheet pending.'
    },
    {
      id: 'esxi-03', u: 2, state: 'off',
      role: 'virtualization host', note: 'Powered off. Data sheet pending.'
    }
  ];

  const rackUnitsEl = document.getElementById('rackUnits');
  const rackExtEl   = document.getElementById('rackExt');
  const rackInfoEl  = document.getElementById('rackInfo');
  const rackLegend  = document.getElementById('rackLegend');

  if (rackUnitsEl && rackExtEl && rackInfoEl) {
    const STATE_LABEL = { on: 'online', standby: 'on demand', off: 'offline' };

    const unitButton = (unit) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ru' + (unit.ext ? ' ru--ext' : '');
      b.dataset.unit = unit.id;
      b.dataset.state = unit.state;
      b.style.setProperty('--ru-h', unit.u);
      b.setAttribute('aria-pressed', 'false');
      // the sheet below is deliberately tiny, so the longer note rides along
      // as the unit's tooltip instead
      if (unit.note) b.title = unit.note;
      b.innerHTML =
        `<span class="ru__name"><span class="ru__led"></span>${escHtml(unit.id)}</span>` +
        `<span class="ru__u">${unit.ext ? '' : unit.u + 'U · '}${escHtml(STATE_LABEL[unit.state])}</span>`;
      return b;
    };

    rackData.forEach(unit => {
      (unit.ext ? rackExtEl : rackUnitsEl).appendChild(unitButton(unit));
    });

    const unitEls = Array.from(document.querySelectorAll('#rackExt .ru, #rackUnits .ru'));

    const countEl = document.getElementById('rackCount');
    if (countEl) {
      const inRack = rackData.filter(u => !u.ext);
      countEl.textContent =
        `${inRack.length} UNITS · ${inRack.reduce((s, u) => s + u.u, 0)}U`;
    }

    // ---- data sheet ----
    // Kept to two lines on purpose: selecting a unit retunes the neofetch
    // terminal next door, which is where the full system info lives. A
    // taller sheet here would only push the elevation around on every click.
    const renderInfo = (unit) => {
      rackInfoEl.dataset.state = unit.state;
      rackInfoEl.innerHTML = `
        <div class="rackinfo__head">
          <div class="rackinfo__name" id="rackInfoName"></div>
          <span class="rackinfo__badge"><span class="ru__led"></span>${escHtml(STATE_LABEL[unit.state])}</span>
        </div>
        <div class="rackinfo__role">${escHtml(unit.role)} · ${unit.ext ? 'not racked' : unit.u + 'U'} · ${escHtml(unit.chassis || 'spec pending')}</div>
      `;
      // plain text first: the scramble runs on rAF, which is paused while
      // the tab is in the background — the name must never render empty
      const nameEl = rackInfoEl.querySelector('#rackInfoName');
      nameEl.textContent = unit.id;
      scrambleTo(nameEl, unit.id);
    };

    let currentId = null;
    // opts.focus follows keyboard stepping and opts.sync retunes the neofetch
    // terminal next door. The initial selection passes neither, so the page
    // still opens on its own tab. Nothing here scrolls: the sheet is small
    // enough to stay put, so a click never moves the elevation.
    const select = (id, opts) => {
      const o = opts || {};
      const unit = rackData.find(u => u.id === id);
      if (!unit || id === currentId) return;
      currentId = id;
      unitEls.forEach(el => {
        const on = el.dataset.unit === id;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && o.focus) el.focus();
      });
      renderInfo(unit);
      if (o.sync && unit.neofetch) showNeofetch(unit.neofetch);
    };

    document.querySelectorAll('#rackExt, #rackUnits').forEach(host => {
      host.addEventListener('click', (e) => {
        const btn = e.target.closest('.ru');
        if (btn) select(btn.dataset.unit, { sync: true });
      });
    });

    // arrow keys step through the elevation. stopPropagation keeps set-nav
    // (window-level keydown) from swapping panels while we're in here.
    document.getElementById('rackView')?.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (!e.target.closest('.ru')) return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      let i = unitEls.findIndex(el => el.dataset.unit === currentId);
      // walk past units the legend filter has dimmed out
      for (let n = i + step; n >= 0 && n < unitEls.length; n += step) {
        if (!unitEls[n].classList.contains('is-dim')) { i = n; break; }
      }
      select(unitEls[i].dataset.unit, { focus: true, sync: true });
    });

    // ---- legend doubles as a state filter ----
    if (rackLegend) {
      const active = new Set(['on', 'standby', 'off']);
      ['on', 'standby', 'off'].forEach(state => {
        const n = rackData.filter(u => u.state === state).length;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'rackchip';
        chip.dataset.state = state;
        chip.setAttribute('aria-pressed', 'true');
        chip.innerHTML = `<span class="rackchip__led"></span>${STATE_LABEL[state]} <b>${n}</b>`;
        rackLegend.appendChild(chip);
      });
      rackLegend.addEventListener('click', (e) => {
        const chip = e.target.closest('.rackchip');
        if (!chip) return;
        const state = chip.dataset.state;
        if (active.has(state)) active.delete(state); else active.add(state);
        if (!active.size) ['on', 'standby', 'off'].forEach(s => active.add(s));
        rackLegend.querySelectorAll('.rackchip').forEach(c => {
          const on = active.has(c.dataset.state);
          c.classList.toggle('is-off', !on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        unitEls.forEach(el => el.classList.toggle('is-dim', !active.has(el.dataset.state)));
      });
    }

    select(rackData.find(u => !u.ext).id);
  }

  // ---------- SPOTIFY TOP SONGS ROTATION -------------------------
  const spotifyCard = document.getElementById('spotifyCard');
  if (spotifyCard) {
    const SONG_DIR = 'images/spotify_widget/songs/';
    const ALBUM_DIR = 'images/spotify_widget/albums/';
    const ARTIST_DIR = 'images/spotify_widget/artists/';

    const songs = [
      { title: "Rebirth", artist: "SHIMA", cover: SONG_DIR + "rebirth.jpeg" },
      { title: "Infohazard", artist: "Ninajirachi", cover: SONG_DIR + "cover4.webp" },
      { title: "Affection Addiction", artist: "VocaloKAT, Aku P", cover: SONG_DIR + "affection.jpeg" },
      { title: "Evergreen Misery", artist: "MOTHICA", cover: SONG_DIR + "mothica.jpeg" },
      { title: "Slide", artist: "MRJay", cover: SONG_DIR + "slide.jpeg" },
      { title: "one last thing", artist: "vinter", cover: SONG_DIR + "vinter.jpg" },
      { title: "Heaven", artist: "Allison Wonderland, Ninajirachi", cover: SONG_DIR + "cover1.webp" },
      { title: "Flesh without Blood", artist: "Grimes", cover: SONG_DIR + "artangels.webp" },
      { title: "Delicate Weapon", artist: "Grimes", cover: SONG_DIR + "CPv2.jpg" },
      { title: "FORTUNE", artist: "SAKUREYE", cover: SONG_DIR + "fortune.jpg" },
      { title: "Darling Game Over Love", artist: "MAIKI P", cover: SONG_DIR + "maikip.jpg" },
      { title: "Elevate", artist: "Sub Focus", cover: SONG_DIR + "cover3.jpeg" },
      { title: "Battery Death", artist: "Ninajirachi", cover: SONG_DIR + "cover4.webp" },
      { title: "Ghostlight", artist: "Skeler, Veela", cover: SONG_DIR + "Ghostlight.jpeg" },
      { title: "THE BADDEST", artist: "K/DA", cover: SONG_DIR + "the_baddest.jpg" }
    ];

    // fav albums + artists — `note` is the year badge on the album tiles.
    // genre lines are the descriptions the artists/their labels use; see the
    // sources noted in the commit rather than guessing new ones.
    const albums = [
      { title: "I Love My Computer", artist: "Ninajirachi", note: "2025", cover: ALBUM_DIR + "i_love_my_computer.webp" },
      { title: "Escape Cycle", artist: "Darci", note: "2023", cover: ALBUM_DIR + "escapecycle.jpeg" },
      { title: "Call for Help", artist: "Pearly Drops", note: "2020", cover: ALBUM_DIR + "callforhelp.jpeg" },
      { title: "Miss Anthropocene", artist: "Grimes", note: "2020", cover: ALBUM_DIR + "missantropocene.jpeg" },
      { title: "Art Angels", artist: "Grimes", note: "2015", cover: ALBUM_DIR + "artangels.webp" },
      { title: "Hysteria", artist: "Def Leppard", note: "1987", cover: ALBUM_DIR + "hysteriy.jpeg" }
    ];
    const artists = [
      { title: "Ninajirachi", artist: "girl edm · electro house", cover: ARTIST_DIR + "ninajirachi.jpeg" },
      { title: "Grimes", artist: "art pop · synth-pop", cover: ARTIST_DIR + "grimes.jpeg" },
      { title: "REZZ", artist: "midtempo bass", cover: ARTIST_DIR + "rezz.jpeg" },
      { title: "Skeler", artist: "hardwave · wave", cover: ARTIST_DIR + "skeler.jpeg" },
      { title: "Reol", artist: "j-pop · electropop", cover: ARTIST_DIR + "reol.jpeg" },
      { title: "Exyl", artist: "electro house · glitch hop", cover: ARTIST_DIR + "exyl.jpeg" },
      { title: "TheFatRat", artist: "glitch hop", cover: ARTIST_DIR + "thefatrat.jpeg" },
      { title: "DARCI", artist: "wave · trap soul", cover: ARTIST_DIR + "darci.jpeg" }
    ];
    const INTERVAL_MS = 5000;
    const coverWrap = document.getElementById('spotifyCover');
    const cover = document.getElementById('spotifyCoverImg');
    const meta = spotifyCard.querySelector('.spotify__meta');
    const trackEl = document.getElementById('spotifyTrack');
    const artistEl = document.getElementById('spotifyArtist');
    const counterEl = document.getElementById('spotifyCounter');
    const dotsEl = document.getElementById('spotifyDots');
    const elapsedEl = document.getElementById('spotifyElapsed');
    const totalEl = document.getElementById('spotifyTotal');

    const fmtTime = sec => pad2(Math.floor(sec / 60)) + ':' + pad2(Math.floor(sec % 60));

    spotifyCard.style.setProperty('--spotify-interval', (INTERVAL_MS / 1000) + 's');
    if (totalEl) totalEl.textContent = fmtTime(INTERVAL_MS / 1000);

    const dotFrag = document.createDocumentFragment();
    songs.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'track ' + (i + 1));
      b.dataset.idx = i;
      dotFrag.appendChild(b);
    });
    dotsEl.appendChild(dotFrag);
    const dotEls = Array.from(dotsEl.children);

    // preload only the upcoming cover instead of all of them at once —
    // saves a burst of ~14 requests on page load
    const preloadNext = () => {
      const i = new Image();
      i.src = songs[(idx + 1) % songs.length].cover;
    };

    let idx = 0;
    let tickStart = 0;
    let elapsedRaf = 0;

    const stopElapsed = () => { if (elapsedRaf) cancelAnimationFrame(elapsedRaf); elapsedRaf = 0; };
    const startElapsed = () => {
      stopElapsed();
      tickStart = performance.now();
      const total = INTERVAL_MS / 1000;
      // the readout is mm:ss, so ~59 of every 60 frames used to write back a
      // string identical to the one already there. Each of those writes dirties
      // a node inside the card, and a dirty card means its backdrop-filter pane
      // re-blurs — for the entire length of every track, scrolling or not.
      // Write only on a real change; the rAF itself is free without the write.
      let shown = '';
      const step = () => {
        const e = Math.min(total, (performance.now() - tickStart) / 1000);
        const t = fmtTime(e);
        if (t !== shown){ shown = t; if (elapsedEl) elapsedEl.textContent = t; }
        if (e < total) elapsedRaf = requestAnimationFrame(step);
      };
      elapsedRaf = requestAnimationFrame(step);
    };

    let onAfterRender = null;
    const render = () => {
      const s = songs[idx];
      coverWrap.classList.add('is-swap');
      meta.classList.add('is-swap');
      setTimeout(() => {
        cover.src = s.cover;
        cover.alt = s.title + ' — ' + s.artist;
        scrambleTo(trackEl, s.title);
        artistEl.textContent = s.artist;
        counterEl.textContent = pad2(idx + 1) + ' / ' + pad2(songs.length);
        dotEls.forEach((d, i) => {
          d.classList.toggle('is-active', i === idx);
          d.classList.toggle('is-played', i < idx);
        });
        // restart the tick animation by re-adding the active class
        const active = dotEls[idx];
        if (active){
          active.classList.remove('is-active');
          void active.offsetWidth;
          active.classList.add('is-active');
        }
        coverWrap.classList.remove('is-swap');
        meta.classList.remove('is-swap');
        startElapsed();
        preloadNext();
        if (onAfterRender) onAfterRender();
      }, 300);
    };

    let timer = 0;
    const schedule = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        idx = (idx + 1) % songs.length;
        render();
      }, INTERVAL_MS);
    };

    const jumpTo = (i) => {
      idx = ((i % songs.length) + songs.length) % songs.length;
      render();
      schedule();
    };

    dotsEl.addEventListener('click', (e) => {
      const t = e.target.closest('button[data-idx]');
      if (!t) return;
      e.stopPropagation();
      jumpTo(parseInt(t.dataset.idx, 10));
    });

    // ---------- MANIFEST : tracks / albums / artists overlay -------
    const manifest = document.getElementById('spotifyManifest');
    const manifestList = document.getElementById('manifestList');
    let lastFocus = null;

    if (manifest && manifestList) {
      // portal to body so position:fixed isn't broken by transformed ancestors
      if (manifest.parentElement !== document.body) document.body.appendChild(manifest);

      const albumList = document.getElementById('manifestAlbums');
      const artistList = document.getElementById('manifestArtists');
      const metaEl = document.getElementById('manifestMeta');

      // tracks — dense list, the only interactive one (jumps the rotation)
      const trackFrag = document.createDocumentFragment();
      songs.forEach((s, i) => {
        const li = document.createElement('li');
        li.className = 'manifest__item';
        li.innerHTML =
          '<button type="button" class="manifest__row" data-idx="' + i + '">' +
            '<span class="manifest__idx mono">' + pad2(i + 1) + '</span>' +
            '<span class="manifest__thumb"><img src="' + s.cover + '" alt="" loading="lazy" decoding="async" /></span>' +
            '<span class="manifest__txt">' +
              '<span class="manifest__title">' + escHtml(s.title) + '</span>' +
              '<span class="manifest__artist">' + escHtml(s.artist) + '</span>' +
            '</span>' +
            '<span class="manifest__status mono" aria-hidden="true"></span>' +
          '</button>';
        trackFrag.appendChild(li);
      });
      manifestList.appendChild(trackFrag);

      // albums — the artwork is the point, so it gets the room
      if (albumList) {
        const frag = document.createDocumentFragment();
        albums.forEach((a) => {
          const li = document.createElement('li');
          li.className = 'mtile';
          li.innerHTML =
            '<span class="mtile__art">' +
              '<img src="' + a.cover + '" alt="" loading="lazy" decoding="async" />' +
              '<span class="mtile__corner" aria-hidden="true"></span>' +
              (a.note ? '<span class="mtile__year mono">' + escHtml(a.note) + '</span>' : '') +
              '<span class="mtile__txt">' +
                '<span class="mtile__title">' + escHtml(a.title) + '</span>' +
                '<span class="mtile__artist">' + escHtml(a.artist) + '</span>' +
              '</span>' +
            '</span>';
          frag.appendChild(li);
        });
        albumList.appendChild(frag);
      }

      // artists — avatar pills that wrap, so the block reflows with the sheet
      if (artistList) {
        const frag = document.createDocumentFragment();
        artists.forEach((a) => {
          const li = document.createElement('li');
          li.className = 'mface';
          li.innerHTML =
            '<span class="mface__img"><img src="' + a.cover + '" alt="" loading="lazy" decoding="async" /></span>' +
            '<span class="mface__txt">' +
              '<span class="mface__name">' + escHtml(a.title) + '</span>' +
              '<span class="mface__tag">' + escHtml(a.artist) + '</span>' +
            '</span>';
          frag.appendChild(li);
        });
        artistList.appendChild(frag);
      }

      const COUNTS = { songs: songs.length, albums: albums.length, artists: artists.length };
      manifest.querySelectorAll('[data-col-count]').forEach((el) => {
        const n = COUNTS[el.dataset.colCount];
        if (n != null) el.textContent = n;
      });
      if (metaEl) {
        metaEl.textContent = COUNTS.songs + ' TRACKS · ' + COUNTS.albums + ' ALBUMS · ' + COUNTS.artists + ' ARTISTS';
      }

      const markActive = () => {
        manifestList.querySelectorAll('.manifest__row').forEach((r, i) => {
          r.classList.toggle('is-active', i === idx);
          const st = r.querySelector('.manifest__status');
          if (st) st.textContent = i === idx ? '▸ PLAYING' : '';
        });
      };

      // Entry order follows the layout, not the DOM: reading order. The row
      // an element sits in decides its beat (y quantised into bands, so a
      // 1px offset can't desync a row), and its horizontal position adds a
      // left-to-right lead within that row.
      const SWEEP_SELECTOR = '.manifest__doc, .manifest__head, .mbox__head, .manifest__item, .mtile, .mface, .manifest__foot';
      const SWEEP_BAND  = 18;   // px per row band — what counts as "same row"
      const SWEEP_STEP  = 26;   // ms between two boxes
      const SWEEP_TOTAL = 900;  // ms budget; the step tightens if items are added
      const sheetEl = manifest.querySelector('.manifest__sheet');

      const layoutSweep = () => {
        if (!sheetEl) return;
        const sheet = sheetEl.getBoundingClientRect();
        const boxes = Array.from(manifest.querySelectorAll(SWEEP_SELECTOR)).map((el) => {
          const b = el.getBoundingClientRect();
          return {
            el: el,
            row: Math.max(0, Math.round((b.top - sheet.top) / SWEEP_BAND)),
            col: b.left - sheet.left
          };
        });
        // reading order: rows top to bottom, boxes left to right within a row
        boxes.sort((a, b) => (a.row - b.row) || (a.col - b.col));
        const step = Math.min(SWEEP_STEP, SWEEP_TOTAL / Math.max(1, boxes.length));
        boxes.forEach((o, i) => o.el.style.setProperty('--d', Math.round(i * step) + 'ms'));
      };

      const root = document.documentElement;
      const lockScroll = () => {
        // reserve the scrollbar's width so hiding it doesn't jump the page
        const sbw = window.innerWidth - root.clientWidth;
        root.style.setProperty('--scrollbar-w', (sbw > 0 ? sbw : 0) + 'px');
        root.classList.add('is-scrolllock');
      };
      const unlockScroll = () => {
        root.classList.remove('is-scrolllock');
        root.style.removeProperty('--scrollbar-w');
      };

      // is-closing runs the exit keyframes; CLOSE_MS must outlast the longest
      // of them (.17s sheet / .16s backdrop) so nothing snaps mid-flight
      const CLOSE_MS = 200;
      let closeTimer = 0;

      const openManifest = () => {
        lastFocus = document.activeElement;
        clearTimeout(closeTimer);
        manifest.classList.remove('is-closing');
        manifest.hidden = false;
        // reset the scrollers first — the sweep measures where things sit
        manifestList.scrollTop = 0;
        const bento = manifest.querySelector('.manifest__bento');
        if (bento) bento.scrollTop = 0;
        // flush the un-hidden state synchronously instead of waiting a frame:
        // a throttled rAF would leave the overlay open but fully transparent
        void manifest.offsetWidth;
        layoutSweep();
        manifest.classList.add('is-open');
        lockScroll();
        markActive();
        const first = manifestList.querySelector('.manifest__row.is-active') || manifestList.querySelector('.manifest__row');
        if (first) first.focus({ preventScroll: true });
      };
      const closeManifest = () => {
        if (manifest.hidden) return;
        manifest.classList.add('is-closing');
        manifest.classList.remove('is-open');
        unlockScroll();
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
          manifest.hidden = true;
          manifest.classList.remove('is-closing');
        }, CLOSE_MS);
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
      };

      spotifyCard.addEventListener('click', (e) => {
        if (e.target.closest('#spotifyDots')) return;
        openManifest();
      });
      spotifyCard.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('#spotifyDots')) {
          e.preventDefault();
          openManifest();
        }
      });

      manifest.addEventListener('click', (e) => {
        if (e.target.closest('[data-manifest-close]')) { closeManifest(); return; }
        const row = e.target.closest('.manifest__row[data-idx]');
        if (row) { jumpTo(parseInt(row.dataset.idx, 10)); closeManifest(); }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !manifest.hidden) closeManifest();
      });

      // keep the manifest highlight in sync with the rotating widget
      onAfterRender = () => { if (!manifest.hidden) markActive(); };
    }

    // rotation + per-frame elapsed timer only run while the card is
    // actually on screen and the tab is visible — otherwise this widget
    // burns CPU forever in the background
    let cardInView = true;
    const updateRunState = () => {
      const run = cardInView && !document.hidden;
      if (run){ schedule(); startElapsed(); }
      else { clearInterval(timer); stopElapsed(); }
    };
    render();
    updateRunState();
    if ('IntersectionObserver' in window){
      new IntersectionObserver((ents) => {
        cardInView = ents[0].isIntersecting;
        updateRunState();
      }, { threshold: 0.05 }).observe(spotifyCard);
    }
    document.addEventListener('visibilitychange', updateRunState);
  }

  // ---------- TICKER : seamless loop (fallback duplication) -------
  // duplicates the static HTML so the loop works even if data.json fails.
  // data.json loader (below) overwrites with live content if available.
  const tickerTrack = document.getElementById('tickerTrack');
  if (tickerTrack) {
    tickerTrack.innerHTML += tickerTrack.innerHTML;
    const days = document.getElementById('countdownDays');
    if (days) {
      tickerTrack.querySelectorAll('#tickerDays').forEach((el, i) => {
        el.id = i ? '' : 'tickerDays';
        el.textContent = days.textContent;
      });
    }
  }

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

  fetch('data.json', { cache: 'no-cache' })
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
          if (!valEl) continue;
          if (kpi.since) {
            valEl.textContent = yearsMonthsSince(kpi.since);
          } else if (kpi.target) {
            // JP trip: counts down to `target`, then — while there — down
            // to `end`; afterwards shows the total stay + subAfter.
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

      // -- TICKER --
      if (tickerTrack && Array.isArray(data.ticker)) {
        const japanKpi = (data.kpis || []).find(k => k && k.target);
        let japanPhase = 'pre', japanDays = '';
        if (japanKpi) {
          const toStart = daysUntil(japanKpi.target);
          const toEnd   = japanKpi.end ? daysUntil(japanKpi.end) : 0;
          japanPhase = toStart > 0 ? 'pre' : (toEnd > 0 ? 'in' : 'post');
          japanDays  = toStart > 0 ? toStart : toEnd;
        }
        const items = data.ticker.map(t => {
          // items may carry phase variants for the JP trip (textIn / textAfter)
          const base = (japanPhase === 'in' && t.textIn) ? t.textIn
                     : (japanPhase === 'post' && t.textAfter) ? t.textAfter
                     : (t.text || '');
          const text = base.replaceAll('{japanDays}', japanDays);
          const tag = t.tag ? `<b>${escHtml(t.tag)}</b> ` : '';
          return `<span class="ticker__item">${tag}${escHtml(text)}</span><span class="ticker__sep">◇</span>`;
        }).join('');
        tickerTrack.innerHTML = items + items;
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

  // ---------- PHOTO TEASER : live pull from images.lucya.sh ------
  // The grid ships with static cards in the HTML; if the gallery answers,
  // the newest shots of the configured album take their place. Any failure
  // — offline, CORS, empty album — just leaves the static set standing, so
  // the section is never blank and never claims "live" without data.
  //
  // Endpoint is /api/photos, not /api/showcase: showcase only ever returns
  // the photos explicitly flagged as featured, we want the latest ones.
  // subtree=1 makes sure sub-albums (japan_2026/kyoto, …) are included even
  // if the album ever loses its `collection = true`.
  (() => {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;
    const api   = (grid.dataset.api || 'https://images.lucya.sh').replace(/\/+$/, '');
    const album = grid.dataset.album || '';
    // lite mode pulls a shorter strip — every card is a remote thumbnail
    const limit = LITE ? 4 : Math.min(24, Math.max(1, +grid.dataset.limit || 9));
    const countEl = document.getElementById('photosCount');
    const metaEl  = document.getElementById('photosMeta');

    const leaf = p => String(p).split('/').filter(Boolean).pop() || '';
    const stem = s => String(s).replace(/\.[^.]+$/, '');
    const shotDate = iso => {
      const d = iso ? new Date(iso) : null;
      return d && !isNaN(d) ? `${d.getFullYear()}.${pad2(d.getMonth()+1)}.${pad2(d.getDate())}` : '';
    };

    const url = `${api}/api/photos?limit=${limit}&sort=date_desc&subtree=1`
              + (album ? `&album=${encodeURIComponent(album)}` : '');
    const root = leaf(album);

    fetch(url, { mode: 'cors' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(({ items, total }) => {
        if (!Array.isArray(items) || !items.length) throw new Error('album empty');
        grid.innerHTML = items.map((it, i) => {
          const u     = it.urls || {};
          const thumb = u.thumb_abs || u.preview_abs || '';
          // the lightbox gets the preview, never the full frame — originals
          // in that album run well past 10 MB a piece. NOTE: the gallery only
          // sends CORP: cross-origin on /thumb, so /preview is blocked when
          // embedded here — hence the thumb as onerror fallback in the
          // lightbox. Once /preview ships that header it sharpens by itself.
          const big   = u.preview_abs || u.full_abs || thumb;
          const alb   = it.display_album || it.album || album;
          const file  = stem(it.display_filename || it.filename || `shot ${i + 1}`);
          const date  = shotDate(it.taken_at);
          // sub-albums are the trip's stops (japan_2026/kyoto → KYOTO), which
          // says more than a camera filename; shots sitting directly in the
          // album fall back to their filename. No EXIF date → no date shown,
          // mtime is an import timestamp and would be a lie here.
          const stop  = leaf(alb);
          const title = (stop && stop !== root) ? stop : file;
          const cap   = `${title.toUpperCase()} // ${alb}${date ? ` · ${date}` : ''}`;
          return `
    <figure class="photo-card" tabindex="0" role="button"
            data-src="${escHtml(big)}" data-src-fallback="${escHtml(thumb)}"
            data-caption="${escHtml(cap)}">
      <div class="photo-card__img-wrap">
        <img src="${escHtml(thumb)}" alt="${escHtml(`${alb} — ${file}`)}" loading="lazy" decoding="async" />
        <div class="photo-card__overlay"><span class="mono">EXPAND ↗</span></div>
      </div>
      <figcaption class="photo-card__cap">
        <span class="photo-card__tag mono">${escHtml(date || file.toUpperCase())} · ${pad2(i + 1)}</span>
        <span class="photo-card__title">${escHtml(title.toUpperCase())}</span>
      </figcaption>
    </figure>`;
        }).join('');
        const n = items.length, all = +total || n;
        if (countEl) countEl.textContent = all > n
          ? `${n} / ${all} ASSETS · LIVE`
          : `${n} ASSET${n === 1 ? '' : 'S'} · LIVE`;
        if (metaEl)  metaEl.textContent  = `${(root || 'ARCHIVE').toUpperCase()} · LIVE FROM IMAGES.LUCYA.SH`;
      })
      .catch(err => console.warn('[lucya] gallery API unavailable, keeping static photos', err));
  })();

  // ---------- PHOTO LIGHTBOX ------------------------------------
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lightboxImg');
  const lbCap       = document.getElementById('lightboxCap');
  const lbClose     = document.getElementById('lightboxClose');
  if (lightbox && lbImg && lbCap && lbClose) {
    const openLb = card => {
      // remote cards may carry a lower-res fallback for when the big file is
      // blocked cross-origin; local cards have none and just fail visibly
      const fallback = card.dataset.srcFallback || '';
      lbImg.onerror = () => {
        lbImg.onerror = null;
        if (fallback && lbImg.src !== fallback) lbImg.src = fallback;
      };
      lbImg.src = card.dataset.src || '';
      lbImg.alt = card.querySelector('img')?.alt || '';
      lbCap.textContent = card.dataset.caption || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden','false');
      lbClose.focus();
    };
    const closeLb = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden','true');
    };
    // delegated: the teaser grid is swapped out once the showcase API
    // answers, so per-card listeners would die with the static markup
    document.querySelectorAll('.photo-card').forEach(card => {
      card.setAttribute('tabindex','0');
      card.setAttribute('role','button');
    });
    document.addEventListener('click', e => {
      const card = e.target.closest?.('.photo-card');
      if (card) openLb(card);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest?.('.photo-card');
      if (card) { e.preventDefault(); openLb(card); }
    });
    lbClose.addEventListener('click', closeLb);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLb(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLb(); });
  }

  // ---------- UPTIME STAT ----------------------------------------
  // same anchor date as the UPTIME kpi in data.json so both always agree
  const uptime = document.getElementById('uptimeStat');
  if (uptime) uptime.textContent = yearsMonthsSince('2007-08-26');

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
      ov.dataset.state = crit>0 ? 'dead' : warn>0 ? 'stale' : 'ok';
      if (ovTag) ovTag.textContent = 'CHECKMK · LIVE';
      if (ovSrc) ovSrc.textContent = String(last.source || 'checkmk');
      if (ovAge) ovAge.textContent = fmtAge();
    };

    const sample = () => {
      if (ov){ ov.dataset.state='down'; if(ovTag)ovTag.textContent='CHECKMK · SAMPLE';
        if(ovSrc)ovSrc.textContent='sample data'; if(ovAge)ovAge.textContent='awaiting probe'; }
    };

    const tickAge = () => {
      if (!last) return;
      if (ovAge) ovAge.textContent = fmtAge();
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
  const docstrip = document.querySelector('.docstrip');
  if (kpiBar && profileSection && docstrip) {
    const mq = matchMedia('(max-width: 768px)');
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

  // ---------- MOBILE NAV : current-section highlight --------------
  // the bar carries more links than fit on a phone, so it scrolls sideways.
  // when the spy moves the highlight onto a link that sits outside the
  // visible strip, pull that link into the middle. a manual swipe wins for
  // a moment so the bar isn't yanked out from under a thumb.
  const mnav = document.querySelector('.mnav');
  if (mnav && 'IntersectionObserver' in window){
    const links = Array.from(mnav.querySelectorAll('a[href^="#"]'));
    const linkById = {};
    links.forEach(a => { linkById[a.getAttribute('href').slice(1)] = a; });

    const MANUAL_HOLD_MS = 1500;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lastManual = 0;
    ['pointerdown', 'touchstart', 'wheel'].forEach(ev => {
      mnav.addEventListener(ev, () => { lastManual = Date.now(); }, { passive: true });
    });

    const keepInView = (link) => {
      // also covers desktop, where the bar is display:none (both widths 0)
      if (mnav.scrollWidth <= mnav.clientWidth + 1) return;
      if (Date.now() - lastManual < MANUAL_HOLD_MS) return;
      const left = link.offsetLeft;
      const right = left + link.offsetWidth;
      const viewLeft = mnav.scrollLeft;
      if (left >= viewLeft && right <= viewLeft + mnav.clientWidth) return;
      mnav.scrollTo({
        left: left - (mnav.clientWidth - link.offsetWidth) / 2,
        behavior: reduceMotion.matches ? 'auto' : 'smooth'
      });
    };

    const spy = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const active = linkById[e.target.id];
        if (!active || active.classList.contains('is-current')) return;
        links.forEach(l => l.classList.toggle('is-current', l === active));
        keepInView(active);
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    Object.keys(linkById).forEach(id => {
      const sec = document.getElementById(id);
      if (sec) spy.observe(sec);
    });
  }

})();
