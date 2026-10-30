import { Group, Vector3 } from '../vendor/three.bundle.min.js';

/* The contract between the intro and any laptop model. intro.js only ever
   touches what is defined here, so a glTF can replace the placeholder by
   filling in the same four nodes (see GLTF notes in intro/README.md).

   Model space: centimetres, origin at the centre of the footprint, base on
   y = 0, keyboard up (+y), front edge +z, hinge along x at the back edge.
   Closed, the lid lies on the base.

     root
     ├─ base         the lower half
     └─ lidPivot     empty, on the lid's hinge axis
        └─ lid       lower-half-sized slab, extends to +z from the pivot
           └─ screen plane carrying the display texture, faces lid-local -y

   A 360° convertible cannot turn about one axis: it would end up back on top
   of the keyboard instead of behind the base. The hinge has two axes that
   work one after the other: up to 180 the lid turns on its own axis, from 180
   to 360 the lower axis in the base carries that whole axis around on a short
   link. That is what setHinge() does; `hinge` describes the geometry. */
export class Laptop {
  /** @param hinge {{ y:number, z:number, link:number }} base axis and the
   *  distance between the two axes, in model space */
  constructor({ base, lidPivot, lid, screen, hinge, links = [] }) {
    this.root = new Group();
    this.base = base;
    this.lidPivot = lidPivot;
    this.lid = lid;
    this.screen = screen;
    this.hinge = hinge;
    this.links = links;      // optional visible hinge parts
    this.root.add(base, lidPivot, ...links);
    this.setHinge(0);
  }

  setHinge(deg) {
    const lower = (Math.max(0, deg - 180) * Math.PI) / 180;
    this.lidPivot.position.set(
      0,
      this.hinge.y + this.hinge.link * Math.cos(lower),
      this.hinge.z - this.hinge.link * Math.sin(lower),
    );
    this.lidPivot.rotation.x = (-deg * Math.PI) / 180;
    for (const link of this.links) link.rotation.x = -lower;
  }

  /** Display brightness, 0 off to 1 on. */
  setPower(level) {
    this.screen.material.color.setScalar(level);
  }

  /** World-space pose of the screen, for the camera fit. */
  screenPose(center, normal, up) {
    this.screen.getWorldPosition(center);
    const e = this.screen.matrixWorld.elements;
    normal.set(e[8], e[9], e[10]).normalize();
    up.set(e[4], e[5], e[6]).normalize();
  }

  /** Size of the screen plane in world units. */
  screenSize() {
    const { width, height } = this.screen.userData.size;
    return new Vector3(width, height, 0);
  }

  dispose() {
    this.root.traverse((node) => {
      node.geometry?.dispose();
      node.material?.map?.dispose();
      node.material?.emissiveMap?.dispose();
      node.material?.normalMap?.dispose();
      node.material?.dispose();
    });
  }
}
