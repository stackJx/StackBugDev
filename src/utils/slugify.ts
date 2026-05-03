import slugify from "slugify";

const hasNonLatin = (str: string): boolean => /[^\x00-\x7F]/.test(str);

/**
 * Slugify a string using a hybrid approach:
 * - For Latin-only strings: use slugify (eg: "E2E Testing" -> "e2e-testing", "TypeScript 5.0" -> "typescript-5.0")
 * - For strings with non-Latin characters: use a simple kebab-case (preserves non-Latin chars)
 */
export const slugifyStr = (str: string): string => {
  if (hasNonLatin(str)) {
    return str
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-");
  }
  return slugify(str, { lower: true });
};

export const slugifyAll = (arr: string[]) => arr.map(str => slugifyStr(str));
