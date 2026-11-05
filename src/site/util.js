// Small shared helpers used across the site modules.

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

// One sizing helper for every canvas: match CSS size, scale for the screen's pixel density
function fitCanvas(canvas, ctx, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Full-viewport overlay canvas, sized now and on every resize
function overlayCanvas(className) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const size = () => fitCanvas(canvas, ctx, innerWidth, innerHeight);
  size();
  window.addEventListener('resize', size);
  return { canvas, ctx };
}

module.exports = { clamp, rand, reduceMotion, finePointer, overlayCanvas };
