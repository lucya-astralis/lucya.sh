/* Pulls the laptop intro in when gate.js decided it runs. three.js and GSAP are
   behind the dynamic import, so nothing heavy loads otherwise. */
const VERSION = '?v=20261031-leds';

if (window.LUCYA_INTRO) {
  window.LUCYA_INTRO_LOADING = true;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'intro/intro.css' + VERSION;
  const cover = document.createElement('div');
  cover.className = 'lintro lintro--cover';

  // Three.js, the model and its textures take a moment on a slow line, and a black
  // page reads as a dead one. The bar counts real files once the model is loading.
  const load = document.createElement('div');
  load.className = 'lintro__load';
  load.setAttribute('role', 'status');
  const mark = document.createElement('img');
  mark.src = 'images/logo/lucya_logo.svg';
  mark.alt = '';
  const bar = document.createElement('div');
  bar.className = 'lintro__bar';
  const fill = document.createElement('i');
  bar.append(fill);
  const label = document.createElement('span');
  label.textContent = 'Loading';
  load.append(mark, bar, label);

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'lintro__skip';
  skip.textContent = 'Skip intro';
  cover.append(load, skip);

  document.documentElement.classList.add('is-scrolllock');
  document.head.append(css);
  document.body.append(cover);

  const leave = () => {
    cover.remove();
    css.remove();
    document.documentElement.classList.remove('is-scrolllock');
    window.lucyaIntroDone();
  };
  skip.addEventListener('click', leave);

  let shown = 0;
  const report = (fraction) => {
    shown = Math.max(shown, fraction);
    load.classList.add('is-measured');
    fill.style.width = `${Math.round(shown * 100)}%`;
    label.textContent = `Loading ${Math.round(shown * 100)}%`;
  };

  import('./intro.js' + VERSION)
    .then(({ runIntro }) => runIntro(cover, { skip, leave, load, report }))
    .catch((err) => {
      console.warn('laptop intro skipped:', err);
      leave();
    });
}
