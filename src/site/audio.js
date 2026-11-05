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
