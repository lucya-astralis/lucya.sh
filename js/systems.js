import { escHtml } from './utils.js';
import { neofetchData, rackData } from './systems-data.js?v=20261025-statuslink';

export function initSystems(statusFeed, scrambleTo) {
  // ---------- NEOFETCH : real systems ----------------------------
  // raw content uses inline <span style="color:..."> and occasionally
  // malformed <span/> as closers — we sanitize on inject.
  // Sheets are hand-transcribed snapshots. Entries with a `live` id get
  // their volatile figures (uptime, memory, cpu, temperature, storage,
  // pool/disk/fan health, ports, traffic, service counts) rewritten
  // from status.json; those spans carry .nlive so the dotted underline
  // says which numbers are current and which are from the dump.
  const sanitize = s => s.replace(/<span\/>/g, '</span>');

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

      const fmtGib = (g) => g >= 1024 ? `${(g / 1024).toFixed(2)} TiB` : `${g.toFixed(2)} GiB`;

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
          if (isFinite(temp) && h.temp_c != null) put('temp-c', `${temp.toFixed(1)} °C`, band(temp, 60, 75));
          const diskTemp = Number(h.disk_temp_c);
          if (isFinite(diskTemp) && h.disk_temp_c != null) put('disk-temp', `${diskTemp.toFixed(0)} °C`, band(diskTemp, 45, 55));

          // filesystem the probe watches — the root fs on the hypervisors,
          // the data volumes summed on the NAS
          const fsUsed = Number(h.fs_used_gib), fsTotal = Number(h.fs_total_gib);
          if (fsTotal > 0 && isFinite(fsUsed)) {
            const pct = isFinite(Number(h.fs_pct)) && h.fs_pct != null ? Number(h.fs_pct) : fsUsed / fsTotal * 100;
            put('disk-used', fmtGib(fsUsed));
            put('disk-total', fmtGib(fsTotal));
            put('disk-pct', `${pct.toFixed(pct < 10 ? 1 : 0)}%`, band(pct, 75, 90));
          }

          // n of m healthy — anything short of all is a fault, not a level
          const ratio = (key, ok, total, word) => {
            const o = Number(ok), t = Number(total);
            if (t > 0 && isFinite(o)) put(key, `${o}/${t} ${word}`, o >= t ? '#06e236' : '#da0a0a');
          };
          ratio('pools', h.pools_ok, h.pools_total, 'online');
          ratio('disks', h.disks_ok, h.disks_total, 'healthy');
          ratio('fans',  h.fans_ok,  h.fans_total,  'ok');
          ratio('ports', h.ports_up, h.ports_monitored, 'up');

          const traffic = Number(h.traffic_bps);
          if (isFinite(traffic) && h.traffic_bps != null) {
            put('traffic', traffic >= 1e9 ? `${(traffic / 1e9).toFixed(2)} Gbit/s` : `${(traffic / 1e6).toFixed(2)} Mbit/s`);
          }

          if (h.svc_ok != null) {
            const ok = Number(h.svc_ok) || 0;
            put('svc', `${ok} ok` + (warn ? ` · ${warn} warn` : '') + (crit ? ` · ${crit} crit` : ''),
                crit ? '#da0a0a' : warn ? '#e5c07b' : '#06e236');
          }
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

}
