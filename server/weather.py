#!/usr/bin/env python3
"""Weather puller for lucya.sh.

Polls Open-Meteo (no account, no key) and writes weather.json next to
status.json. The page pairs it with the local time there in a KPI card,
which falls back to "awaiting" when the file is missing or its `ts` is
older than a few hours.

Standard library only. Runs in the same image as the Spotify puller, as its
own compose service. Settings come from the environment (server/.env):

  WEATHER_PLACE     place name, looked up once at start (e.g. Tokyo)
  WEATHER_COUNTRY   optional ISO country code to pick the right match (JP)
  WEATHER_LAT/LON   coordinates instead of a name; wins over WEATHER_PLACE
  WEATHER_LABEL     name shown on the page (default: the looked-up name)
  WEATHER_OUT       path of weather.json

Coordinates never end up in the JSON: the page only gets the label, so
pick a town rather than your street.
"""

import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

POLL = 600      # seconds between polls; Open-Meteo updates every 15 min
TIMEOUT = 10    # HTTP timeout
UA = 'lucya.sh-weather/1 (+https://lucya.sh)'

# WMO weather interpretation codes, as documented by Open-Meteo
WMO = {
    0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'rime fog',
    51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
    56: 'freezing drizzle', 57: 'freezing drizzle',
    61: 'light rain', 63: 'rain', 65: 'heavy rain',
    66: 'freezing rain', 67: 'freezing rain',
    71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
    80: 'showers', 81: 'showers', 82: 'heavy showers',
    85: 'snow showers', 86: 'snow showers',
    95: 'thunderstorm', 96: 'thunderstorm, hail', 99: 'thunderstorm, hail',
}


def write_atomic(path, content, mode=0o644):
    # write-then-rename so the web server never serves a half-written file
    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=d, prefix='.wx-')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(content)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        try: os.unlink(tmp)
        except OSError: pass
        raise


def get_json(url, params):
    req = urllib.request.Request(url + '?' + urllib.parse.urlencode(params),
                                 headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.load(r)


def locate():
    """Returns (lat, lon, label) from the environment."""
    label = os.environ.get('WEATHER_LABEL', '').strip()
    lat, lon = os.environ.get('WEATHER_LAT', '').strip(), os.environ.get('WEATHER_LON', '').strip()
    if lat and lon:
        return float(lat), float(lon), label or 'here'

    place = os.environ.get('WEATHER_PLACE', '').strip()
    if not place:
        sys.exit('set WEATHER_PLACE, or WEATHER_LAT and WEATHER_LON')
    country = os.environ.get('WEATHER_COUNTRY', '').strip().upper()
    params = {'name': place, 'count': 10, 'language': 'en', 'format': 'json'}
    if country:
        params['countryCode'] = country
    # retried, so a network blip at boot doesn't crash-loop the container
    while True:
        try:
            hits = get_json('https://geocoding-api.open-meteo.com/v1/search', params).get('results') or []
            break
        except Exception as e:
            print(f'geocoding failed: {e}; retrying in 60s', file=sys.stderr, flush=True)
            time.sleep(60)
    if not hits:
        sys.exit(f'no place found for {place!r}' + (f' in {country}' if country else ''))
    hit = hits[0]
    print(f"location: {hit.get('name')}, {hit.get('admin1', '')}, {hit.get('country_code', '')}", flush=True)
    return hit['latitude'], hit['longitude'], label or hit.get('name') or place


def fetch(lat, lon):
    return get_json('https://api.open-meteo.com/v1/forecast', {
        'latitude': lat, 'longitude': lon, 'timezone': 'auto',
        'current': 'temperature_2m,apparent_temperature,relative_humidity_2m,'
                   'weather_code,is_day,wind_speed_10m',
        'daily': 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
        'forecast_days': 1,
    })


def shape(payload, label):
    """Reduce the API payload to what the page shows — no coordinates."""
    cur = payload.get('current') or {}
    day = payload.get('daily') or {}
    first = lambda k: (day.get(k) or [None])[0]
    hhmm = lambda s: s[11:16] if isinstance(s, str) and len(s) >= 16 else None
    code = cur.get('weather_code')
    return {
        'source': 'open-meteo',
        'ts': int(time.time()),
        'place': label,
        'tz': payload.get('timezone'),
        'is_day': bool(cur.get('is_day')),
        'code': code,
        'text': WMO.get(code, 'unknown'),
        'temp_c': cur.get('temperature_2m'),
        'feels_c': cur.get('apparent_temperature'),
        'humidity_pct': cur.get('relative_humidity_2m'),
        'wind_kmh': cur.get('wind_speed_10m'),
        'today': {
            'min_c': first('temperature_2m_min'),
            'max_c': first('temperature_2m_max'),
            'sunrise': hhmm(first('sunrise')),
            'sunset': hhmm(first('sunset')),
        },
    }


def main():
    out = os.environ.get('WEATHER_OUT') or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not out:
        sys.exit('no output path: set WEATHER_OUT or pass it as the argument')
    lat, lon, label = locate()
    print('polling open-meteo, writing ' + out, flush=True)
    while True:
        wait = POLL
        try:
            data = shape(fetch(lat, lon), label)
            write_atomic(out, json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = max(POLL, int(e.headers.get('Retry-After') or 1800))
            print(f'open-meteo http {e.code}', file=sys.stderr, flush=True)
        except Exception as e:  # network blips: keep the loop alive
            print(f'poll failed: {e}', file=sys.stderr, flush=True)
        # on errors nothing is written; the stale ts makes the page hide the line
        time.sleep(wait)


if __name__ == '__main__':
    main()
