# lucya.sh

Static personal site, served directly without a build step or npm dependencies.

## Local preview

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Use an HTTP server: the main page uses native
JavaScript modules, which browsers do not load reliably from `file://` URLs.

## Code map

- `index.html` and `styles.css`: page markup and styling.
- `lite.js`: synchronous, pre-paint device detection and saved Lite preference.
- `script.js`: main entry point, boot sequence, clocks, shared status polling,
  profile data, and responsive layout setup.
- `js/utils.js`: text escaping and number formatting.
- `js/text-scramble.js`: shared animated text renderer.
- `js/systems-data.js`: hardware snapshots and rack inventory; whitespace in
  snapshot templates is significant for ASCII art.
- `js/systems.js`: hardware tabs, live host readings, and interactive rack.
- `js/spotify.js`: music rotation and the music manifest dialog.
- `js/photos.js`: gallery feed and photo lightbox, with static HTML fallback.
- `js/weather.js`: "I'm in" KPI card (where I am right now: local time and
  weather there), from `/weather.json`.
- `setnav.js` / `mpage.js`: desktop panel navigation / phone page navigation.
- `legal.html` / `legal.js`: bilingual legal page and language selection.
- `concordia.js` / `planet-gl.js`: standalone planet visualization; currently
  not loaded by `index.html`.
- `concept.html` / `concept/`: the new concept page. It opens with the laptop intro
  and reuses `js/systems.js`, `js/weather.js` and the same live JSON files.
- `intro/`: 3D laptop intro with its own committed vendor bundles, see
  `intro/README.md`. Only `concept.html` loads it. `package.json` is dev tooling for it.
- `data.json`: profile, KPI, ticker, and specification content.
- `worker/`: Cloudflare Worker serving the terminal card for curl clients.
- `server/`: server-side pullers that write JSON into the web root.
- `tools/`: asset generation scripts.

Feature modules expose initialization functions. The entry point calls them in
order and passes the shared status feed and text renderer explicitly. Keep
`lite.js` render-blocking in the head; the other page initialization must finish
before `DOMContentLoaded`, when navigation builds its panels.

`/status.json` is produced by the server-side CheckMK puller and is intentionally
not committed. `/nowplaying.json` works the same way: `server/spotify-nowplaying.py`
writes it while Spotify plays, and the music card falls back to the favourites
rotation when nothing plays or the file is older than 90s. It reads the
account's playback, so any device counts (phone, desktop, speakers).

## Boot

The boot runs on every load (5.4s, 1.1s in Lite) and any key, tap or the
skip button ends it. It is a document like every section (`DOC 00.BOOT`,
form BT-00) with the mark building in the centre. Nothing on it is made up:

- the log (top-left, from 1100px wide) lists every file the page fetches as
  it lands, read from the Resource Timing feed: type, name, size or CACHE,
  load time, and MISS/ERR for 4xx/5xx (a missing `nowplaying.json` is IDLE —
  nothing is playing), plus milestones (DOM ready, fonts, page loaded);
- the figures under the mark sum the same feed: files, bytes transferred,
  share served from cache, issues;
- the bar is the boot's clock toward the handoff, and the stamp turns from
  BOOTING to READY on the page's load event.

## Languages and caching

Japanese text carries `lang="ja"` (static markup and the labels the scripts
write), so screen readers and font fallback treat it as Japanese.
Cache lifetimes are set at Cloudflare, not in this repo. Recommended Cache
Rule ("Browser TTL: override"): `/fonts/*` one year, `/images/*` seven days;
CSS and JS keep the default and carry a `?v=` that is bumped when they
change (module imports included).

## Spotify now-playing puller

Runs as a container from `server/` and writes
`/srv/websites/lucya.sh/nowplaying.json` plus `nowplaying-cover.jpg` next to it
(covers are mirrored so the CSP needs no Spotify host and visitors never
contact Spotify).

1. Create an app at https://developer.spotify.com/dashboard and add
   `http://127.0.0.1:8888/callback` as a Redirect URI.
2. On the server, in `server/`: `cp .env.example .env`, fill in client id and
   secret, set `PUID`/`PGID` to a user that can write `./data` and the web
   root, then `mkdir -p data && docker compose up -d --build`.
3. Authorize once: `docker compose run --rm nowplaying auth`. Open the printed
   URL on any device, approve, and paste back the URL the browser ends up on
   (the page itself fails to load; the code is in the address bar).

The running container picks up the token within 30s.
`docker compose logs -f` shows poll errors. Local previews use the offline fallback. Photos also retain their
static fallback if the remote gallery is unavailable.

## Weather puller

`server/weather.py` runs as the `weather` service in the same compose file and
image. It polls Open-Meteo (no account or key) every 10 minutes and writes
`weather.json` into the web root, including the place's time zone. A KPI card
shows the local time there next to the weather, and falls back to "awaiting"
when the file is missing or older than 3h.

The card is labelled as where I am right now, so update the location when
travelling. It comes from `server/.env`:

- `WEATHER_PLACE` (plus `WEATHER_COUNTRY`, an ISO code, when the name is
  ambiguous) is looked up once at container start, or
- `WEATHER_LAT` / `WEATHER_LON` give exact coordinates and win over the name.
- `WEATHER_LABEL` overrides the name shown on the page.

To change it, edit `.env` and run `docker compose up -d weather` (the
container is recreated with the new environment); `docker compose logs weather`
prints the place it resolved. Only the label reaches the page, never the
coordinates, but the weather itself narrows things down, so prefer a town over
your exact address.

## Checks

Check JavaScript syntax without installing dependencies:

```sh
for file in *.js js/*.js worker/src/*.js; do
  node --check "$file" || exit 1
done
git diff --check
```

For browser checks, cover desktop (at least 1100px), tablet, and phone (below
768px), with Lite mode both on and off. Check the boot handoff, navigation,
hardware tabs/rack, music dialog, photos, and legal language toggle.

Worker preview and deployment commands are documented in `worker/wrangler.toml`.
