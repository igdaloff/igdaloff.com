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
