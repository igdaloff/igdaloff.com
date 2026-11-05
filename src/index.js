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
