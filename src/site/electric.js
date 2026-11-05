// Electricity. Every link, the power switch, and every .wire is a conductor. One overlay canvas
// draws whatever carries current: hovered or focused elements, the cursor's arcs, the power-on
// surge, scroll energy, and the ambient current while the site is on.

const { clamp, rand, reduceMotion, finePointer, overlayCanvas } = require('./util');
const { task } = require('./scheduler');
const { palette } = require('./palette');
const { crackle } = require('./audio');

const { ctx } = overlayCanvas('spark-layer');

// ---- Primitives ---------------------------------------------------------------------------

// A jittered line between two points: perpendicular noise, tapered ends, the odd spike.
function zapLine(c, x0, y0, x1, y1, height, width, alpha) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  c.beginPath();
  c.moveTo(x0, y0);
  for (let d = 2; d < len; d += 2) {
    const t = d / len;
    const taper = Math.sqrt(Math.sin(Math.PI * t));
    let n = Math.random() * 2 - 1;
    if (Math.random() < 0.06) n *= 3.2;
    const o = n * height * taper;
    c.lineTo(x0 + dx * t + nx * o, y0 + dy * t + ny * o);
  }
  c.lineTo(x1, y1);
  c.globalAlpha = alpha;
  c.lineWidth = width;
  c.stroke();
  c.globalAlpha = 1;
}

// A branching arc between two points, by midpoint displacement
function boltPoints(a, b, spread, depth) {
  if (depth === 0) return [a, b];
  const m = [(a[0] + b[0]) / 2 + rand(-spread, spread), (a[1] + b[1]) / 2 + rand(-spread, spread)];
  return [...boltPoints(a, m, spread / 2, depth - 1).slice(0, -1), ...boltPoints(m, b, spread / 2, depth - 1)];
}

function strokePoints(pts, width, alpha, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBolt(x0, y0, x1, y1, power) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const pts = boltPoints([x0, y0], [x1, y1], len * 0.2, len > 160 ? 6 : 5);
  strokePoints(pts, 6 * power, 0.12, palette.glow);
  strokePoints(pts, 2.2 * power, 0.35, palette.glow);
  strokePoints(pts, 1.1, power, palette.spark);
  // a fork or two, thinner, shooting off sideways
  const forks = Math.random() < 0.6 ? 1 + (Math.random() < 0.35) : 0;
  for (let f = 0; f < forks; f++) {
    const p = pts[Math.floor(rand(0.2, 0.8) * pts.length)];
    const ang = Math.atan2(y1 - y0, x1 - x0) + rand(-1.1, 1.1);
    const fl = len * rand(0.15, 0.35);
    const fp = boltPoints(p, [p[0] + Math.cos(ang) * fl, p[1] + Math.sin(ang) * fl], fl * 0.25, 4);
    strokePoints(fp, 0.7, power * 0.7, palette.spark);
  }
}

// ---- Conductors ---------------------------------------------------------------------------

const conductors = [...document.querySelectorAll('main a, .power, .wire')].map(el => ({
  el,
  wire: el.classList.contains('wire'),
  scale: parseFloat(el.dataset.zap || 1),
  hover: 0, // target from hover or focus
  kick: 0, // transient charge from arcs and surges, decays on its own
  level: 0, // what is drawn, follows the others with an envelope
  rects: [],
  shown: false
}));
const byEl = new Map(conductors.map(c => [c.el, c]));

// The line a conductor carries current along: a link's underline, or a wire's center
function segments(c) {
  if (c.wire) {
    const r = c.el.getBoundingClientRect();
    const y = Math.round(r.top + r.height / 2) + 0.5;
    return [[r.left, y, r.right, y]];
  }
  return [...c.el.getClientRects()].filter(r => r.width >= 2).map(r => [r.left, Math.round(r.bottom) - 1.5, r.right]);
}
const segY = s => s[1];
const onScreen = s => segY(s) > -20 && segY(s) < innerHeight + 20;

// Nearest point on any visible conductor to (x, y)
function nearest(x, y, maxDist) {
  let best = null;
  for (const c of conductors) {
    for (const s of c.rects) {
      if (!onScreen(s)) continue;
      const px = clamp(x, s[0], s[2]);
      const d = Math.hypot(px - x, s[1] - y);
      if (d < maxDist && (!best || d < best.d)) best = { c, x: px, y: s[1], d };
    }
  }
  return best;
}

// ---- State --------------------------------------------------------------------------------

let powered = false;
let pointer = null; // { x, y } while a mouse is over the page
let scrollEnergy = 0;
let lastScrollY = scrollY;
let lastScrollT = performance.now();
const sparks = []; // short-lived arcs: { x0, y0, x1, y1, until, power }
const surgeQueue = []; // { at, c } conductors waiting for the surge to reach them
let lastTs = 0;

function spark(x0, y0, x1, y1, power = 1, life = rand(50, 110)) {
  sparks.push({ x0, y0, x1, y1, power, until: performance.now() + life });
  crackle(power);
}

// ---- Frame --------------------------------------------------------------------------------

const loop = task(
  ts => {
    const dt = lastTs ? Math.min(0.08, (ts - lastTs) / 1000) : 0.033;
    lastTs = ts;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    scrollEnergy = Math.max(0, scrollEnergy - dt * 1.6);

    // The surge reaches conductors in page order and jumps from each one to the next
    while (surgeQueue.length && surgeQueue[0].at <= ts) {
      const { c, from } = surgeQueue.shift();
      c.kick = 1;
      const s = segments(c)[0];
      const f = from && segments(from)[0];
      if (s && f && onScreen(s) && onScreen(f)) spark(f[0], f[1], s[0], s[1], 1, 140);
    }

    let busy = sparks.length > 0 || surgeQueue.length > 0 || scrollEnergy > 0 || powered || !!pointer;

    for (const c of conductors) {
      c.rects = segments(c);
      const visible = c.rects.some(onScreen);
      const ambient = powered && c.wire ? 0.22 : 0;
      const scrolled = c.wire && visible ? scrollEnergy * 0.8 : 0;
      const target = Math.max(c.hover, c.kick, ambient, scrolled);
      c.kick = Math.max(0, c.kick - dt * 2.2);
      // fast attack, slower release, like an envelope
      c.level = target > c.level ? Math.min(target, c.level + dt / 0.1) : Math.max(target, c.level - dt / 0.3);

      const live = c.level > 0.02;
      if (live !== c.shown) {
        c.el.classList.toggle('zap', live); // the native line steps aside while the signal draws
        c.shown = live;
      }
      if (!live || !visible) continue;
      busy = true;

      ctx.strokeStyle = palette.spark;
      for (const s of c.rects) {
        if (!onScreen(s)) continue;
        const [x0, y, x1] = s;
        const h = (c.wire ? 2.5 + 9 * c.level : 4.5 * c.level) * c.scale;
        ctx.strokeStyle = palette.glow;
        zapLine(ctx, x0, y, x1, y, h * 1.5, 3, 0.18 * c.level);
        ctx.strokeStyle = palette.spark;
        zapLine(ctx, x0, y, x1, y, h * 0.6, 0.6, 0.4 * c.scale);
        zapLine(ctx, x0, y, x1, y, h * 0.5, c.wire ? 1.3 : 1.2, Math.min(1, c.level * 1.4));
      }

      // While on, live wires throw the occasional arc off their own length
      if (powered && c.wire && Math.random() < 0.025 * c.level) {
        const s = c.rects[0];
        const x = rand(s[0], s[2]);
        spark(x, s[1], x + rand(-60, 60), s[1] + rand(-70, 70), 0.6, 70);
      }
    }

    // The cursor is a live electrode. Near a conductor, current jumps the gap.
    if (pointer) {
      const reach = powered ? 170 : 110;
      const hit = nearest(pointer.x, pointer.y, reach);
      if (hit && hit.d > 6) {
        const chance = (powered ? 0.32 : 0.14) * (1 - hit.d / reach);
        if (Math.random() < chance) {
          spark(pointer.x, pointer.y, hit.x, hit.y, 0.55 + 0.45 * (1 - hit.d / reach));
          hit.c.kick = Math.max(hit.c.kick, 0.7);
        }
      }
    }

    const now = performance.now();
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      if (now > s.until) sparks.splice(i, 1);
      else drawBolt(s.x0, s.y0, s.x1, s.y1, s.power); // redrawn every frame so it flickers
    }

    return busy;
  },
  { fps: 30 }
);

const wake = () => reduceMotion.matches || loop.start();

// ---- Input --------------------------------------------------------------------------------

// Hovering a [data-circuit] group charges every conductor in it
const hoverTargets = el => {
  const group = el.closest('[data-circuit]');
  const own = el.closest('main a, .power');
  const set = new Set(own ? [byEl.get(own)] : []);
  if (group) group.querySelectorAll('a, .wire').forEach(n => byEl.get(n) && set.add(byEl.get(n)));
  return [...set].filter(Boolean);
};
let hovered = [];
function setHover(list) {
  hovered.forEach(c => !list.includes(c) && (c.hover = 0));
  list.forEach(c => (c.hover = c.wire ? 0.75 : 1));
  hovered = list;
  wake();
}

document.addEventListener('pointerover', e => setHover(hoverTargets(e.target)));
document.addEventListener('pointerleave', () => setHover([]));
document.addEventListener('focusin', e => {
  if (e.target.matches(':focus-visible')) setHover(hoverTargets(e.target));
});
document.addEventListener('focusout', () => setHover([]));

document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || !finePointer.matches) return;
  pointer = { x: e.clientX, y: e.clientY };
  wake();
});
document.documentElement.addEventListener('pointerleave', () => (pointer = null));

// Scrolling moves charge: the faster the page moves, the harder the wires crackle
window.addEventListener(
  'scroll',
  () => {
    const now = performance.now();
    const v = Math.abs(scrollY - lastScrollY) / Math.max(1, now - lastScrollT); // px per ms
    lastScrollY = scrollY;
    lastScrollT = now;
    scrollEnergy = Math.min(1, Math.max(scrollEnergy, v / 2.5));
    wake();
  },
  { passive: true }
);

// ---- Power --------------------------------------------------------------------------------

// Switching on sends current from the switch down through every conductor in page order.
// Switching off drains it back up, faster.
function surge(on) {
  powered = on;
  surgeQueue.length = 0;
  if (reduceMotion.matches) return;
  const origin = document.getElementById('power').getBoundingClientRect().top + scrollY;
  const ordered = conductors
    .map(c => ({ c, y: c.el.getBoundingClientRect().top + scrollY }))
    .filter(o => o.y >= origin - 10)
    .sort((a, b) => (on ? a.y - b.y : b.y - a.y));
  const t0 = performance.now();
  const msPerPx = on ? 0.55 : 0.25;
  ordered.forEach((o, i) => {
    surgeQueue.push({ at: t0 + Math.abs(o.y - origin) * msPerPx, c: o.c, from: i ? ordered[i - 1].c : null });
  });
  wake();
}

module.exports = { surge, zapLine };
