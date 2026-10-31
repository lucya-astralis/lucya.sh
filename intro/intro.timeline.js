/* Everything tunable about the intro lives here; intro/README.md explains it.
   Units are centimetres, angles are degrees.

   A keyframe gives values at scroll progress `at` (0-1). Each number runs on one
   smooth curve through the keys that name it (intro/curve.js), so the motion passes
   through a key without slowing for it. A key that leaves something out does not
   touch it; give one number the same value twice to hold it.

   camera.pos / target / up   where the camera sits and looks
   laptop.rot / pos           the whole device (x, y, z)
   hinge                      0 closed, 180 flat, 360 tablet
   fit                        0 = use camera.*, 1 = the computed pose where the
                              screen plane exactly covers the viewport
   power                      display brightness, 0 off to 1 on
   light                      the room's reflections and rim lights, 1 full
*/
export const TIMELINE = {
  model: 'gltf',        // 'gltf' = CF-QV9 from tools/laptop, 'procedural' = placeholder
  scrollVh: 580,        // scroll length of the whole intro
  scrub: 0.9,           // seconds the animation trails the scrollbar
  fov: 30,
  glow: 24,             // how much light the display throws on the keys

  // below this viewport aspect the camera backs off proportionally, so the
  // laptop still fits the width on a portrait phone
  minAspect: 1,

  // slow drift while the closed lid is seen from above
  idle: { until: 0.15, rotDeg: 1.6, seconds: 7 },

  keyframes: [
    {
      at: 0,
      camera: { pos: [0, 54, 0], target: [0, 0, 0], up: [0, 0, -1] },
      // turned round so the lid reads upright, hinge at the bottom of the frame
      laptop: { rot: [0, 180, 0], pos: [0, 0, 0] },
      hinge: 0,
      fit: 0,
      power: 0,
      light: 0.62,
    },
    // the camera drops early while the machine still shows its back, exhaust grille
    // and all, then it swings round past its ports with the lid already lifting
    { at: 0.3, camera: { pos: [0, 32, 72], target: [0, 2, 0], up: [0, 0.8, 0.5] }, laptop: { rot: [0, 250, 0] }, hinge: 4 },
    { at: 0.46, camera: { pos: [0, 15, 74], target: [0, 3, 0], up: [0, 1, 0] }, laptop: { rot: [4, 320, 0] }, hinge: 34, light: 0.72, fit: 0 },
    // opens in one go as the display wakes, pitched forward so the tilted lid ends upright
    { at: 0.62, camera: { pos: [0, 13, 73], target: [0, 8, 0] }, laptop: { rot: [12, 352, 0] }, hinge: 92, power: 1, fit: 0.24 },
    { at: 0.78, camera: { pos: [0, 12, 72], target: [0, 9, 0] }, laptop: { rot: [15, 360, 0] }, hinge: 105, fit: 0.62 },
    { at: 1, hinge: 105, fit: 1 },
  ],
};
