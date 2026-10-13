/**
 * planet-gl.js — one way to draw a world.
 *
 * CANONICAL COPY: sc/gov.inter-astra.net/js/modules/planet-gl.js
 * Byte-identical copies (never edit these, edit the canonical one and run
 * `python gov.inter-astra.net/tools/sync_planet_gl.py`):
 *   sc/terra.inter-astra.net/assets/js/planet-gl.js
 *   lucya.sh/planet-gl.js
 * The sites are separate static deployments with no build step, so each ships
 * its own copy of this one file. Plain ES module, raw WebGL 2, no dependencies.
 *
 * THE STYLE (it is Orikaia Prime's, as lucya.sh's Concordia set first drew it)
 * Everything is shaded in display space (no tone curve, no linear/sRGB round
 * trip), from one recipe:
 *   - the star's light is Lambert, 0.04 + 1.25·N·L on a world with air, with a
 *     soft terminator (smoothstep(-0.06, 0.22, N·L)) and a faint blue night
 *     ambient; airless rock 0.015 + 1.15·N·L plus a thin lit limb; a gas giant
 *     0.025 + N·L under limb darkening pow(mu, 0.35);
 *   - the air: a blue haze that thickens toward the limb, a rim light
 *     pow(1-mu, 2.6) on the lit side, a faint warm band on the terminator, an
 *     amber back-rim on the dark limb, and a halo outside the disc,
 *     exp(-(r-1)/thickness), strongest where the star shines;
 *   - the sea catches the star (a wide lobe and a hard glint), clouds are a
 *     layer of their own that shades the ground beneath and is lit by the star
 *     itself, never a texture painted into the ground;
 *   - the night side shows the world's lights, fading in before the terminator
 *     and thinned out by cloud; emissive rock (lava) glows through its night;
 *   - rings are lit by the star, shaded by the ball and shade it in turn.
 *
 * WHAT IT DRAWS (kind): 'terrestrial' (a world with air: day, night, optional
 * cloud and data maps, or a procedural coast), 'rock' (airless or icy: a day
 * map, or a procedural moon: grey cratered, sulphur and lava, ice and cracks,
 * a dark moonlet), 'gas' (a giant: a band map whose jets stream, or procedural
 * bands with a great storm and a string of ovals; rings), 'star'.
 *
 * VIEW SPACE is x right, y down, z toward the viewer. A body's frame is
 * z north, x at longitude 0, y at 90°E. Matrices are column-major view → body.
 *
 * API
 *   createPlanetLayer(canvas)   screen-space discs (a centre and radius in
 *                               device px per body), over a transparent canvas;
 *                               null without WebGL 2 or if the shader fails.
 *   PLANET_BODY_GLSL            the same shading, for a caller that casts its
 *   PLANET_RING_GLSL            own rays (the orrery) or only wants the light
 *   PLANET_LIGHT_GLSL           (terra.js's Akane); see the exports below.
 *   createTextures, compileProgram, programUniforms, resolveBody, loadBodyMaps, applyBody
 *   faceMatrix, giantMatrix, northInView, ringNormal, yNorth: the geometry
 *   callers need to put a world in view.
 */

// ---- GLSL ------------------------------------------------------------------------

// noise and the equirectangular lookup
const GLSL_CORE = `
const float PI = 3.14159265;
const float TAU = 6.2831853;

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
// an equirectangular map read at a body-frame direction (z north), centred on
// longitude lon0, without the date line's mip seam
vec4 equi(sampler2D t, vec3 nb, float lon0){
  float lon = atan(nb.y, nb.x), lat = asin(clamp(nb.z, -1.0, 1.0));
  vec2 uv = vec2(fract((lon - lon0) / TAU + 0.5), 0.5 - lat / PI);
  vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dy = dFdy(uv), dx2 = dFdx(uv2), dy2 = dFdy(uv2);
  if (dot(dx2, dx2) + dot(dy2, dy2) < dot(dx, dx) + dot(dy, dy)) { dx = dx2; dy = dy2; }
  return textureGrad(t, uv, dx, dy);
}
vec3 turnLon(vec3 n, float a){ float c = cos(a), s = sin(a); return vec3(c * n.x - s * n.y, s * n.x + c * n.y, n.z); }
`;

// the light: explicit arguments only, no uniforms, so anything can call it
const GLSL_LIGHT = `
// The limb colour the recipe is tuned for. Another body's air tints the same
// recipe by its own colour; the warm terminator band and the amber back-rim stay.
const vec3 AIR0 = vec3(0.35, 0.6, 1.0);
vec3 airTint(vec3 air){ return air / max(max(air.r, air.g), max(air.b, 1e-4)) / AIR0; }

// The air seen edge-on, past the limb (premultiplied). rr: the distance from the
// centre in radii (> 1); nh: the unit direction from the centre, in the view plane.
vec4 orkHalo(float rr, vec3 nh, vec3 sun, vec3 air, float thick, float amount){
  float lit = smoothstep(-0.35, 0.6, dot(nh, sun));
  float a = exp(-(rr - 1.0) / thick) * lit * amount;
  return vec4(air * a, a);
}

// Henyey-Greenstein phase function (unnormalised): g > 0 scatters forward
float hgp(float g, float c){ float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }

// One tone curve for every body: linear up to a knee, then a soft shoulder, so a
// glint or a sunlit cloud never clips to a flat white and nothing needs its own exposure.
vec3 orkTone(vec3 c){
  vec3 over = max(c - 0.85, 0.0);
  return min(c, vec3(0.85)) + 0.15 * (1.0 - exp(-over / 0.15));
}

// A world with air. n: the smooth normal, nl: the one the ground's relief gives
// the light; v: toward the viewer. wet: how much of the point is open water;
// c: cloud cover, cs: cloud over the ground the star lights, cv: the cloud's own
// variation. gl3: the glints of glass and rooftops (spark, sheen, glass), lights:
// what the night side shows here, before the night's own fade.
// air: the colour the air scatters (Rayleigh: blue for N2/O2, tan for CO2 and dust);
// airK: how thick it is (1: an Earth's worth); mie: the share of dust and haze that
// scatters forward instead, in white.
vec3 orkTerrestrial(vec3 albedo, vec3 n, vec3 nl, vec3 sun, vec3 v,
                    float wet, float c, float cs, float cv, vec3 gl3, vec3 lights,
                    vec3 air, float airK, float mie){
  float day = dot(n, sun);
  float k = clamp(airK, 0.05, 1.5);
  // the terminator is as soft as the air is thick: scattered light carries past it
  float dayK = smoothstep(-0.06 * k, 0.04 + 0.18 * k, day);
  float mu = max(dot(n, v), 0.0);
  vec3 T = airTint(air);
  vec3 A = T * vec3(0.32, 0.56, 0.97);                 // what the air scatters, in the recipe's own units
  float w = 0.06 * k;
  float lam = max((dot(nl, sun) + w) / (1.0 + w), 0.0) * smoothstep(-0.1, 0.02, day + 0.06 * k);
  vec3 col = albedo * (0.04 + 1.25 * lam) * (1.0 - 0.55 * cs * (1.0 - c)) + vec3(0.004, 0.009, 0.024) * (1.0 - dayK);
  // open water: a rough mirror (two lobes of waves), Fresnel-brightened toward the limb, and the sky in it
  if (wet * (1.0 - c) * dayK > 0.002) {
    vec3 H = normalize(sun + v);
    float NH = max(dot(n, H), 0.0), NV = max(dot(n, v), 0.0);
    float F1 = 1.0 - NV;
    float F = 0.02 + 0.98 * F1 * F1 * F1 * F1 * F1;
    float a1 = 0.06, a2 = 0.28;
    float t1 = NH * NH * (a1 * a1 - 1.0) + 1.0, t2 = NH * NH * (a2 * a2 - 1.0) + 1.0;
    float d1 = a1 * a1 / (PI * t1 * t1);
    float d2 = a2 * a2 / (PI * t2 * t2);
    float spec = (d1 + 0.35 * d2) * F * 0.5;
    col += wet * (1.0 - c) * (vec3(1.0, 0.93, 0.8) * spec * dayK + A * F * 0.55 * (0.05 + 0.75 * max(day, 0.0)) * dayK);
  }
  // glints of glass and rooftops: the same mirror, in points
  if (gl3.x + gl3.y + gl3.z > 0.0) {
    float rv = max(dot(reflect(-sun, n), v), 0.0);
    col += vec3(1.0, 0.97, 0.9) * gl3.x * pow(rv, 5.0) * dayK * (1.0 - c);
    col += vec3(0.85, 0.88, 0.95) * gl3.y * pow(rv, 14.0) * 0.08 * dayK * (1.0 - c);
    col += gl3.z * (1.0 - c) * vec3(0.9, 0.92, 1.0) * pow(rv, 90.0) * 0.25 * dayK;
  }
  // cloud: lit by the star itself, a little past the terminator (it stands above the ground)
  float cl = 0.08 + 1.1 * max((day + 0.06) / 1.06, 0.0);
  col = mix(col, vec3(0.93, 0.95, 1.0) * cl * (0.8 + 0.2 * cv), c);
  // the air in front of it: in-scattered light grows with the airmass along the line of sight,
  // so the limb brightens smoothly; it is only lit where the star shines
  float path = min(1.0 / max(mu, 0.05), 12.0);
  float scat = 1.0 - exp(-0.075 * airK * path);
  float sunl = smoothstep(-0.3, 0.5, day);
  col = mix(col, A * (0.05 + 0.8 * max(day + 0.1, 0.0)), clamp(scat * 0.9, 0.0, 1.0) * dayK);
  col += A * 0.35 * scat * sunl * smoothstep(0.0, 0.4, 1.0 - mu);
  // Mie: dust and haze throw the light forward, so the limb glows most with the star behind the body
  if (mie > 0.0 && sunl > 0.0) {
    float scatM = 1.0 - exp(-0.06 * airK * path);
    float ph = min(hgp(0.7, dot(-sun, v)) / 0.28, 6.0);
    col += vec3(0.95, 0.9, 0.84) * mie * 0.22 * scatM * ph * sunl;
  }
  // twilight: the terminator band takes the colour the air does not scatter (red-orange over blue air)
  vec3 dusk = (vec3(1.0) - T * vec3(0.35, 0.6, 1.0)) * vec3(0.75, 0.5, 0.1) + vec3(0.0, 0.0, 0.07);
  if (abs(day) < 0.4) col += dusk * exp(-day * day / 0.004) * (0.06 + 0.2 * scat) * (1.0 - c * 0.5) * airK;
  float night = 1.0 - smoothstep(-0.02, 0.3, day);
  col += lights * night;
  col += vec3(0.05, 0.06, 0.08) * c * night;
  return col;
}

// Rock without air: the Moon's own law, not Lambert. Lommel-Seeliger (the light a
// dusty regolith returns) keeps the disc flat out to the limb, and it brightens
// toward opposition, when the star is behind the viewer. The terminator is
// knife-sharp. What the ground itself emits (lava) glows through the night;
// glow is how much of it shows by day.
vec3 orkRock(vec3 albedo, vec3 emit, float glow, vec3 n, vec3 nl, vec3 sun, vec3 v){
  float day = dot(n, sun);
  float mu = max(dot(n, v), 0.0);
  float mu0 = max(dot(nl, sun), 0.0) * smoothstep(0.0, 0.05, day);
  float ls = 2.0 * mu0 / (mu0 + mu + 0.04);
  float g = acos(clamp(dot(sun, v), -1.0, 1.0));               // the phase angle
  float surge = 1.0 + 0.4 * exp(-g * 8.0);
  float L = mix(mu0, ls, 0.75) * surge;
  return albedo * (0.012 + 1.15 * L) + emit * (glow + (1.0 - glow) * (1.0 - smoothstep(-0.1, 0.25, day)));
}

// A giant: Lambert under heavy limb darkening, soft over the terminator (the deck
// is deep), the rings' shadow (shade) across the bands, a thin haze at the lit limb.
vec3 orkGas(vec3 albedo, vec3 n, vec3 sun, vec3 v, float shade, vec3 air, float airK){
  float day = dot(n, sun);
  float mu = max(dot(n, v), 0.0);
  float lam = max((day + 0.1) / 1.1, 0.0);
  vec3 col = albedo * (0.025 + lam) * pow(mu, 0.35) * shade;
  col += air * pow(1.0 - mu, 4.0) * smoothstep(-0.2, 0.5, day) * 0.3 * airK;
  return col;
}

// A star's disc: its own light, a little darker toward the limb.
vec3 orkStar(vec3 albedo, vec3 n, vec3 v){
  float om = 1.0 - max(dot(n, v), 0.0);
  return albedo * (1.0 - 0.32 * om - 0.28 * om * om) * 1.25;
}
// and its glow outside the disc; x: the distance past the limb in radii
vec4 orkStarGlow(float x){
  float a = exp(-x * 9.0) * 0.9 + exp(-x * 2.2) * 0.25;
  return vec4(vec3(1.0, 0.96, 0.9) * a, a);
}

// A ring sample, lit (premultiplied). rgb, tau: the ring's colour and opacity here;
// N: the ring plane's normal, v: toward the viewer; P: the point in the plane,
// in the planet's radii from its centre. The lit face reflects by the star's height
// over the plane; the far face shows only what the ring lets through, which is most
// when the star is behind it and the dust throws the light forward. The planet's shadow
// is cast along the ray to the star, with the star's disc blurring its edge.
vec4 orkRing(vec3 rgb, float tau, vec3 sun, vec3 N, vec3 v, vec3 P, float gain){
  float ci = abs(dot(sun, N));
  float cosT = dot(-sun, v);
  float lit;
  if (dot(sun, N) * dot(v, N) > 0.0) {
    lit = max(ci, 0.04) * (0.9 + 0.1 * hgp(0.3, -cosT));       // seen from the lit face
  } else {
    float fwd = hgp(0.75, cosT) / hgp(0.75, 1.0);              // seen from the dark face
    lit = ci * 0.18 + fwd * (0.6 + 0.9 * (1.0 - tau));
  }
  float t = -dot(P, sun);
  float dmin = t > 0.0 ? length(P + sun * t) : length(P);
  float w = 0.03 * max(t, 0.0) + 0.012;
  lit *= mix(0.06, 1.0, smoothstep(1.0 - w, 1.0 + w, dmin));
  return vec4(rgb * lit * gain * tau, tau);
}
`;

// the ring's profile, shared by the planet that casts it and the ring itself
const GLSL_RING = `
uniform vec4 uRingP;          // the ring plane's normal (view), on/off
uniform vec4 uRingR;          // inner, outer (radii), gain, 1 once the ring map is in
uniform float uRingMode;      // 0 the ring map, 1 procedural stripes with a gap
uniform sampler2D uRing;

// colour and opacity of the ring at rr radii
vec4 ringAt(float rr){
  float t = (rr - uRingR.x) / (uRingR.y - uRingR.x);
  if (uRingMode > 0.5) {
    float a = (0.35 + 0.65 * noise(vec3(rr * 38.0, 0.0, 0.0))) * smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.85, t);
    a *= 1.0 - 0.75 * smoothstep(0.42, 0.5, t) * smoothstep(0.58, 0.5, t);   // a gap
    return vec4(0.8, 0.84, 0.93, a * 0.7);
  }
  vec4 s = texture(uRing, vec2(t, 0.5));
  return vec4(s.rgb, mix(0.45, s.a, uRingR.w));
}
`;

// the body: uniforms, the surface of each kind, and the one entry point
const GLSL_BODY = `
uniform int uKind;            // 0 star, 1 rock, 2 terrestrial, 3 gas
uniform vec3 uAir;            // the limb colour; 0 for none
uniform vec3 uAirP;           // the halo's thickness (radii) and strength, the rim/haze strength
uniform vec3 uFlat;           // the colour until the map arrives
uniform float uTex;           // 1 once the day map is in
uniform float uNightOn;       // 1 once the night map is in
uniform float uCloudMode;     // 0 none, 1 the cloud map (streaming), 2 procedural
uniform float uTime;          // the visitor's seconds: the weather's own clock
uniform float uMie;           // the share of the air that is dust and haze
uniform float uGlint;         // how much of the ground is open water, 0: none, 1: from the map
uniform float uNightGain;     // the night map's brightness
uniform float uGlow;          // emissive rock: the share that shows by day
uniform float uProc;          // procedural surface: -1 none, 0 grey rock, 1 sulphur and lava, 2 ice, 3 dark, 4 bands
uniform float uSeed;
uniform float uDetail;        // 1: the data map and its fine detail (shores, cities)
uniform float uVeil;          // how much a photograph carries the capital now
uniform float uDpr;           // device px per CSS px: lines are sized in CSS px
uniform float uLon0;          // the maps' centre longitude, radians
uniform vec3 uCapB;           // the capital, Orikaia's body frame (y north, z east)
uniform vec3 uAerE;           // the photograph's east and north on the world, same frame
uniform vec3 uAerN;
uniform vec3 uAerial;         // its span (radians), and the dome in it (x, y as fractions)
uniform vec4 uStorm;          // a giant's great storm: longitude, latitude, width, height (0: none)
uniform vec4 uOvals;          // a string of white ovals: first longitude, latitude, spacing, count
uniform vec3 uBand1, uBand2, uBand3;
uniform mat3 uToBody;         // view → the body's frame
uniform sampler2D uDay, uNight, uClouds, uData, uMask;

// the winds, as radians of longitude a second of the visitor's time: + eastward
float winds(float lat){
  float l = abs(lat);
  return -0.0035 * exp(-pow(l / 0.38, 2.0)) + 0.0055 * exp(-pow((l - 0.82) / 0.26, 2.0)) - 0.002 * smoothstep(1.05, 1.35, l);
}
// a giant's jets: the bands slide against each other
float jets(float lat){ return 0.0022 * sin(lat * 9.0) * cos(lat * 0.5) + 0.0012 * exp(-pow(lat / 0.2, 2.0)); }

float cloudAt(vec3 nb, float time){
  float lat = asin(clamp(nb.z, -1.0, 1.0));
  vec3 m = turnLon(nb, -time * winds(lat));
  // the cloud re-forms as it goes: the map read through a slow, wandering warp
  vec3 w = vec3(sin(time * 0.031 + nb.z * 11.0 + nb.y * 5.0), cos(time * 0.027 + nb.x * 9.0 - nb.z * 4.0), 0.0) * 0.006;
  float a = equi(uClouds, normalize(m + w), 0.0).r;
  float b = equi(uClouds, normalize(turnLon(m, 0.012) - w), 0.0).r;
  return mix(a, b, 0.5 + 0.5 * sin(time * 0.013 + nb.x * 3.0));
}

// the same cloud, read once: the shadow does not need the re-forming blend
float cloudOnce(vec3 nb, float time){
  float lat = asin(clamp(nb.z, -1.0, 1.0));
  vec3 m = turnLon(nb, -time * winds(lat));
  vec3 w = vec3(sin(time * 0.031 + nb.z * 11.0 + nb.y * 5.0), cos(time * 0.027 + nb.x * 9.0 - nb.z * 4.0), 0.0) * 0.006;
  return equi(uClouds, normalize(m + w), 0.0).r;
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

// ---- a world with air -------------------------------------------------------------
// The ground comes from the day map (and, where a data map is given, from its
// shores, built-up land and causeways, carried below the map's resolution by
// noise: coasts keep breaking into finer bays, cities resolve into street webs
// lit white and sodium-orange). The light is orkTerrestrial's.
vec3 shadeTerrestrial(vec3 n, vec3 sun, vec3 v, vec3 nb, vec3 lb, float pxr){
  float day = dot(n, sun);
  float oct = clamp(log2(1.0 / (pxr * uDpr) / 3.0), 3.0, 14.0);   // octaves this zoom needs
  float pxPerUnit = 1.0 / (pxr * uDpr);
  vec3 b = vec3(nb.x, nb.z, nb.y);                // the frame the detail is written in: y north, z east
  vec3 bsun = vec3(lb.x, lb.z, lb.y);
  float lon = atan(b.z, b.x);
  float lat = asin(clamp(b.y, -1.0, 1.0));
  vec2 fuv = vec2(lon * cos(lat), lat);
  vec3 dayTex = uTex > 0.5 ? equi(uDay, nb, uLon0).rgb : uFlat;

  float land = 1.0, built = 0.0, lines = 0.0, sub = 0.0, patchW = 0.0, plat = 0.0, core = 0.0;
  float tone = 0.5, street = 0.0, lit = 0.0, sodiumW = 0.0, cv = 0.5;
  vec3 data = vec3(0.0);
  vec3 albedo = dayTex;
  vec3 gl3 = vec3(0.0);

#ifdef DETAIL
  if (uDetail > 0.5) {
    data = equi(uData, nb, uLon0).rgb;               // R ground (0.25 at the shore), G built, B causeways
    // the ground: the map's shore, carried below its resolution by noise
    float texel = TAU / 2048.0;
    sub = clamp(texel / max(pxr, 1e-6) * 0.5, 0.0, 1.0);
    float h = data.r + (fbm(b * 520.0, max(oct - 7.0, 1.0)) - 0.5) * 0.2 * sub;
    land = smoothstep(0.25 - 0.02, 0.25 + 0.02, h);
    built = data.g;
    lines = data.b;

    // the capital's own islands, from the photograph, when the camera is that close
    {
      float cz = dot(b, uCapB);
      vec2 t = vec2(dot(b, uAerE), dot(b, uAerN)) / max(cz, 1e-3);
      vec2 a = vec2(uAerial.y + t.x / uAerial.x, uAerial.z - t.y / uAerial.x * 1.5);
      vec2 e = vec2((a.x - 0.48) / 0.46, (a.y - 0.44) / 0.48);
      patchW = cz > 0.5 ? clamp((1.0 - length(e)) / 0.35, 0.0, 1.0) : 0.0;
      if (patchW > 0.0) {
        float m = texture(uMask, clamp(a, 0.0, 1.0)).r;
        land = mix(land, smoothstep(0.35, 0.65, m), patchW);
        built = mix(built, 0.95 * land, patchW);
        lines *= 1.0 - patchW;
      }
    }
    // a city is not a carpet: parks, water, yards and dark districts break it up
    if (built > 0.0) {
      // the heights stay dark; the towns keep to the coasts and the valleys
      built *= 1.0 - 0.85 * smoothstep(0.62, 0.9, data.r);
      built *= mix(0.25, 1.1, smoothstep(0.36, 0.6, fbm(b * 380.0, clamp(oct - 6.0, 2.0, 5.0))));
    }
    // the capital burns white from orbit; close in, it is streets like any other
    core = smoothstep(0.012, 0.0, distance(b, uCapB)) * smoothstep(1.0 / 6000.0, 1.0 / 1200.0, pxr);

    // blocks and streets, at the finest scales the screen resolves
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

    // the day: the map's colour, the cities included (their districts are painted
    // there). Only the capital's photographed islands are the shader's own.
    cv = fbm(b * 300.0, max(oct - 6.0, 2.0));
    vec3 concrete = mix(vec3(0.26, 0.26, 0.27), vec3(0.42, 0.41, 0.39), tone);
    vec3 green = mix(vec3(0.06, 0.11, 0.05), vec3(0.1, 0.15, 0.07), cv);
    vec3 ground = mix(green, concrete, clamp(built * 1.15, 0.0, 0.95));
    albedo = mix(dayTex, ground, land * patchW);
    // below the map's resolution: roof to roof the blocks vary, the streets run dark
    float close = sub * smoothstep(0.05, 0.2, built);
    albedo *= mix(1.0, 0.78 + 0.44 * tone, close);
    albedo *= 1.0 - 0.45 * street;
    // the platforms over the sea, close in: decks with seams between them
    plat = (1.0 - land) * smoothstep(0.08, 0.2, built);
    vec2 pg = fract(fuv * 2400.0);
    float seam = smoothstep(0.0, 2.0, min(min(pg.x, 1.0 - pg.x), min(pg.y, 1.0 - pg.y)) * pxPerUnit / 2400.0);
    albedo *= mix(1.0, mix(0.7, 1.0, seam), plat * sub);
    albedo = mix(albedo, vec3(0.6, 0.6, 0.6), lines * 0.75);    // causeways, corridors, the rings
  } else
#endif
  if (uGlint > 0.0) {
    // no data map: the sea is the map's dark blue
    float luma = dot(dayTex, vec3(0.3, 0.55, 0.15));
    land = 1.0 - smoothstep(0.0, 0.07, dayTex.b - max(dayTex.r, dayTex.g)) * (1.0 - smoothstep(0.4, 0.7, luma));
  }
  float wet = (1.0 - land) * (1.0 - plat);

  // relief, felt by the light, on the land only
  vec3 nl = n;
  if (land > 0.0 && day > -0.2 && (uDetail > 0.5 || pxPerUnit > 90.0)) {      // too small to show relief: not worth the noise
    vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(n, t1);
    float eps = max(pxr * 1.5, 0.0004);
    float o2 = max(oct - 2.0, 3.0);
    vec3 bx = uToBody * (n + t1 * eps), by = uToBody * (n + t2 * eps);
    float h0 = fbm(b * 40.0, o2);
    float hx = fbm(vec3(bx.x, bx.z, bx.y) * 40.0, o2);
    float hy = fbm(vec3(by.x, by.z, by.y) * 40.0, o2);
    vec2 grad = vec2(hx - h0, hy - h0) / eps;
    nl = normalize(n - (t1 * grad.x + t2 * grad.y) * 0.0025 * (1.0 - built * 0.6));
  }

  // cloud: warped so it streams, eroded at the edges so it billows
  float c = 0.0, cs = 0.0;
  if (uCloudMode > 1.5) {
    vec3 cw = b * 3.0 + vec3(fbm(b * 2.0, 4.0), fbm(b * 2.0 + 5.0, 4.0), 0.0) * 1.4;
    float cf = fbm(cw + vec3(4.0, 1.0, 7.0), min(oct, 9.0));
    cf -= 0.1 * fbm(b * 40.0 + 1.0, min(max(oct - 4.0, 1.0), 6.0));
    c = smoothstep(0.54, 0.74, cf) * 0.9;
    cs = smoothstep(0.54, 0.74, fbm(cw + vec3(4.0, 1.0, 7.0) - bsun * 0.02, min(oct, 6.0)));
  } else if (uCloudMode > 0.5) {
    c = clamp(cloudAt(nb, uTime) * 0.92, 0.0, 1.0);
    cs = pxr < 1.0 / 60.0 ? c : cloudOnce(normalize(nb + lb * 0.008), uTime);   // the shadow falls a little way from it; on a small disc it is not seen
  }

  // glints of glass and rooftop water, a point here and there, cells about a pixel
  // across so they stay sharp at any distance
#ifdef DETAIL
  if (uDetail > 0.5) {
    float cell = max(pxPerUnit * 0.9, 40.0);
    vec3 gc = floor(b * cell);
    float gh = hash(mod(gc, 1024.0) + 3.0);
    float spark = step(0.965, gh) * smoothstep(0.12, 0.45, built) * (1.0 - wet * (1.0 - plat));
    gl3 = vec3(spark * (0.5 + 0.8 * hash(mod(gc, 1024.0) + 9.0)), smoothstep(0.1, 0.5, built), (1.0 - wet) * step(0.8, tone));
  }
#endif

  // the night: every island lit, the platforms, the causeways as threads. The lights
  // come on in the evening, while the star is still low over the horizon, not at the
  // edge of the dark: full by the terminator, already glowing well before it.
  float night = 1.0 - smoothstep(-0.02, 0.3, day);
  vec3 lights = vec3(0.0);
  if (night > 0.0) {
    vec3 mapLights = uNightOn > 0.5 ? equi(uNight, nb, uLon0).rgb * uNightGain : vec3(0.0);
#ifdef DETAIL
    if (uDetail > 0.5) {
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
      float texelPx = pxPerUnit * TAU / 2048.0;
      float mapK = 1.0 - smoothstep(2.0, 6.0, texelPx);
      float webK = smoothstep(45.0, 110.0, texelPx);
      l = mix(speck, l, webK);
      l = mix(l, mapLights, mapK);
      // under the photograph, its lights are the capital's: the shader's step back
      l *= 1.0 - uVeil * 0.9 * patchW;
      lights = l * (1.0 - 0.85 * c) + vec3(1.0, 0.78, 0.5) * c * built * land * 0.04;
    } else
#endif
    {
      lights = mapLights * (1.0 - 0.85 * c);
    }
  }
  return orkTerrestrial(albedo, n, nl, sun, v, wet * uGlint, c, cs, cv, gl3, lights, uAir, uAirP.z, uMie);
}

// ---- rock and ice -----------------------------------------------------------------
// Procedural kinds, each its own sort of world: 0 airless grey rock and craters;
// 1 sulphur and lava lakes glowing through the night; 2 ice cut by rust-red
// cracks; 3 a dark moonlet. Or the day map (and a night map of what glows).
vec3 shadeRock(vec3 n, vec3 sun, vec3 v, vec3 nb, float pxr){
  vec3 alb = uFlat;
  vec3 emit = vec3(0.0);
  if (uProc > -0.5) {
    vec3 pv = vec3(nb.y, -nb.z, nb.x);
    vec3 p = pv * 2.6 + vec3(uSeed * 11.0, uSeed * 3.0, 0.0);
    float f = fbm(p, 5.0);
    float f2 = fbm(p * 4.0 + 7.0, 4.0);
    if (uProc < 0.5) {
      alb = mix(vec3(0.30, 0.29, 0.28), vec3(0.56, 0.55, 0.53), f);
      float rim = smoothstep(0.6, 0.63, f2) * (1.0 - smoothstep(0.66, 0.72, f2));
      alb = alb * (1.0 - 0.3 * smoothstep(0.63, 0.7, f2)) + rim * 0.12;
    } else if (uProc < 1.5) {
      alb = mix(vec3(0.62, 0.47, 0.15), vec3(0.88, 0.78, 0.40), f);
      float dark = smoothstep(0.58, 0.68, f2);
      alb = mix(alb, vec3(0.22, 0.12, 0.05), dark * 0.75);
      emit = vec3(1.0, 0.33, 0.06) * smoothstep(0.7, 0.76, f2) * 1.4;
    } else if (uProc < 2.5) {
      alb = mix(vec3(0.76, 0.80, 0.85), vec3(0.94, 0.95, 0.97), f);
      float crack = 1.0 - smoothstep(0.0, 0.035, abs(fbm(p * 1.6 + 3.0, 4.0) - 0.5));
      alb = mix(alb, vec3(0.58, 0.40, 0.30), crack * 0.55);
    } else {
      alb = vec3(0.34, 0.32, 0.29) * (0.7 + 0.6 * f);
    }
  } else {
    if (uTex > 0.5) alb = equi(uDay, nb, uLon0).rgb;
    if (uNightOn > 0.5) emit = equi(uNight, nb, uLon0).rgb * uNightGain;
  }
  // relief: the ground's own bumps, felt by the light (not worth it on a disc a few dozen px wide)
  vec3 nl = n;
  if (pxr < 1.0 / 50.0 && dot(n, sun) > -0.15) {
    vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(n, t1);
    float eps = 0.004;
    vec3 b1 = uToBody * (n + t1 * eps), b2 = uToBody * (n + t2 * eps);
    vec3 q0 = vec3(nb.y, -nb.z, nb.x) * 24.0, q1 = vec3(b1.y, -b1.z, b1.x) * 24.0, q2 = vec3(b2.y, -b2.z, b2.x) * 24.0;
    float h0 = fbm(q0, 5.0);
    vec2 grad = vec2(fbm(q1, 5.0) - h0, fbm(q2, 5.0) - h0) / eps;
    nl = normalize(n - (t1 * grad.x + t2 * grad.y) * 0.011);
  }
  return orkRock(alb, emit, uGlow, n, nl, sun, v);
}

// ---- a giant ----------------------------------------------------------------------
vec3 shadeGas(vec3 n, vec3 sun, vec3 v, vec3 nb, float shade){
  vec3 alb = uFlat;
  if (uProc > 3.5) {
    // bands along the equator, stirred; the cloud deck turns about the pole
    vec3 gs = vec3(nb.y, -nb.z, nb.x);
    float lat = gs.y;
    float lon = atan(gs.x, gs.z);
    float storm = 0.0;
    float turb;
    if (uStorm.z > 0.0) {
      // the great oval storm in the south, and its swirl
      float dLon = lon - uStorm.x;
      dLon -= TAU * floor((dLon + PI) / TAU);
      vec2 so = vec2(dLon / uStorm.z, (lat - uStorm.y) / uStorm.w);
      storm = exp(-dot(so, so) * 1.6);
      float swirl = atan(so.y, so.x) + length(so) * 3.0;
      turb = fbm(gs * 3.0 + vec3(0.0, lat * 4.0, 0.0) + vec3(cos(swirl), sin(swirl), 0.0) * storm * 0.5, 6.0);
    } else {
      turb = fbm(gs * 3.0 + vec3(0.0, lat * 4.0, 0.0), 6.0);
    }
    float bb = lat * 7.0 + turb * 2.2;
    alb = mix(uBand1, uBand2, 0.5 + 0.5 * sin(bb * 3.1));
    alb = mix(alb, uBand3, smoothstep(0.55, 0.9, sin(bb * 1.3 + 1.0)) * 0.6);
    if (uStorm.z > 0.0) {
      alb = mix(alb, vec3(0.30, 0.40, 0.66), smoothstep(0.25, 0.8, storm) * 0.75);
      alb = mix(alb, vec3(0.88, 0.91, 0.97), smoothstep(0.08, 0.25, storm) * (1.0 - smoothstep(0.25, 0.5, storm)) * 0.6);
    }
    if (uOvals.w > 0.5) {
      // and a string of white ovals
      float ovals = 0.0;
      for (int i = 0; i < 8; i++) {
        if (float(i) >= uOvals.w) break;
        float ol = lon - (uOvals.x + float(i) * uOvals.z);
        ol -= TAU * floor((ol + PI) / TAU);
        vec2 od = vec2(ol / 0.07, (lat - uOvals.y) / 0.035);
        ovals += exp(-dot(od, od) * 1.2);
      }
      alb = mix(alb, vec3(0.94, 0.95, 0.98), clamp(ovals, 0.0, 1.0) * 0.8);
    }
  } else if (uTex > 0.5) {
    // the bands stream against each other, as jets do
    vec3 nd = turnLon(nb, -uTime * jets(asin(clamp(nb.z, -1.0, 1.0))));
    alb = equi(uDay, nd, uLon0).rgb;
  }
  return orkGas(alb, n, sun, v, shade, uAir, uAirP.z);
}

// ---- the entry point ----------------------------------------------------------------
// One world's colour at one point of its disc (display space, alpha 1).
// n: the surface normal in view space; sun: toward the star, view; v: toward the
// viewer; nb: the normal in the body's frame; pxr: one device px, in radii, here;
// shade: other shadows on it (the rings').
vec3 planetColor(vec3 n, vec3 sun, vec3 v, vec3 nb, float pxr, float shade){
  // KIND, when defined, is the one kind this program draws: the others are not compiled in
  // (a software or mobile GPU runs both sides of a branch it cannot prove uniform)
  vec3 lb = normalize(uToBody * sun);
#if !defined(KIND) || KIND == 0
  if (uKind == 0) return orkTone(orkStar(uTex > 0.5 ? equi(uDay, nb, uLon0).rgb : uFlat, n, v));
#endif
#if !defined(KIND) || KIND == 1
  if (uKind == 1) return orkTone(shadeRock(n, sun, v, nb, pxr) * shade);
#endif
#if !defined(KIND) || KIND == 2
  if (uKind == 2) return orkTone(shadeTerrestrial(n, sun, v, nb, lb, pxr) * shade);
#endif
#if !defined(KIND) || KIND == 3
  return orkTone(shadeGas(n, sun, v, nb, shade));
#else
  return vec3(0.0);
#endif
}

// How much of the planet's light a ring in the planet's own plane takes: 1 where
// nothing shades it. p: a point on the ball, in radii, view space; sun: toward the star.
float ringTauAt(float rr){ return (rr > uRingR.x && rr < uRingR.y) ? ringAt(rr).a : 0.0; }
float ringShadow(vec3 p, vec3 sun){
  if (uRingP.w < 0.5) return 1.0;
  float den = dot(sun, uRingP.xyz);
  if (abs(den) < 1e-4) return 1.0;
  float s = -dot(p, uRingP.xyz) / den;               // along the ray to the star, to the ring's plane
  if (s <= 0.0) return 1.0;
  float rr = length(p + sun * s);
  float w = 0.03 * s + 0.01;                       // the star's disc blurs the shadow's edge, radially
  float a = 0.25 * ringTauAt(rr - w) + 0.5 * ringTauAt(rr) + 0.25 * ringTauAt(rr + w);
  return 1.0 - 0.85 * a;
}
`;

/** noise, fbm, the equirectangular lookup, and the Orikaia light (orkTerrestrial, orkRock, orkGas, orkStar, orkHalo, orkRing). No uniforms. */
export const PLANET_LIGHT_GLSL = GLSL_CORE + GLSL_LIGHT;
/** the above, plus the ring's uniforms and ringAt(rr): for a caller that draws the ring itself */
export const PLANET_RING_GLSL = PLANET_LIGHT_GLSL + GLSL_RING;
/** the whole body shading: uniforms (set them with applyBody) and planetColor(n, sun, v, nb, pxr, shade) */
export const PLANET_BODY_GLSL = PLANET_RING_GLSL + GLSL_BODY;

// ---- the screen-space layer's shaders ---------------------------------------------

const VS = `#version 300 es
in vec2 aCorner;
uniform vec2 uRes;          // the canvas, device px
uniform vec3 uDisc;         // centre x, y (device px, y down), radius (device px)
uniform float uFrame;       // the quad's half-size, in radii (rings and air reach past the disc)
out vec2 vP;                // in radii, y down
void main(){
  vP = aCorner * uFrame;
  vec2 px = uDisc.xy + vP * uDisc.z;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const fsSource = (kind, detail) => `#version 300 es
#define KIND ${kind}
${detail ? '#define DETAIL 1' : '// no data map'}
precision highp float;
in vec2 vP;
uniform vec3 uDisc;
uniform vec3 uSun;          // toward the star, view
uniform float uAlpha;
${PLANET_BODY_GLSL}
out vec4 frag;
void main(){
  float d2 = dot(vP, vP);
  float d = sqrt(d2);
  float pxr = 1.0 / uDisc.z;                    // a pixel, in radii
  vec3 sun = normalize(uSun);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 nh = vec3(vP, 0.0);
  float edge = smoothstep(1.0, 1.0 - 1.5 * pxr, d);
  // the ball, anti-aliased over what is behind it: the air's halo, and the ring behind it
  vec4 ball = vec4(0.0);
  if (d < 1.0) {
    vec3 n = vec3(vP, sqrt(max(1.0 - d2, 0.0)));
    vec3 nb = uToBody * n;
#if !defined(KIND) || KIND == 3
    float shade = ringShadow(n, sun);
#else
    float shade = 1.0;
#endif
    ball = vec4(planetColor(n, sun, v, nb, pxr, shade), 1.0) * edge;
  }
  vec4 under = vec4(0.0);
  if (uKind >= 2 && uAirP.y > 0.0 && d > 1.0 - 1.5 * pxr) {
    // the air seen edge-on, past the limb (and under the limb's own anti-aliased edge)
    under = orkHalo(max(d, 1.0), nh / max(d, 1e-4), sun, uAir, uAirP.x, uAirP.y);
  }
  vec4 front = vec4(0.0);
#if !defined(KIND) || KIND == 3
  if (uRingP.w > 0.5 && abs(uRingP.z) > 1e-3) {
    float zr = -(vP.x * uRingP.x + vP.y * uRingP.y) / uRingP.z;
    vec3 P = vec3(vP, zr);
    float rr = length(P);
    float zb = sqrt(max(1.0 - d2, 0.0));
    if (rr > uRingR.x && rr < uRingR.y) {
      vec4 s = ringAt(rr);
      vec4 r = orkRing(s.rgb, s.a, sun, uRingP.xyz, v, P, uRingR.z);
      if (d >= 1.0 || zr > zb) front = r;                  // beside the ball, or in front of it
      else under = r + under * (1.0 - r.a);                // behind it: the ball's soft edge lets it show
    }
  }
#endif
  vec4 outc = ball + under * (1.0 - ball.a);
  outc = front + outc * (1.0 - front.a);
  if (outc.a <= 0.001) discard;
  frag = outc * uAlpha;
}`;

// ---- geometry callers need ----------------------------------------------------------

const DEG = Math.PI / 180;
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** view → body (column-major) for a body showing (lat, lon) at the disc's centre, north up,
 * turned by roll (deg, counter-clockwise on the screen) and spun by spin (rad, eastward). */
export function faceMatrix(lat, lon, roll = 0, spin = 0) {
  const la = lat * DEG, lo = lon * DEG - spin;
  const d = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const e = [-Math.sin(lo), Math.cos(lo), 0];
  const n = cross(d, e);
  // the picture turned counter-clockwise by roll: turn each view vector back before reading the body
  const r = roll * DEG, c = Math.cos(r), s = Math.sin(r);
  const c0 = [0, 1, 2].map((i) => c * e[i] - s * n[i]);
  const c1 = [0, 1, 2].map((i) => -s * e[i] - c * n[i]);
  return [...c0, ...c1, ...d];
}

/** the body's north, in view space, from a view → body matrix */
export const northInView = (m) => [m[2], m[5], m[8]];

/** view → body for a giant as the reach and the renders show it: its axis tilted on the screen
 * by tiltDeg, the rings opened by slant, and a body point (lat, lon) brought to view direction w. */
export function giantMatrix(tiltDeg, slant, point, w) {
  const t = tiltDeg * DEG;
  const minor = [-Math.sin(t), Math.cos(t)];
  const s = Math.sqrt(1 - slant * slant);
  const z = norm([s * minor[0], s * minor[1], -slant]);
  const x = norm([1 - z[0] * z[0], -z[0] * z[1], -z[0] * z[2]]);
  const y = cross(z, x);
  // body → view without spin: columns x, y, z. Find the spin bringing point to w.
  const wb = [dot(x, w), dot(y, w), dot(z, w)];       // w in the unspun body frame
  const phi = Math.atan2(wb[1], wb[0]) - point[1] * DEG;   // the point's latitude matches w's by construction
  const c = Math.cos(phi), sn = Math.sin(phi);
  // R = F · Rz(phi); view → body = Rᵀ: row i of Rᵀ = column i of R
  const R0 = [x[0] * c + y[0] * sn, x[1] * c + y[1] * sn, x[2] * c + y[2] * sn];      // body x in view
  const R1 = [-x[0] * sn + y[0] * c, -x[1] * sn + y[1] * c, -x[2] * sn + y[2] * c];   // body y in view
  const R2 = z;                                                                     // body z in view
  // column-major view → body: column j = view axis j in body coords = (R0[j], R1[j], R2[j])
  return [R0[0], R1[0], R2[0], R0[1], R1[1], R2[1], R0[2], R1[2], R2[2]];
}

/** a ring plane's normal in view space: tiltDeg on the screen, opened by slant (0: edge-on, 1: face-on) */
export function ringNormal(tiltDeg, slant) {
  const t = tiltDeg * DEG, s = Math.sqrt(1 - slant * slant);
  return norm([-s * Math.sin(t), s * Math.cos(t), -slant]);
}

/** a view → body matrix written for a frame with y north (z at 90°E) → this module's z north */
export const yNorth = (m) => [0, 1, 2].flatMap((c) => [m[c * 3], m[c * 3 + 2], m[c * 3 + 1]]);

// ---- WebGL plumbing -------------------------------------------------------------------

/** compiles and links; throws with the driver's log on failure */
export function compileProgram(gl, vs, fs) {
  const prog = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

/** every active uniform of a program, by name */
export function programUniforms(gl, prog) {
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i++) {
    const info = gl.getActiveUniform(prog, i);
    u[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return u;
}

/**
 * A cache of maps by URL. get(url, { data, mip, clamp }) returns { tex, ready } at
 * once (a black pixel until the image arrives, then onLoad fires). data: the map is
 * numbers, not colour (no colour management); mip: mipmaps (default); clamp: don't
 * wrap in longitude; aniso: anisotropic filtering, where the GPU has it.
 */
export function createTextures(gl, onLoad = () => {}) {
  const black = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, black);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  const cache = new Map();
  const api = {
    black,
    onLoad,
    get(url, { data = false, mip = true, clamp = false, aniso = 0 } = {}) {
      if (!url) return null;
      if (cache.has(url)) return cache.get(url);
      const e = { tex: black, ready: false };
      cache.set(url, e);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, data ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (mip) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        const ext = aniso && gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, aniso);
        e.tex = t;
        e.ready = true;
        api.onLoad();
      };
      img.onerror = () => console.warn('[planet] map missing', url);
      img.src = url;
      return e;
    },
  };
  return api;
}

const KIND = { star: 0, rock: 1, terrestrial: 2, gas: 3 };
const PROC = { rock: 0, lava: 1, ice: 2, dark: 3, bands: 4 };
// the air each kind wears by default: limb colour, halo thickness (radii), halo strength, rim/haze strength
const AIR = {
  terrestrial: { col: [0.35, 0.6, 1.0], thick: 0.024, halo: 0.75, k: 1, mie: 0.12 },
  gas: { col: [0.35, 0.55, 1.0], thick: 0.012, halo: 0.35, k: 1, mie: 0 },
  rock: { col: [0, 0, 0], thick: 0.03, halo: 0, k: 0 },
  star: { col: [0, 0, 0], thick: 0.03, halo: 0, k: 0 },
};

/**
 * A body, with its defaults filled in. spec:
 *   kind        'terrestrial' | 'rock' | 'gas' | 'star'
 *   maps        { day, night, clouds, data, mask, ring }: image URLs. day: the colour
 *               (equirectangular); night: lights, or what glows; clouds: a cloud map
 *               the winds carry (else procedural cloud, with cloud: true); data: R ground
 *               (0.25 at the shore), G built, B causeways, with mask, the photograph's
 *               islands, and frame, for the fine detail; ring: a 1-D ring profile
 *   flat        [r, g, b] 0..1, the colour before the day map arrives, and for a rock
 *               with neither map nor proc
 *   air         [r, g, b] the colour the air scatters (Rayleigh: blue for N2/O2, tan for CO2 and dust;
 *               default by kind; null: none); atm: { thick, halo, k } (scale height in radii, halo
 *               strength, how thick the air is, 1 an Earth's worth); mie: the dusty, forward-scattering share
 *   proc        'rock' | 'lava' | 'ice' | 'dark' | 'bands': a procedural surface in place of the day map
 *   seed        a number that makes one procedural moon unlike another
 *   cloud       true: procedural cloud on a world without a cloud map
 *   glint       how much the open water shines (default 1; 0 turns the sea off)
 *   nightGain   the night map's brightness (default 1.9)
 *   glow        emissive rock: the share of its glow that shows by day (default 0)
 *   frame       { lon0 (deg), capB, aerE, aerN, aerial: [span, domeFx, domeFy] } for the data map
 *   storm, ovals, bands  a procedural giant's great storm [lon, lat, w, h], its string of ovals
 *               [lon0, lat, spacing, n] and band colours [c1, c2, c3]
 *   rings       { inner, outer, gain, proc }: radii of the giant; proc: stripes, not a map
 */
export function resolveBody(spec) {
  const kind = spec.kind ?? 'terrestrial';
  const A = AIR[kind] ?? AIR.rock;
  const air = spec.air === null ? [0, 0, 0] : spec.air ?? A.col;
  const atm = { thick: A.thick, halo: A.halo, k: A.k, ...spec.atm };
  const mie = spec.mie ?? A.mie ?? 0;
  if (air[0] + air[1] + air[2] === 0) { atm.halo = 0; atm.k = 0; }
  return {
    kind, k: KIND[kind], mie, maps: spec.maps ?? {}, flat: spec.flat ?? [0.3, 0.3, 0.3], air, atm,
    proc: spec.proc ? PROC[spec.proc] : -1, seed: spec.seed ?? 0, cloud: !!spec.cloud,
    glint: spec.glint ?? 1, nightGain: spec.nightGain ?? 1.9, glow: spec.glow ?? 0,
    frame: spec.frame ?? null, storm: spec.storm ?? [0, 0, 0, 0], ovals: spec.ovals ?? [0, 0, 0, 0],
    bands: spec.bands ?? [[0.58, 0.68, 0.86], [0.80, 0.84, 0.92], [0.36, 0.46, 0.68]],
    rings: spec.rings ?? null,
  };
}

/** makes (once) a body's map entries, which start loading at once; returns them */
export function loadBodyMaps(tc, b, aniso = 0) {
  if (b.tex) return b.tex;
  const m = b.maps;
  b.tex = {
    day: tc.get(m.day, { aniso }), night: tc.get(m.night, { aniso }), clouds: tc.get(m.clouds, { data: true, aniso }),
    data: tc.get(m.data, { data: true }), mask: tc.get(m.mask, { data: true, mip: false, clamp: true }),
    ring: tc.get(m.ring ?? b.rings?.tex, { data: true }),
  };
  return b.tex;
}

/**
 * Binds a body's maps to texture units 0–5 and sets its uniforms (and the view → body
 * matrix). b: from resolveBody; tc: the createTextures cache; extra: { toBody (9, column-major),
 * ring (the ring plane's normal in view space, or null), veil, dpr, time, aniso }.
 * The body's maps start loading the first time it is applied.
 */
export function applyBody(gl, u, tc, b, extra) {
  const { toBody, ring = null, veil = 0, dpr = 1, time = 0, aniso = 0 } = extra;
  const t = loadBodyMaps(tc, b, aniso);
  const ready = (e) => (e?.ready ? 1 : 0);
  const fr = b.frame;
  gl.uniform1i(u.uKind, b.k);
  gl.uniform3fv(u.uAir, b.air);
  gl.uniform3f(u.uAirP, b.atm.thick, b.atm.halo, b.atm.k);
  gl.uniform3fv(u.uFlat, b.flat);
  gl.uniform1f(u.uTex, ready(t.day));
  gl.uniform1f(u.uNightOn, ready(t.night));
  gl.uniform1f(u.uCloudMode, t.clouds ? ready(t.clouds) : b.cloud ? 2 : 0);
  gl.uniform1f(u.uTime, time);
  gl.uniform1f(u.uMie, b.mie);
  gl.uniform1f(u.uGlint, b.glint);
  gl.uniform1f(u.uNightGain, b.nightGain);
  gl.uniform1f(u.uGlow, b.glow);
  gl.uniform1f(u.uProc, b.proc);
  gl.uniform1f(u.uSeed, b.seed);
  gl.uniform1f(u.uDetail, t.data && fr ? 1 : 0);
  gl.uniform1f(u.uVeil, veil);
  gl.uniform1f(u.uDpr, dpr);
  gl.uniform1f(u.uLon0, fr ? fr.lon0 * DEG : 0);
  gl.uniform3fv(u.uCapB, fr?.capB ?? [0, 0, 1]);
  gl.uniform3fv(u.uAerE, fr?.aerE ?? [1, 0, 0]);
  gl.uniform3fv(u.uAerN, fr?.aerN ?? [0, 1, 0]);
  gl.uniform3fv(u.uAerial, fr?.aerial ?? [1, 0.5, 0.5]);
  gl.uniform4fv(u.uStorm, b.storm);
  gl.uniform4fv(u.uOvals, b.ovals);
  gl.uniform3fv(u.uBand1, b.bands[0]);
  gl.uniform3fv(u.uBand2, b.bands[1]);
  gl.uniform3fv(u.uBand3, b.bands[2]);
  gl.uniformMatrix3fv(u.uToBody, false, new Float32Array(toBody));
  const R = b.rings;
  if (R && ring) {
    gl.uniform4f(u.uRingP, ...norm(ring), 1);
    gl.uniform4f(u.uRingR, R.inner, R.outer, R.gain ?? 1.1, R.proc ? 1 : ready(t.ring));
    gl.uniform1f(u.uRingMode, R.proc ? 1 : 0);
  } else gl.uniform4f(u.uRingP, 0, 0, 1, 0);
  const units = [t.day, t.night, t.clouds, t.data, t.mask, t.ring];
  ['uDay', 'uNight', 'uClouds', 'uData', 'uMask', 'uRing'].forEach((name, i) => {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, units[i]?.tex ?? tc.black);
    gl.uniform1i(u[name], i);
  });
}

// ---- the screen-space layer ---------------------------------------------------------

/**
 * Draws whole worlds in screen space over a transparent canvas: each is a disc whose
 * relief, air and rings are cast per pixel, so it is round at any size. Returns null
 * where WebGL 2 or the shader is missing (the caller keeps its still pictures).
 *
 *   layer.define(id, spec)      a body (see resolveBody); its maps start loading on first draw
 *   layer.resize(w, h, dpr)     the drawing buffer, in CSS px × the caller's capped dpr
 *   layer.draw(items, time)     items, back to front: { id, cx, cy, r (device px), toBody
 *                               (column-major view → body), sun (view), ring (the ring plane's
 *                               normal in view, for a giant with rings), alpha, veil, dpr }
 *   layer.ready(id)             true once the body's day map is in (allReady: all its maps)
 *   layer.clear(), layer.onLoad (set a function), layer.gl
 */
export function createPlanetLayer(canvas) {
  let gl = null;
  try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' }); } catch { gl = null; }
  if (!gl) return null;
  // one program per kind of body (and one more for a world with a data map's fine detail:
  // shores, street webs), each compiled from the same source with only its own code in it
  const progs = {};
  const programFor = (kind, detail) => {
    const key = `${kind}${detail ? 'd' : ''}`;
    if (progs[key] !== undefined) return progs[key];
    try {
      const prog = compileProgram(gl, VS, fsSource(kind, detail));
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aCorner');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      progs[key] = { prog, vao, u: programUniforms(gl, prog) };
    } catch (error) {
      console.warn('[planet] no planet shader', error);
      progs[key] = null;
    }
    return progs[key];
  };
  if (!programFor(2, false)) return null;
  let onLoad = () => {};
  const tc = createTextures(gl, () => onLoad());
  const bodies = new Map();
  let W = 1, H = 1;
  return {
    get gl() { return gl; },
    set onLoad(f) { onLoad = f; },
    define(id, spec) {
      const b = resolveBody(spec);
      b.detail = !!(b.maps.data && b.frame);
      bodies.set(id, b);
    },
    ready(id) {
      const b = bodies.get(id);
      if (!b) return false;
      const t = loadBodyMaps(tc, b);
      return b.maps.day ? t.day.ready : true;
    },
    /** true once every one of the body's maps is in */
    allReady(id) {
      const b = bodies.get(id);
      if (!b) return false;
      return Object.values(loadBodyMaps(tc, b)).every((e) => !e || e.ready);
    },
    resize(w, h, dpr) {
      W = Math.max(1, Math.round(w * dpr));
      H = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      gl.viewport(0, 0, W, H);
    },
    clear() { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); },
    draw(items, time = 0) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      let cur = null;
      for (const it of items) {
        const b = bodies.get(it.id);
        if (!b) continue;
        const P = programFor(b.k, b.detail);
        if (!P) continue;
        if (P !== cur) {
          cur = P;
          gl.useProgram(P.prog);
          gl.bindVertexArray(P.vao);
          gl.uniform2f(P.u.uRes, W, H);
        }
        const u = P.u;
        applyBody(gl, u, tc, b, { toBody: it.toBody, ring: it.ring, veil: it.veil, dpr: it.dpr ?? 1, time });
        gl.uniform3f(u.uDisc, it.cx, it.cy, it.r);
        gl.uniform3fv(u.uSun, norm(it.sun));
        gl.uniform1f(u.uAlpha, it.alpha ?? 1);
        const ringed = !!(it.ring && b.rings);
        gl.uniform1f(u.uFrame, ringed ? Math.max(b.rings.outer * 1.02, 1.15) : b.atm.halo > 0 ? 1 + Math.min(b.atm.thick * 7, 0.5) : 1.02);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    },
  };
}
