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
 *   - the air: real single scattering along each line of sight, Rayleigh and Mie, so
 *     the limb is a thin blue line falling off into black, the sun's light reaches
 *     the ground reddened by its path, and the planet's shadow lies in the air;
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
vec4 equiB(sampler2D t, vec3 nb, float lon0, float blur){
  float lon = atan(nb.y, nb.x), lat = asin(clamp(nb.z, -1.0, 1.0));
  vec2 uv = vec2(fract((lon - lon0) / TAU + 0.5), 0.5 - lat / PI);
  vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dx = dFdx(uv), dy = dFdy(uv), dx2 = dFdx(uv2), dy2 = dFdy(uv2);
  if (dot(dx2, dx2) + dot(dy2, dy2) < dot(dx, dx) + dot(dy, dy)) { dx = dx2; dy = dy2; }
  return textureGrad(t, uv, dx * blur, dy * blur);
}
vec4 equi(sampler2D t, vec3 nb, float lon0){ return equiB(t, nb, lon0, 1.0); }
vec3 turnLon(vec3 n, float a){ float c = cos(a), s = sin(a); return vec3(c * n.x - s * n.y, s * n.x + c * n.y, n.z); }
`;

const GLSL_RINGGEO = `
// Henyey-Greenstein phase function (unnormalised): g > 0 scatters forward
float hgp(float g, float c){ float g2 = g * g, d = 1.0 + g2 - 2.0 * g * c; return (1.0 - g2) / (d * sqrt(d)); }
// what a ring plane (normal N) looks like from here, for the star at sun and a viewer toward v:
// (mu0, mu: the slant cosines of the light and the sight, the dust's phase function, 1 on the lit face).
// It is the same everywhere on a flat ring seen in parallel, so a vertex shader can compute it once.
vec4 ringGeo(vec3 sun, vec3 N, vec3 v){
  float cosT = dot(-sun, v);                                      // 1: looking toward the star through it
  float ph = 0.5 * (hgp(0.65, cosT) + hgp(-0.25, cosT));          // dust: a forward lobe, a mild back lobe
  return vec4(max(abs(dot(sun, N)), 0.02), max(abs(dot(v, N)), 0.02), ph, dot(sun, N) * dot(v, N) > 0.0 ? 1.0 : 0.0);
}
`;

// the light: explicit arguments only, no uniforms, so anything can call it
const GLSL_LIGHT = `
// The limb colour the recipe is tuned for. Another body's air tints the same
// recipe by its own colour; the warm terminator band and the amber back-rim stay.
const vec3 AIR0 = vec3(0.35, 0.6, 1.0);
vec3 airTint(vec3 air){ return air / max(max(air.r, air.g), max(air.b, 1e-4)) / AIR0; }

// The air, as air: single scattering along the line of sight (Nishita 1993; the same
// integral as GPU Gems 2 ch. 16 and Scratchapixel's sky). Rayleigh takes the blue out of
// the light and throws it to the side, so the limb is a thin blue line that falls off into
// black; what comes through a long path is what is left, orange. Nothing here is painted.
// One sample of the sun's path per step, closed form: Schueler's Chapman approximation
// (GPU Pro 3), which also puts the planet's own shadow in the air.
const vec3 RAYLEIGH = vec3(0.175, 0.41, 1.0);             // 680, 550, 440 nm, as lambda^-4
const float AIR_TAU = 0.14;                                // an Earth's vertical optical depth in blue
const float AIR_SUN = 34.0;                                // the star's light, in the display's units
const float MIE_G = 0.78;
const int AIR_STEPS = 6;                                   // each side of the point nearest the ground

float airH(float thick){ return thick * 0.32; }            // a body's "thick" is a look; this is its scale height
vec3 airBeta(vec3 air, float H, float k){
  vec3 g = airTint(air);
  vec3 t = RAYLEIGH * g * g;                               // another air scatters its own colour, not a paler blue
  return t / max(t.b, max(t.r, t.g)) * AIR_TAU * k / H;
}
// the air in a column, in scale heights, from h (scale heights up) toward a light at cos chi
float chapman(float X, float h, float c){
  float a = sqrt(X + h);
  if (c >= 0.0) return a / (a * c + 1.0) * exp(-h);
  float x0 = sqrt(max(1.0 - c * c, 0.0)) * (X + h);
  float c0 = sqrt(x0);
  return 2.0 * c0 * exp(min(X - x0, 40.0)) - a / (1.0 - a * c) * exp(-h);
}
// what is left of the star's light at the ground, for the sun at cos chi = day
vec3 orkSunT(float day, vec3 air, float thick, float k, float mie){
  if (k <= 0.0) return vec3(1.0);
  float H = airH(thick);
  vec3 b = airBeta(air, H, k);
  float m = mie * 0.3 * AIR_TAU * k / H;
  return exp(-(b + m * 0.2) * H * chapman(1.0 / H, 0.0, day) * 1.8);   // a touch more than the integral: the orange should read
}
// The air along a ray, in radii from the body's centre: ro near the body, rd its direction,
// tHit where it meets the ground (a large number if it misses). Returns the light it adds,
// premultiplied, a: what it dims behind it; T: what comes through.
vec4 orkAir(vec3 ro, vec3 rd, float tHit, vec3 sun, vec3 air, float thick, float k, float mie, float amount, out vec3 T){
  T = vec3(1.0);
  float H = airH(thick);
  float top = 1.0 + 7.0 * H;
  float b = dot(ro, rd), disc = b * b - dot(ro, ro) + top * top;
  if (disc <= 0.0 || k <= 0.0) return vec4(0.0);
  float s = sqrt(disc), tA = -b - s, tB = min(-b + s, tHit);
  if (tB <= tA) return vec4(0.0);
  // a grazing ray has all its air at one point on a long chord: the steps crowd toward it
  float tc = clamp(-b, tA, tB);
  vec3 betaR = airBeta(air, H, k);
  float betaM = mie * 0.3 * AIR_TAU * k / H;
  float X = 1.0 / H, odR = 0.0, odM = 0.0;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float n = float(AIR_STEPS);
  for (int i = 0; i < 2 * AIR_STEPS; i++) {
    bool first = i < AIR_STEPS;
    float x = first ? (n - float(i) - 0.5) / n : (float(i) - n + 0.5) / n;
    float e = first ? tA : tB;
    float t = tc + (e - tc) * x * x * x;
    float ds = abs(e - tc) * 3.0 * x * x / n;
    if (ds < 1e-6) continue;
    vec3 P = ro + rd * t;
    float r = length(P);
    float h = max(r - 1.0, 0.0) / H;
    float rho = exp(-h), rhoM = exp(-h * 5.0);
    odR += rho * ds * 0.5;
    odM += rhoM * ds * 0.5;
    float col = chapman(X, h, dot(P, sun) / r) * H;
    vec3 tr = exp(-(betaR * (odR + col) + betaM * (odM + col * 0.2)));
    sumR += rho * tr * ds;
    sumM += rhoM * tr * ds;
    odR += rho * ds * 0.5;
    odM += rhoM * ds * 0.5;
  }
  vec3 tau = betaR * odR + betaM * odM;
  T = exp(-tau);
  float c = dot(rd, sun);
  vec3 L = sumR * betaR * 0.0597 * (1.0 + c * c) + sumM * betaM * min(hgp(MIE_G, c), 16.0) * 0.0796;
  L = 1.0 - exp(-L * AIR_SUN * amount);
  return vec4(L, 1.0 - dot(T, vec3(0.3333)));
}


// One tone curve for every body: linear up to a knee, then a soft shoulder, so a
// glint or a sunlit cloud never clips to a flat white and nothing needs its own exposure.
vec3 orkTone(vec3 c){
  vec3 over = max(c - 0.85, 0.0);
  return min(c, vec3(0.85)) + 0.15 * (1.0 - exp(-over / 0.15));
}

// shL, shD: light a parent body reflects onto this one (planetshine): colour times strength, and the direction to it.
// A world with air. n: the smooth normal, nl: the one the ground's relief gives
// the light; v: toward the viewer. wet: how much of the point is open water;
// c: cloud cover, cs: cloud over the ground the star lights, cv: the cloud's own
// variation. gl3: the glints of glass and rooftops (spark, sheen, glass), lights:
// what the night side shows here, before the night's own fade.
// air: the colour the air scatters (Rayleigh: blue for N2/O2, tan for CO2 and dust);
// airK: how thick it is (1: an Earth's worth); mie: the share of dust and haze that
// scatters forward instead, in white; thick: its height. The air between here and the
// viewer is orkAir's; what this keeps of it is the star's light as it arrives, reddened.
vec3 orkTerrestrial(vec3 albedo, vec3 n, vec3 nl, vec3 sun, vec3 v,
                    float wet, float c, float cs, float cv, vec3 gl3, vec3 lights,
                    vec3 air, float airK, float mie, float thick, vec3 shL, vec3 shD){
  float day = dot(n, sun);
  float k = clamp(airK, 0.05, 1.5);
  // the terminator is as soft as the air is thick: scattered light carries past it
  float dayK = smoothstep(-0.06 * k, 0.04 + 0.18 * k, day);
  vec3 sunT = orkSunT(max(day, -0.2), air, thick, airK, mie);
  vec3 T = airTint(air);
  vec3 A = T * vec3(0.32, 0.56, 0.97);                 // what the air scatters, in the recipe's own units
  float w = 0.06 * k;
  float lam = max((dot(nl, sun) + w) / (1.0 + w), 0.0) * smoothstep(-0.1, 0.02, day + 0.06 * k);
  vec3 col = albedo * (0.02 + 1.25 * lam * sunT) * (1.0 - 0.55 * cs * (1.0 - c)) + vec3(0.004, 0.009, 0.024) * (1.0 - dayK);
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
    col += wet * (1.0 - c) * (vec3(1.0, 0.93, 0.8) * sunT * spec * dayK + A * F * 0.55 * (0.05 + 0.75 * max(day, 0.0)) * dayK);
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
  col = mix(col, vec3(0.95, 0.96, 1.0) * orkSunT(day + 0.03, air, thick, airK, mie) * cl * (0.45 + 0.55 * cv), c);
  float night = 1.0 - smoothstep(-0.02, 0.3, day);
  col += lights * night;
  col += vec3(0.05, 0.06, 0.08) * c * night;
  col += albedo * shL * max(dot(nl, shD), 0.0) * (1.0 - 0.7 * c);       // the parent's light, on the night side too
  return col;
}

// Rock without air: the Moon's own law, not Lambert. Lommel-Seeliger (the light a
// dusty regolith returns) keeps the disc flat out to the limb, and it brightens
// toward opposition, when the star is behind the viewer. The terminator is
// knife-sharp. What the ground itself emits (lava) glows through the night;
// glow is how much of it shows by day.
vec3 orkRock(vec3 albedo, vec3 emit, float glow, vec3 n, vec3 nl, vec3 sun, vec3 v, vec3 shL, vec3 shD){
  float day = dot(n, sun);
  float mu = max(dot(n, v), 0.0);
  float mu0 = max(dot(nl, sun), 0.0) * smoothstep(0.0, 0.05, day);
  float ls = 2.0 * mu0 / (mu0 + mu + 0.04);
  float g = acos(clamp(dot(sun, v), -1.0, 1.0));               // the phase angle
  float surge = 1.0 + 0.4 * exp(-g * 8.0);
  float L = mix(mu0, ls, 0.75) * surge;
  return albedo * (0.012 + 1.15 * L + shL * max(dot(nl, shD), 0.0)) + emit * (glow + (1.0 - glow) * (1.0 - smoothstep(-0.1, 0.25, day)));
}

// A giant: Lambert under heavy limb darkening, soft over the terminator (the deck
// is deep), the rings' shadow (shade) across the bands, a thin haze at the lit limb.
vec3 orkGas(vec3 albedo, vec3 n, vec3 sun, vec3 v, float shade, vec3 air, float airK){
  float day = dot(n, sun);
  float mu = max(dot(n, v), 0.0);
  float lam = max((day + 0.1) / 1.1, 0.0);
  vec3 col = albedo * (0.025 + lam) * pow(mu, 0.35) * shade;
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
vec4 orkRingG(vec3 rgb, float alpha, vec4 g, vec3 sun, vec3 P, float gain){
  // g: ringGeo's (mu0, mu, phase, lit face). alpha is the ring's opacity face-on; its optical depth is
  // -ln(1 - alpha), and the light takes the slant path 1/mu through it
  float tau = -log(1.0 - min(alpha, 0.97)) * 0.6;       // the ring map's opacity is for a thicker sheet than these
  float mu0 = g.x, mu = g.y, ph = g.z;
  float e0 = exp(-tau / mu0), e1 = exp(-tau / mu);      // the slant transmittances, toward the star and toward us
  float I;
  if (g.w > 0.5) {
    // the lit face: single scattering off a layer of optical depth tau (rgb is the particles' albedo)
    I = 0.38 * mu0 / (mu0 + mu) * (1.0 - e0 * e1) * ph;     // 0.38: single scattering is 0.25, multiple scattering in a dense ring adds the rest
  } else {
    // the far face: only what leaks through, bright when the star is behind it
    float d = mu0 - mu;
    float tr = abs(d) < 1e-3 ? tau / mu0 * e0 : mu0 / d * (e0 - e1);
    I = 0.38 * tr * ph;
  }
  // the planet's shadow, cast along the ray to the star, with the star's disc blurring its edge
  float t = -dot(P, sun);
  float dmin = t > 0.0 ? length(P + sun * t) : length(P);
  float w = 0.03 * max(t, 0.0) + 0.012;
  float sh = mix(0.06, 1.0, smoothstep(1.0 - w, 1.0 + w, dmin));
  sh *= 1.0 + 0.05 * cos(2.0 * atan(P.y, P.x) + 0.7);              // the A ring is a little brighter on one side than the other (self-gravity wakes)
  // I/F to display units: a Lambert surface of albedo A shows A * 1.25 * mu0, and returns I/F = A * mu0 / pi
  return vec4(orkTone(rgb * 0.9 * I * 3.9269908 * gain * sh), 1.0 - e1);   // 0.9: slightly dirty water ice
}
vec4 orkRing(vec3 rgb, float alpha, vec3 sun, vec3 N, vec3 v, vec3 P, float gain){
  return orkRingG(rgb, alpha, ringGeo(sun, N, v), sun, P, gain);
}
`;

// the ring's profile, shared by the planet that casts it and the ring itself
const GLSL_RING = `
uniform vec4 uRingP;          // the ring plane's normal (view), on/off
uniform vec4 uRingR;          // inner, outer (radii), gain, 1 once the ring map is in
uniform sampler2D uRing;

// colour and opacity of the ring at rr radii (its radial profile is a baked map, see bakeRing)
vec4 ringAt(float rr){
  float t = (rr - uRingR.x) / (uRingR.y - uRingR.x);
  return texture(uRing, vec2(t, 0.5));
}
`;


// A giant's weather is drawn once, into an equirectangular map, and read like any other map: the
// per-pixel cost of a giant is then one more lookup, however fine the weather.
const GLSL_WEATHER = `
// A giant's weather as the Cassini and Juno cameras show one: mostly smooth, laminar zonal bands, each its
// own flat tone with a sharp edge and only a small step between neighbours; turbulence kept to a few narrow
// belts, where the edges ripple into thin festoons; a handful of small sharp ovals; a quiet darker pole.
// Noise is advected along the latitude circles (stretched many times longer than it is wide). Returns
// (brightness, warmth, pole, 0).
float zoneStep(float L, float n, float seed){
  float x = L * n;
  float id = floor(x), f = fract(x);
  float cur = hash(vec3(id, seed, 1.0)), prev = hash(vec3(id - 1.0, seed, 1.0));
  // flat inside a zone, a narrow ramp at its edge, a whisper of gradient across it
  return mix(prev, cur, smoothstep(0.0, 0.07, f)) + (f - 0.5) * 0.12 * (cur - 0.5);
}
float beltAt(float lat, float c, float w){ float d = (lat - c) / w; return exp(-d * d); }
vec4 gasWeather(vec3 p, float lat, float rpx, float time){
  float lon = atan(p.y, p.x);
  float fine = smoothstep(60.0, 150.0, rpx);
  // where the weather is: a few narrow belts
  float belts = max(max(beltAt(lat, 0.23, 0.05), beltAt(lat, -0.31, 0.045)), max(beltAt(lat, 0.50, 0.04), beltAt(lat, -0.66, 0.04)));
  // the edges ripple only in those belts: thin festoons
  float fest = belts * (0.012 * sin(lon * 13.0 + lat * 40.0) + 0.006 * sin(lon * 29.0 - lat * 70.0)) + 0.004 * sin(lon * 3.0 + lat * 5.0);
  float L = lat + fest;
  float t1 = zoneStep(L, 11.0, 1.0) - 0.5;             // the broad zones
  float t2 = zoneStep(L, 29.0, 2.0) - 0.5;             // finer ones, for a big disc
  float br = t1 * 0.30 + t2 * 0.12 * fine;
  float warm = t1 * 1.2;
  // noise advected along the latitude circles: long, thin, faint everywhere, stronger in the belts
  float adv = noise(vec3(p.x * 2.4, p.y * 2.4, p.z * 55.0)) - 0.5;
  float adv2 = noise(vec3(p.x * 6.0, p.y * 6.0, p.z * 130.0 + 7.0)) - 0.5;
  br += adv * 0.07 + belts * (adv * 0.22 + adv2 * 0.24 * fine);
  // thin bright and dark lines on the belts' edges
  float dl = L - 0.23 - 0.0;
  br += 0.22 * exp(-dl * dl / 0.00003) * fine - 0.12 * exp(-(dl + 0.018) * (dl + 0.018) / 0.00005) * fine;
  // a handful of small sharp ovals, in fixed places
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float la = (hash(vec3(fi, 11.0, 0.0)) - 0.5) * 1.7;
    float lo = hash(vec3(fi, 12.0, 0.0)) * TAU;
    float rx = 0.022 + 0.035 * hash(vec3(fi, 13.0, 0.0));
    float dlo = lon - lo;
    dlo -= TAU * floor((dlo + PI) / TAU);
    vec2 q = vec2(dlo * cos(la) / rx, (lat - la) / (rx * 0.55));
    float r = length(q);
    float core = 1.0 - smoothstep(0.72, 1.0, r);
    float rim = smoothstep(0.85, 1.0, r) * (1.0 - smoothstep(1.0, 1.35, r));
    float sg = hash(vec3(fi, 14.0, 0.0)) > 0.45 ? 1.0 : -1.0;
    br += (core * sg * 0.30 - rim * sg * 0.12) * mix(0.5, 1.0, fine);
    warm += core * -sg * 0.3;
  }
  // the pole: a quiet, darker cap with a little structure
  float pol = smoothstep(0.95, 1.22, abs(lat));
  if (pol > 0.0) {
    float ch = noise(vec3(p.x * 5.0, p.y * 5.0, p.z * 5.0) + 3.0) - 0.5;
    br = mix(br, ch * 0.25 - 0.1, pol);
  }
  return vec4(br, warm, pol, 0.0);
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
uniform vec4 uShine;          // planetshine: toward the parent (view), strength
uniform vec3 uShineCol;       // and its colour
uniform vec4 uOvals;          // a string of white ovals: first longitude, latitude, spacing, count
uniform vec3 uBand1, uBand2, uBand3;
uniform mat3 uToBody;         // view → the body's frame
uniform sampler2D uDay, uNight, uClouds, uData, uMask, uWeather, uCloudDetail, uZonal;
uniform float uZonalOn;       // 1 once the giant's zonal-mean colours are in
uniform float uWeatherOn;     // 1 once the weather map is baked
uniform float uCloudDetail1;  // how much of the baked cloud detail a world's clouds take, 0..1
uniform float uCalm;          // 1: an ice giant, smooth and hazy
uniform vec4 uShallow;        // a sea's shallow colour, and how far it shows toward the shores

// the winds, as radians of longitude a second of the visitor's time: + eastward
float winds(float lat){
  float l = abs(lat);
  return -0.0035 * exp(-pow(l / 0.38, 2.0)) + 0.0055 * exp(-pow((l - 0.82) / 0.26, 2.0)) - 0.002 * smoothstep(1.05, 1.35, l);
}
// a giant's jets: the bands slide against each other
float jets(float lat){ return 0.0022 * sin(lat * 9.0) * cos(lat * 0.5) + 0.0012 * exp(-pow(lat / 0.2, 2.0)); }

// The cloud map (full resolution; softer only toward the limb, where it is squeezed and would streak).
// cloudDir: where on the map this point reads, carried by the winds and a slow wandering warp.
vec3 cloudDir(vec3 nb, float time, out vec3 m, out vec3 w){
  float lat = asin(clamp(nb.z, -1.0, 1.0));
  m = turnLon(nb, -time * winds(lat));
  w = vec3(sin(time * 0.031 + nb.z * 11.0 + nb.y * 5.0), cos(time * 0.027 + nb.x * 9.0 - nb.z * 4.0), 0.0) * 0.006;
  return normalize(m + w);
}

// Cloud as an optical depth, not a coverage. From the map's coverage (sharp, and a wide soft one beside it) and a baked,
// tileable detail texture, a density: thick cores, a margin that breaks into wisps and holes, thin patches inside; the
// opacity is 1 - exp(-k density), so thin cloud is translucent and a thick core opaque, with no threshold anywhere.
// Brightness comes from the density and from a fake normal (the detail toward the star against the detail here: lumpy
// cumulus tops lit on the sunward side). Returns (opacity, brightness 0..1). On a small disc or at the limb the detail
// fades out and the plain map takes over.
vec2 cloudDensity(vec3 nb, vec3 q, float csun, float covS, float rpx, float mu, float blur){
  float lat = asin(clamp(nb.z, -1.0, 1.0));
  float amt = smoothstep(55.0, 170.0, rpx) * smoothstep(0.1, 0.45, mu) * (1.0 - smoothstep(1.0, 1.3, abs(lat)));
  if (uCloudDetail1 <= 0.0) {
    // no baked detail: the map's own density, translucent, with the lump lighting from the map itself
    if (rpx <= 55.0) return vec2(covS * 0.92, 0.5);
    float cw = equiB(uClouds, q, 0.0, blur * 4.0).r;
    float rho0 = 0.15 + 1.2 * covS;
    float opm = (1.0 - exp(-2.3 * rho0 * covS)) ;
    float lump0 = (cw - csun) * 0.9;
    return vec2(mix(covS * 0.92, opm, amt), clamp(0.35 + 0.4 * covS + lump0 * smoothstep(0.1, 0.9, cw), 0.0, 1.0));
  }
  if (amt <= 0.0) return vec2(covS * 0.92, 0.5);
  amt *= uCloudDetail1;
  float covW = equiB(uClouds, q, 0.0, blur * 6.0).r;
  float lon = atan(nb.y, nb.x);
  vec2 uv = vec2(lon / TAU * 6.0, lat / PI * 3.0 + 0.5);                   // a 512 tile is 60 degrees across
  float lod = log2(max(489.0 / (rpx * max(mu, 0.1)), 1.0));               // texels a pixel spans, from the disc size
  vec4 t = textureLod(uCloudDetail, uv, lod);
  float dm = 0.5 * t.g + 0.3 * t.r + 0.2 * t.b;
  float base = mix(covS, covW, 0.5);
  float rho = base * (0.2 + 1.7 * dm) + covW * (1.0 - covS) * max(t.b - 0.35, 0.0) * 1.6;
  float op = 1.0 - exp(-2.3 * rho);
  // the fake normal: more cloud toward the star than here means this is in a lump's shadow, less means it is its lit face
  // (csun is the soft cloud a little way toward the star: the same tap the ground's shadow needs)
  float lump = (covW - csun) * 0.9;
  float shade = clamp(0.3 + 0.45 * clamp(rho / 1.2, 0.0, 1.0) + lump * smoothstep(0.1, 0.9, covW) + (dm - 0.45) * 0.65 + (covS - covW) * 0.4, 0.0, 1.0);
  return vec2(mix(covS * 0.92, op, amt), mix(0.5, shade, amt));
}

// the same cloud, read once: the shadow does not need the re-forming blend
float cloudOnce(vec3 nb, float time){   // (soft: a shadow is)
  float lat = asin(clamp(nb.z, -1.0, 1.0));
  vec3 m = turnLon(nb, -time * winds(lat));
  vec3 w = vec3(sin(time * 0.031 + nb.z * 11.0 + nb.y * 5.0), cos(time * 0.027 + nb.x * 9.0 - nb.z * 4.0), 0.0) * 0.006;
  return smoothstep(0.1, 0.9, equiB(uClouds, normalize(m + w), 0.0, 2.0).r);
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
    if (uShallow.w > 0.0 && uTex > 0.5) {
      // a sea is deep in the middle and pale toward its shores: the map's own sea, blurred, says how far from one
      vec3 bl = equiB(uDay, nb, uLon0, 14.0).rgb;
      float seaB = smoothstep(0.0, 0.07, bl.b - max(bl.r, bl.g)) * (1.0 - smoothstep(0.4, 0.7, dot(bl, vec3(0.3, 0.55, 0.15))));
      albedo = mix(dayTex, uShallow.rgb, (1.0 - land) * (1.0 - seaB) * uShallow.w);
    }
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
    float mu_ = max(dot(n, v), 0.0);
    float rpx_ = 1.0 / pxr;
    float cblur = mix(1.0, 9.0, pow(1.0 - mu_, 3.0));
    vec3 cm, cw_;
    vec3 cq = cloudDir(nb, uTime, cm, cw_);
    float covS = equiB(uClouds, cq, 0.0, cblur).r;
    if (rpx_ <= 55.0) {
      // a small disc: the map as it is, re-forming (the soft, round-four look)
      float covB = equiB(uClouds, normalize(turnLon(cm, 0.012) - cw_), 0.0, cblur).r;
      covS = mix(covS, covB, 0.5 + 0.5 * sin(uTime * 0.013 + nb.x * 3.0));
    }
    float csun = rpx_ > 55.0 ? cloudOnce(normalize(nb + lb * 0.008), uTime) : 0.0;   // the soft cloud toward the star: shadow and lump shading both want it
    vec2 cd = cloudDensity(nb, cq, csun, covS, rpx_, mu_, cblur);
    c = clamp(cd.x, 0.0, 1.0);
    cv = cd.y;
    cs = rpx_ > 55.0 ? csun : c;   // the shadow falls a little way from it; on a small disc it is not seen
  }

  // a cloud is shaded by the cloud toward the star, and lit on its sun-facing edge
  cv = clamp(cv + 0.8 * (c - cs), 0.0, 1.0);

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
  return orkTerrestrial(albedo, n, nl, sun, v, wet * uGlint, c, cs, cv, gl3, lights, uAir, uAirP.z, uMie, uAirP.x, uShineCol * uShine.w * 1.25, uShine.xyz);
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
    nl = normalize(n - (t1 * grad.x + t2 * grad.y) * 0.006 * smoothstep(0.0, 0.35, n.z));   // not at the limb, where it only frizzes
  }
  return orkRock(alb, emit, uGlow, n, nl, sun, v, uShineCol * uShine.w * 1.25, uShine.xyz);
}

// ---- a giant ----------------------------------------------------------------------
vec3 shadeGas(vec3 n, vec3 sun, vec3 v, vec3 nb, float shade, float pxr){
  vec3 alb = uFlat;
  float glat = asin(clamp(nb.z, -1.0, 1.0));
  float jv = jets(glat);
  vec3 nd = nb;
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
      turb = fbm(vec3(gs.x * 2.0, gs.y * 16.0, gs.z * 2.0) + vec3(cos(swirl), sin(swirl), 0.0) * storm * 0.5, 4.0);
    } else {
      turb = fbm(vec3(gs.x * 2.0, gs.y * 16.0, gs.z * 2.0), 4.0);
    }
    float bb = lat * 7.0 + (turb - 0.5) * 0.9;
    alb = mix(uBand1, uBand2, smoothstep(0.25, 0.75, 0.5 + 0.5 * sin(bb * 3.1)));
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
    nd = turnLon(nb, -uTime * jv * (1.0 - 0.9 * uCalm));
    // the band map is painted, and mottled along every band: low-pass it along the latitude circles (its mean colour at this
    // latitude, taken once at load) so that the bands stay and the mottling goes; a little of the local colour is kept
    vec3 loc = equiB(uDay, nd, uLon0, 2.2).rgb;
    vec3 zm = uZonalOn > 0.5 ? texture(uZonal, vec2(0.5, 0.5 - glat / PI)).rgb : loc;
    alb = mix(zm, loc, 0.2);
    if (uCalm > 0.5) {
      // the map, blurred, and pulled toward its own mean: a hazy, almost uniform ball
      vec3 soft = equiB(uDay, nd, uLon0, 7.0).rgb, mean = equiB(uDay, nd, uLon0, 90.0).rgb;
      alb = mix(mean, soft, 0.45);
    }
  }
  float rpx = 1.0 / pxr;
  if (rpx > 28.0) {
    // the weather map, drifted by this latitude's own rate; it is stored as (brightness, warmth, pole) * 0.8 + 0.5
    vec3 wm = equi(uWeather, turnLon(nb, -uTime * jv * 4.0), 0.0).rgb;
    float amt = smoothstep(28.0, 70.0, rpx) * uWeatherOn;
    float wx = (wm.r - 0.5) * 1.25, wy = (wm.g - 0.5) * 1.25;
    amt *= mix(1.0, 0.18, uCalm);                           // an ice giant is nearly featureless
    alb *= 1.0 + wx * amt * 0.8;
    alb += vec3(0.04, 0.015, -0.05) * wy * amt * 0.5;
    alb = mix(alb, alb * vec3(0.7, 0.78, 0.92), wm.b * amt);
  }
  vec3 gas = orkGas(alb, n, sun, v, shade, uAir, uAirP.z * (1.0 + uCalm));
  if (uCalm > 0.5) {
    // methane haze: heavy limb darkening and a haze over the limb
    float hz = pow(1.0 - max(dot(n, v), 0.0), 2.4);
    gas = mix(gas * (1.0 - 0.35 * hz), uAir * (0.06 + 0.5 * max(dot(n, sun) + 0.1, 0.0)), hz * 0.5);
  }
  return gas;
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
  return orkTone(shadeGas(n, sun, v, nb, shade, pxr));
#else
  return vec3(0.0);
#endif
}

// How much of the planet's light a ring in the planet's own plane takes: 1 where
// nothing shades it. p: a point on the ball, in radii, view space; sun: toward the star.
float ringTauAt(float rr){ return (rr > uRingR.x && rr < uRingR.y) ? ringAt(rr).a : 0.0; }
float ringShadow(vec3 p, vec3 sun, float pxr_inv){
  if (uRingP.w < 0.5) return 1.0;
  float den = dot(sun, uRingP.xyz);
  if (abs(den) < 1e-4) return 1.0;
  float s = -dot(p, uRingP.xyz) / den;               // along the ray to the star, to the ring's plane
  if (s <= 0.0) return 1.0;
  float rr = length(p + sun * s);
  float w = 0.03 * s + 0.01;                         // the star's disc blurs the shadow's edge, radially
  float a = w * pxr_inv > 1.5 ? 0.5 * (ringTauAt(rr - 0.5 * w) + ringTauAt(rr + 0.5 * w)) : ringTauAt(rr);   // blur only where the blur spans pixels
  return max(pow(1.0 - min(a, 0.97), 1.0 / max(abs(den), 0.05)), 0.08);   // the light that gets through, on the slant
}
`;

/** noise, fbm, the equirectangular lookup, and the Orikaia light (orkTerrestrial, orkRock, orkGas, orkStar, orkAir, orkRing). No uniforms. */
export const PLANET_LIGHT_GLSL = GLSL_CORE + GLSL_RINGGEO + GLSL_LIGHT;
/** the above, plus the ring's uniforms and ringAt(rr): for a caller that draws the ring itself */
export const PLANET_RING_GLSL = PLANET_LIGHT_GLSL + GLSL_RING;
/** the whole body shading: uniforms (set them with applyBody) and planetColor(n, sun, v, nb, pxr, shade) */
export const PLANET_BODY_GLSL = PLANET_RING_GLSL + GLSL_BODY;

// ---- the screen-space layer's shaders ---------------------------------------------

const VS = `#version 300 es
${GLSL_RINGGEO}
in vec2 aCorner;
uniform vec2 uRes;          // the canvas, device px
uniform vec3 uDisc;         // centre x, y (device px, y down), radius (device px)
uniform float uFrame;       // the quad's half-size, in radii (rings and air reach past the disc)
out vec2 vP;                // in radii, y down
uniform vec3 uSun;
uniform vec4 uRingP;
flat out vec4 vG;           // the ring's light, once
void main(){
  vG = ringGeo(normalize(uSun), uRingP.xyz, vec3(0.0, 0.0, 1.0));
  vP = aCorner * uFrame;
  vec2 px = uDisc.xy + vP * uDisc.z;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const fsSource = (kind, detail) => `#version 300 es
#define KIND ${kind}
${detail ? '#define DETAIL 1' : '// no data map'}
precision highp float;
in vec2 vP;
flat in vec4 vG;
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
    float shade = ringShadow(n, sun, 1.0 / pxr);
#else
    float shade = 1.0;
#endif
    ball = vec4(planetColor(n, sun, v, nb, pxr, shade), 1.0) * edge;
    if (uKind >= 2 && uAirP.y > 0.0) {
      vec3 T;
      vec4 air = orkAir(vec3(vP, 0.0), -v, -n.z, sun, uAir, uAirP.x, uAirP.z, uMie, uAirP.y, T);
      ball.rgb = ball.rgb * T + air.rgb * edge;
    }
  }
  vec4 under = vec4(0.0);
  if (uKind >= 2 && uAirP.y > 0.0 && d > 1.0 - 1.5 * pxr) {
    // the air past the limb (and under the limb's own anti-aliased edge)
    vec3 T;
    under = orkAir(vec3(vP * max(d, 1.0) / max(d, 1e-4), 0.0), -v, 1e6, sun, uAir, uAirP.x, uAirP.z, uMie, uAirP.y, T);
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
      vec4 r = orkRingG(s.rgb, s.a, vG, sun, P, uRingR.z);
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

/**
 * How strongly a parent body lights its moon, relative to the star: the parent's albedo, its lit share as the
 * moon sees it, and its angular size (its radius over its distance, squared), for a Lambert sphere (2/3), with a
 * small perceptual gain (x1.5): a faint ghost on the night side, never a second sun.
 */
export function planetshine(albedo, litShare, radiusOverDistance) {
  return albedo * (2 / 3) * litShare * radiusOverDistance * radiusOverDistance * 1.5;
}

// draws a giant's weather into a 2048 x 1024 map (once per GL context) and gives it mipmaps
function bakeWeather(gl, black) {
  try {
    const W = 2048, H = 1024;
    const prog = compileProgram(gl, `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`, `#version 300 es
precision highp float;
${GLSL_CORE}
${GLSL_WEATHER}
uniform vec2 uSize;
out vec4 frag;
void main(){
  vec2 uv = gl_FragCoord.xy / uSize;
  float lon = (uv.x - 0.5) * TAU, lat = (0.5 - uv.y) * PI;
  vec3 p = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
  vec4 w = gasWeather(p, lat, 200.0, 0.0);
  frag = vec4(clamp(w.x * 0.8 + 0.5, 0.0, 1.0), clamp(w.y * 0.8 + 0.5, 0.0, 1.0), clamp(w.z, 0.0, 1.0), 1.0);
}`);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    const keep = { vp: gl.getParameter(gl.VIEWPORT), prog: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING), blend: gl.isEnabled(gl.BLEND) };
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('weather framebuffer');
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(prog);
    gl.uniform2f(gl.getUniformLocation(prog, 'uSize'), W, H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.deleteFramebuffer(fbo); gl.deleteProgram(prog);
    gl.viewport(...keep.vp);
    gl.useProgram(keep.prog);
    gl.bindVertexArray(keep.vao);
    if (keep.blend) gl.enable(gl.BLEND);
    return tex;
  } catch (error) {
    console.warn('[planet] no weather map', error);
    return null;
  }
}

// A ring system's radial profile, as a 4096 x 1 map: t = 0 at the inner edge, 1 at the outer. A translucent C ring
// of fine dark ringlets, a bright, dense B ring with a few thin gaps, a Cassini-type division, an A ring of
// finer structure with an Encke-type gap and a narrow one near the edge. rgb: the particles' albedo, a: the
// opacity looking straight down on the ring.
function bakeRing(gl) {
  const N = 4096;
  const data = new Uint8Array(N * 4);
  const h1 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const n1 = (x, seed) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i + seed) * (1 - u) + h1(i + 1 + seed) * u; };
  const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    // ringlets: many fine bands of varying density, at several scales
    const ring = 0.5 * n1(t * 140, 1) + 0.3 * n1(t * 420, 7) + 0.2 * n1(t * 1300, 13);
    let a, col;
    if (t < 0.2) {                                              // C ring: translucent, dark
      a = 0.10 + 0.20 * ring + 0.06 * n1(t * 60, 3);
      col = [0.62, 0.6, 0.58];
    } else if (t < 0.57) {                                      // B ring: dense and bright
      const k = (t - 0.2) / 0.37;
      a = 0.70 + 0.28 * (ring - 0.2) + 0.08 * Math.sin(k * 40);
      col = [0.99, 0.96, 0.91];
      a *= 1 - 0.7 * Math.exp(-Math.pow((t - 0.37) / 0.004, 2)) - 0.6 * Math.exp(-Math.pow((t - 0.47) / 0.003, 2));   // thin gaps
    } else if (t < 0.63) {                                      // the division, with a ringlet in it
      a = 0.05 + 0.05 * ring + 0.25 * Math.exp(-Math.pow((t - 0.597) / 0.004, 2));
      col = [0.6, 0.58, 0.56];
    } else {                                                    // A ring: finer, a little thinner
      a = 0.52 + 0.30 * (ring - 0.2) + 0.1 * n1(t * 900, 21);
      col = [0.92, 0.91, 0.9];
      a *= 1 - 0.95 * Math.exp(-Math.pow((t - 0.865) / 0.009, 2)) - 0.9 * Math.exp(-Math.pow((t - 0.945) / 0.003, 2));   // the Encke gap, a narrow one
    }
    // hundreds of faint ringlets over the whole profile: density and brightness
    const fine = 0.5 * n1(t * 1500, 41) + 0.3 * n1(t * 2600, 47) + 0.2 * n1(t * 420, 53) - 0.5;
    a *= 1 + 0.35 * fine;
    col = col.map((x) => x * (1 + 0.1 * fine));
    a *= ss(0.0, 0.012, t) * (1 - ss(0.975, 1.0, t));           // soft outer and inner edges
    a = Math.min(Math.max(a, 0), 0.97);
    data.set([col[0], col[1], col[2], a].map((x) => Math.min(Math.max(x * 255, 0), 255)), i * 4);
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

// A tileable 512 x 512 cloud-detail texture, drawn once: R fbm, G worley billows blended with a mid fbm, B a fine fbm.
// Everything wraps, so it tiles. Mipmapped.
function bakeCloudDetail(gl) {
  const N = 512;
  const data = new Uint8Array(N * N * 4);
  const hash = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
  const wrap = (i, g) => ((i % g) + g) % g;
  const vnoise = (u, v, g, seed) => {
    const x = u * g, y = v * g, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(wrap(ix, g), wrap(iy, g), seed), b = hash(wrap(ix + 1, g), wrap(iy, g), seed);
    const c = hash(wrap(ix, g), wrap(iy + 1, g), seed), d = hash(wrap(ix + 1, g), wrap(iy + 1, g), seed);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
  const fbm = (u, v, g0, oct, seed) => {
    let sum = 0, amp = 0.5, norm = 0, g = g0;
    for (let o = 0; o < oct; o++) { sum += amp * vnoise(u, v, g, seed + o); norm += amp; amp *= 0.5; g *= 2; }
    return sum / norm;
  };
  const worley = (u, v, g, seed) => {
    const x = u * g, y = v * g, ix = Math.floor(x), iy = Math.floor(y);
    let best = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = wrap(ix + i, g), cy = wrap(iy + j, g);
      const px = ix + i + hash(cx, cy, seed), py = iy + j + hash(cx, cy, seed + 5);
      best = Math.min(best, Math.hypot(px - x, py - y));
    }
    return Math.min(best, 1);
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N, k = (j * N + i) * 4;
      const r = fbm(u, v, 6, 5, 1);
      const billow = 1 - worley(u, v, 22, 3);
      const g = 0.15 * billow + 0.85 * fbm(u, v, 10, 4, 9);
      const b = fbm(u, v, 28, 4, 21);
      data[k] = r * 255; data[k + 1] = Math.min(Math.max((g - 0.15) * 1.5, 0), 1) * 255; data[k + 2] = b * 255; data[k + 3] = 255;
    }
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}

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
  let weather, ringMap, cloudDetail;
  const api = {
    /** the baked cloud-detail texture (see bakeCloudDetail) */
    cloudDetail() { return cloudDetail ?? (cloudDetail = bakeCloudDetail(gl)); },
    /** the baked ring-system profile (see bakeRing) */
    ring() { return ringMap ?? (ringMap = bakeRing(gl)); },
    black,
    onLoad,
    /** a giant's weather map, drawn on first call (call it before binding a program to draw with) */
    weather() { if (weather === undefined) weather = bakeWeather(gl, black); return weather; },
    get weatherReady() { return !!weather; },
    get(url, { data = false, mip = true, clamp = false, aniso = 0, zonal = false } = {}) {
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
        if (zonal) {
          // the mean colour of each row of the map (each latitude), as a 1 x H map
          try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            const x = c.getContext('2d');
            x.drawImage(img, 0, 0);
            const px = x.getImageData(0, 0, c.width, c.height).data;
            const rows = new Uint8Array(c.height * 4);
            for (let j = 0; j < c.height; j++) {
              let r = 0, g = 0, b = 0;
              for (let i = 0; i < c.width; i++) { const k = (j * c.width + i) * 4; r += px[k]; g += px[k + 1]; b += px[k + 2]; }
              rows.set([r / c.width, g / c.width, b / c.width, 255], j * 4);
            }
            const zt = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, zt);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, c.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rows);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            e.zonal = zt;
          } catch (error) { console.warn('[planet] no zonal mean', error); }
        }
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
 *   rings       { inner, outer, gain, proc }: radii of the giant; proc: stripes, not a map; gain: irradiance, 1 physical
 *   cloudDetail 0..1: how much of the baked fine cloud detail the clouds take (default 1; 0: the map's own density only)
 *   shallow     [r, g, b, k]: a sea's pale shore colour, on a world whose map has no depth (k: how far it shows)
 *   albedo, shine  a body's albedo and the colour it reflects onto its moons (item.parent names the body)
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
    albedo: spec.albedo ?? 0.45, shine: spec.shine ?? [0.62, 0.72, 0.92],
    cloudDetail: spec.cloudDetail ?? 1, calm: spec.calm ? 1 : 0, shallow: spec.shallow ?? [0, 0, 0, 0],
    glint: spec.glint ?? 1, nightGain: spec.nightGain ?? 1.9, glow: spec.glow ?? 0,
    frame: spec.frame ?? null, storm: spec.storm ?? [0, 0, 0, 0], ovals: spec.ovals ?? [0, 0, 0, 0],
    bands: spec.bands ?? [[0.58, 0.68, 0.86], [0.80, 0.84, 0.92], [0.36, 0.46, 0.68]],
    rings: spec.rings ?? null,
  };
}

/** makes (once) a body's map entries, which start loading at once; returns them */
export function loadBodyMaps(tc, b, aniso = 4) {
  if (b.tex) return b.tex;
  const m = b.maps;
  b.tex = {
    day: tc.get(m.day, { aniso, zonal: b.k === 3 }), night: tc.get(m.night, { aniso }), clouds: tc.get(m.clouds, { data: true }),          // read soft anyway: no anisotropic taps
    data: tc.get(m.data, { data: true }), mask: tc.get(m.mask, { data: true, mip: false, clamp: true }),
    detail: m.clouds ? { tex: tc.cloudDetail(), ready: true } : null,
    // a ring map of the body's own, or the baked profile
    ring: (m.ring ?? b.rings?.tex) ? tc.get(m.ring ?? b.rings?.tex, { data: true }) : (b.rings ? { tex: tc.ring(), ready: true } : null),
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
  const { toBody, ring = null, veil = 0, dpr = 1, time = 0, aniso = 4, shine = null } = extra;
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
  gl.uniform1f(u.uCalm, b.calm);
  gl.uniform1f(u.uCloudDetail1, b.cloudDetail);
  gl.uniform4fv(u.uShallow, b.shallow);
  gl.uniform4f(u.uShine, ...(shine ? [...shine.dir, shine.k] : [0, 0, 1, 0]));
  gl.uniform3fv(u.uShineCol, shine?.col ?? [0, 0, 0]);
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
    gl.uniform4f(u.uRingR, R.inner, R.outer, R.gain ?? 1, 1);
  } else gl.uniform4f(u.uRingP, 0, 0, 1, 0);
  gl.activeTexture(gl.TEXTURE8);
  gl.bindTexture(gl.TEXTURE_2D, t.day?.zonal ?? tc.black);
  gl.uniform1i(u.uZonal, 8);
  gl.uniform1f(u.uZonalOn, t.day?.zonal ? 1 : 0);
  gl.activeTexture(gl.TEXTURE7);
  gl.bindTexture(gl.TEXTURE_2D, t.detail?.tex ?? tc.black);
  gl.uniform1i(u.uCloudDetail, 7);
  gl.activeTexture(gl.TEXTURE6);
  gl.bindTexture(gl.TEXTURE_2D, b.k === 3 && tc.weatherReady ? tc.weather() : tc.black);
  gl.uniform1i(u.uWeather, 6);
  gl.uniform1f(u.uWeatherOn, b.k === 3 && tc.weatherReady ? 1 : 0);
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
  // a moon of another item in the same draw gets that body's light on its night side:
  // from the parent's direction, coloured by it, as strong as its disc is large and as full as the
  // moon sees it (the parent's lit share, from where the moon stands)
  const shineOf = (it, items) => {
    if (!it.parent) return null;
    const P = items.find((x) => x.id === it.parent);
    const pb = P && bodies.get(P.id);
    if (!pb) return null;
    const dx = P.cx - it.cx, dy = P.cy - it.cy, dz = it.parentZ ?? P.r * 2;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const dir = [dx / dist, dy / dist, dz / dist];
    const s = norm(it.sun);
    const lit = 0.5 * (1 - (dir[0] * s[0] + dir[1] * s[1] + dir[2] * s[2]));
    const ratio = Math.min(P.r / dist, 0.35);
    return { dir, k: planetshine(pb.albedo, lit, ratio), col: pb.shine };
  };
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
      if (items.some((it) => bodies.get(it.id)?.k === 3)) tc.weather();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      let cur = null;
      for (const it of items) {
        const b = bodies.get(it.id);
        if (!b || (it.alpha ?? 1) <= 0.002) continue;      // an invisible body (still a parent for its moons' light) costs nothing
        const P = programFor(b.k, b.detail);
        if (!P) continue;
        if (P !== cur) {
          cur = P;
          gl.useProgram(P.prog);
          gl.bindVertexArray(P.vao);
          gl.uniform2f(P.u.uRes, W, H);
        }
        const u = P.u;
        applyBody(gl, u, tc, b, { toBody: it.toBody, ring: it.ring, veil: it.veil, dpr: it.dpr ?? 1, time, shine: shineOf(it, items) });
        gl.uniform3f(u.uDisc, it.cx, it.cy, it.r);
        gl.uniform3fv(u.uSun, norm(it.sun));
        gl.uniform1f(u.uAlpha, it.alpha ?? 1);
        const ringed = !!(it.ring && b.rings);
        gl.uniform1f(u.uFrame, ringed ? Math.max(b.rings.outer * 1.02, 1.15) : b.atm.halo > 0 ? 1 + Math.min(b.atm.thick * 3.2, 0.5) : 1.02);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    },
  };
}
