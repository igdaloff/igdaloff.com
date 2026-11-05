(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// igdaloff.com: a live wire. Everything is a conductor; the "off" in the name is the switch.

const palette = require('./site/palette');
const card = require('./site/card');
require('./site/electric');
require('./site/power');

palette.refresh();
card.load();

// Favicon switches "off" while the tab is in the background
document.addEventListener('visibilitychange', () => {
  const favicon = document.querySelector('[rel=icon]');
  favicon.href = document.hidden ? './src/images/favicon/off/favicon-32x32.png' : './src/images/favicon/favicon-32x32.png';
});

},{"./site/card":3,"./site/electric":4,"./site/palette":5,"./site/power":6}],2:[function(require,module,exports){
// Sound is opt-in: nothing plays until the power switch is clicked, and switching off silences it.
// One shared AudioContext, a mains hum while powered, and short crackles when arcs fire.

let ctx = null;
let hum = null;
let noise = null;
let lastCrackle = 0;

const HUM_LEVEL = 0.03;
const CRACKLE_LEVEL = 0.05;

function getAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(ac) {
  if (noise) return noise;
  const len = ac.sampleRate;
  noise = ac.createBuffer(1, len, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

// 60Hz mains with a buzzy second harmonic, like a transformer under load
function buildHum(ac) {
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.connect(master);
  [
    [60, 'sine', 0.5],
    [120, 'sawtooth', 0.22],
    [180, 'square', 0.05]
  ].forEach(([f, type, g]) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const og = ac.createGain();
    og.gain.value = g;
    o.connect(og).connect(lp);
    o.start();
  });
  return master;
}

// level 0..1. A short time constant so the hum cuts in and out with the flicker.
function setHum(level, ramp = 0.015) {
  const ac = level > 0 ? getAudio() : ctx;
  if (!ac) return;
  if (!hum) {
    if (level <= 0) return;
    hum = buildHum(ac);
  }
  hum.gain.cancelScheduledValues(ac.currentTime);
  hum.gain.setTargetAtTime(level * HUM_LEVEL, ac.currentTime, ramp);
}

// A snap of filtered noise. Only sounds once audio exists, so only after the switch was clicked.
function crackle(intensity = 1) {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (now - lastCrackle < 0.05) return; // keep it a crackle, not a wall of noise
  lastCrackle = now;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800 + Math.random() * 4200;
  bp.Q.value = 0.9;
  const g = ctx.createGain();
  const dur = 0.03 + Math.random() * 0.07;
  g.gain.setValueAtTime(CRACKLE_LEVEL * intensity, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(now, Math.random() * 0.8, dur + 0.02);
}

module.exports = { getAudio, setHum, crackle };

},{}],3:[function(require,module,exports){
// "Last track saved": the most recent Spotify like, read from a Google Sheet by a Netlify function.

const html = String.raw;

function dayLabel(dateAdded) {
  const d = new Date(dateAdded);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'today';
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZoneName: 'short'
  });
}

function render({ artistName, trackUrl, artistImage, trackName, dateAdded }) {
  const image = artistImage.split(',')[0];
  return html`
    <div class="player text-sm sm:w-[300px]">
      <div class="player-inner p-1 flex gap-2 items-center justify-start">
        <a href="${trackUrl}" class="size-12">
          <img class="block w-full rounded-sm" src="${image}" alt="Image of ${artistName} album art" />
        </a>
        <a href="${trackUrl}" class="flex no-underline flex-col max-w-[60%]">
          <span class="font-bold text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${artistName}</span>
          <span class="text-nowrap text-ellipsis overflow-hidden sm:hover:underline">${trackName}</span>
        </a>
        <a href="${trackUrl}" class="player-play ml-auto mr-1 rounded-full size-8 flex justify-center items-center">
          <span class="play-triangle relative right-[-2px]"></span>
        </a>
      </div>
      <div class="player-foot p-1 text-xs flex gap-1 items-center">
        <span class="italic before:content-['>'] before:not-italic">Last track saved ${dayLabel(dateAdded)}</span>
      </div>
    </div>
  `;
}

function load() {
  fetch('/.netlify/functions/fetch-sheet')
    .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(data => {
      const box = document.querySelector('.track-player');
      box.innerHTML = render(data);
      box.classList.add('animate-slide-in');
    })
    .catch(err => console.log(err));
}

module.exports = { load };

},{}],4:[function(require,module,exports){
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

},{"./audio":2,"./palette":5,"./scheduler":7,"./util":8}],5:[function(require,module,exports){
// Cached palette. CSS custom properties are the source of truth; canvas code reads this cache
// instead of calling getComputedStyle every frame. Refreshed whenever the power state changes.

const KEYS = ['ink', 'paper', 'spark', 'glow'];
const palette = {};
const listeners = [];

function refresh() {
  const css = getComputedStyle(document.body);
  KEYS.forEach(k => (palette[k] = css.getPropertyValue(`--${k}`).trim()));
  listeners.forEach(fn => fn(palette));
}

const onChange = fn => listeners.push(fn);

module.exports = { palette, refresh, onChange };

},{}],6:[function(require,module,exports){
// The "off" in Igdaloff is the site's power switch. Clicking it is also the opt-in for sound.

const { reduceMotion } = require('./util');
const palette = require('./palette');
const { setHum, crackle, getAudio } = require('./audio');
const electric = require('./electric');

const btn = document.getElementById('power');
const face = btn.querySelector('span');
const nameRest = document.querySelector('.name-rest');
const themeMeta = document.querySelector('meta[name="theme-color"]');

let powered = false;
let timers = [];

// Lights do not crossfade. They catch, drop, catch again, sag, then hold.
const BROWNOUT_ON = [
  [0, 'on'],
  [50, 'off'],
  [95, 'on'],
  [170, 'off'],
  [215, 'sag'],
  [430, 'on']
];
const BROWNOUT_OFF = [
  [0, 'off'],
  [60, 'sag'],
  [110, 'off']
];

// One frame of the lights: palette, sag, hum, and everything drawn from the palette
function lights(state) {
  document.body.classList.toggle('on', state !== 'off');
  document.body.classList.toggle('sag', state === 'sag');
  palette.refresh();
  if (themeMeta) themeMeta.content = palette.palette.paper;
  setHum(state === 'on' ? 1 : state === 'sag' ? 0.4 : 0, state === 'off' && !powered ? 0.06 : 0.01);
  if (state !== 'off' || powered) crackle(0.8);
}

function setPower(on) {
  powered = on;
  timers.forEach(clearTimeout);
  timers = [];
  if (on) getAudio(); // created inside the click, so the browser allows it

  nameRest.classList.toggle('gone', on);
  nameRest.classList.remove('back');
  if (!on) {
    void nameRest.offsetWidth; // restart the flicker back in
    nameRest.classList.add('back');
  }
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Turn site off' : 'Turn site on');
  face.textContent = on ? 'on' : 'off';
  btn.classList.remove('flip');
  void btn.offsetWidth; // restart the flip
  btn.classList.add('flip');

  if (reduceMotion.matches) lights(on ? 'on' : 'off');
  else (on ? BROWNOUT_ON : BROWNOUT_OFF).forEach(([t, state]) => timers.push(setTimeout(() => lights(state), t)));

  electric.surge(on);
}

btn.addEventListener('click', () => setPower(!powered));

},{"./audio":2,"./electric":4,"./palette":5,"./util":8}],7:[function(require,module,exports){
// One requestAnimationFrame loop for the whole site. Each system registers a task with its
// own frame budget. The loop only runs while some task is active, and never while the tab is hidden.

const tasks = [];
let raf = 0;

function loop(ts) {
  raf = 0;
  if (document.hidden) return;
  let busy = false;
  for (const t of tasks) {
    if (!t.active) continue;
    if (ts - t.last >= t.interval) {
      t.last = ts;
      if (t.fn(ts) === false) t.active = false; // a task returns false to put itself to sleep
    }
    busy = busy || t.active;
  }
  if (busy) raf = requestAnimationFrame(loop);
}

function wake() {
  if (!raf && !document.hidden && tasks.some(t => t.active)) raf = requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', wake);

function task(fn, { fps = 60 } = {}) {
  const t = {
    fn,
    interval: 1000 / fps - 2, // small tolerance so 30fps tasks do not drop to 20 on 60Hz screens
    last: -Infinity,
    active: false,
    start() {
      t.active = true;
      wake();
    },
    stop() {
      t.active = false;
    }
  };
  tasks.push(t);
  return t;
}

module.exports = { task };

},{}],8:[function(require,module,exports){
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

},{}]},{},[1]);
