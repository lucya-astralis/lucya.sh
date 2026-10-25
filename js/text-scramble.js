import { escHtml } from './utils.js';

export function createScrambler(LITE) {
  // ---------- TEXT SCRAMBLE --------------------------------------
  // decoder-style transition. Random glyphs flicker, then resolve to the
  // target text one char at a time. Used for rack names and Spotify titles.
  const SCRAMBLE_CHARS = '!<>-_\\/[]{}=+*^?#$&%01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ';
  // per-char start/end below are authored in 60fps frame units, but they are
  // read against elapsed wall-clock time, not against a frame counter. A
  // frame-counted reveal has no fixed duration — it stretches by exactly the
  // factor the frame rate drops by, so the same ~0.6s decode that reads as a
  // flicker on desktop crawls for several seconds on a busy phone. Timing it
  // off the clock makes a dropped frame skip glyphs instead of adding time.
  const SCRAMBLE_FPS = 60;
  class TextScrambler {
    constructor(el){ this.el = el; this.queue = []; this.frame = 0; }
    setText(newText){
      const oldText = this.el.textContent;
      const len = Math.max(oldText.length, newText.length);
      this.queue = [];
      for (let i = 0; i < len; i++){
        const start = Math.floor(Math.random() * 14);
        const end = start + 12 + Math.floor(Math.random() * 22);
        this.queue.push({ from: oldText[i] || '', to: newText[i] || '', start, end, char: '' });
      }
      cancelAnimationFrame(this.rafId);
      this.frame = 0;
      this.startedAt = 0;
      // first frame still paints synchronously (it renders the outgoing text,
      // so the element is never briefly empty); rAF drives everything after.
      return new Promise(res => { this.resolve = res; this._tick(performance.now()); });
    }
    _tick = (now) => {
      if (!this.startedAt) this.startedAt = now;
      this.frame = (now - this.startedAt) / (1000 / SCRAMBLE_FPS);
      let out = '';
      let done = 0;
      for (let i = 0; i < this.queue.length; i++){
        const q = this.queue[i];
        if (this.frame >= q.end){ done++; out += escHtml(q.to); }
        else if (this.frame >= q.start){
          if (!q.char || Math.random() < 0.28){
            q.char = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }
          out += `<span class="scramble-char">${escHtml(q.char)}</span>`;
        } else {
          out += escHtml(q.from);
        }
      }
      this.el.innerHTML = out;
      if (done === this.queue.length){ this.resolve(); }
      else { this.rafId = requestAnimationFrame(this._tick); }
    };
  }
  const scramblers = new WeakMap();
  const scrambleTo = (el, text) => {
    if (!el) return;
    if (LITE){ el.textContent = String(text); return Promise.resolve(); }
    let s = scramblers.get(el);
    if (!s){ s = new TextScrambler(el); scramblers.set(el, s); }
    return s.setText(String(text));
  };

  return scrambleTo;
}
