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
/* Makes a screen material wake like a tube: power 0 is dark, then a thin beam
   runs out from the centre, tears open to the full picture, 1 is the plain image. */
function crtPower(material) {
  const power = { value: 1 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPower = power;
    shader.fragmentShader = `uniform float uPower;\n${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        vec2 c = abs(vEmissiveMapUv - 0.5) * 2.0;
        float open = smoothstep(0.14, 0.62, uPower);
        float reach = smoothstep(0.0, 0.2, uPower) * 1.1;
        float beam = (1.0 - smoothstep(reach - 0.08, reach, c.x)) * (1.0 - smoothstep(0.42, 0.78, uPower));
        totalEmissiveRadiance *= 1.0 - smoothstep(open, open + 0.012, c.y);
        totalEmissiveRadiance += vec3(0.8, 0.88, 1.0) * beam * exp(-pow(c.y / (0.008 + open * 0.3), 2.0));
      }`,
    );
  };
  return power;
}

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
    this.power = crtPower(screen.material);
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

  /** 0 off, 1 on; see crtPower(). */
  setPower(level) {
    this.power.value = level;
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
