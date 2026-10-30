/* Pulls the laptop intro in when gate.js decided it runs. three.js and GSAP are
   behind the dynamic import, so nothing heavy loads otherwise. */
const VERSION = '?v=20261030-crt';

if (window.LUCYA_INTRO) {
  window.LUCYA_INTRO_LOADING = true;
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
      window.lucyaIntroDone();
    });
}
