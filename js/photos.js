import { pad2, escHtml } from './utils.js';

export function initPhotos(LITE) {
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

}
