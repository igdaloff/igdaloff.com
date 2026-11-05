// Electric underline. One shared overlay canvas draws the live signal under whatever is hovered
// or keyboard focused; the native underline steps aside via the .zap class.

const { reduceMotion, overlayCanvas } = require('./util');
const { task } = require('./scheduler');

// One jagged pass along a line. Mostly small noise, with the odd spike for the "arc" feel.
function zapLine(c, x0, x1, y, height, width, alpha) {
  const len = Math.max(1, x1 - x0);
  c.beginPath();
  c.moveTo(x0, y);
  for (let x = x0 + 2; x < x1; x += 2) {
    const taper = Math.sqrt(Math.sin((Math.PI * (x - x0)) / len));
    let n = Math.random() * 2 - 1;
    if (Math.random() < 0.06) n *= 3.2;
    c.lineTo(x, y + n * height * taper);
  }
  c.lineTo(x1, y);
  c.globalAlpha = alpha;
  c.lineWidth = width;
  c.stroke();
  c.globalAlpha = 1;
}

const ZAP_SEL = 'main a, .play, .power';
const { ctx } = overlayCanvas('zap-layer');

let el = null;
let color = '';
let level = 0;
let target = 0;
let lastTs = 0;

// Fast attack, slower release, like an envelope. Drawn at ~30fps so it flickers rather than smears.
const loop = task(
  ts => {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.033;
    lastTs = ts;
    level = target > level ? Math.min(1, level + dt / 0.12) : Math.max(0, level - dt / 0.3);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (level <= 0 && target === 0) {
      el?.classList.remove('zap');
      el = null;
      lastTs = 0;
      return false;
    }
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    const scale = parseFloat(el.dataset.zap || 1);
    for (const r of el.getClientRects()) {
      // one signal per line box, so wrapped links crackle on each line
      if (r.width < 2) continue;
      const y = Math.round(r.bottom) - 1.5;
      zapLine(ctx, r.left, r.right, y, 4.5 * level * scale, 0.6, 0.35 * scale); // faint ghost arc
      zapLine(ctx, r.left, r.right, y, 2.6 * level * scale, 1.2, scale); // main signal
    }
  },
  { fps: 30 }
);

function on(next) {
  if (reduceMotion.matches) return;
  if (el !== next) {
    el?.classList.remove('zap');
    el = next;
    level = 0;
    next.classList.add('zap');
  }
  color = getComputedStyle(next).color;
  target = 1;
  loop.start();
}
const off = from => {
  if (from === el) target = 0;
};

document.addEventListener('pointerover', e => {
  const t = e.target.closest(ZAP_SEL);
  if (t) on(t);
});
document.addEventListener('pointerout', e => {
  const t = e.target.closest(ZAP_SEL);
  if (t && !t.contains(e.relatedTarget)) off(t);
});
document.addEventListener('focusin', e => {
  const t = e.target.closest(ZAP_SEL);
  if (t && t.matches(':focus-visible')) on(t);
});
document.addEventListener('focusout', e => {
  const t = e.target.closest(ZAP_SEL);
  if (t) off(t);
});

module.exports = { zapLine, refreshColor: () => el && (color = getComputedStyle(el).color) };
