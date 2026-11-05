(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// igdaloff.com: the page is a recording. Scroll position is the playhead.

const track = require('./site/track');
const palette = require('./site/palette');
const rail = require('./site/rail');
const type = require('./site/type');
const playback = require('./site/playback');
const zap = require('./site/zap');
const card = require('./site/card');
const { verticalMQ, clamp } = require('./site/util');
require('./site/power');

const elapsedEl = document.getElementById('elapsed');
const totalEl = document.getElementById('total');
const nowLabel = document.getElementById('nowLabel');
const slider = document.getElementById('wave');
const { fmt } = track;

totalEl.textContent = fmt(track.totalSec);

let lastSec = null;
function update() {
  const p = clamp(track.scrollToP(scrollY));
  const s = track.sectionAt(p);
  const time = fmt(track.timeAt(p));
  elapsedEl.textContent = time;
  slider.setAttribute('aria-valuenow', Math.round(p * 100));
  slider.setAttribute('aria-valuetext', `${s.label}, ${time} of ${fmt(track.totalSec)}`);
  if (s !== lastSec) {
    lastSec?.el.classList.remove('is-playing');
    s.el.classList.add('is-playing');
    nowLabel.textContent = s.label;
    lastSec = s;
  }
  type.ink();
  rail.draw();
}

function labelCues() {
  track.sections.forEach(s => {
    const cue = s.el.querySelector('.cue');
    cue.textContent = fmt(s.tStart);
    cue.setAttribute('aria-label', `Jump to ${s.label} at ${fmt(s.tStart)}`);
    cue.onclick = () => playback.seek(s.p0 + 0.0001);
  });
}

function relayout() {
  track.measure();
  rail.build();
  labelCues();
  type.measure();
  update();
}

palette.refresh();
palette.onChange(() => {
  rail.draw();
  zap.refreshColor();
});
type.init();
window.addEventListener('scroll', update, { passive: true });
window.addEventListener('resize', relayout);
verticalMQ.addEventListener?.('change', relayout);
relayout();
document.fonts?.ready.then(relayout);

card.load();

// Favicon switches "off" while the tab is in the background
document.addEventListener('visibilitychange', () => {
  const favicon = document.querySelector('[rel=icon]');
  favicon.href = document.hidden ? './src/images/favicon/off/favicon-32x32.png' : './src/images/favicon/favicon-32x32.png';
});

},{"./site/card":3,"./site/palette":4,"./site/playback":5,"./site/power":6,"./site/rail":8,"./site/track":11,"./site/type":12,"./site/util":13,"./site/zap":14}],2:[function(require,module,exports){
// One shared AudioContext, created on the first user gesture that needs sound.

let ctx = null;

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

// Tape hiss with a faint mains hum: the sound of a room with the gear switched on.
// Built once, then only its master gain moves.
const ROOM_LEVEL = 0.018;
let room = null;

function buildRoom(ac) {
  const master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);

  // Two seconds of noise, slightly pinked, looped
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = 0.86 * last + 0.14 * (Math.random() * 2 - 1);
    data[i] = last * 3;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 700;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7500;

  // Slow wow and flutter on the hiss level
  const flutter = ac.createGain();
  flutter.gain.value = 1;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.35;
  const lfoDepth = ac.createGain();
  lfoDepth.gain.value = 0.18;
  lfo.connect(lfoDepth).connect(flutter.gain);

  noise.connect(hp).connect(lp).connect(flutter).connect(master);

  // Hum at 60Hz and its second harmonic, well under the hiss
  [
    [60, 0.12],
    [120, 0.07]
  ].forEach(([f, g]) => {
    const o = ac.createOscillator();
    o.frequency.value = f;
    const og = ac.createGain();
    og.gain.value = g;
    o.connect(og).connect(master);
    o.start();
  });

  noise.start();
  lfo.start();
  return master;
}

// level 0..1 of ROOM_LEVEL. Ramps briefly so changes click like a switch, not pop.
function setRoom(level, ramp = 0.02) {
  const ac = level > 0 ? getAudio() : ctx;
  if (!ac) return;
  if (!room) {
    if (level <= 0) return;
    room = buildRoom(ac);
  }
  const g = room.gain;
  g.cancelScheduledValues(ac.currentTime);
  g.setTargetAtTime(level * ROOM_LEVEL, ac.currentTime, ramp);
}

module.exports = { getAudio, setRoom };

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
// Cached palette. CSS custom properties are the source of truth; canvas code reads this cache
// instead of calling getComputedStyle every frame. Refreshed whenever the power state changes.

const KEYS = ['ink', 'paper', 'body', 'muted', 'unplayed', 'hover', 'ghost'];
const palette = {};
const listeners = [];

function refresh() {
  const css = getComputedStyle(document.body);
  KEYS.forEach(k => (palette[k] = css.getPropertyValue(`--${k}`).trim()));
  listeners.forEach(fn => fn(palette));
}

const onChange = fn => listeners.push(fn);

module.exports = { palette, refresh, onChange };

},{}],5:[function(require,module,exports){
// Play: auto-scroll at reading speed, with a soft note four times a second.
// Manual wheel or touch input hands control back to the reader.

const track = require('./track');
const { task } = require('./scheduler');
const { getAudio } = require('./audio');
const { amp, kick } = require('./signal');
const { clamp } = require('./util');

const btn = document.getElementById('play');
const NOTES_PER_SEC = 4;
const PENTA = [0, 2, 4, 7, 9]; // G pentatonic from 196Hz

let playing = false;
let playT = 0;
let lastTs = 0;
let lastNote = -1;

function note(p, s) {
  const a = amp(p);
  kick(0.4 + a * 0.6);
  const ac = getAudio();
  if (!ac) return;
  const now = ac.currentTime;
  const deg = Math.floor(a * 9) + s.root;
  const semis = PENTA[deg % 5] + 12 * Math.floor(deg / 5);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 196 * Math.pow(2, semis / 12);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.05 * a + 0.01, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

const loop = task(ts => {
  if (!playing) return false;
  const dt = lastTs ? (ts - lastTs) / 1000 : 0;
  lastTs = ts;
  playT += dt;
  if (playT >= track.totalSec) {
    track.seek(1);
    stop();
    return false;
  }
  const p = track.pAtTime(playT);
  track.seek(p);
  const n = Math.floor(playT * NOTES_PER_SEC);
  if (n !== lastNote) note(p, track.sectionAt(p));
  lastNote = n;
});

function setLabel() {
  btn.textContent = playing ? 'Pause' : 'Play';
  btn.setAttribute('aria-pressed', String(playing));
}

function start() {
  getAudio(); // created inside the click, so the browser allows it
  const p = clamp(track.scrollToP(scrollY));
  playT = p >= 0.999 ? 0 : track.timeAt(p);
  playing = true;
  lastTs = 0;
  lastNote = -1;
  setLabel();
  loop.start();
}

function stop() {
  if (!playing) return;
  playing = false;
  setLabel();
}

// Seek from the rail or a cue; playback, if running, carries on from there
function seek(p) {
  track.seek(p);
  if (playing) playT = track.timeAt(clamp(p));
}

btn.addEventListener('click', () => (playing ? stop() : start()));
['wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => playing && stop(), { passive: true }));

module.exports = { seek, stop, isPlaying: () => playing };

},{"./audio":2,"./scheduler":9,"./signal":10,"./track":11,"./util":13}],6:[function(require,module,exports){
// The "off" in Igdaloff is the site's power switch. Power is independent of Play:
// switching on never starts scrolling.

const { reduceMotion } = require('./util');
const palette = require('./palette');
const { setRoom } = require('./audio');
const pulse = require('./pulse');

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

// Apply one frame of the lights: palette, sag, room tone, and anything drawn from the palette
function lights(state) {
  const lit = state !== 'off';
  document.body.classList.toggle('on', lit);
  document.body.classList.toggle('sag', state === 'sag');
  palette.refresh();
  if (themeMeta) themeMeta.content = palette.palette.paper;
  setRoom(state === 'on' ? 1 : state === 'sag' ? 0.45 : 0, state === 'off' && !powered ? 0.08 : 0.01);
}

function setPower(on) {
  powered = on;
  timers.forEach(clearTimeout);
  timers = [];

  nameRest.classList.toggle('gone', on);
  nameRest.classList.remove('back');
  if (!on) {
    void nameRest.offsetWidth; // restart the flicker back in
    nameRest.classList.add('back');
  }
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Turn site off' : 'Turn site on');
  if (face.textContent !== (on ? 'on' : 'off')) {
    face.textContent = on ? 'on' : 'off';
    btn.classList.remove('flip');
    void btn.offsetWidth; // restart the flip
    btn.classList.add('flip');
  }

  if (reduceMotion.matches) lights(on ? 'on' : 'off');
  else (on ? BROWNOUT_ON : BROWNOUT_OFF).forEach(([t, state]) => timers.push(setTimeout(() => lights(state), t)));

  on ? pulse.start() : pulse.stop();
}

btn.addEventListener('click', () => setPower(!powered));

module.exports = { isPowered: () => powered };

},{"./audio":2,"./palette":4,"./pulse":7,"./util":13}],7:[function(require,module,exports){
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

},{"./palette":4,"./scheduler":9,"./signal":10,"./track":11,"./util":13,"./zap":14}],8:[function(require,module,exports){
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

},{"./palette":4,"./playback":5,"./signal":10,"./track":11,"./util":13}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
// Amplitude sources. For now: the seeded waveform drawn from each section's own text,
// and a short "kick" that playback notes send to the room.

const { rng } = require('./util');
const { sectionAt } = require('./track');

// Editing a section's copy changes the shape of its waveform. That is intentional.
function amp(p) {
  const s = sectionAt(p);
  const t = (p - s.p0) / (s.p1 - s.p0);
  const edge = Math.min(1, t / 0.06, (1 - t) / 0.06); // fade at each edge so gaps read as track breaks
  const env = edge <= 0 ? 0 : Math.sin((Math.min(1, edge) * Math.PI) / 2);
  const x = t * (s.ctrl.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = s.ctrl[i];
  const b = s.ctrl[Math.min(i + 1, s.ctrl.length - 1)];
  const smooth = a + ((b - a) * (1 - Math.cos(f * Math.PI))) / 2;
  const jitter = rng(s.seed ^ Math.round(p * 4000))();
  return Math.max(0.04, env * s.energy * (0.25 + 0.5 * smooth + 0.25 * jitter));
}

// Each note sets the kick, which decays by 0.75 every 50ms. Computed on read, so no loop is needed.
let kickValue = 0;
let kickAt = 0;
const kickLevel = (now = performance.now()) => kickValue * Math.pow(0.75, (now - kickAt) / 50);
function kick(v) {
  const now = performance.now();
  kickValue = Math.max(kickLevel(now), v);
  kickAt = now;
}

module.exports = { amp, kick, kickLevel };

},{"./track":11,"./util":13}],11:[function(require,module,exports){
// The page as one track. Each [data-track] section is a segment whose share of the track
// matches its share of page height, and whose runtime is its reading time.

const { clamp, hash, rng, fmt } = require('./util');

const WORDS_PER_SEC = 230 / 60; // runtime = reading time

const sections = [...document.querySelectorAll('[data-track]')].map(el => {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const seed = hash(text);
  const r = rng(seed);
  return {
    el,
    label: el.dataset.track,
    words: text.split(' ').length,
    energy: 0.55 + r() * 0.45,
    ctrl: Array.from({ length: 14 }, () => r()),
    root: Math.floor(r() * 5),
    seed,
    tStart: 0,
    p0: 0,
    p1: 1
  };
});

let acc = 0;
sections.forEach(s => {
  s.tStart = acc / WORDS_PER_SEC;
  acc += s.words;
});
const totalSec = acc / WORDS_PER_SEC;
const duration = s => s.words / WORDS_PER_SEC;

const view = { docH: 1, vh: 1, maxScroll: 1 };

function measure() {
  view.docH = document.documentElement.scrollHeight;
  view.vh = window.innerHeight;
  view.maxScroll = Math.max(1, view.docH - view.vh);
  const starts = sections.map((s, i) => (i === 0 ? 0 : s.el.getBoundingClientRect().top + scrollY - 24));
  sections.forEach((s, i) => {
    s.p0 = starts[i] / view.docH;
    s.p1 = i < sections.length - 1 ? starts[i + 1] / view.docH : 1;
  });
}

// The reading line slides from viewport top to bottom as you scroll, so 0 and 1 are both reachable.
// Every scrub, seek and playback step goes through these two.
const scrollToP = y => (y + view.vh * (y / view.maxScroll)) / view.docH;
const pToScroll = p => (p * view.docH) / (1 + view.vh / view.maxScroll);

// Document y of the reading line, for anything that compares itself against it
const readY = () => clamp(scrollToP(scrollY)) * view.docH;

const sectionAt = p => sections.find(s => p >= s.p0 && p < s.p1) || sections[sections.length - 1];

const timeAt = p => {
  const s = sectionAt(p);
  return s.tStart + ((p - s.p0) / (s.p1 - s.p0)) * duration(s);
};

const pAtTime = t => {
  const s = sections.find(sec => t < sec.tStart + duration(sec)) || sections[sections.length - 1];
  return s.p0 + clamp((t - s.tStart) / duration(s)) * (s.p1 - s.p0);
};

const seek = p => window.scrollTo({ top: pToScroll(clamp(p)), behavior: 'auto' });

module.exports = { sections, totalSec, view, measure, scrollToP, pToScroll, readY, sectionAt, timeAt, pAtTime, seek, fmt };

},{"./util":13}],12:[function(require,module,exports){
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

},{"./playback":5,"./scheduler":9,"./signal":10,"./track":11,"./util":13}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
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

},{"./scheduler":9,"./util":13}]},{},[1]);
