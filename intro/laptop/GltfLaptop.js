import { GLTFLoader, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from '../vendor/three.bundle.min.js';
import { Laptop } from './Laptop.js';

// Separate .gltf + .bin + .webp on purpose: a .glb's embedded images go through
// blob: URLs, which the site's CSP refuses.
const MODEL_URL = 'intro/laptop/cf-qv9/cf-qv9.gltf';
const METRES_TO_CM = 100;

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
  });
  laptop.root.scale.setScalar(METRES_TO_CM);
  return laptop;
}
