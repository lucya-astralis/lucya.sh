/* ============================================================================
   LITE MODE — shared by index.html and legal.html.

   Decides lite vs. full BEFORE first paint, so this MUST stay a render-blocking
   <script src="lite.js"></script> in <head> (no defer / no async) — otherwise
   the heavy version flashes for a frame before html.lite is applied.

   Auto-on ONLY for genuinely weak hardware (<= 2 GB RAM or <= 2 cores) or
   data-saver; a manual override in localStorage('lucya-lite') wins in both
   directions (toggled by the LITE chip built in script.js). Exposes
   window.LUCYA_LITE and sets <html class="lite">.

   NOTE: prefers-reduced-motion does NOT force lite here — reduced motion is
   handled independently by a dedicated @media block in styles.css that kills
   animations/transitions. Lite stays reserved for weak hardware / data-saver.
   ============================================================================ */
(function () {
  var lite = null;
  try {
    var s = localStorage.getItem('lucya-lite');
    if (s === '1') lite = true; else if (s === '0') lite = false;
  } catch (e) {}
  if (lite === null) {
    var n = navigator;
    var mem = n.deviceMemory || 8;
    var cores = n.hardwareConcurrency || 8;
    var save = !!(n.connection && n.connection.saveData);
    lite = mem <= 2 || cores <= 2 || save;
  }
  window.LUCYA_LITE = lite;
  if (lite) document.documentElement.classList.add('lite');
})();
