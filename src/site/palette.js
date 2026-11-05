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
