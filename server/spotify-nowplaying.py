#!/usr/bin/env python3
"""Spotify now-playing puller for lucya.sh.

Polls the Spotify Web API and writes nowplaying.json next to status.json.
The page shows the live track while something plays and falls back to the
favourites rotation otherwise — including when this puller stops, because
the page ignores a file whose `ts` is older than ~90s.

Standard library only. Two commands:

  auth  one-time: prints the consent URL; open it on any device, approve,
        and paste back the URL the browser lands on
  run   loop forever, writing the JSON every POLL seconds

Settings come from the environment (see server/.env.example):
  SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET   from the Spotify developer app
  SPOTIFY_REDIRECT_URI                       must match the app's settings
  NOWPLAYING_STATE                           where the refresh token is kept
  NOWPLAYING_OUT                             path of nowplaying.json
"""

import argparse
import base64
import json
import os
import secrets
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

# Nothing listens on the redirect URI: the browser fails to load it, and
# the code is read from the address bar instead. That is why auth works
# from any device, and why a loopback URI is fine (Spotify only allows
# plain http for loopback IPs, not "localhost").
REDIRECT_URI = os.environ.get('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:8888/callback')
STATE_PATH = os.environ.get('NOWPLAYING_STATE', '/data/token.json')
SCOPE = 'user-read-currently-playing'
POLL = 10       # seconds between polls
TIMEOUT = 10    # HTTP timeout


def client():
    cid = os.environ.get('SPOTIFY_CLIENT_ID')
    secret = os.environ.get('SPOTIFY_CLIENT_SECRET')
    if not cid or not secret:
        sys.exit('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set')
    return cid, secret


def load_token():
    try:
        with open(STATE_PATH) as f:
            return json.load(f).get('refresh_token')
    except (FileNotFoundError, ValueError):
        return None


def save_token(refresh_token):
    os.makedirs(os.path.dirname(os.path.abspath(STATE_PATH)), exist_ok=True)
    write_atomic(STATE_PATH, json.dumps({'refresh_token': refresh_token}), mode=0o600)


def write_atomic(path, text, mode=0o644):
    # write-then-rename so the web server never serves a half-written file
    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=d, prefix='.np-')
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(text)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        try: os.unlink(tmp)
        except OSError: pass
        raise


def token_request(data):
    cid, secret = client()
    basic = base64.b64encode(f'{cid}:{secret}'.encode()).decode()
    req = urllib.request.Request(
        'https://accounts.spotify.com/api/token',
        data=urllib.parse.urlencode(data).encode(),
        headers={'Authorization': 'Basic ' + basic,
                 'Content-Type': 'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.load(r)


# ---------- auth ----------------------------------------------------

def cmd_auth(_args):
    cid, _ = client()
    state = secrets.token_urlsafe(16)
    url = 'https://accounts.spotify.com/authorize?' + urllib.parse.urlencode({
        'client_id': cid, 'response_type': 'code',
        'redirect_uri': REDIRECT_URI, 'scope': SCOPE, 'state': state})
    print('1. Open this URL on any device and approve access:\n\n   ' + url + '\n')
    print('2. The browser then fails to load ' + REDIRECT_URI + ' - that is expected.')
    print('   Copy the full URL from its address bar and paste it here.\n')
    pasted = input('URL: ').strip()

    q = urllib.parse.parse_qs(urllib.parse.urlparse(pasted).query)
    if q.get('error'):
        sys.exit('authorization denied: ' + q['error'][0])
    if q.get('state', [''])[0] != state:
        sys.exit('state mismatch - paste the URL from this attempt')
    code = q.get('code', [None])[0]
    if not code:
        sys.exit('no ?code= in that URL')

    tok = token_request({'grant_type': 'authorization_code',
                         'code': code, 'redirect_uri': REDIRECT_URI})
    save_token(tok['refresh_token'])
    print('refresh token stored in ' + STATE_PATH)


# ---------- run -----------------------------------------------------

class Spotify:
    def __init__(self, refresh_token):
        self.refresh_token = refresh_token
        self.access = None
        self.expires = 0

    def token(self):
        if self.access and time.time() < self.expires - 60:
            return self.access
        tok = token_request({'grant_type': 'refresh_token',
                             'refresh_token': self.refresh_token})
        self.access = tok['access_token']
        self.expires = time.time() + int(tok.get('expires_in', 3600))
        # Spotify may rotate the refresh token; keep the newest one
        if tok.get('refresh_token') and tok['refresh_token'] != self.refresh_token:
            self.refresh_token = tok['refresh_token']
            save_token(self.refresh_token)
        return self.access

    def current(self):
        """Returns the API payload, or None when nothing is playing."""
        req = urllib.request.Request(
            'https://api.spotify.com/v1/me/player/currently-playing',
            headers={'Authorization': 'Bearer ' + self.token()})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            if r.status == 204:
                return None
            body = r.read()
            return json.loads(body) if body else None


def shape(payload):
    """Reduce the API payload to what the page shows — no device, no context."""
    ts = int(time.time())
    item = (payload or {}).get('item')
    if not payload or not payload.get('is_playing') or not item or item.get('type') != 'track':
        return {'source': 'spotify', 'ts': ts, 'playing': False}
    album = item.get('album') or {}
    images = sorted(album.get('images') or [], key=lambda i: i.get('width') or 0)
    # smallest cover that is still >= 300px; the card renders at most 240px
    cover = next((i['url'] for i in images if (i.get('width') or 0) >= 300),
                 images[-1]['url'] if images else None)
    return {
        'source': 'spotify',
        'ts': ts,
        'playing': True,
        'track': {
            'title': item.get('name'),
            'artist': ', '.join(a.get('name', '') for a in item.get('artists') or []),
            'album': album.get('name'),
            'cover': cover,
            'url': (item.get('external_urls') or {}).get('spotify'),
            'duration_ms': item.get('duration_ms'),
            'progress_ms': payload.get('progress_ms'),
        },
    }


def cmd_run(args):
    out = args.out or os.environ.get('NOWPLAYING_OUT')
    if not out:
        sys.exit('no output path: pass --out or set NOWPLAYING_OUT')
    client()
    # wait instead of exiting, so the container can be up before `auth` ran
    refresh_token = load_token()
    while not refresh_token:
        print('no refresh token yet - run `auth`; retrying in 30s', file=sys.stderr, flush=True)
        time.sleep(30)
        refresh_token = load_token()

    sp = Spotify(refresh_token)
    print('polling spotify, writing ' + out, flush=True)
    while True:
        wait = POLL
        try:
            data = shape(sp.current())
            write_atomic(out, json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = max(POLL, int(e.headers.get('Retry-After') or 30))
            elif e.code == 401:
                sp.access = None
            print(f'spotify http {e.code}', file=sys.stderr, flush=True)
        except Exception as e:  # network blips: keep the loop alive
            print(f'poll failed: {e}', file=sys.stderr, flush=True)
        # on errors nothing is written; the stale ts makes the page fall back
        time.sleep(wait)


def main():
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)
    sub.add_parser('auth', help='one-time Spotify authorization')
    r = sub.add_parser('run', help='poll and write nowplaying.json')
    r.add_argument('--out', help='path of nowplaying.json (default: $NOWPLAYING_OUT)')
    args = p.parse_args()
    {'auth': cmd_auth, 'run': cmd_run}[args.cmd](args)


if __name__ == '__main__':
    main()
