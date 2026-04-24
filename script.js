/* ================================================================
   LUCYA // lucya.dev  —  interactions
   ================================================================ */

(() => {

  // ---------- SPLASH : progress bar ------------------------------
  // progress only starts once the whole splash UI has built in.
  // UI reveal timing (CSS): corners 0.05-0.42s, log 0.55s, bottom 0.95s.
  // Log lines stream in from ~1.25s onward; we kick progress just after.
  const PROGRESS_START_DELAY = 1250;
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
      p += Math.round(2 + Math.random() * 9);
      if (p > 100) p = 100;
      progressPct.textContent = `${String(p).padStart(2, '0')}%`;
      progressFill.style.width = p + '%';
      revealLogs();
      setTimeout(tick, 160 + Math.random() * 260);
    };
    setTimeout(tick, PROGRESS_START_DELAY);
  }

  // ---------- SPLASH : session id + boot log ---------------------
  const sessionEl = document.getElementById('splashSession');
  if (sessionEl){
    const now = new Date();
    const pad2 = n => String(n).padStart(2,'0');
    const stamp = `${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    sessionEl.textContent = `SESSION · ${stamp}`;
  }

  const logEl = document.getElementById('splashLog');
  if (logEl){
    const hex = () => Math.random().toString(16).slice(2, 8).toUpperCase();
    const lines = [
      ['OK',   'LUCYA-CORE // COLD BOOT'],
      ['OK',   'MOUNTING /dev/sigil'],
      ['OK',   'LOAD KERNEL 6.8.0-LUCYA'],
      ['WAIT', 'HANDSHAKE · NODE-01'],
      ['OK',   'AUTH KEYRING · LUCYA@CORE'],
      ['OK',   'NET · SECURE CHANNEL UP'],
      ['OK',   'LOADING RITUAL ASSETS'],
      ['WAIT', 'DECRYPT /var/soul'],
      ['OK',   'GEOFENCE · DE-BY LOCKED'],
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

  // ---------- REVEAL : mark below-fold blocks (observer starts post-splash) ----------
  const revealSelectors = ['.about', '.interests', '.buttons', '.neofetch', '.services', '.spotify', '.foot'];
  const revealTargets = revealSelectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
  revealTargets.forEach(el => el.classList.add('reveal-block'));

  // splash lockdown + body scroll toggle
  document.body.style.overflow = 'hidden';
  // flip body -> ready slightly before the splash fade finishes,
  // so nav/pcard/hero-side are flickering in as the splash fades away.
  setTimeout(() => {
    document.body.classList.add('is-ready');
    // start observing below-fold blocks now — reveal as user scrolls past them
    if ('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting){
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      revealTargets.forEach(el => io.observe(el));
    } else {
      revealTargets.forEach(el => el.classList.add('is-visible'));
    }
  }, 7400);
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) splash.classList.add('is-done');
    document.body.style.overflow = '';
  }, 8000);

  // ---------- SPLASH LOGO BUILD ----------------------------------
  (function splashLogoBuild(){
    const mainSvg = document.getElementById('splashLogoSvg');
    if (!mainSvg) return;
    const rgbR = document.getElementById('rgbR');
    const rgbB = document.getElementById('rgbB');
    const order = [
      { id: 'p2', dur: 1.0 },
      { id: 'p5', dur: 0.85 },
      { id: 'p3', dur: 0.85 },
      { id: 'p0', dur: 0.6 },
      { id: 'p4', dur: 0.4 },
      { id: 'p1', dur: 0.4 },
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
      await wait(300);
      for (let i = 0; i < order.length; i++){
        const el = document.getElementById(order[i].id);
        if (el) el.classList.add('drawn');
        if (i === 1 || i === 3) await shake(mainSvg, 3, 3);
        await wait(160);
      }
      await wait(350);
      await burst(mainSvg, 10, 16);
      for (let i = 0; i < order.length; i++){
        const el = document.getElementById(order[i].id);
        if (el) el.classList.add('filled');
        if (i % 2 === 0){ rgbSplit(2 + Math.random()*3); await wait(25); rgbClear(); }
        await wait(40);
      }
      await burst(mainSvg, 8, 12);

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
  const pad = n => String(n).padStart(2, '0');
  const fmt12 = d => {
    let h = d.getHours(); const m = d.getMinutes();
    const am = h < 12 ? 'AM' : 'PM';
    h = h % 12 || 12;
    return `${h}:${pad(m)} ${am}`;
  };
  const navTime   = document.getElementById('navTime');
  const footTime  = document.getElementById('footTime');
  const tzLocal   = document.getElementById('tzLocal');
  const tzYours   = document.getElementById('tzYours');

  const updateClock = () => {
    const now = new Date();
    const hms = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    if (navTime)  navTime.textContent  = `${hms} CET`;
    if (footTime) footTime.textContent = `CET ${hms} · 通信中`;
    if (tzLocal)  tzLocal.textContent  = fmt12(now);
    if (tzYours)  tzYours.textContent  = fmt12(now);
  };
  updateClock();
  setInterval(updateClock, 1000);

  // ---------- COUNTDOWN : "noch XX Tage" / "あとXX日" -------------
  // anchor the target so the count decreases over time
  const countdownTarget = new Date('2026-08-10T00:00:00');
  const updateCountdown = () => {
    const now = new Date();
    const diff = Math.max(0, Math.ceil((countdownTarget - now) / 86400000));
    const a = document.getElementById('countdownDays');
    const b = document.getElementById('pcardCountdown');
    if (a) a.textContent = diff;
    if (b) b.textContent = diff;
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
    const mkRow = () => pokemon.map(f =>
      `<img src="images/pokemon/${f}" alt="" loading="lazy" />`).join('');
    // two copies for seamless loop
    pokeTrack.innerHTML = mkRow() + mkRow();
  }

  // ---------- 88x31 BUTTON WALL ----------------------------------
  const buttons = [
    ['pride.png','pride'],['eu.gif','eu'],['adhd.png','adhd'],['autism-new.png','autism'],
    ['binbows.gif','binbows.net'],['twitter.gif','twitter'],['discord.gif','discord'],
    ['steam.gif','steam'],['landshut.png','landshut'],['pilsting.png','pilsting'],
    ['think.gif','think'],['gif8.gif','gif'],['gif16.gif','gif'],
    ['ie.gif','internet explorer'],
    ['amd.gif','amd'],['affinity-designer.png','affinity designer'],
    ['archive.gif','archive'],['astra.gif','astra'],
    ['autism.png','autism'],['computer.png','my computer'],
    ['dance.gif','dance'],['dnd.png','dnd'],
    ['face.gif','face'],['fukuoka.png','fukuoka'],
    ['gif15.gif','gif'],['gif2.gif','gif'],
    ['gif5.gif','gif'],['gif6.gif','gif'],
    ['lain.gif','lain'],
    ['miku.gif','hatsune miku'],['mspaint.jpg','ms paint'],['nerv.png','nerv'],
    ['smile.gif','smile'],
    
  ];
  const wall = document.getElementById('buttonWall');
  if (wall) {
    const frag = document.createDocumentFragment();
    buttons.forEach(([file, name]) => {
      const a = document.createElement('a');
      a.className = 'b81';
      a.href = '#';
      a.title = name;
      a.innerHTML =
        `<img src="images/88x31 buttons/${file}" alt="${name}" loading="lazy" />` +
        `<span class="b81__name">${name}</span>`;
      frag.appendChild(a);
    });
    wall.appendChild(frag);
  }

  // ---------- DOMAINS --------------------------------------------
  const domains = [
    ['lucya.dev',          'lucya_logo_text.svg',     'Personal homepage · identity hub',    'PRIMARY', true, 'logo'],
    ['aizaku.com',         'aizaku.com.svg',          'Deffence industry',                   'ACTIVE',  true],
    ['astraos.app',        'astraos.app.svg',         'AstraOS — main product site',         'ACTIVE',  true],
    ['beta.astraos.app',   'beta.astraos.app.svg',    'AstraOS public beta portal',          'ACTIVE',  true],
    ['status.astraos.app', 'status.astraos.app.svg',  'System status · uptime monitor',      'ACTIVE',  true],
    ['binbows.net',        'binbows.net.svg',         'Official Binbows site',               'ACTIVE',  true],
    ['inter-astra.org',    'inter-astra.org.svg',     'inter-astra collective',              'PARKED',  true],
    ['gov.inter-astra.org','gov.inter-astra.org.svg', 'Internal governance portal',          'ACTIVE',  true],
    ['wirtaufendeinauto.de','wirtaufendeinauto.de.svg','gag domain · for the memes',         'ACTIVE',  true],
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
        <div class="dcard__logo"><img src="${path}" alt="${url}" loading="lazy" /></div>
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



  // ---------- NEOFETCH : real systems ----------------------------
  // raw content uses inline <span style="color:..."> and occasionally
  // malformed <span/> as closers — we sanitize on inject.
  const sanitize = s => s.replace(/<span\/>/g, '</span>');

  const neofetchData = [
    {
      id: 'aoi',
      tab: 'aoi',
      title: 'aoi.inter-astra.local // mobile workstation',
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
      id: 'vanta',
      tab: 'vanta',
      title: 'vanta.inter-astra.local // main system',
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
      id: 'lynx',
      tab: 'lynx',
      title: 'lynx.inter-astra.local // homelab core hypervisor',
      width: 800,
      content: `<span style="color: #e7e7e7;">         .://:'              '://:.<span/>             <span style="color: #E57000;">root<span/><span style="color: #e7e7e7;">@<span/><span style="color: #E57000;">lynx</span>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'<span/>           <span style="color: #E57000;">---------<span/>
<span style="color: #e7e7e7;">        'sMMMMMMMd:      :mMMMMMMMs'<span/>            <span style="color: #e7e7e7;">OS: Proxmox VE 9.x.x x86_64<span/>
<span style="color: #E57000;">'-/+oo+/:<span/><span style="color: #e7e7e7;">'.yMMMMMMMh-  -hMMMMMMMy.'<span/><span style="color: #E57000;">:/+oo+/-'    <span/><span style="color: #e7e7e7;">Host: Macmini6,2 (1.0)<span/>
<span style="color: #E57000;">':oooooooo/<span/><span style="color: #e7e7e7;">'-hMMMMMMMyyMMMMMMMh-'<span/><span style="color: #E57000;">/oooooooo:'    <span/><span style="color: #e7e7e7;">Kernel: Linux 6.17.4-2-pve<span/>
<span style="color: #E57000;">  '/oooooooo:<span/><span style="color: #e7e7e7;">':mMMMMMMMMMMMMm:'<span/><span style="color: #E57000;">:oooooooo/'      <span/><span style="color: #e7e7e7;">Uptime: 23 days, 22 hours, 54 mins<span/>
<span style="color: #E57000;">    ./ooooooo+-<span/><span style="color: #e7e7e7;"> +NMMMMMMMMN+ <span/><span style="color: #E57000;">-+ooooooo/.        <span/><span style="color: #e7e7e7;">Packages: 738 (dpkg)<span/>
<span style="color: #E57000;">      .+ooooooo+-<span/><span style="color: #e7e7e7;">'oNMMMMNo'<span/><span style="color: #E57000;">-+ooooooo+.          <span/><span style="color: #e7e7e7;">Shell: bash 5.2.37<span/>
<span style="color: #E57000;">        -+ooooooo/.<span/><span style="color: #e7e7e7;">'sMMs'<span/><span style="color: #E57000;">./ooooooo+-            <span/><span style="color: #e7e7e7;">Terminal: termproxy<span/>
<span style="color: #E57000;">          :oooooooo/<span/><span style="color: #e7e7e7;">'..'<span/><span style="color: #E57000;">/oooooooo:              <span/><span style="color: #e7e7e7;">CPU: Intel(R) Core(TM) i7-3615QM (8) @ 3.30 GHz<span/>
<span style="color: #E57000;">          :oooooooo/'<span/><span style="color: #e7e7e7;">..<span/><span style="color: #E57000;">'/oooooooo:              <span/><span style="color: #e7e7e7;">GPU: Intel 3rd Gen Core processor Graphics Controller<span/>
<span style="color: #E57000;">        -+ooooooo/.'<span/><span style="color: #e7e7e7;">sMMs<span/><span style="color: #E57000;">'./ooooooo+-            <span/><span style="color: #e7e7e7;">Memory: 12.66 GiB / 15.53 GiB (<span/><span style="color: #da0a0a;">82%<span/><span style="color: #e7e7e7;">)<span/>
<span style="color: #E57000;">      .+ooooooo+-'<span/><span style="color: #e7e7e7;">oNMMMMNo<span/><span style="color: #E57000;">'-+ooooooo+.          <span/><span style="color: #e7e7e7;">Swap: 124.55 MiB / 8.00 GiB (<span/><span style="color: #06e236;">2%<span/><span style="color: #e7e7e7;">)<span/>
<span style="color: #E57000;">    ./ooooooo+- <span/><span style="color: #e7e7e7;">+NMMMMMMMMN+ <span/><span style="color: #E57000;">-+ooooooo/.        <span/><span style="color: #e7e7e7;">Disk (/): 21.41 GiB / 93.93 GiB (<span/><span style="color: #06e236;">23%<span/><span style="color: #e7e7e7;">) - ext4<span/>
<span style="color: #E57000;">  '/oooooooo:'<span/><span style="color: #e7e7e7;">:mMMMMMMMMMMMMm:<span/><span style="color: #E57000;">':oooooooo/'      <span/><span style="color: #e7e7e7;">Local IP (vmbr0): 192.168.178.252/24<span/>
<span style="color: #E57000;">':oooooooo/'<span/><span style="color: #e7e7e7;">-hMMMMMMMyyMMMMMMMh-<span/><span style="color: #E57000;">'/oooooooo:'    <span/><span style="color: #e7e7e7;">Locale: en_US.UTF-8<span/>
<span style="color: #E57000;">'-/+oo+/:'<span/><span style="color: #e7e7e7;">.yMMMMMMMh-  -hMMMMMMMy.<span/><span style="color: #E57000;">':/+oo+/-'<span/>
<span style="color: #e7e7e7;">        'sMMMMMMMm:      :dMMMMMMMs'<span/>
<span style="color: #e7e7e7;">       'hMMMMMMd/          /dMMMMMMh'<span/>
<span style="color: #e7e7e7;">         '://:'              '://:'<span/> `
    },
    {
      id: 'rubicon',
      tab: 'rubicon',
      title: 'rubicon.inter-astra.local // linux macbook',
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
      id: 'esx-01',
      tab: 'esx-01',
      title: 'esx-01.inter-astra.local // homelab virtualization host #01',
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
      title: 'esx-02.inter-astra.local // homelab virtualization host #02',
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
      id: 'kolibri',
      tab: 'kolibri',
      title: 'kolibri.inter-astra.local // main laptop / tablet',
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
      id: 'motte',
      tab: 'motte',
      title: 'motte.inter-astra.local // garbage 1st gen lenovo yogabook',
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
    {
      id: 'dc-01',
      tab: 'dc-01',
      title: "dc-01.inter-astra.local // domain controller (yes, it's a surface)",
      width: 900,
      content: `<span style="color:#3B78FF;">      ##%%%%%%%%%  %%%%%%%%%##</span>          <span style="color:#61D6D6;">Administrator</span>@<span style="color:#61D6D6;">DC-01</span>
<span style="color:#3B78FF;">    ###%%%%%%%%%%  %%%%%%%%%%###</span>        <span style="color:#CCCCCC;">--------------------</span>
<span style="color:#3B78FF;">  ####%%%%%%%%%%%  %%%%%%%%%%%####</span>      <span style="color:#F9F1A5;">OS:</span> <span style="color:#CCCCCC;">Windows Server 2025 Standard Evaluation x86_64</span>
<span style="color:#3B78FF;"> ##%%%%%%%%%%%%%%  %%%%%%%%%%%%%%##</span>     <span style="color:#F9F1A5;">Host:</span> <span style="color:#CCCCCC;">Surface Pro</span>
<span style="color:#3B78FF;">#%%%%%%%%%%%%%%%%  %%%%%%%%%%%%%%%%#</span>    <span style="color:#F9F1A5;">Kernel:</span> <span style="color:#CCCCCC;">WIN32_NT 10.0.26100.3476 (24H2)</span>
<span style="color:#3B78FF;">%%%%%%%%%%%%%%%%%  %%%%%%%%%%%%%%%%%</span>    <span style="color:#F9F1A5;">Uptime:</span> <span style="color:#CCCCCC;">7 hour, 34 mins</span>
<span style="color:#3B78FF;">%%%%%%%%%%%%%%%%%  %%%%%%%%%%%%%%%%%</span>    <span style="color:#F9F1A5;">Packages:</span> <span style="color:#CCCCCC;">1 (scoop)</span>
<span style="color:#3B78FF;">%%%%%%%%%%%%%%%%%  #%%%%%%%%%%%%%%%%</span>    <span style="color:#F9F1A5;">Shell:</span> <span style="color:#CCCCCC;">CMD 10.0.26100.3323</span>
                                        <span style="color:#F9F1A5;">Display (LGD0555):</span> <span style="color:#CCCCCC;">2736x1824 @ 60 Hz (as 1563x1042) in 12" [Built-in]</span>
<span style="color:#3B78FF;">%%%%%%%%%%%%%%%%%  #%%%%%%%%%%%%%%%%</span>    <span style="color:#F9F1A5;">DE:</span> <span style="color:#CCCCCC;">Fluent</span>
<span style="color:#3B78FF;">%%%%%%%%%%%%%%%%%  %%%%%%%%%%%%%%%%%</span>    <span style="color:#F9F1A5;">WM:</span> <span style="color:#CCCCCC;">Desktop Window Manager 10.0.26100.3323</span>
<span style="color:#3B78FF;">%%%%%%%%%%%%%%%%%  %%%%%%%%%%%%%%%%%</span>    <span style="color:#F9F1A5;">WM Theme:</span> <span style="color:#CCCCCC;">Dark - Blue (System: Dark, Apps: Dark)</span>
<span style="color:#3B78FF;">%%%%%%%%%%%%%%%%%  %%%%%%%%%%%%%%%%#</span>    <span style="color:#F9F1A5;">Font:</span> <span style="color:#CCCCCC;">Segoe UI (12pt) [Caption / Menu / Message / Status]</span>
<span style="color:#3B78FF;"> ###%%%%%%%%%%%%%  %%%%%%%%%%%%%%%##</span>    <span style="color:#F9F1A5;">Cursor:</span> <span style="color:#CCCCCC;">Windows Default (32px)</span>
<span style="color:#3B78FF;">  ####%%%%%%%%%%%  %%%%%%%%%%%#%####</span>    <span style="color:#F9F1A5;">Terminal:</span> <span style="color:#CCCCCC;">Windows Console 10.0.26100.3323</span>
<span style="color:#3B78FF;">    ##%#%%%%%%%%%  %%%%%%%%%%%######</span>    <span style="color:#F9F1A5;">Terminal Font:</span> <span style="color:#CCCCCC;">Consolas (16pt)</span>
<span style="color:#3B78FF;">      ##%%%%%%%%%  %%%%%%%%%########</span>    <span style="color:#F9F1A5;">CPU:</span> <span style="color:#CCCCCC;">Intel(R) Core(TM) i5-7300U (4) @ 3,50 GHz</span>
                                        <span style="color:#F9F1A5;">GPU:</span> <span style="color:#CCCCCC;">Intel(R) HD Graphics 620 (128,00 MiB) [Integrated]</span>
                                        <span style="color:#F9F1A5;">Memory:</span> <span style="color:#CCCCCC;">3,03 GiB / 3,92 GiB</span> (<span style="color:#13A10E;">77%</span>)
                                        <span style="color:#F9F1A5;">Swap:</span> <span style="color:#CCCCCC;">0 B / 5,00 GiB</span> (<span style="color:#13A10E;">0%</span>)
                                        <span style="color:#F9F1A5;">Disk (C:\\):</span> <span style="color:#CCCCCC;">26,48 GiB / 166,41 GiB</span> (<span style="color:#13A10E;">16%</span>) - <span style="color:#CCCCCC;">NTFS</span>
                                        <span style="color:#F9F1A5;">Local IP (Ethernet 4):</span> <span style="color:#CCCCCC;">192.168.178.3/24</span>
                                        <span style="color:#F9F1A5;">Battery:</span> <span style="color:#CCCCCC;">100% [Discharging]</span>
                                        <span style="color:#F9F1A5;">Locale:</span> <span style="color:#CCCCCC;">de-DE</span>`
    },
    {
      id: 'orcus',
      tab: 'orcus',
      title: 'orcus.inter-astra.local // imac mid 2011 21.5 inch',
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
      id: 'backup-01',
      tab: 'backup-01',
      title: 'backup-01.inter-astra.local // thinkstation c20x / old backup pc',
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
                                        <span style="color:#e5c07b;">Local IP (LAN-Verbindung 2):</span> <span style="color:#ffffff;">236.174.110.143/24</span>
                                        <span style="color:#e5c07b;">Locale:</span> <span style="color:#ffffff;">de-DE</span>`
    },
  ];

  const nTabs  = document.getElementById('nTabs');
  const nPanes = document.getElementById('nPanes');
  if (nTabs && nPanes) {
    neofetchData.forEach((entry, i) => {
      const btn = document.createElement('button');
      btn.className = 'ntab' + (i === 0 ? ' is-active' : '');
      btn.dataset.tab = entry.id;
      btn.textContent = entry.tab;
      nTabs.appendChild(btn);

      const pane = document.createElement('div');
      pane.className = 'nterm' + (i === 0 ? ' is-active' : '');
      pane.dataset.pane = entry.id;
      pane.innerHTML = `
        <div class="nterm__bar">
          <span class="nterm__dot"></span><span class="nterm__dot"></span><span class="nterm__dot"></span>
          <span class="nterm__title">${entry.title}</span>
        </div>
        <pre class="nterm__body">${sanitize(entry.content)}</pre>
      `;
      nPanes.appendChild(pane);
    });

    // tab switching
    nTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.ntab');
      if (!btn) return;
      const target = btn.dataset.tab;
      nTabs.querySelectorAll('.ntab').forEach(t => t.classList.toggle('is-active', t === btn));
      nPanes.querySelectorAll('.nterm').forEach(p => p.classList.toggle('is-active', p.dataset.pane === target));
    });
  }

  // ---------- UPTIME STAT ----------------------------------------
  const uptime = document.getElementById('uptimeStat');
  if (uptime) {
    const born = new Date(2007, 11, 1);
    const now = new Date();
    let years = now.getFullYear() - born.getFullYear();
    let months = now.getMonth() - born.getMonth();
    if (months < 0) { years--; months += 12; }
    uptime.textContent = `${years}y ${String(months).padStart(2, '0')}m`;
  }

})();
