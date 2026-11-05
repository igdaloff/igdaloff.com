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
