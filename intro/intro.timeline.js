/* Everything tunable about the intro lives here; intro/README.md explains it.
   Units are centimetres, angles are degrees.

   A keyframe sets the pose at scroll progress `at` (0-1). Whatever it leaves
   out holds the previous value. `ease` shapes the way INTO that keyframe.

   camera.pos / target / up   where the camera sits and looks
   laptop.rot / pos           the whole device (x, y, z)
   hinge                      0 closed, 180 flat, 360 tablet
   fit                        0 = use camera.*, 1 = the computed pose where the
                              screen plane exactly covers the viewport
*/
export const TIMELINE = {
  model: 'gltf',        // 'gltf' = CF-QV9 from tools/laptop, 'procedural' = placeholder
  scrollVh: 450,        // scroll length of the whole intro
  scrub: 0.6,           // seconds the animation trails the scrollbar
  ease: 'power2.inOut', // default between keyframes
  fov: 30,

  // below this viewport aspect the camera backs off proportionally, so the
  // laptop still fits the width on a portrait phone
  minAspect: 1.3,

  // slow drift while the closed lid is seen from above
  idle: { until: 0.15, rotDeg: 1.6, seconds: 7 },

  // canvas fades out over the real page between these two progress values
  fade: [0.9, 1],

  keyframes: [
    {
      at: 0,
      camera: { pos: [0, 78, 0], target: [0, 0, 0], up: [0, 0, -1] },
      // turned round so the lid reads upright, hinge at the bottom of the frame
      laptop: { rot: [0, 180, 0], pos: [0, 0, 0] },
      hinge: 0,
      fit: 0,
    },
    { at: 0.15 },
    {
      // 3/4 view, camera comes down
      at: 0.35,
      camera: { pos: [0, 30, 66], target: [0, 1, 0], up: [0, 1, 0] },
      laptop: { rot: [0, 322, 0] },
    },
    {
      // open to 110
      at: 0.43,
      camera: { pos: [0, 30, 84], target: [0, 7, 0] },
      laptop: { rot: [0, 336, 0] },
      hinge: 110,
    },
    {
      // flat
      at: 0.5,
      camera: { pos: [0, 58, 62], target: [0, 0, 0] },
      laptop: { rot: [0, 376, 0], pos: [0, 0, 6] },
      hinge: 180,
      ease: 'sine.inOut',
    },
    {
      // tablet. Pitch and hinge move together, so the panel keeps facing the
      // camera while the base folds away behind it
      at: 0.6,
      camera: { pos: [0, 54, 72], target: [0, 2, 0] },
      laptop: { rot: [180, 346, 0], pos: [0, 0, 0] },
      hinge: 360,
      ease: 'sine.inOut',
    },
    {
      // back to laptop mode, square to the camera. Pitched forward so the
      // tilted lid ends up upright and the dolly runs straight at the panel
      at: 0.7,
      camera: { pos: [0, 12, 72], target: [0, 9, 0] },
      laptop: { rot: [15, 360, 0], pos: [0, 0, 0] },
      hinge: 105,
    },
    { at: 0.72 },
    {
      // dolly onto the display until it covers the viewport
      at: 0.9,
      fit: 1,
    },
    { at: 1 },
  ],
};
