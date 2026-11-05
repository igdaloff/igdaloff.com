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
