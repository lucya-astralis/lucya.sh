import { Color, GLTFLoader, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from '../vendor/three.bundle.min.js';
import { Laptop } from './Laptop.js';

// Separate .gltf + .bin + .webp on purpose: a .glb's embedded images go through
// blob: URLs, which the site's CSP refuses.
const MODEL_URL = 'intro/laptop/cf-qv9/cf-qv9.gltf';
const METRES_TO_CM = 100;

/** The modelled CF-QV9 (see tools/laptop). The file is in metres, the intro in
 *  centimetres, so the root carries the scale; hinge values stay in model units.
 *  @param screenTexture sRGB texture shown on the display
 *  @param envMap environment map for the cover glass, kept faint so the image
 *         still matches the page at the handoff */
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
    new MeshStandardMaterial({
      color: new Color(0x000000), roughness: 0.34, metalness: 0,
      emissive: new Color(0xffffff), emissiveMap: screenTexture,
      envMap, envMapIntensity: 0.04, toneMapped: false,
    }),
  );
  screen.userData.size = { width: size.x * METRES_TO_CM, height: size.z * METRES_TO_CM };
  screen.rotation.x = Math.PI / 2;
  screen.position.copy(center);
  lid.add(screen);

  // legends and prints are read at a slant
  scene.traverse((part) => {
    if (part.material?.map) part.material.map.anisotropy = 8;
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
