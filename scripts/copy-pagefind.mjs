// 把 pagefind 在 dist/ 下生成的索引镜像到 public/，
// 以便后续 `pnpm run dev` 也能命中搜索（public/pagefind 已被 gitignore）。
//
// 用 fs.cpSync 而非 `cp -r`，原因：
// 1. 跨平台（Windows 也能跑）
// 2. 先 rmSync 避免旧 hash 文件残留 —— pagefind 输出文件名带哈希，
//    多次 build 后 cp 合并会让 public/pagefind 越攒越多
import { rmSync, cpSync, existsSync } from "node:fs";

const src = "dist/pagefind";
const dst = "public/pagefind";

if (!existsSync(src)) {
  console.error(`[copy-pagefind] source missing: ${src}`);
  process.exit(1);
}

rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
