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
