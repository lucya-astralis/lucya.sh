/* =================================================================
   SET-NAV — one panel-set at a time, glitch entry/exit, no classic
   scrolling. Desktop only (>=1100px); narrower screens scroll normally.
   Self-contained; relies only on DOM structure + classes in styles.css.
   ================================================================= */
(function () {
  'use strict';

  var MQ = window.matchMedia('(min-width: 1100px)');
  var root = document.documentElement;

  var main, layout, mainCol, sideCol, footer;
  var panels = [];          // [{ main:[...], side:[...] } ...] + footer panel appended
  var current = 0;
  var transitioning = false;
  var wheelLock = false;
  var active = false;       // set-mode currently engaged
  var pager, hint;

  var EXIT_MS = 320;
  var ENTER_MS = 620;       // matches the slide-in duration
  var COOLDOWN = 200;       // extra lock after enter finishes
  var STAGGER = 110;        // per-card delay so they don't appear all at once

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function byId(id) { return document.getElementById(id); }
  function pick(ids) {
    return ids.map(byId).filter(Boolean);
  }

  function buildPanels() {
    panels = [
      { main: pick(['profile']),            side: pick(['buttons', 'spotify']) },
      { main: pick(['about', 'interests']), side: pick(['games']) },
      { main: pick(['systems', 'services']),side: pick(['photos']) }
    ];
    // footer is no longer a panel — it's rendered as a slim persistent bar
  }

  // staggered slide+flicker entrance for a set's sections
  function playEntrance(els) {
    els.forEach(function (el, idx) {
      el.style.setProperty('--set-delay', (idx * STAGGER) + 'ms');
      el.classList.add('set-in');
    });
  }
  function clearEntrance(els) {
    els.forEach(function (el) {
      el.classList.remove('set-in');
      el.style.removeProperty('--set-delay');
    });
  }
  function entranceMs(count) {
    return ENTER_MS + Math.max(0, count - 1) * STAGGER;
  }

  function elementsFor(i) {
    var p = panels[i];
    if (!p) return [];
    if (p.footer) return [p.footer];
    return p.main.concat(p.side);
  }

  function measureStage() {
    // height of the chrome above <main> (nav + ticker + kpibar + thermal),
    // minus the slim footer bar reserved at the very bottom (--setbar-h)
    var top = Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY));
    root.style.setProperty('--stage-h', 'calc(100vh - ' + top + 'px - var(--setbar-h, 0px))');
  }

  function applyColumnMode(i) {
    var p = panels[i];
    layout.classList.toggle('is-solo', !!(p && p.main && p.main.length && (!p.side || !p.side.length) && !p.footer));
  }

  function resetColumns() {
    if (mainCol) mainCol.scrollTop = 0;
    if (sideCol) sideCol.scrollTop = 0;
  }

  function revealInside(els) {
    resetColumns();
    els.forEach(function (el) {
      el.scrollTop = 0;
      el.classList.add('is-visible');
      var blocks = el.querySelectorAll('.reveal-block, .is-visible-target');
      for (var j = 0; j < blocks.length; j++) blocks[j].classList.add('is-visible');
    });
  }

  function show(target, dir) {
    target = Math.max(0, Math.min(panels.length - 1, target));
    if (target === current || transitioning) return;

    transitioning = true;
    var outEls = elementsFor(current);
    var inEls = elementsFor(target);

    main.classList.add('is-swapping');
    clearEntrance(outEls); // drop any lingering entrance delay before exit
    outEls.forEach(function (el) { el.classList.add('set-exit'); });

    setTimeout(function () {
      outEls.forEach(function (el) {
        el.classList.remove('set-exit', 'is-set-active');
      });

      current = target;
      applyColumnMode(current);

      // every set animates in: staggered slide + flicker
      inEls.forEach(function (el) { el.classList.add('is-set-active'); });
      playEntrance(inEls);
      revealInside(inEls);
      updatePager();
      updateNav();

      setTimeout(function () {
        clearEntrance(inEls);
        main.classList.remove('is-swapping');
        setTimeout(function () { transitioning = false; }, COOLDOWN);
      }, entranceMs(inEls.length));
    }, EXIT_MS);
  }

  function go(delta) {
    show(current + delta, delta > 0 ? 1 : -1);
  }

  function jumpTo(i) {
    show(i, i > current ? 1 : -1);
  }

  // does some scrollable container under `node` still have room in `dir`?
  function innerCanScroll(node, dir) {
    var el = node;
    while (el && el !== main) {
      var oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        if (dir > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        if (dir < 0 && el.scrollTop > 1) return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function onWheel(e) {
    if (!active) return;
    var dir = e.deltaY > 0 ? 1 : -1;
    if (innerCanScroll(e.target, dir)) return; // let the panel scroll internally
    e.preventDefault();
    if (transitioning || wheelLock) return;
    wheelLock = true;
    setTimeout(function () { wheelLock = false; }, EXIT_MS + ENTER_MS + COOLDOWN);
    go(dir);
  }

  function onKey(e) {
    if (!active) return;
    var t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    switch (e.key) {
      case 'ArrowDown': case 'PageDown':
        e.preventDefault(); go(1); break;
      case 'ArrowUp': case 'PageUp':
        e.preventDefault(); go(-1); break;
      case ' ':
        e.preventDefault(); go(e.shiftKey ? -1 : 1); break;
      case 'Home':
        e.preventDefault(); jumpTo(0); break;
      case 'End':
        e.preventDefault(); jumpTo(panels.length - 1); break;
    }
  }

  // ---- nav links jump to their set instead of anchor-scrolling ----
  var navMap = {};
  function wireNav() {
    var links = document.querySelectorAll('.nav__links a[href^="#"]');
    for (var i = 0; i < links.length; i++) {
      (function (a) {
        var id = a.getAttribute('href').slice(1);
        var idx = panels.findIndex(function (p) {
          return elementsForIds(p).indexOf(id) > -1;
        });
        if (idx < 0) return;
        navMap[id] = idx;
        a.addEventListener('click', function (e) {
          if (!active) return;
          e.preventDefault();
          jumpTo(idx);
        });
      })(links[i]);
    }
  }

  function elementsForIds(p) {
    if (!p || p.footer) return [];
    return p.main.concat(p.side).map(function (el) { return el.id; });
  }

  function updateNav() {
    var links = document.querySelectorAll('.nav__links a[href^="#"]');
    var activeIds = panels[current] ? elementsForIds(panels[current]) : [];
    for (var i = 0; i < links.length; i++) {
      var id = links[i].getAttribute('href').slice(1);
      var on = activeIds.indexOf(id) > -1;
      links[i].classList.toggle('is-current', on);
      if (on) links[i].setAttribute('aria-current', 'true');
      else links[i].removeAttribute('aria-current');
    }
  }

  // ---- pager dots + hint ----
  function buildChrome() {
    pager = document.createElement('div');
    pager.className = 'setpager';
    pager.setAttribute('aria-label', 'panel navigation');
    panels.forEach(function (p, i) {
      var b = document.createElement('button');
      b.className = 'setpager__dot';
      b.type = 'button';
      var label = p.footer ? 'INFO' : (p.main && p.main[0] ? p.main[0].id : ('panel ' + (i + 1)));
      b.setAttribute('aria-label', label);
      b.addEventListener('click', function () { if (active) jumpTo(i); });
      pager.appendChild(b);
    });
    document.body.appendChild(pager);

    hint = document.createElement('div');
    hint.className = 'sethint';
    hint.innerHTML = '<span>SCROLL</span><span class="sethint__arrow">▼</span><span>NEXT</span>';
    document.body.appendChild(hint);

    buildBar();
  }

  // slim persistent footer bar (set-mode only); keeps Impressum/Datenschutz
  // reachable on every set without a dedicated panel
  function buildBar() {
    var bar = document.createElement('div');
    bar.className = 'setbar mono';
    bar.setAttribute('aria-label', 'site footer');

    var copy = document.createElement('span');
    copy.className = 'setbar__copy';
    var yrEl = document.getElementById('thisYear');
    var yr = (yrEl && yrEl.textContent.trim()) || String(new Date().getFullYear());
    copy.innerHTML = '© LUCYA SYSTEMS<span class="reg">®</span> ' + yr + ' · ALL RIGHTS RESERVED';
    bar.appendChild(copy);

    var links = document.createElement('span');
    links.className = 'setbar__links';
    var src = footer && footer.querySelector('.foot__legal-links');
    var anchors = src ? Array.prototype.slice.call(src.querySelectorAll('a')) : [];
    for (var i = 0; i < anchors.length; i++) {
      if (i) {
        var sep = document.createElement('span');
        sep.className = 'setbar__sep';
        sep.textContent = '·';
        links.appendChild(sep);
      }
      links.appendChild(anchors[i].cloneNode(true));
    }
    bar.appendChild(links);

    document.body.appendChild(bar);
  }

  function updatePager() {
    if (!pager) return;
    var dots = pager.children;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('is-on', i === current);
  }

  // ---- enable / disable across the breakpoint ----
  function enable() {
    if (active) return;
    active = true;
    root.classList.add('setmode');
    measureStage();
    // reveal everything once (no scroll observer will fire in set-mode)
    var allBlocks = document.querySelectorAll('.reveal-block');
    for (var i = 0; i < allBlocks.length; i++) allBlocks[i].classList.add('is-visible');
    // hide all, then show the current set
    panels.forEach(function (p, i) {
      elementsFor(i).forEach(function (el) { el.classList.remove('is-set-active', 'set-enter', 'set-exit'); });
    });
    applyColumnMode(current);
    elementsFor(current).forEach(function (el) { el.classList.add('is-set-active'); el.scrollTop = 0; });
    updatePager();
    updateNav();
  }

  function disable() {
    if (!active) return;
    active = false;
    root.classList.remove('setmode');
    layout.classList.remove('is-solo');
    main.classList.remove('is-swapping');
    // clear all panel state so normal scrolling layout returns
    document.querySelectorAll('.is-set-active, .set-enter, .set-exit').forEach(function (el) {
      el.classList.remove('is-set-active', 'set-enter', 'set-exit');
    });
    root.style.removeProperty('--stage-h');
  }

  function syncMode() {
    if (MQ.matches) enable();
    else disable();
  }

  ready(function () {
    main = document.getElementById('top');
    layout = main && main.querySelector('.layout');
    mainCol = layout && layout.querySelector('.layout__main');
    sideCol = layout && layout.querySelector('.layout__side');
    footer = main && main.querySelector('.foot');
    if (!main || !layout || !mainCol || !sideCol) return;

    buildPanels();
    buildChrome();
    wireNav();

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', function () { if (active) measureStage(); });
    if (MQ.addEventListener) MQ.addEventListener('change', syncMode);
    else if (MQ.addListener) MQ.addListener(syncMode);

    syncMode();
  });
})();
