// Small shared helpers used across the site modules.

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// FNV-1a hash, so a string can seed a repeatable random sequence
const hash = s => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// mulberry32
const rng = seed => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const fmt = t => {
  t = Math.max(0, Math.round(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const verticalMQ = window.matchMedia('(min-width: 720px)');

// One sizing helper for every canvas: match CSS size, scale for the screen's pixel density
function fitCanvas(canvas, ctx, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Full-viewport overlay canvas, sized now and on every resize
function overlayCanvas(className, { prepend = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  prepend ? document.body.prepend(canvas) : document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const size = () => fitCanvas(canvas, ctx, innerWidth, innerHeight);
  size();
  window.addEventListener('resize', size);
  return { canvas, ctx };
}

module.exports = { clamp, hash, rng, fmt, reduceMotion, verticalMQ, fitCanvas, overlayCanvas };
