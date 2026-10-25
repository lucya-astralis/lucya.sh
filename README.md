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
- `setnav.js` / `mpage.js`: desktop panel navigation / phone page navigation.
- `legal.html` / `legal.js`: bilingual legal page and language selection.
- `concordia.js` / `planet-gl.js`: standalone planet visualization; currently
  not loaded by `index.html`.
- `data.json`: profile, KPI, ticker, and specification content.
- `worker/`: Cloudflare Worker serving the terminal card for curl clients.
- `tools/`: asset generation scripts.

Feature modules expose initialization functions. The entry point calls them in
order and passes the shared status feed and text renderer explicitly. Keep
`lite.js` render-blocking in the head; the other page initialization must finish
before `DOMContentLoaded`, when navigation builds its panels.

`/status.json` is produced by the server-side CheckMK puller and is intentionally
not committed. Local previews use the offline fallback. Photos also retain their
static fallback if the remote gallery is unavailable.

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
