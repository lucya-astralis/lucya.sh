import * as THREE from './vendor/three.bundle.min.js';
import { gsap, ScrollTrigger } from './vendor/gsap.bundle.min.js';
import { createProceduralLaptop } from './laptop/ProceduralLaptop.js?v=20261030-placed';
import { createGltfLaptop } from './laptop/GltfLaptop.js?v=20261030-placed';
import { TIMELINE } from './intro.timeline.js?v=20261030-placed';

const SCREEN_URL = 'intro/boot-screen.webp?v=20261030-placed';
const VEC_KEYS = ['camPos', 'camTarget', 'camUp', 'rot', 'pos'];
const FADE_MS = 600;  // the fade in intro.css
const SETTLE_MS = 700; // the wheel has to rest this long before the page takes it
const SETTLE_CAP_MS = 2500;

function loadTexture(renderer) {
  return new THREE.TextureLoader().loadAsync(SCREEN_URL).then((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  });
}

function buildScene(renderer) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.RoomEnvironment();
  // reflections only: scene.background stays empty, the canvas clears to #000
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.75;
  room.dispose();
  pmrem.dispose();

  const rim = new THREE.DirectionalLight(0xdfe8ff, 2.6);
  rim.position.set(-40, 30, -50);
  const rim2 = new THREE.DirectionalLight(0xfff0e0, 1.4);
  rim2.position.set(50, 20, -30);
  scene.add(rim, rim2);
  return { scene, env };
}

/** Flattens the keyframes into one start state plus a tween per segment. */
function flatten(keyframes) {
  const state = {
    camPos: [0, 0, 0], camTarget: [0, 0, 0], camUp: [0, 1, 0],
    rot: [0, 0, 0], pos: [0, 0, 0], hinge: 0, fit: 0, power: 0,
  };
  const read = (key, into) => {
    if (key.camera?.pos) into.camPos = key.camera.pos;
    if (key.camera?.target) into.camTarget = key.camera.target;
    if (key.camera?.up) into.camUp = key.camera.up;
    if (key.laptop?.rot) into.rot = key.laptop.rot;
    if (key.laptop?.pos) into.pos = key.laptop.pos;
    if (key.hinge !== undefined) into.hinge = key.hinge;
    if (key.fit !== undefined) into.fit = key.fit;
    if (key.power !== undefined) into.power = key.power;
  };
  read(keyframes[0], state);
  const flat = {};
  const put = (from, out) => {
    for (const k of VEC_KEYS) from[k].forEach((v, i) => { out[`${k}${i}`] = v; });
    out.hinge = from.hinge;
    out.fit = from.fit;
    out.power = from.power;
    return out;
  };
  put(state, flat);
  const running = { ...state };
  const segments = keyframes.slice(1).map((key, i) => {
    read(key, running);
    return {
      to: put(running, {}),
      start: keyframes[i].at,
      duration: key.at - keyframes[i].at,
      ease: key.ease,
    };
  });
  return { flat, segments };
}

export async function runIntro(cover) {
  const root = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'lintro__canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const coarse = matchMedia('(pointer: coarse), (max-width: 767.98px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  gsap.registerPlugin(ScrollTrigger);
  const texture = await loadTexture(renderer);

  const { scene, env } = buildScene(renderer);
  // the placeholder needs no files, so it doubles as the fallback
  const laptop = TIMELINE.model === 'gltf'
    ? await createGltfLaptop(texture, env.texture).catch((err) => {
      console.warn('laptop model failed, using the placeholder:', err);
      return createProceduralLaptop(texture, env.texture);
    })
    : createProceduralLaptop(texture, env.texture);
  const rig = laptop.root;
  scene.add(rig);

  const camera = new THREE.PerspectiveCamera(TIMELINE.fov, 1, 2, 600);

  // The display's own light, falling on the keys as it wakes: a cone aimed down
  // from the panel, so the glass in front of it catches no highlight of its own.
  const glow = new THREE.SpotLight(0xc4d4ff, 0, 0, 1.1, 0.8, 1);
  scene.add(glow, glow.target);

  const { flat, segments } = flatten(TIMELINE.keyframes);
  const state = flat;
  const tl = gsap.timeline({ paused: true, defaults: { ease: TIMELINE.ease } });
  for (const seg of segments) {
    if (seg.duration > 0) {
      tl.to(state, { ...seg.to, duration: seg.duration, ease: seg.ease || TIMELINE.ease }, seg.start);
    }
  }

  const v = () => new THREE.Vector3();
  const [camPos, camTarget, camUp, fitPos, fitUp, screenC, screenN] = [v(), v(), v(), v(), v(), v(), v()];
  const DEG = Math.PI / 180;
  let width = 1, height = 1;
  let dirty = true;
  let progress = 0;

  const screenSize = laptop.screenSize();
  const tanHalf = Math.tan((TIMELINE.fov * DEG) / 2);

  function applyPose(t) {
    const idleWeight = Math.max(0, 1 - progress / TIMELINE.idle.until);
    const wobble = idleWeight * TIMELINE.idle.rotDeg * DEG;
    const phase = (t / TIMELINE.idle.seconds) * Math.PI * 2;

    rig.position.set(state.pos0, state.pos1, state.pos2);
    rig.rotation.set(
      state.rot0 * DEG + wobble * Math.sin(phase) * 0.6,
      state.rot1 * DEG + wobble * Math.cos(phase * 0.7),
      state.rot2 * DEG,
    );
    laptop.setHinge(state.hinge);
    laptop.setPower(state.power);
    rig.updateMatrixWorld(true);

    // unsteady until the picture has settled, like a tube warming up
    const flicker = state.power < 1 ? 0.8 + 0.2 * Math.sin(t * 61) * Math.sin(t * 37) : 1;
    laptop.screenPose(screenC, screenN, fitUp);
    glow.position.copy(screenC).addScaledVector(screenN, 3);
    glow.target.position.copy(screenC).addScaledVector(screenN, 14).addScaledVector(fitUp, -16);
    glow.target.updateMatrixWorld();
    glow.intensity = TIMELINE.glow * state.power * flicker;

    camPos.set(state.camPos0, state.camPos1, state.camPos2);
    camTarget.set(state.camTarget0, state.camTarget1, state.camTarget2);
    camUp.set(state.camUp0, state.camUp1, state.camUp2).normalize();

    const aspect = width / height;
    camPos.sub(camTarget).multiplyScalar(Math.max(1, TIMELINE.minAspect / aspect)).add(camTarget);

    if (state.fit > 0) {
      // cover: the plane must overfill both axes, so the tighter one decides
      const dist = Math.min(screenSize.y, screenSize.x / aspect) / (2 * tanHalf);
      fitPos.copy(screenC).addScaledVector(screenN, dist);
      camPos.lerp(fitPos, state.fit);
      camTarget.lerp(screenC, state.fit);
      camUp.lerp(fitUp, state.fit).normalize();
    }

    camera.position.copy(camPos);
    camera.up.copy(camUp);
    camera.lookAt(camTarget);
  }

  function resize() {
    width = cover.clientWidth || window.innerWidth;
    height = cover.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    dirty = true;
  }

  // Shader compile and texture upload happen here, behind the black cover, so
  // the first scroll does not stall on them.
  resize();
  applyPose(0);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);


  // ---- DOM ----
  cover.classList.remove('lintro--cover');
  const scroller = document.createElement('div');
  scroller.className = 'lintro__scroller';
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  scroller.setAttribute('aria-label', 'Intro animation. Scroll to continue to the site.');
  const track = document.createElement('div');
  track.style.height = `${TIMELINE.scrollVh}vh`;
  scroller.append(track);
  const hint = document.createElement('div');
  hint.className = 'lintro__hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = 'Scroll ▼';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'lintro__skip';
  skip.textContent = 'Skip intro';
  cover.append(canvas, scroller, hint, skip);

  // the panel navigation stands down while this class is set
  root.classList.add('is-scrolllock');
  scroller.focus({ preventScroll: true });

  // ---- teardown ----
  let done = false;
  let raf = 0;

  function teardown() {
    cover.remove();
    document.querySelector('link[href^="intro/intro.css"]')?.remove();
    laptop.dispose();
    env.dispose();
    scene.environment = null;
    renderer.dispose();
    renderer.forceContextLoss();
  }

  // The scroll that landed the zoom is still going. Left alone it runs on into
  // the page and flips straight through every panel, so input stops here: the
  // lock holds through the boot and lifts once the wheel has rested on the
  // finished page. A new gesture after that is a deliberate one.
  function holdScroll() {
    let ready = false, timer;
    const release = () => {
      clearTimeout(timer);
      clearTimeout(cap);
      window.removeEventListener('wheel', stop, listen);
      window.removeEventListener('touchmove', stop, listen);
      window.removeEventListener('lucya:ready', onReady);
      root.classList.remove('is-scrolllock');
    };
    const rest = () => {
      clearTimeout(timer);
      if (ready) timer = setTimeout(release, SETTLE_MS);
    };
    const stop = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      rest();
    };
    let cap;
    const onReady = () => {
      ready = true;
      cap = setTimeout(release, SETTLE_CAP_MS);
      rest();
    };
    const listen = { capture: true, passive: false };
    window.addEventListener('wheel', stop, listen);
    window.addEventListener('touchmove', stop, listen);
    if (document.body.classList.contains('is-ready')) onReady();
    else window.addEventListener('lucya:ready', onReady, { once: true });
  }

  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('keydown', onKey);
    trigger.kill();
    tl.kill();
    // Fully zoomed in: the boot starts behind the canvas, which fades away over it.
    window.lucyaIntroDone();
    holdScroll();
    cover.classList.add('is-leaving');
    setTimeout(teardown, FADE_MS);
  }

  const onKey = (e) => { if (e.key === 'Escape') finish(); };
  // tabbing into the page behind means the visitor is done with the intro
  const onFocusIn = (e) => { if (!cover.contains(e.target)) finish(); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('focusin', onFocusIn);
  skip.addEventListener('click', finish);

  // mpage.js swipes pages from document-level touch listeners
  for (const type of ['touchstart', 'touchend']) {
    cover.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }

  const trigger = ScrollTrigger.create({
    scroller,
    trigger: track,
    start: 'top top',
    end: 'bottom bottom',
    animation: tl,
    scrub: TIMELINE.scrub,
  });
  tl.eventCallback('onUpdate', () => {
    progress = tl.progress();
    dirty = true;
    hint.classList.toggle('is-gone', progress > 0.02);
    if (progress >= 1) finish();
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(cover);

  function frame(ms) {
    raf = requestAnimationFrame(frame);
    // rAF already stops in a hidden tab; past the idle window nothing moves
    // unless the scrub does, so there is no reason to draw
    if (!dirty && progress >= TIMELINE.idle.until) return;
    dirty = false;
    applyPose(ms / 1000);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
}
