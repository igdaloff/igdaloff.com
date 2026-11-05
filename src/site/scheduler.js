// One requestAnimationFrame loop for the whole site. Each system registers a task with its
// own frame budget. The loop only runs while some task is active, and never while the tab is hidden.

const tasks = [];
let raf = 0;

function loop(ts) {
  raf = 0;
  if (document.hidden) return;
  let busy = false;
  for (const t of tasks) {
    if (!t.active) continue;
    if (ts - t.last >= t.interval) {
      t.last = ts;
      if (t.fn(ts) === false) t.active = false; // a task returns false to put itself to sleep
    }
    busy = busy || t.active;
  }
  if (busy) raf = requestAnimationFrame(loop);
}

function wake() {
  if (!raf && !document.hidden && tasks.some(t => t.active)) raf = requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', wake);

function task(fn, { fps = 60 } = {}) {
  const t = {
    fn,
    interval: 1000 / fps - 2, // small tolerance so 30fps tasks do not drop to 20 on 60Hz screens
    last: -Infinity,
    active: false,
    start() {
      t.active = true;
      wake();
    },
    stop() {
      t.active = false;
    }
  };
  tasks.push(t);
  return t;
}

module.exports = { task };
