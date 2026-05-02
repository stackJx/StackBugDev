import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// astro build 在项目根运行，从 cwd 解析以便打包后路径仍然有效
// （import.meta.url 会指向 dist/chunks/，找不到 src/assets/fonts/）
const fontDir = resolve(process.cwd(), "src/assets/fonts");

type SatoriFont = {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
};

// Latin/code first so digits/Latin chars stay in mono; MiSans handles CJK fallback.
const fontFiles = [
  { name: "JetBrains Mono", file: "JetBrainsMono-Regular.ttf", weight: 400 },
  { name: "JetBrains Mono", file: "JetBrainsMono-Bold.ttf", weight: 700 },
  { name: "MiSans", file: "MiSans-Regular.ttf", weight: 400 },
  { name: "MiSans", file: "MiSans-Bold.ttf", weight: 700 },
] as const;

let cache: SatoriFont[] | null = null;

async function loadLocalFonts(): Promise<SatoriFont[]> {
  if (cache) return cache;

  cache = await Promise.all(
    fontFiles.map(async ({ name, file, weight }) => ({
      name,
      data: await readFile(`${fontDir}/${file}`),
      weight,
      style: "normal" as const,
    }))
  );

  return cache;
}

export default loadLocalFonts;
