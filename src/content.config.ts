import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/data/blog";
export const KB_PATH = "src/data/kb";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
    }),
});

// 知识库 collection。
// 与 blog 并列、但定位不同：blog 是按时间流的文章，kb 是体系化、持续更新的主题型内容。
// 目录约定：src/data/kb/<category>/<entry>.md，其中 <category> 即一级目录（也可由 frontmatter `category` 覆盖）。
// `_index.md`（注意是双下划线之一的特殊文件名）会被 glob 的 `[^_]*.md` 排除，所以分类首页文件命名为 `index.md`。
const kb = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${KB_PATH}` }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // 显示用的分类。不填则从一级目录推导。
      category: z.string().optional(),
      // 同一分类内的排序权重，越小越靠前；同 order 时按 title 字典序。
      order: z.number().default(100),
      // 知识库强调持续更新。
      updated: z.date(),
      created: z.date().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default([]),
      ogImage: image().or(z.string()).optional(),
      // 是否在分类侧边栏中隐藏（用于分类首页等无需在自身侧边栏列出的条目）。
      hideInSidebar: z.boolean().optional(),
      hideEditPost: z.boolean().optional(),
    }),
});

export const collections = { blog, kb };
