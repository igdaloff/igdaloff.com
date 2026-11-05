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
