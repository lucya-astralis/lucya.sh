import {
  Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry, RoundedBoxGeometry,
} from '../vendor/three.bundle.min.js?v=20261031-leds2';
import { Laptop } from './Laptop.js?v=20261031-leds2';

// Roughly a CF-QV9: 12" 3:2 panel in a 27.5 x 20 cm footprint.
const WIDTH = 27.5;
const DEPTH = 20;
const BASE_H = 1.1;
const LID_H = 0.55;
const SCREEN_W = 24.4;
const SCREEN_H = SCREEN_W / 1.5;
const AXIS_INSET = 0.4; // hinge axis behind the back edge of base and lid

function slab(w, h, d, radius, material) {
  return new Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), material);
}

function keyboard() {
  const rows = 6, cols = 14, pitch = 1.72, size = 1.5;
  const mat = new MeshStandardMaterial({ color: new Color(0x17181b), roughness: 0.62, metalness: 0.2 });
  const keys = new InstancedMesh(new RoundedBoxGeometry(size, 0.12, size, 2, 0.05), mat, rows * cols);
  const m = new Matrix4();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.setPosition((c - (cols - 1) / 2) * pitch, 0, (r - (rows - 1) / 2) * pitch);
      keys.setMatrixAt(r * cols + c, m);
    }
  }
  keys.position.set(0, BASE_H + 0.02, -3.4);
  return keys;
}

/** Placeholder built from rounded boxes, no external assets.
 *  @param screenTexture sRGB texture shown on the display */
export function createProceduralLaptop(screenTexture) {
  const shell = new MeshPhysicalMaterial({
    color: new Color(0x8e9196), metalness: 0.9, roughness: 0.42,
    clearcoat: 0.25, clearcoatRoughness: 0.5,
  });
  const dark = new MeshStandardMaterial({ color: new Color(0x0c0d0f), roughness: 0.7, metalness: 0.3 });
  const bezel = new MeshStandardMaterial({ color: new Color(0x060607), roughness: 0.55, metalness: 0 });

  const base = new Group();
  const body = slab(WIDTH, BASE_H, DEPTH, 0.38, shell);
  body.position.y = BASE_H / 2;
  base.add(body, keyboard());

  const pad = new Mesh(new PlaneGeometry(9.5, 5.6), dark);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, BASE_H + 0.004, 6.4);
  base.add(pad);

  const hingeZ = -DEPTH / 2 + AXIS_INSET;
  const hingeY = BASE_H / 2;
  for (const x of [-9.5, 9.5]) {
    const barrel = new Mesh(new CylinderGeometry(0.52, 0.52, 3.2, 20), dark);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(x, hingeY, hingeZ - 0.2);
    base.add(barrel);
  }

  const lidPivot = new Group();
  const lid = new Group();
  const lidShell = slab(WIDTH, LID_H, DEPTH, 0.25, shell);
  lidShell.position.set(0, 0, DEPTH / 2 - AXIS_INSET);
  lid.add(lidShell);

  // unlit: the picture alone, so its black meets the boot splash clean
  const panel = new Mesh(
    new PlaneGeometry(SCREEN_W, SCREEN_H),
    new MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
  );
  panel.userData.size = { width: SCREEN_W, height: SCREEN_H };
  panel.rotation.x = Math.PI / 2; // normal -y, image top toward the lid's far edge
  panel.position.set(0, -LID_H / 2 - 0.04, DEPTH / 2 - AXIS_INSET + 0.1);

  const surround = new Mesh(new PlaneGeometry(WIDTH - 0.5, DEPTH - 0.5), bezel);
  surround.rotation.x = Math.PI / 2;
  surround.position.set(0, -LID_H / 2 - 0.02, DEPTH / 2 - AXIS_INSET);
  lid.add(surround, panel);
  lidPivot.add(lid);

  return new Laptop({
    base, lidPivot, lid, screen: panel,
    hinge: { y: hingeY, z: hingeZ, link: (BASE_H + LID_H) / 2 },
  });
}
