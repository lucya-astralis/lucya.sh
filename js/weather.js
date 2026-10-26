import { pad2 } from './utils.js';

export function initWeather() {
  // ---------- WEATHER : /weather.json from server/weather.py ------
  // One KPI card says where I am right now (WEATHER_PLACE on the server)
  // and pairs the local time there with the conditions. The puller writes every 10 min; a missing file or
  // one older than WX_STALE_S puts the card back into its "awaiting"
  // state rather than showing old weather as current.
  const card = document.getElementById('wxMetric');
  if (!card) return;
  const $ = id => document.getElementById(id);
  const WX_POLL_MS = 10 * 60 * 1000;
  const WX_STALE_S = 3 * 3600;

  // U+FE0E keeps these as text glyphs instead of colour emoji
  const glyph = (code, day) => {
    const g = code === 0 || code === 1 ? (day ? '☀' : '☾')
      : code === 2 || code === 3 ? '☁'
      : code === 45 || code === 48 ? '≋'
      : (code >= 71 && code <= 77) || code === 85 || code === 86 ? '❄'
      : code >= 95 ? 'ϟ'
      : code >= 51 ? '☂'
      : '·';
    return g + '︎';
  };
  const num = v => typeof v === 'number' && Number.isFinite(v);
  const deg = v => `${Math.round(v)}°`;

  let wx = null;   // last fresh payload, or null

  // hours, minutes and UTC offset at the location, from its IANA zone
  const zoned = (tz) => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        timeZoneName: 'shortOffset'
      }).formatToParts(new Date());
      const get = t => (parts.find(p => p.type === t) || {}).value || '';
      return {
        h: Number(get('hour')), m: Number(get('minute')),
        offset: get('timeZoneName').replace('GMT', 'UTC') || 'UTC'
      };
    } catch (_) {
      return null;
    }
  };

  const tick = () => {
    const z = wx && wx.tz ? zoned(wx.tz) : null;
    $('wxTime').textContent = z ? `${pad2(z.h)}:${pad2(z.m)}` : '—';
    $('wxOffset').textContent = z ? z.offset : '—';
    // the tick is how far the location is through its day
    $('wxSky').style.setProperty('--now', z ? `${(z.h * 60 + z.m) / 14.4}%` : '0%');
    $('wxDay').style.visibility = z ? '' : 'hidden';
  };

  // the sky band: night, amber at sunrise and sunset, blue day between
  const pct = hhmm => {
    const [h, m] = String(hhmm || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? (h * 60 + m) / 14.4 : null;
  };
  const sky = (rise, set) => {
    const a = pct(rise), b = pct(set);
    if (a === null || b === null || b <= a) return '';
    const night = '#1c2350', glow = 'var(--acc-amb)', day = 'var(--acc-cy)';
    return `linear-gradient(90deg, ${night} 0%, ${night} ${a - 4}%, ${glow} ${a}%, ${day} ${a + 6}%, ` +
      `${day} ${b - 6}%, ${glow} ${b}%, ${night} ${b + 4}%, ${night} 100%)`;
  };

  const render = () => {
    if (!wx) {
      $('wxPlace').textContent = "I'M IN · —";
      $('wxNow').textContent = 'AWAITING WEATHER';
      $('wxRange').textContent = '— / —';
      $('wxSun').textContent = 'SUN —';
      $('wxSky').style.background = '';
      card.title = 'Where I am right now · no weather data available';
      tick();
      return;
    }
    const t = wx.today || {};
    $('wxPlace').textContent = `I'M IN · ${String(wx.place || '—').toUpperCase()}`;
    $('wxNow').textContent = `${glyph(wx.code, wx.is_day)} ${Math.round(wx.temp_c)}°C ${String(wx.text || '').toUpperCase()}`;
    $('wxRange').textContent = num(t.min_c) && num(t.max_c) ? `L ${deg(t.min_c)} / H ${deg(t.max_c)}` : '— / —';
    $('wxSun').textContent = t.sunrise && t.sunset ? `SUN ${t.sunrise}–${t.sunset}` : 'SUN —';
    $('wxSky').style.background = sky(t.sunrise, t.sunset);
    const tip = [`Where I am right now: ${wx.place || 'unknown'}`];
    if (num(wx.feels_c)) tip.push(`feels like ${deg(wx.feels_c)}`);
    if (num(wx.humidity_pct)) tip.push(`humidity ${Math.round(wx.humidity_pct)}%`);
    if (num(wx.wind_kmh)) tip.push(`wind ${Math.round(wx.wind_kmh)} km/h`);
    tip.push(`Open-Meteo · ${new Date(Number(wx.ts) * 1000).toLocaleString()}`);
    card.title = tip.join(' · ');
    tick();
  };

  const refresh = async () => {
    if (document.hidden) return;
    try {
      const r = await fetch('/weather.json?t=' + Date.now(), { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      // age by the server's Date header, so a wrong client clock can't
      // hide fresh weather (same as the now-playing card)
      const date = Date.parse(r.headers.get('Date') || '');
      const now = (Number.isFinite(date) ? date : Date.now()) / 1000;
      wx = d && num(d.temp_c) && now - Number(d.ts || 0) < WX_STALE_S ? d : null;
    } catch (_) {
      // keep what is shown through a blip; a stale file clears it next time
      if (wx && Date.now() / 1000 - Number(wx.ts || 0) >= WX_STALE_S) wx = null;
    }
    render();
  };

  render();
  refresh();
  setInterval(refresh, WX_POLL_MS);
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', refresh);
}
