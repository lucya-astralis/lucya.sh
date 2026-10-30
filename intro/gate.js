/* Decides, before first paint, whether the laptop intro runs. Must stay a
   render-blocking script right after lite.js: it holds the page and the boot
   splash back, which has to happen before either can flash.

   Sets window.LUCYA_INTRO. script.js starts its boot on 'lucya:intro-done', which
   window.lucyaIntroDone() fires when the intro ends, is skipped or fails. */
(function () {
  var ENABLE_LAPTOP_INTRO = true;

  // ?intro=on forces it past the flag, Lite and deep links; ?intro=off disables it.
  var override = new URLSearchParams(location.search).get('intro');

  function hasWebGL2() {
    var gl = document.createElement('canvas').getContext('webgl2');
    if (gl && gl.getExtension('WEBGL_lose_context')) gl.getExtension('WEBGL_lose_context').loseContext();
    return !!gl;
  }

  function wanted() {
    if (override === 'off') return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!hasWebGL2()) return false;
    if (override === 'on') return true;
    return ENABLE_LAPTOP_INTRO && !window.LUCYA_LITE && !location.hash;
  }

  window.LUCYA_INTRO = wanted();
  if (!window.LUCYA_INTRO) return;

  var root = document.documentElement;
  var hold = document.createElement('style');
  hold.textContent =
    'html.lintro-hold body{background:#000}' +
    'html.lintro-hold body>*:not(.lintro){opacity:0}' +
    'html.lintro-hold .splash{display:none}';
  document.head.appendChild(hold);
  root.classList.add('lintro-hold');

  var done = false;
  window.lucyaIntroDone = function () {
    if (done) return;
    done = true;
    root.classList.remove('lintro-hold');
    hold.remove();
    window.dispatchEvent(new CustomEvent('lucya:intro-done'));
  };

  // loader.js never ran (blocked, 404): the page must not stay held back
  window.addEventListener('load', function () {
    if (!window.LUCYA_INTRO_LOADING) window.lucyaIntroDone();
  });
})();
