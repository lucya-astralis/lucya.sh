import * as THREE from './vendor/three.bundle.min.js';
import { gsap, ScrollTrigger } from './vendor/gsap.bundle.min.js';
import { createProceduralLaptop } from './laptop/ProceduralLaptop.js?v=20261030-real';
import { createGltfLaptop } from './laptop/GltfLaptop.js?v=20261030-real';
import { TIMELINE } from './intro.timeline.js?v=20261030-real';

const SCREEN_URL = 'intro/screen.webp?v=20261030-real';
const VEC_KEYS = ['camPos', 'camTarget', 'camUp', 'rot', 'pos'];
const QUIET_MS = 300; // at least the fade in intro.css

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
    rot: [0, 0, 0], pos: [0, 0, 0], hinge: 0, fit: 0,
  };
  const read = (key, into) => {
    if (key.camera?.pos) into.camPos = key.camera.pos;
    if (key.camera?.target) into.camTarget = key.camera.target;
    if (key.camera?.up) into.camUp = key.camera.up;
    if (key.laptop?.rot) into.rot = key.laptop.rot;
    if (key.laptop?.pos) into.pos = key.laptop.pos;
    if (key.hinge !== undefined) into.hinge = key.hinge;
    if (key.fit !== undefined) into.fit = key.fit;
  };
  read(keyframes[0], state);
  const flat = {};
  const put = (from, out) => {
    for (const k of VEC_KEYS) from[k].forEach((v, i) => { out[`${k}${i}`] = v; });
    out.hinge = from.hinge;
    out.fit = from.fit;
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

const waitForBoot = () => new Promise((resolve) => {
  if (document.body.classList.contains('is-ready')) resolve();
  else window.addEventListener('lucya:ready', resolve, { once: true });
});

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
    rig.updateMatrixWorld(true);

    camPos.set(state.camPos0, state.camPos1, state.camPos2);
    camTarget.set(state.camTarget0, state.camTarget1, state.camTarget2);
    camUp.set(state.camUp0, state.camUp1, state.camUp2).normalize();

    const aspect = width / height;
    camPos.sub(camTarget).multiplyScalar(Math.max(1, TIMELINE.minAspect / aspect)).add(camTarget);

    if (state.fit > 0) {
      // cover: the plane must overfill both axes, so the tighter one decides
      const dist = Math.min(screenSize.y, screenSize.x / aspect) / (2 * tanHalf);
      laptop.screenPose(screenC, screenN, fitUp);
      // A wide viewport crops the plane vertically. Crop from the bottom: the
      // page's nav sits at the top edge, so it lines up with the real one.
      const visible = 2 * dist * tanHalf;
      screenC.addScaledVector(fitUp, (screenSize.y - visible) / 2);
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

  // Shader compile and texture upload happen here, under the splash, so the
  // first scroll does not stall on them.
  resize();
  applyPose(0);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  await waitForBoot();

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
    root.classList.remove('is-scrolllock');
    cover.remove();
    document.querySelector('link[href^="intro/intro.css"]')?.remove();
    laptop.dispose();
    env.dispose();
    scene.environment = null;
    renderer.dispose();
    renderer.forceContextLoss();
  }

  // Trackpad momentum outlives the intro. The faded overlay stays in place
  // until the wheel goes quiet, or the tail of the gesture would scroll or flip
  // the first panel the moment it appears.
  function teardownWhenQuiet() {
    let timer;
    const release = () => {
      window.removeEventListener('wheel', onWheel);
      clearTimeout(cap);
      teardown();
    };
    const onWheel = () => { clearTimeout(timer); timer = setTimeout(release, QUIET_MS); };
    const cap = setTimeout(release, 1500);
    timer = setTimeout(release, QUIET_MS);
    window.addEventListener('wheel', onWheel, { passive: true });
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
    cover.classList.add('is-leaving');
    teardownWhenQuiet();
  }

  const onKey = (e) => { if (e.key === 'Escape') finish(); };
  // Tabbing into the page behind means the visitor is done with the intro. The
  // boot's skip button is the exception: the same click that ended the boot
  // focuses it right after this runs.
  const onFocusIn = (e) => {
    if (e.target.closest?.('#splash')) scroller.focus({ preventScroll: true });
    else if (!cover.contains(e.target)) finish();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('focusin', onFocusIn);
  skip.addEventListener('click', finish);

  // mpage.js swipes pages from document-level touch listeners
  for (const type of ['touchstart', 'touchend']) {
    cover.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }

  const [fadeFrom, fadeTo] = TIMELINE.fade;
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
    const fade = Math.min(1, Math.max(0, (progress - fadeFrom) / (fadeTo - fadeFrom)));
    canvas.style.opacity = String(1 - fade);
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
