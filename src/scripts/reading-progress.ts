// 文章详情页顶部的阅读进度条。
// - 仅当当前页面存在 #article 时挂载；其他页面隐藏。
// - 尊重 prefers-reduced-motion，命中时不渲染。
// - 通过 astro:page-load 在 ClientRouter 切页后重新初始化，并清理旧的 scroll 监听。

const BAR_ID = "reading-progress";
const ARTICLE_SELECTOR = "#article";

let activeScrollHandler: (() => void) | null = null;

function ensureBar(): HTMLDivElement {
  let bar = document.getElementById(BAR_ID) as HTMLDivElement | null;
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = BAR_ID;
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  return bar;
}

function hideBar() {
  const bar = document.getElementById(BAR_ID);
  if (!bar) return;
  bar.style.width = "0%";
  bar.style.opacity = "0";
}

function init() {
  if (activeScrollHandler) {
    document.removeEventListener("scroll", activeScrollHandler);
    activeScrollHandler = null;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    hideBar();
    return;
  }

  const article = document.querySelector<HTMLElement>(ARTICLE_SELECTOR);
  if (!article) {
    hideBar();
    return;
  }

  const bar = ensureBar();
  bar.style.opacity = "1";

  let ticking = false;
  const update = () => {
    ticking = false;
    const rect = article.getBoundingClientRect();
    const articleTop = window.scrollY + rect.top;
    const articleHeight = article.offsetHeight;
    const scrolled = window.scrollY - articleTop;
    const total = articleHeight - window.innerHeight;

    let pct: number;
    if (total <= 0) {
      pct = scrolled > 0 ? 100 : 0;
    } else {
      pct = Math.max(0, Math.min(100, (scrolled / total) * 100));
    }
    bar.style.width = `${pct}%`;
  };

  const handler = () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  };

  activeScrollHandler = handler;
  document.addEventListener("scroll", handler, { passive: true });
  update();
}

init();
document.addEventListener("astro:page-load", init);
