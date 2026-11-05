// igdaloff.com: a live wire. Everything is a conductor; the "off" in the name is the switch.

const palette = require('./site/palette');
const card = require('./site/card');
require('./site/electric');
require('./site/power');

palette.refresh();
card.load();

// Favicon switches "off" while the tab is in the background
document.addEventListener('visibilitychange', () => {
  const favicon = document.querySelector('[rel=icon]');
  favicon.href = document.hidden ? './src/images/favicon/off/favicon-32x32.png' : './src/images/favicon/favicon-32x32.png';
});
