/* Decides whether the laptop intro runs and pulls it in if so. This small file
   is the only thing that loads when the intro is off; three.js and GSAP are
   behind the dynamic import below. */
const ENABLE_LAPTOP_INTRO = true;

const VERSION = '?v=20261030-real';

// ?intro=on forces it past the flag, Lite and deep links; ?intro=off disables it.
const override = new URLSearchParams(location.search).get('intro');

function hasWebGL2() {
  const gl = document.createElement('canvas').getContext('webgl2');
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return !!gl;
}

function wanted() {
  if (override === 'off') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!hasWebGL2()) return false;
  if (override === 'on') return true;
  return ENABLE_LAPTOP_INTRO && !window.LUCYA_LITE && !location.hash;
}

if (wanted()) {
  // Black cover first: the boot splash sits above it and fades onto it, so the
  // page never shows between boot and intro.
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'intro/intro.css' + VERSION;
  const cover = document.createElement('div');
  cover.className = 'lintro lintro--cover';
  document.head.append(css);
  document.body.append(cover);

  import('./intro.js' + VERSION)
    .then(({ runIntro }) => runIntro(cover))
    .catch((err) => {
      console.warn('laptop intro skipped:', err);
      cover.remove();
      css.remove();
    });
}
