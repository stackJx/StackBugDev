// Constants
const THEME = "theme";
const LIGHT = "light";
const DARK = "dark";

// 主题已由 Layout.astro 的 inline FOUC 脚本提前选定并写入 window.theme；
// 此处直接消费，?? LIGHT 仅在极端情况（内联脚本被阻塞）下兜底。
let themeValue = window.theme?.themeValue ?? LIGHT;

function setPreference(): void {
  localStorage.setItem(THEME, themeValue);
  reflectPreference();
}

const themeColorMap: Record<string, string> = {
  light: "#f8f9fa",
  dark: "#0f0f0f",
};

function reflectPreference(): void {
  document.firstElementChild?.setAttribute("data-theme", themeValue);
  document
    .querySelector("#theme-btn")
    ?.setAttribute("aria-pressed", themeValue === DARK ? "true" : "false");

  const color = themeColorMap[themeValue] ?? "#ffffff";
  document
    .querySelector("meta[name='theme-color']")
    ?.setAttribute("content", color);
}

// Update the global theme API
if (window.theme) {
  window.theme.setPreference = setPreference;
  window.theme.reflectPreference = reflectPreference;
} else {
  window.theme = {
    themeValue,
    setPreference,
    reflectPreference,
    getTheme: () => themeValue,
    setTheme: (val: string) => {
      themeValue = val;
    },
  };
}

// Ensure theme is reflected (in case body wasn't ready when inline script ran)
reflectPreference();

function setThemeFeature(): void {
  // set on load so screen readers can get the latest value on the button
  reflectPreference();

  // now this script can find and listen for clicks on the control
  document.querySelector("#theme-btn")?.addEventListener("click", () => {
    themeValue = themeValue === LIGHT ? DARK : LIGHT;
    window.theme?.setTheme(themeValue);
    setPreference();
  });
}

// Set up theme features after page load
setThemeFeature();

// Runs on view transitions navigation
document.addEventListener("astro:after-swap", setThemeFeature);

// Set theme-color value before page transition
// to avoid navigation bar color flickering in Android dark mode
document.addEventListener("astro:before-swap", event => {
  const astroEvent = event;
  const bgColor = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");

  if (bgColor) {
    astroEvent.newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
});

// sync with system changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches: isDark }) => {
    themeValue = isDark ? DARK : LIGHT;
    window.theme?.setTheme(themeValue);
    setPreference();
  });
