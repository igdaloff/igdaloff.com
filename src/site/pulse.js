// Background pulse: faint signal lines across the page while the site is on.

const { reduceMotion, verticalMQ, clamp, overlayCanvas } = require('./util');
const { task } = require('./scheduler');
const { palette } = require('./palette');
const { zapLine } = require('./zap');
const { amp, kickLevel } = require('./signal');
const { scrollToP } = require('./track');

const ROWS = [0.16, 0.33, 0.5, 0.67, 0.84];
const { ctx } = overlayCanvas('pulse-layer', { prepend: true });
const rail = document.querySelector('.transport');

let x0 = 0;
let wanted = false;
const measureX = () => (x0 = verticalMQ.matches ? rail.getBoundingClientRect().right : 0);
window.addEventListener('resize', measureX);

const loop = task(
  ts => {
    // canvas fades out via CSS, keeping its last frame
    if (!wanted) return false;
    const level = 0.25 + 0.75 * kickLevel(ts);
    const here = amp(clamp(scrollToP(scrollY), 0, 0.999));
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.strokeStyle = palette.ink;
    ctx.lineJoin = 'round';
    ROWS.forEach((row, i) => {
      const y = innerHeight * row;
      const h = (4 + 22 * here) * level * (0.6 + 0.4 * Math.sin(ts / 700 + i * 1.3));
      zapLine(ctx, x0, innerWidth, y, h * 1.6, 0.6, 0.06);
      zapLine(ctx, x0, innerWidth, y, h, 1, 0.13);
    });
  },
  { fps: 30 }
);

function start() {
  if (reduceMotion.matches) return;
  wanted = true;
  measureX();
  loop.start();
}
const stop = () => (wanted = false);

module.exports = { start, stop };
