// Type as part of the recording.
// Ink: words ahead of the reading line sit in carbon-ghost gray. As the line passes, each word
// inks with a brief wet bleed that dries to matte (CSS animation). Once inked it stays inked,
// because it has already been recorded.
// Breath: words near the reading line swell and tremble with the waveform at their position.

const track = require('./track');
const { amp } = require('./signal');
const { task } = require('./scheduler');
const { reduceMotion } = require('./util');
const playback = require('./playback');

const SKIP = '.cue, .power, .sr-only';
const words = [];

// Each word gets its own inline-block box so it can transform without reflowing the line.
// The heading's accessible name lives in .sr-only and the visible copy is aria-hidden,
// so nothing is announced twice.
function split() {
  track.sections.forEach(({ el }) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n =>
        n.parentElement.closest(SKIP) || !n.textContent.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = part;
        frag.appendChild(span);
        words.push({ el: span, seed: Math.random() * 1000, y: 0, a: 0, moving: false, inked: false });
      });
      n.replaceWith(frag);
    });
  });
}

function measure() {
  const { docH } = track.view;
  words.forEach(w => {
    const r = w.el.getBoundingClientRect();
    w.y = r.top + scrollY + r.height / 2;
    w.a = amp(Math.min(0.999, w.y / docH));
  });
  words.sort((a, b) => a.y - b.y);
  inkFrom = 0;
}

// Ink everything the reading line has passed. Words are sorted by y, so this only walks forward.
let inkFrom = 0;
function ink() {
  const line = track.readY();
  while (inkFrom < words.length && (words[inkFrom].inked || words[inkFrom].y <= line)) {
    const w = words[inkFrom++];
    if (w.inked) continue;
    w.inked = true;
    w.el.classList.add('inked');
  }
}

const still = w => {
  w.el.style.transform = '';
  w.el.style.webkitTextStroke = '';
  w.moving = false;
};

const breath = task(
  ts => {
    if (reduceMotion.matches) {
      words.forEach(w => w.moving && still(w));
      return false;
    }
    const t = ts / 1000;
    const line = track.readY();
    const spread = track.view.vh * 0.16;
    const boost = playback.isPlaying() ? 1.4 : 1;
    for (const w of words) {
      const d = (w.y - line) / spread;
      if (d > 3 || d < -3) {
        if (w.moving) still(w);
        continue;
      }
      const k = Math.exp(-d * d) * w.a * boost;
      if (k < 0.004) {
        if (w.moving) still(w);
        continue;
      }
      w.moving = true;
      // Slow breath that rolls down the page, plus a fast, tiny, irregular shiver
      const swell = 0.5 + 0.5 * Math.sin(t * 1.4 - w.y * 0.004);
      const stroke = k * (0.12 + 0.36 * swell);
      const s = w.seed;
      const tx = (k * 0.7 * (Math.sin(t * 31 + s) + Math.sin(t * 47.3 + s * 1.7))) / 2;
      const ty = (k * 0.7 * (Math.sin(t * 37.1 + s * 2.3) + Math.sin(t * 53.9 + s * 0.6))) / 2;
      w.el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
      w.el.style.webkitTextStroke = `${stroke.toFixed(3)}px currentColor`;
    }
  },
  { fps: 30 }
);

const startBreath = () => reduceMotion.matches || breath.start();
reduceMotion.addEventListener?.('change', startBreath);

function init() {
  split();
  startBreath();
}

module.exports = { init, measure, ink };
