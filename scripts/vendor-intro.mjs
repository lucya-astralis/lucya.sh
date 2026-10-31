// Rebuilds intro/vendor/ from node_modules. The site has no build step, so the
// result is committed and served as is; run this only when bumping three/gsap.
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'intro', 'vendor');
await mkdir(out, { recursive: true });

// Only what the intro uses, so the bundle stays tree-shaken. Anything added
// to intro/*.js from THREE has to be listed here too.
const entry = `
export {
  ACESFilmicToneMapping, AdditiveBlending, Box3, CanvasTexture, Color, DefaultLoadingManager, DirectionalLight, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, SpotLight, MeshStandardMaterial,
  PMREMGenerator, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace,
  CylinderGeometry, TextureLoader, Vector3, WebGLRenderer,
} from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
export { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
`;

const bundle = (contents, banner, name) => build({
  stdin: { contents, resolveDir: root, loader: 'js' },
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  legalComments: 'none',
  banner: { js: banner },
  outfile: join(out, name),
});

await bundle(entry, '/* three.js (MIT) - https://threejs.org */', 'three.bundle.min.js');

// gsap's dist/ builds are UMD and throw when imported as modules
await bundle(
  `export { gsap } from 'gsap'; export { ScrollTrigger } from 'gsap/ScrollTrigger';`,
  '/* GSAP (Standard License) - https://gsap.com/standard-license */',
  'gsap.bundle.min.js',
);
