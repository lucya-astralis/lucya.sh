import * as THREE from './vendor/three.bundle.min.js?v=20261031-leds';
import { gsap, ScrollTrigger } from './vendor/gsap.bundle.min.js';
import { createProceduralLaptop } from './laptop/ProceduralLaptop.js?v=20261031-leds';
import { createGltfLaptop } from './laptop/GltfLaptop.js?v=20261031-leds';
import { TIMELINE } from './intro.timeline.js?v=20261031-leds';
import { curve } from './curve.js?v=20261031-leds';

const SCREEN_URL = 'intro/boot-screen.webp?v=20261031-leds';
const FADE_MS = 1000;  // the fade in intro.css
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
  scene.environmentIntensity = 0.5;
  room.dispose();
  pmrem.dispose();

  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.8);
  rim.position.set(-40, 30, -50);
  const rim2 = new THREE.DirectionalLight(0xfff0e0, 1.0);
  rim2.position.set(50, 20, -30);
  scene.add(rim, rim2);
  return { scene, env, rims: [rim, rim2] };
}

/** One curve per number, each through the keyframes that set it. A key that leaves a
 *  channel out does not touch it, so nothing is made to wait at a key. */
function channels(keyframes) {
  const knots = {};
  const add = (name, at, value) => { (knots[name] ||= []).push([at, value]); };
  const addVec = (name, at, vec) => vec?.forEach((v, i) => add(`${name}${i}`, at, v));
  for (const key of keyframes) {
    addVec('camPos', key.at, key.camera?.pos);
    addVec('camTarget', key.at, key.camera?.target);
    addVec('camUp', key.at, key.camera?.up);
    addVec('rot', key.at, key.laptop?.rot);
    addVec('pos', key.at, key.laptop?.pos);
    for (const name of ['hinge', 'fit', 'power', 'light']) {
      if (key[name] !== undefined) add(name, key.at, key[name]);
    }
  }
  return Object.entries(knots).map(([name, list]) => [name, curve(list)]);
}

// files behind the bar: glTF, buffer, the model's textures and the display picture
const EXPECTED_FILES = 11;

export async function runIntro(cover, { skip, leave, load, report }) {
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
  THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
    report(loaded / Math.max(total, EXPECTED_FILES));
  };
  const texture = await loadTexture(renderer);

  const { scene, env, rims } = buildScene(renderer);
  const lightFull = { env: scene.environmentIntensity, rims: rims.map((rim) => rim.intensity) };
  // the placeholder needs no files, so it doubles as the fallback
  const laptop = TIMELINE.model === 'gltf'
    ? await createGltfLaptop(texture, env.texture).catch((err) => {
      console.warn('laptop model failed, using the placeholder:', err);
      return createProceduralLaptop(texture);
    })
    : createProceduralLaptop(texture);
  THREE.DefaultLoadingManager.onProgress = undefined;
  // skipped while it was still loading
  if (!cover.isConnected) {
    laptop.dispose();
    env.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return;
  }
  const rig = laptop.root;
  scene.add(rig);

  const camera = new THREE.PerspectiveCamera(TIMELINE.fov, 1, 2, 600);

  // The display's own light, falling on the keys as it wakes: a cone aimed down
  // from the panel, so the glass in front of it catches no highlight of its own.
  const glow = new THREE.SpotLight(0xc4d4ff, 0, 0, 1.1, 0.8, 1);
  scene.add(glow, glow.target);

  const curves = channels(TIMELINE.keyframes);
  const state = {};
  const pose = (t) => { for (const [name, at] of curves) state[name] = at(t); };
  pose(0);
  const tl = gsap.timeline({ paused: true });
  const driver = { t: 0 };
  tl.to(driver, { t: 1, duration: 1, ease: 'none', onUpdate: () => pose(driver.t) });

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

    laptop.screenPose(screenC, screenN, fitUp);
    glow.position.copy(screenC).addScaledVector(screenN, 3);
    glow.target.position.copy(screenC).addScaledVector(screenN, 14).addScaledVector(fitUp, -16);
    glow.target.updateMatrixWorld();
    glow.intensity = TIMELINE.glow * state.power;
    scene.environmentIntensity = lightFull.env * state.light;
    rims.forEach((rim, i) => { rim.intensity = lightFull.rims[i] * state.light; });

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
  load.remove();
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
  cover.append(canvas, scroller, hint, skip);

  // the panel navigation stands down while is-scrolllock is set (loader.js sets it)
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
  skip.removeEventListener('click', leave);
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
    if (laptop.setLeds(ms / 1000)) dirty = true;
    // rAF already stops in a hidden tab; past the idle window nothing moves
    // unless the scrub or a light does, so there is no reason to draw
    if (!dirty && progress >= TIMELINE.idle.until) return;
    dirty = false;
    applyPose(ms / 1000);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);
}
