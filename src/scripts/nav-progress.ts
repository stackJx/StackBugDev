function createNavProgress() {
  const bar = document.createElement("div");
  bar.id = "nav-progress";
  bar.style.cssText = `
    position: fixed; top: 0; left: 0; height: 3px; z-index: 9999;
    background: var(--accent); width: 0; opacity: 0;
    transition: width 0.2s ease, opacity 0.2s ease;
    pointer-events: none;
  `;
  document.body.appendChild(bar);
  return bar;
}

function initNavProgress() {
  let bar = document.getElementById("nav-progress") || createNavProgress();
  const timers: ReturnType<typeof setTimeout>[] = [];

  function clearTimers() {
    while (timers.length) clearTimeout(timers.shift());
  }

  function setProgress(pct: number) {
    bar.style.opacity = "1";
    bar.style.width = `${pct}%`;
  }

  function hide() {
    bar.style.opacity = "0";
    setTimeout(() => {
      bar.style.width = "0";
    }, 200);
  }

  document.addEventListener("astro:before-preparation", () => {
    bar = document.getElementById("nav-progress") || createNavProgress();
    clearTimers();
    setProgress(20);
    timers.push(setTimeout(() => setProgress(45), 300));
    timers.push(setTimeout(() => setProgress(60), 600));
  });

  document.addEventListener("astro:after-swap", () => {
    clearTimers();
    setProgress(100);
    setTimeout(hide, 150);
  });
}

initNavProgress();
