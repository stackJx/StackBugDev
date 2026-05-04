// 文章详情页的客户端增强：
// - 给 markdown 渲染出的 heading 加 # 锚点链接（限定有 id，避免影响首页等手写 heading）
// - 给图片挂上点击预览
// - 给代码块挂上 Copy 按钮
// - view transition 后回到页面顶部
//
// 通过监听 astro:page-load，每次新页（含 ClientRouter swap）后都会重跑。

const COPY_LABEL = "Copy";
const LIGHTBOX_ID = "image-lightbox";
const ZOOMABLE_IMAGE_CLASS = "image-zoomable";

function addHeadingLinks() {
  const headings = document.querySelectorAll<HTMLElement>(
    "h2[id], h3[id], h4[id], h5[id], h6[id]"
  );
  for (const heading of headings) {
    if (heading.querySelector(".heading-link")) continue;
    heading.classList.add("group");

    const link = document.createElement("a");
    link.className =
      "heading-link ms-2 no-underline opacity-75 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100";
    link.href = "#" + heading.id;

    const span = document.createElement("span");
    span.ariaHidden = "true";
    span.innerText = "#";
    link.appendChild(span);
    heading.appendChild(link);
  }
}

function ensureImageLightbox() {
  let dialog = document.querySelector<HTMLDialogElement>(`#${LIGHTBOX_ID}`);
  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("dialog");
  dialog.id = LIGHTBOX_ID;
  dialog.className = "image-lightbox";
  dialog.setAttribute("aria-label", "图片预览");
  dialog.innerHTML = `
    <form method="dialog" class="image-lightbox__surface" aria-label="图片预览">
      <button
        type="submit"
        value="close"
        class="image-lightbox__close"
        aria-label="关闭图片预览"
        autofocus
      >
        ×
      </button>
      <img class="image-lightbox__img" alt="" />
    </form>
  `;

  const surface = dialog.querySelector<HTMLFormElement>(
    ".image-lightbox__surface"
  );
  const image = dialog.querySelector<HTMLImageElement>(".image-lightbox__img");
  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      dialog?.close();
    }
  });
  surface?.addEventListener("click", event => {
    if (event.target === surface) {
      dialog?.close();
    }
  });
  dialog.addEventListener("close", () => {
    if (!image) return;
    image.removeAttribute("src");
    image.removeAttribute("srcset");
    image.alt = "";
    image.title = "";
  });

  document.body.appendChild(dialog);
  return dialog;
}

function openImageLightbox(sourceImage: HTMLImageElement) {
  const dialog = ensureImageLightbox();
  const previewImage = dialog.querySelector<HTMLImageElement>(
    ".image-lightbox__img"
  );
  if (!previewImage) return;

  const source = sourceImage.currentSrc || sourceImage.src;
  if (!source) return;

  previewImage.src = source;
  previewImage.alt = sourceImage.alt || sourceImage.title || "图片预览";
  previewImage.title = sourceImage.title || sourceImage.alt || "";

  if (dialog.open) {
    dialog.close();
  }
  dialog.showModal();
  previewImage.focus();
}

function addImageZoom() {
  const article = document.querySelector<HTMLElement>("#article");
  if (!article || article.dataset.imageZoomBound === "true") return;

  article.dataset.imageZoomBound = "true";
  for (const image of article.querySelectorAll<HTMLImageElement>("img")) {
    if (image.closest("a")) continue;
    image.classList.add(ZOOMABLE_IMAGE_CLASS);
    image.setAttribute("role", "button");
    image.setAttribute("tabindex", "0");
  }

  article.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const image = target.closest("img");
    if (!image || !article.contains(image)) return;
    if (image.closest("a")) return;

    event.preventDefault();
    openImageLightbox(image);
  });
  article.addEventListener("keydown", event => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (!target.classList.contains(ZOOMABLE_IMAGE_CLASS)) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openImageLightbox(target);
  });
}

function attachCopyButtons() {
  const codeBlocks = document.querySelectorAll<HTMLPreElement>("pre");
  for (const codeBlock of codeBlocks) {
    if (codeBlock.parentElement?.dataset.copyWrap === "true") continue;

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.dataset.copyWrap = "true";

    // file= meta 会暴露 --file-name-offset，决定 copy 按钮的纵向偏移
    const computedStyle = getComputedStyle(codeBlock);
    const hasFileNameOffset =
      computedStyle.getPropertyValue("--file-name-offset").trim() !== "";
    const topClass = hasFileNameOffset ? "top-(--file-name-offset)" : "-top-3";

    const copyButton = document.createElement("button");
    copyButton.className = `copy-code absolute end-3 ${topClass} rounded bg-muted border border-muted px-2 py-1 text-xs leading-4 text-foreground font-medium`;
    copyButton.innerHTML = COPY_LABEL;
    codeBlock.setAttribute("tabindex", "0");
    codeBlock.appendChild(copyButton);

    codeBlock.parentNode?.insertBefore(wrapper, codeBlock);
    wrapper.appendChild(codeBlock);

    copyButton.addEventListener("click", async () => {
      const code = codeBlock.querySelector("code");
      await navigator.clipboard.writeText(code?.innerText ?? "");
      copyButton.innerText = "Copied";
      setTimeout(() => {
        copyButton.innerText = COPY_LABEL;
      }, 700);
    });
  }
}

function enhancePost() {
  addHeadingLinks();
  addImageZoom();
  attachCopyButtons();
}

enhancePost();
document.addEventListener("astro:page-load", enhancePost);
document.addEventListener("astro:after-swap", () =>
  window.scrollTo({ left: 0, top: 0, behavior: "instant" })
);
