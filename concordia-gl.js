/**
 * Orikaia Prime and Orikaia, rendered rather than shown.
 *
 * Copied from gov.inter-astra.net (js/modules/reach-gl.js). What this copy adds:
 * the giant turns (uSpin) and carries its great oval storm and the string of
 * white ovals in the south, as LORE.md describes it.
 *
 * The moon stands on its world map (tools/build_moonmap.py): the day colour,
 * and a data map of the ground, what is built, and the causeways. Below the
 * map's own resolution the shader carries on by itself: coastlines keep
 * breaking into finer bays, the cities resolve into street webs lit white and
 * sodium-orange, and near Seiki-tō the aerial photograph's own islands take
 * over the ground. Over it: relief, cloud, the glint, the atmosphere, the
 * beyond, the ringed giant.
 *
 * The caller owns the camera and the moon's orientation: it passes each
 * body's centre and radius in canvas pixels and the rotation from the view
 * into the moon's body frame. Returns null without WebGL.
 */

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uMoon;       // centre x, y (px, y down), radius px
uniform vec3 uGiant;      // centre x, y, radius
uniform vec2 uTilt;       // cos, sin of the giant's equator against the screen
uniform float uSpin;      // how far the giant's cloud deck has turned, radians
uniform vec4 uSat[4];     // Orikaia's other moons: centre x, y, radius px (0: not drawn), kind
uniform float uSatSpin;   // how far they have turned
uniform vec3 uSun;        // towards the star, view space, y down
uniform float uOct;       // octaves the moon needs at this zoom
uniform float uAlpha;
uniform float uVeil;      // how much the aerial photograph carries the capital now
uniform float uDpr;       // device px per CSS px: lines are sized in CSS px
uniform sampler2D uDay;   // the day colour, equirectangular, centred on uLon0
uniform sampler2D uData;  // R ground (0.25 at the shore), G built, B causeways
uniform sampler2D uMask;  // the aerial photograph's islands
uniform sampler2D uNight; // the lights, as the world map paints them
uniform mat3 uToBody;     // view -> the moon's body frame
uniform float uLon0;      // the maps' centre longitude, radians
uniform vec3 uCapB;       // Seiki-to, body frame
uniform vec3 uAerE;       // the photograph's east and north on the moon, body frame
uniform vec3 uAerN;
uniform vec3 uAerial;     // its span (radians), and the dome in it (x, y as fractions)

float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// fbm with a fractional octave count: the last octave fades in, never pops
float fbm(vec3 p, float oct){
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 16; i++){
    float w = clamp(oct - float(i), 0.0, 1.0);
    if (w <= 0.0) break;
    sum += amp * w * noise(p);
    norm += amp * w;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-4);
}

// one cell of a street web: (distance to the nearest street in px, cell tone, distance to the knot in px)
vec3 web(vec2 x, float cellPx){
  vec2 ci = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0, f2 = 8.0;
  vec2 c1 = ci;
  for (int yy = -1; yy <= 1; yy++)
  for (int xx = -1; xx <= 1; xx++) {
    vec2 g = vec2(float(xx), float(yy));
    vec2 cc = mod(ci + g, 1024.0);
    vec2 o = vec2(hash(vec3(cc, 1.0)), hash(vec3(cc, 7.0)));
    vec2 r = g + 0.1 + 0.8 * o - f;
    float dd = dot(r, r);
    if (dd < f1) { f2 = f1; f1 = dd; c1 = cc; } else if (dd < f2) { f2 = dd; }
  }
  return vec3((sqrt(f2) - sqrt(f1)) * 0.5 * cellPx, hash(vec3(c1, 3.0)), sqrt(f1) * cellPx);
}

vec4 moon(vec2 px){
  vec2 q = (px - uMoon.xy) / uMoon.z;
  float r2 = dot(q, q);
  float rr = sqrt(r2);
  float pxr = 1.0 / uMoon.z;                     // one pixel, in radii
  float edge = smoothstep(1.0, 1.0 - 1.5 * pxr, rr);
  // the atmosphere's halo, outside the limb
  float halo = 0.0;
  if (rr > 1.0) {
    vec3 nh = normalize(vec3(q, 0.0));
    float lit = smoothstep(-0.35, 0.6, dot(nh, uSun));
    halo = exp(-(rr - 1.0) * 28.0) * lit * 0.85;
    if (edge <= 0.0) return vec4(vec3(0.35, 0.6, 1.0) * halo, halo);
  }
  vec3 n = vec3(q, sqrt(max(1.0 - r2, 0.0)));
  float day = dot(n, uSun);
  float dayK = smoothstep(-0.06, 0.22, day);
  float mu = n.z;

  // where on the map
  vec3 b = uToBody * n;
  float lon = atan(b.z, b.x);
  float lat = asin(clamp(b.y, -1.0, 1.0));
  vec2 uv = vec2(fract((lon - uLon0) / 6.2831853 + 0.5), 0.5 - lat / 3.1415927);
  vec3 dayTex = texture2D(uDay, uv).rgb;
  vec3 data = texture2D(uData, uv).rgb;

  // the ground: the map's shore, carried below its resolution by noise
  float texel = 6.2831853 / 2048.0;
  float sub = clamp(texel / max(pxr, 1e-6) * 0.5, 0.0, 1.0);
  float h = data.r + (fbm(b * 520.0, max(uOct - 7.0, 1.0)) - 0.5) * 0.2 * sub;
  float land = smoothstep(0.25 - 0.02, 0.25 + 0.02, h);
  float built = data.g;
  float lines = data.b;

  // the capital's own islands, from the photograph, when the camera is that close
  float patchW = 0.0;
  {
    float cz = dot(b, uCapB);
    vec2 t = vec2(dot(b, uAerE), dot(b, uAerN)) / max(cz, 1e-3);
    vec2 a = vec2(uAerial.y + t.x / uAerial.x, uAerial.z - t.y / uAerial.x * 1.5);
    vec2 e = vec2((a.x - 0.48) / 0.46, (a.y - 0.44) / 0.48);
    patchW = cz > 0.5 ? clamp((1.0 - length(e)) / 0.35, 0.0, 1.0) : 0.0;
    if (patchW > 0.0) {
      float m = texture2D(uMask, clamp(a, 0.0, 1.0)).r;
      land = mix(land, smoothstep(0.35, 0.65, m), patchW);
      built = mix(built, 0.95 * land, patchW);
      lines *= 1.0 - patchW;
    }
  }
  // a city is not a carpet: parks, water, yards and dark districts break it up
  if (built > 0.0) {
    // the heights stay dark; the towns keep to the coasts and the valleys
    built *= 1.0 - 0.85 * smoothstep(0.62, 0.9, data.r);
    built *= mix(0.25, 1.1, smoothstep(0.36, 0.6, fbm(b * 380.0, clamp(uOct - 6.0, 2.0, 5.0))));
  }
  // the capital burns white from orbit; close in, it is streets like any other
  float core = smoothstep(0.012, 0.0, distance(b, uCapB)) * smoothstep(1.0 / 6000.0, 1.0 / 1200.0, pxr);

  // blocks and streets, at the finest scales the screen resolves
  float pxPerUnit = uMoon.z / uDpr;
  vec2 fuv = vec2(lon * cos(lat), lat);
  float tone = 0.5, street = 0.0, lit = 0.0, sodiumW = 0.0;
  float sc = 600.0;
  for (int i = 0; i < 6; i++) {
    float cellPx = pxPerUnit / sc;
    float resolve = smoothstep(2.0, 5.0, cellPx);
    float need = 0.15 + 0.12 * float(i);
    float here = smoothstep(need, need + 0.4, built);
    float avg = here * (0.1 - 0.01 * float(i));
    float line = 0.0;
    if (resolve > 0.0 && here > 0.0 && cellPx < 900.0) {
      vec2 x = fuv * sc + float(i) * 13.1;
      x += 0.4 * vec2(noise(vec3(x * 0.35, 1.0)), noise(vec3(x * 0.35, 5.0))) - 0.2;
      vec3 w = web(x, cellPx);
      float wpx = 0.55 + 0.25 * step(float(i), 1.0);
      float kept = step(0.3, w.y);
      line = exp(-w.x * w.x / (wpx * wpx)) * (0.35 + 0.65 * kept) * 0.8;
      line += exp(-w.z * w.z / 0.8) * 0.5 * w.y;
      // a coarse web on its own reads as crazed glaze: it shows once finer webs are there too
      line *= here * (1.0 - 0.75 * smoothstep(9.0, 30.0, cellPx) * (1.0 - smoothstep(30.0, 120.0, cellPx)));
      tone = mix(tone, w.y, resolve * here);
      street = max(street, line * resolve);
    }
    float contrib = mix(avg, line, resolve);
    lit += contrib;
    if (i < 2) sodiumW += contrib;
    sc *= 3.0;
  }

  // the day: the map's colour, the cities included: their districts are painted
  // there (tile and slate roofs, glass, works, parks, greenhouse decks, solar
  // fields). Only the capital's photographed islands are the shader's own.
  float v = fbm(b * 300.0, max(uOct - 6.0, 2.0));
  vec3 concrete = mix(vec3(0.26, 0.26, 0.27), vec3(0.42, 0.41, 0.39), tone);
  vec3 green = mix(vec3(0.06, 0.11, 0.05), vec3(0.1, 0.15, 0.07), v);
  vec3 ground = mix(green, concrete, clamp(built * 1.15, 0.0, 0.95));
  vec3 albedo = mix(dayTex, ground, land * patchW);
  // below the map's resolution: roof to roof the blocks vary, the streets run dark
  float close = sub * smoothstep(0.05, 0.2, built);
  albedo *= mix(1.0, 0.78 + 0.44 * tone, close);
  albedo *= 1.0 - 0.45 * street;
  // the platforms over the sea, close in: decks with seams between them
  float plat = (1.0 - land) * smoothstep(0.08, 0.2, built);
  vec2 pg = fract(fuv * 2400.0);
  float seam = smoothstep(0.0, 2.0, min(min(pg.x, 1.0 - pg.x), min(pg.y, 1.0 - pg.y)) * pxPerUnit / 2400.0);
  albedo *= mix(1.0, mix(0.7, 1.0, seam), plat * sub);
  albedo = mix(albedo, vec3(0.6, 0.6, 0.6), lines * 0.75);    // causeways, corridors, the rings

  // relief, felt by the light, on the land only
  vec3 nl = n;
  if (land > 0.0 && day > -0.2) {
    vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(n, t1);
    float eps = max(pxr * 1.5, 0.0004);
    float o2 = max(uOct - 2.0, 3.0);
    float h0 = fbm(b * 40.0, o2);
    float hx = fbm((uToBody * (n + t1 * eps)) * 40.0, o2);
    float hy = fbm((uToBody * (n + t2 * eps)) * 40.0, o2);
    vec2 grad = vec2(hx - h0, hy - h0) / eps;
    nl = normalize(n - (t1 * grad.x + t2 * grad.y) * 0.0025 * (1.0 - built * 0.6));
  }

  // cloud: warped so it streams, eroded at the edges so it billows
  vec3 cw = b * 3.0 + vec3(fbm(b * 2.0, 4.0), fbm(b * 2.0 + 5.0, 4.0), 0.0) * 1.4;
  float cf = fbm(cw + vec3(4.0, 1.0, 7.0), min(uOct, 9.0));
  cf -= 0.1 * fbm(b * 40.0 + 1.0, min(max(uOct - 4.0, 1.0), 6.0));
  float c = smoothstep(0.54, 0.74, cf) * 0.9;
  float cs = smoothstep(0.54, 0.74, fbm(cw + vec3(4.0, 1.0, 7.0) - uToBody * uSun * 0.02, min(uOct, 6.0)));

  float lam = max(dot(nl, uSun), 0.0);
  vec3 col = albedo * (0.04 + 1.25 * lam) * (1.0 - 0.55 * cs * (1.0 - c)) + vec3(0.004, 0.009, 0.024) * (1.0 - dayK);
  vec3 refl = reflect(-uSun, n);
  float wet = (1.0 - land) * (1.0 - plat);
  float glint = pow(max(refl.z, 0.0), 22.0) * 0.18 + pow(max(refl.z, 0.0), 160.0) * 0.5;
  col += wet * (1.0 - c) * vec3(1.0, 0.93, 0.8) * glint * dayK;
  // the cities glitter: glass and rooftop water catch the star, a point here and
  // there, cells about a pixel across so the glints stay sharp at any distance
  {
    float cell = max(uMoon.z / uDpr * 0.9, 40.0);
    vec3 gc = floor(b * cell);
    float gh = hash(mod(gc, 1024.0) + 3.0);
    float spark = step(0.965, gh) * smoothstep(0.12, 0.45, built) * (1.0 - wet * (1.0 - plat));
    col += vec3(1.0, 0.97, 0.9) * spark * pow(max(refl.z, 0.0), 5.0) * (0.5 + 0.8 * hash(mod(gc, 1024.0) + 9.0)) * dayK * (1.0 - c);
    // and the whole city a faint sheen where the star's reflection falls on it
    col += vec3(0.85, 0.88, 0.95) * smoothstep(0.1, 0.5, built) * pow(max(refl.z, 0.0), 14.0) * 0.08 * dayK * (1.0 - c);
  }
  // glass and metal catch the star too
  col += (1.0 - wet) * (1.0 - c) * vec3(0.9, 0.92, 1.0) * pow(max(refl.z, 0.0), 90.0) * 0.25 * step(0.8, tone) * dayK;
  float cl = 0.08 + 1.1 * max(day, 0.0);
  col = mix(col, vec3(0.93, 0.95, 1.0) * cl * (0.8 + 0.2 * v), c);
  float haze = pow(1.0 - mu, 2.2) * 0.75 + 0.06;
  col = mix(col, vec3(0.32, 0.52, 0.9) * (0.05 + 0.75 * max(day, 0.0)), haze * dayK * 0.6);
  col += vec3(0.5, 0.2, 0.07) * exp(-day * day / 0.003) * 0.08 * (1.0 - c * 0.5);

  // the night: every island lit, the platforms, the causeways as threads. The lights
  // come on in the evening, while the star is still low over the horizon, not at the
  // edge of the dark: full by the terminator, already glowing well before it.
  float night = 1.0 - smoothstep(-0.02, 0.3, day);
  if (night > 0.0) {
    vec3 sodium = vec3(1.0, 0.68, 0.34);
    vec3 led = vec3(0.88, 0.95, 0.86);
    vec3 webCol = mix(sodium, led, smoothstep(0.55, 0.95, built));
    vec3 l = webCol * (lit - sodiumW) * 0.7 + sodium * sodiumW * 0.8;
    l *= land;
    // platforms close up: lit as blocks, the way a harbour is, some bright, most dim
    float blocks = 0.0;
    float psc = 1600.0;
    for (int j = 0; j < 4; j++) {
      float cellPx = pxPerUnit / psc;
      float res = smoothstep(3.0, 8.0, cellPx) * (1.0 - smoothstep(80.0, 200.0, cellPx));
      if (res > 0.0) {
        vec2 cc = floor(fuv * psc);
        float hb = hash(vec3(mod(cc, 1024.0), 5.0 + float(j)));
        vec2 fc = fract(fuv * psc);
        float rim = min(min(fc.x, 1.0 - fc.x), min(fc.y, 1.0 - fc.y)) * cellPx;
        float inner = smoothstep(0.5, 1.5, rim);
        blocks += res * inner * (step(0.86, hb) * 0.13 + step(0.5, hb) * 0.02);
      }
      psc *= 3.0;
    }
    l += sodium * plat * (0.015 + blocks);
    l += vec3(1.0, 0.6, 0.22) * lines * 0.9;
    l += mix(sodium, vec3(1.0, 0.9, 0.7), core) * 0.25 * core * (0.5 + 0.5 * land);
    l = l * l * 2.2 + l * 0.15;

    // The middle distance, as the station photographs show a lit coast from a few
    // hundred kilometres up: not streets yet, a speckle of point lights thickening
    // into the cities, sodium at the edges, white at the cores. One candidate light
    // per cell; the cells come in fixed sizes, each faded in and out by how large
    // it shows, so the points stay sharp and never swim.
    vec3 speck = vec3(0.0);
    {
      float dens = max(land * built, plat * 0.45);
      float sc2 = 300.0;
      for (int i = 0; i < 7; i++) {
        float k = pxPerUnit / sc2;                 // one cell, in CSS px
        if (k < 2.5) break;
        float w = smoothstep(2.5, 6.0, k) * (1.0 - smoothstep(22.0, 70.0, k));
        if (w > 0.0) {
          vec3 g = b * sc2 + float(i) * 17.0;
          vec3 ci = floor(g);
          vec3 cm = mod(ci, 1024.0);
          vec3 pt = ci + 0.15 + 0.7 * vec3(hash(cm), hash(cm + 11.0), hash(cm + 23.0));
          float dd = length(g - pt) * k;          // px to the candidate
          float keep = step(1.0 - min(dens * 1.3, 0.95), hash(cm + 5.0));
          float size = 0.8 + 1.1 * hash(cm + 7.0);
          float bright = exp(-dd * dd / (size * size)) * keep * (0.35 + 0.65 * hash(cm + 31.0));
          vec3 hue = mix(sodium, led, step(0.62, hash(cm + 41.0)) * smoothstep(0.5, 0.9, dens));
          speck += hue * bright * w * 2.6;
        }
        sc2 *= 3.0;
      }
      // the glow of the many lights too small to see one by one
      speck += mix(sodium, vec3(1.0, 0.88, 0.7), smoothstep(0.6, 0.95, dens)) * dens * dens * 0.16;
    }
    // far: the map's own lights; middle: the speckle; close: the street webs
    float texelPx = pxPerUnit * 6.2831853 / 2048.0;
    float mapK = 1.0 - smoothstep(2.0, 6.0, texelPx);
    float webK = smoothstep(45.0, 110.0, texelPx);
    vec3 mapLights = texture2D(uNight, uv).rgb * 1.9;
    l = mix(speck, l, webK);
    l = mix(l, mapLights, mapK);
    // under the photograph, its lights are the capital's: the shader's step back
    l *= 1.0 - uVeil * 0.9 * patchW;
    l = l * (1.0 - 0.85 * c) + vec3(1.0, 0.78, 0.5) * c * built * land * 0.04;
    col += l * night;
  }
  col += vec3(0.05, 0.06, 0.08) * c * night;

  // the atmosphere on the disc
  float rim = pow(1.0 - mu, 2.6) * smoothstep(-0.3, 0.5, day);
  col += vec3(0.3, 0.55, 1.0) * rim * 0.9;
  col += vec3(0.25, 0.45, 0.9) * 0.05 * dayK;
  col += vec3(0.85, 0.55, 0.2) * pow(1.0 - mu, 14.0) * (1.0 - dayK) * 0.5;

  return vec4(col, 1.0) * edge + vec4(vec3(0.35, 0.6, 1.0) * halo, halo) * (1.0 - edge);
}

vec4 giant(vec2 px){
  vec2 m = (px - uGiant.xy) / uGiant.z;
  // into the giant's own frame: its equator, and the ring in that plane
  vec2 g = vec2(m.x * uTilt.x + m.y * uTilt.y, -m.x * uTilt.y + m.y * uTilt.x);
  float r2 = dot(m, m);
  float pxr = 1.0 / uGiant.z;

  // its rings, in the equatorial plane, seen at a slant
  vec2 rp = vec2(g.x, g.y / 0.27);
  float rr = length(rp);
  float ringA = 0.0;
  if (rr > 1.3 && rr < 2.35) {
    float t = (rr - 1.3) / 1.05;
    ringA = (0.35 + 0.65 * noise(vec3(rr * 38.0, 0.0, 0.0))) * smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.85, t);
    ringA *= 1.0 - 0.75 * smoothstep(0.42, 0.5, t) * smoothstep(0.58, 0.5, t);   // a gap
    ringA *= 0.7;
  }
  vec3 ringCol = vec3(0.8, 0.84, 0.93);
  bool front = g.y > 0.0;

  vec4 outc = vec4(0.0);
  if (!front && ringA > 0.0) outc = vec4(ringCol * ringA, ringA);

  if (r2 < 1.0) {
    vec3 n = vec3(m, sqrt(1.0 - r2));
    float day = dot(n, uSun);
    // bands, along the equator, stirred; the cloud deck turns about the pole
    vec3 gn = vec3(g, n.z);
    float cs = cos(uSpin), sn = sin(uSpin);
    vec3 gs = vec3(gn.x * cs - gn.z * sn, gn.y, gn.x * sn + gn.z * cs);
    float lat = gn.y;
    float lon = atan(gs.x, gs.z);
    // the great oval storm in the south, and its string of white ovals
    float dLon = lon - 0.6;
    dLon -= 6.2831853 * floor((dLon + 3.1415927) / 6.2831853);
    vec2 so = vec2(dLon / 0.3, (lat - 0.36) / 0.09);
    float storm = exp(-dot(so, so) * 1.6);
    float swirl = atan(so.y, so.x) + length(so) * 3.0;
    float turb = fbm(gs * 3.0 + vec3(0.0, lat * 4.0, 0.0) + vec3(cos(swirl), sin(swirl), 0.0) * storm * 0.5, 6.0);
    float bb = lat * 7.0 + turb * 2.2;
    vec3 c1 = vec3(0.58, 0.68, 0.86);
    vec3 c2 = vec3(0.80, 0.84, 0.92);
    vec3 c3 = vec3(0.36, 0.46, 0.68);
    vec3 alb = mix(c1, c2, 0.5 + 0.5 * sin(bb * 3.1));
    alb = mix(alb, c3, smoothstep(0.55, 0.9, sin(bb * 1.3 + 1.0)) * 0.6);
    alb = mix(alb, vec3(0.30, 0.40, 0.66), smoothstep(0.25, 0.8, storm) * 0.75);
    alb = mix(alb, vec3(0.88, 0.91, 0.97), smoothstep(0.08, 0.25, storm) * (1.0 - smoothstep(0.25, 0.5, storm)) * 0.6);
    float ovals = 0.0;
    for (int i = 0; i < 6; i++) {
      float ol = lon - (2.0 + float(i) * 0.62);
      ol -= 6.2831853 * floor((ol + 3.1415927) / 6.2831853);
      vec2 od = vec2(ol / 0.07, (lat - 0.55) / 0.035);
      ovals += exp(-dot(od, od) * 1.2);
    }
    alb = mix(alb, vec3(0.94, 0.95, 0.98), clamp(ovals, 0.0, 1.0) * 0.8);
    float limb = pow(n.z, 0.35);
    vec3 col = alb * (0.025 + 1.0 * max(day, 0.0)) * limb;
    // the rings' shadow across the bands
    float sh = smoothstep(0.02, 0.07, abs(g.y + 0.05));
    col *= mix(0.6, 1.0, sh);
    col += vec3(0.35, 0.55, 1.0) * pow(1.0 - n.z, 3.0) * smoothstep(-0.2, 0.5, day) * 0.7;
    float edge = smoothstep(1.0, 1.0 - 1.5 * pxr, sqrt(r2));
    outc = vec4(col, 1.0) * edge + outc * (1.0 - edge);
  }
  if (front && ringA > 0.0) outc = vec4(ringCol * ringA, ringA) + outc * (1.0 - ringA);
  return outc;
}


// Orikaia's other moons, each its own kind of world: 0 Tsukiyo, airless grey rock and
// craters; 1 Kagerō, sulphur and lava lakes glowing through its night; 2 Kasumi, ice
// cut by rust-red cracks; 3 Yūgiri, a dark moonlet.
vec4 sat(vec2 px, vec4 S){
  vec2 q = (px - S.xy) / S.z;
  float r2 = dot(q, q);
  if (r2 >= 1.0) return vec4(0.0);
  vec3 n = vec3(q, sqrt(1.0 - r2));
  float day = dot(n, uSun);
  float a = uSatSpin * (0.6 + 0.15 * S.w) + S.w * 1.7;
  float cs = cos(a), sn = sin(a);
  vec3 bn = vec3(n.x * cs - n.z * sn, n.y, n.x * sn + n.z * cs);
  vec3 p = bn * 2.6 + vec3(S.w * 11.0, S.w * 3.0, 0.0);
  float f = fbm(p, 5.0);
  float f2 = fbm(p * 4.0 + 7.0, 4.0);
  vec3 alb;
  vec3 emit = vec3(0.0);
  if (S.w < 0.5) {
    alb = mix(vec3(0.30, 0.29, 0.28), vec3(0.56, 0.55, 0.53), f);
    float rim = smoothstep(0.6, 0.63, f2) * (1.0 - smoothstep(0.66, 0.72, f2));
    alb = alb * (1.0 - 0.3 * smoothstep(0.63, 0.7, f2)) + rim * 0.12;
  } else if (S.w < 1.5) {
    alb = mix(vec3(0.62, 0.47, 0.15), vec3(0.88, 0.78, 0.40), f);
    float dark = smoothstep(0.58, 0.68, f2);
    alb = mix(alb, vec3(0.22, 0.12, 0.05), dark * 0.75);
    emit = vec3(1.0, 0.33, 0.06) * smoothstep(0.7, 0.76, f2) * 1.4;
  } else if (S.w < 2.5) {
    alb = mix(vec3(0.76, 0.80, 0.85), vec3(0.94, 0.95, 0.97), f);
    float crack = 1.0 - smoothstep(0.0, 0.035, abs(fbm(p * 1.6 + 3.0, 4.0) - 0.5));
    alb = mix(alb, vec3(0.58, 0.40, 0.30), crack * 0.55);
  } else {
    alb = vec3(0.34, 0.32, 0.29) * (0.7 + 0.6 * f);
  }
  float lam = max(day, 0.0);
  vec3 col = alb * (0.015 + 1.15 * lam) + emit * (0.35 + 0.65 * (1.0 - smoothstep(-0.1, 0.25, day)));
  // a thin rim of the star's light on the limb, so the night side keeps its shape
  col += alb * pow(1.0 - n.z, 6.0) * smoothstep(-0.2, 0.3, day) * 0.25;
  float edge = smoothstep(1.0, 1.0 - 1.5 / S.z, sqrt(r2));
  return vec4(col, 1.0) * edge;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec4 col = vec4(0.0);
  // each body only where it can be, so a small one costs almost nothing
  if (length(px - uGiant.xy) < uGiant.z * 2.4) col = giant(px);
  // the other moons, in front of the giant, behind the homeworld
  for (int i = 0; i < 4; i++) {
    vec4 S = uSat[i];
    if (S.z > 0.5 && length(px - S.xy) < S.z) {
      vec4 sc = sat(px, S);
      col = sc + col * (1.0 - sc.a);
    }
  }
  if (length(px - uMoon.xy) < uMoon.z * 1.2) {
    vec4 mc = moon(px);
    col = mc + col * (1.0 - mc.a);
  }
  gl_FragColor = col * uAlpha;
}
`;

/**
 * @param canvas the drawing surface
 * @param maps   { day, data, mask }: image URLs of the world map; the moon is
 *               drawn as open sea until they arrive, and onReady fires then
 */
export function createPlanetRenderer(canvas, maps, onReady) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (error) {
    console.warn('[concordia] no planet shader', error);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  for (const name of ['uRes', 'uMoon', 'uGiant', 'uTilt', 'uSpin', 'uSat', 'uSatSpin', 'uSun', 'uOct', 'uAlpha', 'uDpr', 'uVeil',
    'uDay', 'uData', 'uMask', 'uNight', 'uToBody', 'uLon0', 'uCapB', 'uAerE', 'uAerN', 'uAerial']) {
    u[name] = gl.getUniformLocation(prog, name);
  }
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

  // three textures: a placeholder pixel each until the maps arrive
  const texture = (unit, pixel, wrapS) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(pixel));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  const tex = {
    day: texture(0, [5, 14, 33, 255], gl.REPEAT),
    data: texture(1, [0, 0, 0, 255], gl.REPEAT),
    mask: texture(2, [0, 0, 0, 255], gl.CLAMP_TO_EDGE),
    night: texture(3, [0, 0, 0, 255], gl.REPEAT),
  };
  gl.uniform1i(u.uDay, 0);
  gl.uniform1i(u.uData, 1);
  gl.uniform1i(u.uMask, 2);
  gl.uniform1i(u.uNight, 3);
  let pending = 4;
  const load = (unit, t, url, { mip, data }) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      // data is data: no colour management, no premultiplying
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, data ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (mip) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      }
      if (--pending === 0) onReady?.();
    };
    img.onerror = () => console.warn('[concordia] map missing', url);
    img.src = url;
  };
  load(0, tex.day, maps.day, { mip: true, data: false });
  load(1, tex.data, maps.data, { mip: true, data: true });
  load(2, tex.mask, maps.mask, { mip: false, data: true });
  load(3, tex.night, maps.night, { mip: true, data: false });

  return {
    /** sizes the drawing buffer; dpr is capped by the caller */
    resize(w, h, dpr) {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    /**
     * moon, giant: [x, y, r] in canvas px; tilt in radians; sun: view vector;
     * toBody: 3 × 3 rotation view → body, column-major; frame: the map's
     * frame { lon0, capB, aerE, aerN, aerial: [span, domeFx, domeFy] };
     * spin: the giant's turn.
     */
    draw({ moon, giant, tilt, spin = 0, sun, alpha, dpr = 1, veil = 0, toBody, frame, sats = [], satSpin = 0 }) {
      gl.uniform1f(u.uVeil, veil);
      gl.uniform1f(u.uDpr, dpr);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform3f(u.uMoon, ...moon);
      gl.uniform3f(u.uGiant, ...giant);
      gl.uniform2f(u.uTilt, Math.cos(tilt), Math.sin(tilt));
      gl.uniform1f(u.uSpin, spin);
      const S = new Float32Array(16);
      sats.slice(0, 4).forEach((m, i) => S.set(m, i * 4));
      gl.uniform4fv(u.uSat, S);
      gl.uniform1f(u.uSatSpin, satSpin);
      gl.uniform3f(u.uSun, ...norm(sun));
      gl.uniform1f(u.uOct, Math.min(Math.max(Math.log2(moon[2] / dpr / 3), 3), 14));
      gl.uniform1f(u.uAlpha, alpha);
      gl.uniformMatrix3fv(u.uToBody, false, toBody);
      gl.uniform1f(u.uLon0, frame.lon0);
      gl.uniform3f(u.uCapB, ...frame.capB);
      gl.uniform3f(u.uAerE, ...frame.aerE);
      gl.uniform3f(u.uAerN, ...frame.aerN);
      gl.uniform3f(u.uAerial, ...frame.aerial);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    clear() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}
