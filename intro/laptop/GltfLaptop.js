import {
  AdditiveBlending, Box3, CanvasTexture, GLTFLoader, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector3,
} from '../vendor/three.bundle.min.js?v=20261031-leds2';
import { Laptop } from './Laptop.js?v=20261031-leds2';

// Separate .gltf + .bin + .webp on purpose: a .glb's embedded images go through
// blob: URLs, which the site's CSP refuses.
const MODEL_URL = 'intro/laptop/cf-qv9/cf-qv9.gltf';
const METRES_TO_CM = 100;
const GRAIN_STRENGTH = 0.35;
const LED_GREEN = 0x4dff7c;
const LED_PITCH_M = 0.00635;
const LED_SIZE_M = 0.0019;
const LED_HALO_M = 0.016;
const LED_EDGE = 0.69;      // the deck's front edge, down the halo's picture

// disk activity: bursts of flicker with quiet stretches between them, never a pattern
const diskBusy = (t) => Math.sin(t * 1.7) + Math.sin(t * 2.9 + 1) > 0.7 && Math.floor(t * 13) % 3 !== 0;

/** The shell's grain, down far enough that its 2.4 cm tile does not show as a grid.
 *  Stickers and ink are the map's non-metal: they lie smooth on top of the paint. */
function paintShell(material) {
  material.normalScale.setScalar(GRAIN_STRENGTH);
  material.normalMap.anisotropy = 8;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      normal = normalize(mix(nonPerturbedNormal, normal, smoothstep(0.05, 0.2, metalnessFactor)));`,
    );
  };
}

function canvasTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const paintHalo = (ctx, size) => {
  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, 'rgba(255,255,255,.75)');
  fade.addColorStop(0.16, 'rgba(255,255,255,.26)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.clearRect(0, size * LED_EDGE, size, size);   // the light ends where the deck does
};

const paintCapsule = (ctx, size) => {
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(size * 0.2, 0, size * 0.6, size, size * 0.3);
  ctx.fill();
};

/** The status row under the wheel pad, left to right: battery, caps, numlock, disk, card.
 *  It is only printed on the deck; the two that light get a capsule of their own over
 *  the print. The battery light stays on, the disk light comes and goes. */
function statusLeds(scene) {
  scene.updateMatrixWorld(true);
  const first = new Box3().setFromObject(scene.getObjectByName('battery_led')).getCenter(new Vector3());
  scene.getObjectByName('battery_led').visible = false;
  const haloMap = canvasTexture(64, paintHalo);
  const capsuleMap = canvasTexture(32, paintCapsule);

  const light = (index) => {
    const at = new Vector3(first.x + index * LED_PITCH_M, first.y + 0.00002, first.z);
    const capsule = new Mesh(
      new PlaneGeometry(LED_SIZE_M, LED_SIZE_M),
      new MeshBasicMaterial({ map: capsuleMap, color: LED_GREEN, transparent: true, depthWrite: false, toneMapped: false }),
    );
    const halo = new Mesh(
      new PlaneGeometry(LED_HALO_M, LED_HALO_M),
      new MeshBasicMaterial({
        map: haloMap, color: LED_GREEN, blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: 0,
      }),
    );
    for (const lying of [capsule, halo]) {
      lying.rotation.x = -Math.PI / 2;
      lying.position.copy(at);
    }
    halo.position.y -= 0.00001;
    scene.getObjectByName('base').add(capsule, halo);
    return { capsule, halo };
  };
  const battery = light(0);
  const disk = light(3);

  return {
    blink: diskBusy,
    show(open, on) {
      battery.halo.material.opacity = open;
      disk.halo.material.opacity = on ? open : 0;
      disk.capsule.visible = on;
    },
  };
}

/** The modelled CF-QV9 (see tools/laptop). The file is in metres, the intro in
 *  centimetres, so the root carries the scale; hinge values stay in model units.
 *  @param screenTexture sRGB texture shown on the display
 *  @param envMap environment map for the glass around the display */
export async function createGltfLaptop(screenTexture, envMap) {
  const { scene } = await new GLTFLoader().loadAsync(MODEL_URL);
  const node = (name) => {
    const found = scene.getObjectByName(name);
    if (!found) throw new Error(`model has no node "${name}"`);
    return found;
  };

  // The exported plane does not follow the Laptop contract (+z out, +y image
  // up), so it is swapped for a plane in the same spot built that way round.
  const lid = node('lid');
  const placeholder = node('screen');
  placeholder.geometry.computeBoundingBox();
  const bounds = placeholder.geometry.boundingBox;
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3()).add(placeholder.position);
  placeholder.removeFromParent();
  placeholder.geometry.dispose();
  placeholder.material.dispose();

  const screen = new Mesh(
    new PlaneGeometry(size.x, size.z),
    // unlit: the picture alone, so its black meets the boot splash clean
    new MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
  );
  screen.userData.size = { width: size.x * METRES_TO_CM, height: size.z * METRES_TO_CM };
  screen.rotation.x = Math.PI / 2;
  screen.position.copy(center);
  lid.add(screen);

  // Legends and prints are read at a slant. The black glass gets its own, dim
  // reflections: at the scene's strength it greys out against the panel.
  scene.traverse((part) => {
    if (part.material?.map) part.material.map.anisotropy = 8;
    if (part.material?.name.startsWith('magnesium paint')) paintShell(part.material);
    if (part.material?.name === 'bezel glass') {
      part.material.envMap = envMap;
      part.material.envMapIntensity = 0.12;
    }
  });

  const [y, z, link] = node('laptop').userData.hinge;
  const laptop = new Laptop({
    base: node('base'), lidPivot: node('lidPivot'), lid, screen,
    hinge: { y, z, link },
    links: [node('hingeLinkL'), node('hingeLinkR')],
    leds: statusLeds(scene),
  });
  laptop.root.scale.setScalar(METRES_TO_CM);
  return laptop;
}
