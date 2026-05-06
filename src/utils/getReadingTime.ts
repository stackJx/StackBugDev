// 估算文章阅读时长。
// 中文按 350 字/分钟，英文按 200 词/分钟（技术内容的常见基准）。
// 代码块、行内代码、图片、链接 URL、HTML 标签会先被剥除，避免被语法噪声扭曲字数。

const CHINESE_CHARS_PER_MINUTE = 350;
const ENGLISH_WORDS_PER_MINUTE = 200;

export type ReadingTime = {
  minutes: number;
  words: number;
};

export function getReadingTime(body: string | undefined): ReadingTime {
  if (!body) return { minutes: 1, words: 0 };

  const cleaned = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ");

  const chineseChars = (cleaned.match(/[一-龥]/g) ?? []).length;
  const englishWords = (cleaned.match(/[a-zA-Z][a-zA-Z'-]*/g) ?? []).length;

  const minutes = Math.max(
    1,
    Math.round(
      chineseChars / CHINESE_CHARS_PER_MINUTE +
        englishWords / ENGLISH_WORDS_PER_MINUTE
    )
  );

  return { minutes, words: chineseChars + englishWords };
}
