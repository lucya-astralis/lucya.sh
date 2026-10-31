/* Everything tunable about the intro lives here; intro/README.md explains it.
   Units are centimetres, angles are degrees.

   A keyframe sets the pose at scroll progress `at` (0-1). Whatever it leaves
   out holds the previous value. `ease` shapes the way INTO that keyframe.

   camera.pos / target / up   where the camera sits and looks
   laptop.rot / pos           the whole device (x, y, z)
   hinge                      0 closed, 180 flat, 360 tablet
   ease / cameraEase          cameraEase lets the camera move on its own curve
   fit                        0 = use camera.*, 1 = the computed pose where the
                              screen plane exactly covers the viewport
   power                      display brightness, 0 off to 1 on
*/
export const TIMELINE = {
  model: 'gltf',        // 'gltf' = CF-QV9 from tools/laptop, 'procedural' = placeholder
  scrollVh: 450,        // scroll length of the whole intro
  scrub: 0.6,           // seconds the animation trails the scrollbar
  ease: 'power2.inOut', // default between keyframes
  fov: 30,
  glow: 34,             // how much light the display throws on the keys

  // below this viewport aspect the camera backs off proportionally, so the
  // laptop still fits the width on a portrait phone
  minAspect: 1.3,

  // slow drift while the closed lid is seen from above
  idle: { until: 0.15, rotDeg: 1.6, seconds: 7 },

  keyframes: [
    {
      at: 0,
      camera: { pos: [0, 78, 0], target: [0, 0, 0], up: [0, 0, -1] },
      // turned round so the lid reads upright, hinge at the bottom of the frame
      laptop: { rot: [0, 180, 0], pos: [0, 0, 0] },
      hinge: 0,
      fit: 0,
      power: 0,
    },
    { at: 0.15 },
    {
      // one move: the camera drops early while the machine still shows its back,
      // exhaust grille and all, then it swings round past its ports
      at: 0.5,
      camera: { pos: [0, 14, 74], target: [0, 3, 0], up: [0, 1, 0] },
      laptop: { rot: [0, 338, 0] },
      ease: 'power3.inOut',
      cameraEase: 'power3.out',
    },
    {
      // opens in one go, a little past where it stops, as the display wakes
      at: 0.68,
      camera: { pos: [0, 13, 72], target: [0, 8, 0] },
      laptop: { rot: [12, 356, 0] },
      hinge: 112,
      power: 1,
      ease: 'power2.inOut',
    },
    {
      // and eases back to 105, square to the camera. Pitched forward so the tilted
      // lid ends up upright for the dolly
      at: 0.74,
      camera: { pos: [0, 12, 72], target: [0, 9, 0] },
      laptop: { rot: [15, 360, 0] },
      hinge: 105,
      ease: 'sine.inOut',
    },
    { at: 0.75 },
    {
      // dolly onto the display until it covers the viewport; the page's boot
      // starts the moment this lands
      at: 1,
      fit: 1,
    },
  ],
};
