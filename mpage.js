/* =================================================================
   M-PAGE — the phone counterpart to set-nav. Below 768px the page is
   cut into a handful of pages instead of one endless scroll: the
   bottom bar (.mnav) switches between them, a swipe left/right steps
   through them, and a "next" link closes each page.

   Only one page is in the layout at a time; the rest are display:none
   under html.mpages. Any #section link (deep links, in-page anchors)
   opens the page that holds that section and scrolls to it.
   Self-contained; relies only on section ids + classes in styles.css.
   ================================================================= */
(function () {
  'use strict';

  var MQ = window.matchMedia('(max-width: 767.98px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.documentElement;

  // same groupings as the desktop sets, with the side-column widgets
  // pulled to where they read best on a phone. `.kpibar` is moved under
  // the hero by script.js at this width, so it rides along with page 1.
  var PAGES = [
    { key: 'profile',   label: 'Profile',   ids: ['profile', '.kpibar', 'spotify'] },
    { key: 'about',     label: 'About',     ids: ['about', 'interests', 'photos'] },
    { key: 'systems',   label: 'Systems',   ids: ['rack', 'systems'] },
    { key: 'links',     label: 'Links',     ids: ['buttons', 'friends'] }
  ];

  var mnav, links = [], nextBar, nextLink;
  var pageOf = {};          // section id -> page index
  var current = 0;
  var active = false;

  function els(page) {
    return page.ids.map(function (id) {
      return id.charAt(0) === '.' ? document.querySelector(id) : document.getElementById(id);
    }).filter(Boolean);
  }

  function show(idx, opts) {
    opts = opts || {};
    idx = Math.max(0, Math.min(PAGES.length - 1, idx));
    var changed = idx !== current;
    current = idx;

    PAGES.forEach(function (p, i) {
      els(p).forEach(function (el) {
        el.classList.toggle('is-mpage', i === idx);
        if (i === idx && changed && !reduceMotion.matches) {
          // restart the entrance on every switch, not just the first one
          el.classList.remove('mpage-in');
          void el.offsetWidth;
          el.classList.add('mpage-in');
        }
      });
    });

    links.forEach(function (a, i) {
      var on = i === idx;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    var nxt = PAGES[idx + 1];
    if (nextBar) {
      nextBar.hidden = !nxt;
      if (nxt) {
        nextLink.href = '#' + nxt.key;
        nextLink.querySelector('b').textContent = nxt.label;
        nextLink.querySelector('em').textContent =
          String(idx + 2).padStart(2, '0') + ' / ' + String(PAGES.length).padStart(2, '0');
      }
    }

    if (opts.target) {
      var t = document.getElementById(opts.target);
      // the first section of a page is its top — land on the page, not
      // a few pixels under the header
      if (t && els(PAGES[idx])[0] !== t) {
        t.scrollIntoView({ block: 'start' });
      } else {
        window.scrollTo(0, 0);
      }
    } else if (changed || opts.top) {
      window.scrollTo(0, 0);
    }

    if (opts.hash !== false) {
      var h = '#' + (opts.target || PAGES[idx].key);
      if (location.hash !== h) history.replaceState(null, '', h);
    }

    // anything that measured itself while hidden gets a fresh look
    if (changed) window.dispatchEvent(new Event('resize'));
  }

  // "#about", "#rack", "#top" -> { page, target }
  function resolve(hash) {
    var id = (hash || '').replace(/^#/, '');
    if (!id) return null;
    for (var i = 0; i < PAGES.length; i++) {
      if (PAGES[i].key === id) return { page: i, target: null };
    }
    if (id === 'top') return { page: 0, target: null };
    if (id in pageOf) return { page: pageOf[id], target: id };
    return null;
  }

  function onClick(e) {
    if (!active || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var r = resolve(a.getAttribute('href'));
    if (!r) return;
    e.preventDefault();
    show(r.page, { target: r.target, top: true });
  }

  function onHash() {
    if (!active) return;
    var r = resolve(location.hash);
    if (r) show(r.page, { target: r.target, hash: false });
  }

  // ---- swipe between pages ---------------------------------------
  // only a clear, mostly-horizontal flick counts, and never one that
  // starts on something that scrolls or drags sideways by itself.
  var SWIPE_IGNORE = '.mnav, .orrery__stage, .nterm, .neofetch__panes, .ticker,' +
                     '.manifest, .lightbox, .pcard__pokewalk, input, textarea, [data-noswipe]';
  var sx = 0, sy = 0, st = 0, tracking = false;

  function scrollsSideways(el) {
    for (; el && el !== document.body; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 2) {
        var ox = getComputedStyle(el).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
    }
    return false;
  }

  function onTouchStart(e) {
    tracking = false;
    if (!active || e.touches.length !== 1) return;
    var t = e.target;
    if (t.closest && t.closest(SWIPE_IGNORE)) return;
    if (scrollsSideways(t)) return;
    if (document.querySelector('.lightbox.is-open, .manifest:not([hidden])')) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    tracking = true;
  }

  function onTouchEnd(e) {
    if (!tracking) return;
    tracking = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > 600) return;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    var to = current + (dx < 0 ? 1 : -1);
    if (to < 0 || to >= PAGES.length) return;
    show(to);
  }

  // ---- chrome ----------------------------------------------------
  function buildChrome() {
    mnav = document.querySelector('.mnav');
    if (!mnav) return false;
    mnav.innerHTML = '';
    PAGES.forEach(function (p, i) {
      var a = document.createElement('a');
      a.href = '#' + p.key;
      a.innerHTML = '<em>' + String(i + 1).padStart(2, '0') + '</em>' + p.label;
      mnav.appendChild(a);
      links.push(a);
    });

    var foot = document.querySelector('#top .foot');
    nextBar = document.createElement('div');
    nextBar.className = 'mpage-next mono';
    nextBar.innerHTML = '<a href="#"><span>NEXT</span><b></b><em></em><i aria-hidden="true">▸</i></a>';
    nextLink = nextBar.querySelector('a');
    if (foot) foot.parentNode.insertBefore(nextBar, foot);
    else return false;
    return true;
  }

  function enable() {
    if (active) return;
    active = true;
    root.classList.add('mpages');
    var r = resolve(location.hash);
    current = -1;
    show(r ? r.page : 0, { target: r && r.target, hash: !!r });
  }

  function disable() {
    if (!active) return;
    active = false;
    root.classList.remove('mpages');
    document.querySelectorAll('.is-mpage, .mpage-in').forEach(function (el) {
      el.classList.remove('is-mpage', 'mpage-in');
    });
  }

  function sync() { if (MQ.matches) enable(); else disable(); }

  function init() {
    PAGES.forEach(function (p, i) {
      p.ids.forEach(function (id) { if (id.charAt(0) !== '.') pageOf[id] = i; });
    });
    if (!buildChrome()) return;

    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHash);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    if (MQ.addEventListener) MQ.addEventListener('change', sync);
    else if (MQ.addListener) MQ.addListener(sync);
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
