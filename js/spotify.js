import { pad2, escHtml } from './utils.js';

export function initSpotify(scrambleTo) {
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

}
