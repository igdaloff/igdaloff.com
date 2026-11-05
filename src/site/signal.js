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
