# CLAUDE.md

本文件为在此仓库中工作的 Claude Code (claude.ai/code) 提供指引。

## 项目

本仓库是 **AstroPaper** 博客主题的一个分支/实例 —— 一个基于 Astro 5 + TypeScript + TailwindCSS 4 的静态站点。内容（博客文章）以 Markdown 形式存放于 `src/data/blog/`，并通过 Zod 校验 frontmatter schema。

包管理器为 **pnpm**（CI 中固定版本为 `pnpm@10.11.1`，Node 20）。

## 命令

```bash
pnpm install              # 安装依赖
pnpm run dev              # 在 localhost:4321 启动开发服务器
pnpm run build            # astro check -> astro build -> pagefind --site dist -> 将 pagefind 拷贝到 public
pnpm run preview          # 预览生产构建
pnpm run sync             # 重新生成 astro:content / astro:env 类型（修改 schema 后运行）
pnpm run lint             # eslint 检查
pnpm run format           # prettier --write .
pnpm run format:check     # CI 中执行此命令
```

CI（`.github/workflows/ci.yml`）会在每个 PR 上执行 `lint`、`format:check`、`build`。三者必须全部通过。

项目未配置任何测试运行器。

## 构建流水线注意事项（Pagefind 搜索）

`build` 脚本按顺序执行 **四** 个步骤：
1. `astro check`（类型检查）
2. `astro build`（产物输出到 `dist/`）
3. `pagefind --site dist`（为构建出的 HTML 建立索引，写入 `dist/pagefind/`）
4. `cp -r dist/pagefind public/`（将索引拷贝到 `public/`，以便后续 `dev` 运行时可用）

由此可知：**在至少执行过一次 `pnpm run build` 之前，搜索功能在 `pnpm run dev` 中不会生效。** `src/pages/search.astro` 在 dev 模式下会显示一条横幅提醒此事。不要试图在 dev 中"修复"搜索结果缺失的问题 —— 直接运行一次 build。

`public/pagefind/` 已被 gitignore，且为自动生成产物，永远不要手动编辑。

## 架构

### 内容流水线

- **Schema**：`src/content.config.ts` 通过 `glob({ pattern: "**/[^_]*.md", base: ./src/data/blog })` 定义 `blog` collection。以 `_` 开头的文件会被 loader 跳过。Zod schema 要求 `title`、`description`、`pubDatetime`；其余字段均为可选，默认值取自 `src/config.ts`。
- **路径解析**：`src/utils/getPath.ts` 根据文章的 `id` + `filePath` 构建公开 URL。两条不易察觉的规则：
  - `src/data/blog/` 下的子目录会成为 URL 段（例如 `blog/2025/foo.md` → `/posts/2025/foo`）。
  - 以 `_` 为前缀的子目录会从 URL 中被剥离（例如 `blog/_drafts/foo.md` → `/posts/foo`）。可借此组织内容而不影响 URL。
- **排序 / 过滤**：`getSortedPosts` 按 `modDatetime ?? pubDatetime` 倒序排序，并应用 `postFilter` —— 它会隐藏草稿，以及 `pubDatetime` 比当前时间晚于 `SITE.scheduledPostMargin`（15 分钟）的文章；但在 `import.meta.env.DEV` 下，未来日期的文章可见。
- **Slug**：`src/utils/slugify.ts` 采用混合策略 —— 对纯 ASCII 字符串使用 `slugify`（保留诸如 "TypeScript 5.0" 中的 `5.0` 形式），对包含非拉丁字符的字符串使用 `lodash.kebabcase`（保留缅甸语、中文等字符）。请始终使用 `slugifyStr`，不要直接用 `slugify`，否则非拉丁标签会损坏。

### 路由

- `src/pages/index.astro` —— 首页（featured + 最近文章，数量上限为 `SITE.postPerIndex`）
- `src/pages/posts/[...page].astro` —— 分页的文章列表
- `src/pages/posts/[...slug]/index.astro` —— 文章详情；使用 `getPath(id, filePath, false)` 构建路径，支持嵌套目录
- `src/pages/posts/[...slug]/index.png.ts` —— 动态生成单篇文章 OG 图的端点（仅当 `SITE.dynamicOgImage` 为 true 且文章未显式指定 `ogImage` 时才输出路由）
- `src/pages/tags/[tag]/[...page].astro` —— 分页的标签页，slug 来自 `getUniqueTags`
- `src/pages/og.png.ts`、`rss.xml.ts`、`robots.txt.ts` —— 站点级别端点

### 动态 OG 图

`src/utils/generateOgImages.ts` 使用 **Satori**（JSX → SVG）+ **Resvg**（SVG → PNG），从 `src/utils/og-templates/` 中的模板渲染单篇文章的 OG 卡片。`@resvg/resvg-js` 在 `astro.config.ts` 中被排除在 Vite 的 `optimizeDeps` 之外 —— 不要把它加回去，否则会破坏构建。

**字体本地化**（替换了上游的 Google Fonts 在线拉取）：`src/utils/loadLocalFonts.ts` 从 `src/assets/fonts/` 读取四个 TTF —— `JetBrainsMono-{Regular,Bold}.ttf` 用于西文/数字，`MiSans-{Regular,Bold}.ttf` 用于 CJK 字符。两组字体都注册给 Satori，按数组顺序做 glyph fallback：JetBrains Mono 在前（Latin 命中），MiSans 在后（中文 fallback）。Loader 用 `process.cwd()` 解析路径，因为 `import.meta.url` 在打包后会指向 `dist/chunks/`。改字体时记得同步更新 `loadLocalFonts.ts` 里的 `fontFiles` 数组与 og-templates 里隐式默认的字体（首位字体即 `fontFamily` 默认值）。MiSans 协议是小米字体许可（可商用、需保留版权信息，非 OFL）。

### Markdown 渲染

- Remark 插件：`remark-toc` + `remark-collapse`（折叠 "Table of contents" 这个 h2）。作者通过在文章中写 `## Table of contents` 来启用。
- Rehype 插件：`rehype-mermaid`（构建期渲染 Mermaid 图为内联 SVG，含甘特图、流程图等）。配合 `markdown.syntaxHighlight.excludeLangs: ["mermaid"]` 让 Shiki 跳过 mermaid 代码块，把它们让给 rehype-mermaid。策略为 `img-svg`（输出为 `<img>` + data URL，样式与文章 prose 隔离，避免被 Tailwind typography 干扰）。**依赖 Playwright 的 Chromium**：本地或 CI 第一次构建前需执行 `npx playwright install chromium`，否则 build 会失败。
- Shiki 双主题：`min-light` / `night-owl`，配合 `defaultColor: false`（通过 `data-theme` 切换 CSS）。
- **自定义 transformer**（`src/utils/transformers/fileName.js`）：从 fenced 代码块中读取 `file="..."` meta，并渲染文件名徽章。设置 `file=` 还会暴露一个 `--file-name-offset` CSS 变量，`PostDetails.astro` 用它来正确定位 "Copy" 按钮。删除或重命名 `file=` meta 会导致复制按钮位置异常。

### 主题（亮色/暗色）

为防止 FOUC，`src/layouts/Layout.astro` 内联一段脚本，在 body 渲染*之前*读取 `localStorage.theme` 并将 `data-theme` 设置到 `<html>` 上。完整的主题逻辑后续由 `src/scripts/theme.ts` 加载。两者必须保持同步 —— 内联脚本暴露 `window.theme`，以便延迟加载的脚本读写它。

### 路径别名

`@/*` → `./src/*`（同时定义在 `tsconfig.json` 中并由 Astro 解析）。优先使用 `@/...` 而非相对路径导入。

## 约定

- **禁止 `console.*`**：ESLint 规则 `no-console: error`。不要添加 `console.log` 调试语句；提交前必须移除。
- **Prettier**：2 空格缩进、双引号、加分号、尾随逗号（es5）、避免箭头函数参数加括号、LF 行尾。已加载 `prettier-plugin-astro` + `prettier-plugin-tailwindcss` —— 格式化时会自动排序 Tailwind class。
- **提交**：项目使用 Commitizen + conventional-commits（`cz.yaml`）。Tag 格式 `v$version`，semver，bump 时自动更新 changelog。
- **Astro 严格 tsconfig**：继承自 `astro/tsconfigs/strict`。JSX 配置为 React（供 Satori OG 模板使用），而不是用于组件 —— Astro 组件使用 `.astro` 文件。

## 站点配置

`src/config.ts`（`SITE` 对象）控制站点级行为：`postPerPage`、`postPerIndex`、`scheduledPostMargin`、`lightAndDarkMode`、`showArchives`、`dynamicOgImage`、`timezone`（IANA）、`editPost.url` 等。`src/constants.ts` 中存放 `SOCIALS` 和 `SHARE_LINKS`。绝大多数面向用户的自定义都集中在这两个文件中。

## 上游参考资料

本仓库 fork 自 AstroPaper 主题。`src/data/blog/` 下原本附带的示例文章本质上是 AstroPaper 自己的官方文档，最终会被删除/替换为站主自己的内容。如果将来需要查阅这些文档（写法、frontmatter 字段、配置项、OG 图、git hooks 设置日期、giscus 评论、LaTeX 公式、颜色方案等），到上游查即可：

- 上游仓库：<https://github.com/satnaing/astro-paper>
- 文档站点：<https://astro-paper.pages.dev/posts/>
- 关键文档对照：
  - 配置主题：<https://astro-paper.pages.dev/posts/how-to-configure-astropaper-theme/>
  - 新增文章/frontmatter 规则：<https://astro-paper.pages.dev/posts/adding-new-posts-in-astropaper-theme/>
  - 颜色方案自定义：<https://astro-paper.pages.dev/posts/customizing-astropaper-theme-color-schemes/>
  - 预设颜色方案：<https://astro-paper.pages.dev/posts/predefined-color-schemes/>
  - 动态 OG 图：<https://astro-paper.pages.dev/posts/dynamic-og-image-generation-in-astropaper-blog-posts/>
  - LaTeX 公式：<https://astro-paper.pages.dev/posts/how-to-add-latex-equations-in-blog-posts/>
  - giscus 评论集成：<https://astro-paper.pages.dev/posts/how-to-integrate-giscus-comments/>
  - 依赖升级：<https://astro-paper.pages.dev/posts/how-to-update-dependencies/>
  - 用 git hooks 设置日期：<https://astro-paper.pages.dev/posts/setting-dates-via-git-hooks/>

升级或排查主题层面的问题时，先看上游 CHANGELOG 与 issues，再决定要不要回到本仓库改。
