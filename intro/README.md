# Laptop intro

Scroll-driven 3D intro in front of `index.html`, and only there: a laptop on black swings round
in one move and opens with its display lighting up, and the camera zooms in on the
Panasonic logo. The page's start-up begins when the zoom lands, and scrolling stays
stopped until it has settled. It sits as a fixed overlay on an untouched page and removes itself
completely afterwards.

## On / off

`ENABLE_LAPTOP_INTRO` at the top of `gate.js`. Off, nothing else loads and the page
behaves as before; remove both intro `<script>` tags in `index.html` to take it out
entirely. `gate.js` holds the page and the boot back until the intro ends, is
skipped or fails.

- `?intro=off` disables it, `?intro=on` forces it past the flag, Lite and deep links.
- It always skips on `prefers-reduced-motion` and without WebGL 2.
- It skips in Lite mode and on deep links (`#systems`).

`script-src 'self'` in the live CSP is why there is no CDN, no inline script and
no import map: everything loads from `intro/`.

## Tuning

Everything lives in `intro.timeline.js`: scroll length, easing, idle drift, fade
range and the keyframes. Each number runs on one curve through the keys that name it (`curve.js`), so motion passes through a key without stopping.
The last pose is not typed in: `fit: 1` is computed from the screen's world
position so the plane covers the viewport at any aspect ratio.

To look at a pose, open `/?intro=on` and scroll, or set `scrollTop` on
`.lintro__scroller` in the console.

## Updating three.js or GSAP

The site has no build step, so the bundles in `vendor/` are committed.
`npm run intro:vendor` rebuilds them. A new `THREE.*` used in the code has to be
added to the export list in `scripts/vendor-intro.mjs`, or it is undefined at
runtime. `npm install` is only needed for this and for the logo masks, never to serve the site.

## The model

`intro.js` only knows the `Laptop` class in `laptop/Laptop.js`.
`laptop/GltfLaptop.js` fills it from `laptop/cf-qv9/`, built by `tools/laptop`;
`model` in `intro.timeline.js` switches between it and the placeholder, which is
also the fallback if the files fail to load. To rebuild the model:

```sh
python tools/laptop/cut_stickers.py <folder>   # only for new sticker images
node tools/laptop/rasterize_logos.mjs
python tools/laptop/make_decals.py
blender --background --python tools/laptop/build_cf_qv9.py
blender --background tools/laptop/cf-qv9.blend --python tools/laptop/export_gltf.py
```

Keep it `.gltf` + `.bin` + images. A `.glb` unpacks its images through `blob:`
URLs, which the CSP refuses. A compressed model would also need its decoder in
`intro/`, as the CSP allows no external one (Draco's WASM additionally needs
`'wasm-unsafe-eval'`).

| Node | Expected |
|---|---|
| `base` | lower half |
| `lidPivot` | empty, origin exactly on the **lid's** hinge axis, rotates about +x |
| `lid` | child of `lidPivot`, lying closed at rotation 0 |
| `screen` | child of `lid`, plane with UVs 0-1 upright, +z = outward normal, +y = image up, `userData.size = { width, height }` in cm |

Model space: centimetres, origin at the centre of the footprint, base on `y = 0`,
keyboard up (+y), front edge +z, hinge along x at the back edge.

The hinge has two axes, so also pass `hinge: { y, z, link }`: the base axis
position and the distance between both axes. As on the real machine they work
in turn: up to 180° only `lidPivot` rotates, from 180° to 360° it also swings
around the base axis. With one axis the lid could not reach 360°.

`screen` is replaced at load by an unlit `MeshBasicMaterial` plane in the same spot.
