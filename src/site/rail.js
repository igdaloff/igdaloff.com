// The transport rail: a drum-recorder ink trace of the whole page. Ink behind the reading
// position, a faint carbon ghost ahead of it. The boundary between them is the playhead.
// Redrawn only on scroll, hover, resize and palette change.

const track = require('./track');
const playback = require('./playback');
const { amp } = require('./signal');
const { palette } = require('./palette');
const { clamp, hash, rng, verticalMQ, fitCanvas } = require('./util');

const canvas = document.getElementById('wave');
const ctx = canvas.getContext('2d');
const tip = document.getElementById('tip');

let trace = [];
let cssW = 0;
let cssH = 0;
let vertical = true;
let hoverP = null;
const length = () => (vertical ? cssH : cssW); // along the track
const depth = () => (vertical ? cssW : cssH); // swing axis

function build() {
  vertical = verticalMQ.matches;
  cssW = canvas.clientWidth;
  cssH = canvas.clientHeight;
  fitCanvas(canvas, ctx, cssW, cssH);

  // A pen swinging side to side every 2px, its reach set by the waveform
  const L = Math.floor(length());
  const r = rng(hash('trace' + L));
  trace = [];
  let sign = 1;
  let skipLeft = 0;
  for (let k = 0; k <= L; k += 2) {
    const p = Math.min(0.999, k / L);
    sign = -sign;
    if (skipLeft > 0) skipLeft--;
    else if (r() < 0.012) skipLeft = 2 + Math.floor(r() * 3); // pen lifts off the paper
    trace.push({
      k,
      p,
      s: track.sectionAt(p),
      o: amp(p) * (0.45 + 0.55 * r()) * sign, // swing, as a fraction of half the rail
      w: 0.7 + r() * 1.1, // uneven pen pressure
      skip: skipLeft > 0,
      blot: r() < 0.004 ? 0.8 + r() * 1.4 : 0 // the occasional ink blot
    });
  }
  canvas.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
}

function draw() {
  const progress = clamp(track.scrollToP(scrollY));
  ctx.clearRect(0, 0, cssW, cssH);
  const D = depth();
  const mid = D / 2;
  const half = (D - 8) / 2;
  const L = length();
  const hoverSec = hoverP != null ? track.sectionAt(hoverP) : null;
  const P = (al, ac) => (vertical ? [mid + ac, al] : [al, mid + ac]); // (along, across) to canvas
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Timing marks where each section begins
  ctx.fillStyle = palette.unplayed;
  track.sections.forEach(s => {
    if (s.p0 <= 0) return;
    const al = Math.round(s.p0 * L);
    if (vertical) {
      ctx.fillRect(0, al, 5, 1);
      ctx.fillRect(D - 5, al, 5, 1);
    } else {
      ctx.fillRect(al, 0, 1, 5);
      ctx.fillRect(al, D - 5, 1, 5);
    }
  });

  const ghost = new Path2D();
  const ghostHover = new Path2D();
  ctx.strokeStyle = palette.ink;
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1];
    const b = trace[i];
    if (b.skip) continue;
    const [x1, y1] = P(a.k, a.o * half);
    const [x2, y2] = P(b.k, b.o * half);
    if (b.p <= progress) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.globalAlpha = 0.12; // ink bleeding into paper
      ctx.lineWidth = b.w + 2.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = b.w;
      ctx.stroke();
    } else {
      const path = hoverSec && b.s === hoverSec ? ghostHover : ghost;
      path.moveTo(x1, y1);
      path.lineTo(x2, y2);
    }
  }
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = palette.unplayed;
  ctx.stroke(ghost);
  ctx.strokeStyle = palette.hover;
  ctx.stroke(ghostHover);

  ctx.fillStyle = palette.ink;
  ctx.globalAlpha = 0.85;
  trace.forEach(t => {
    if (!t.blot || t.p > progress) return;
    const [x, y] = P(t.k, t.o * half);
    ctx.beginPath();
    ctx.arc(x, y, t.blot, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// Pointer: scrub and hover
const pFromEvent = e => {
  const r = canvas.getBoundingClientRect();
  return clamp(vertical ? (e.clientY - r.top) / cssH : (e.clientX - r.left) / cssW);
};
let dragging = false;
canvas.addEventListener('pointerdown', e => {
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  playback.stop();
  playback.seek(pFromEvent(e));
});
canvas.addEventListener('pointermove', e => {
  hoverP = pFromEvent(e);
  if (dragging) playback.seek(hoverP);
  const s = track.sectionAt(hoverP);
  tip.textContent = `${s.label}  ${track.fmt(track.timeAt(hoverP))}`;
  if (vertical) {
    tip.style.top = `${hoverP * cssH}px`;
    tip.style.left = '';
  } else {
    tip.style.top = '';
    tip.style.left = `${Math.min(cssW - 40, Math.max(40, hoverP * cssW))}px`;
  }
  tip.classList.add('on');
  draw();
});
canvas.addEventListener('pointerup', () => (dragging = false));
canvas.addEventListener('pointerleave', () => {
  hoverP = null;
  tip.classList.remove('on');
  draw();
});
canvas.addEventListener('keydown', e => {
  const t = track.timeAt(clamp(track.scrollToP(scrollY)));
  const keys = {
    ArrowRight: () => track.pAtTime(t + 5),
    ArrowDown: () => track.pAtTime(t + 5),
    ArrowLeft: () => track.pAtTime(t - 5),
    ArrowUp: () => track.pAtTime(t - 5),
    Home: () => 0,
    End: () => 1
  };
  if (!keys[e.key]) return;
  e.preventDefault();
  playback.seek(keys[e.key]());
});

module.exports = { build, draw };
