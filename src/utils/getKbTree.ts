import type { CollectionEntry } from "astro:content";
import { KB_PATH } from "@/content.config";
import { slugifyStr } from "./slugify";

export type KbEntry = CollectionEntry<"kb">;

export interface KbSubgroup {
  /** 二级目录的 slug，例如 'java'、'system-design' */
  slug: string;
  /** 用于展示的子分组名称，从 slug 推导（'system-design' → 'System Design'） */
  name: string;
  /** 子分组下的条目，已按 order/title 排序 */
  items: KbEntry[];
}

export interface KbCategory {
  /** 用于 URL 的分类 slug，从一级目录推导 */
  slug: string;
  /** 用于展示的分类名称，来自 index.md 的 category 字段，否则用 slug */
  name: string;
  /** 该分类下的全部条目，已按 order/title 排序，包含 index 条目 */
  items: KbEntry[];
  /** 分类首页条目（id 形如 `<slug>/index`），可能为空 */
  indexEntry: KbEntry | undefined;
  /**
   * 用于侧边栏列出的条目（剔除 hideInSidebar 与 index 条目）。
   * 顺序：先 rootItems，再按 subgroups 顺序扁平展开。
   * 该顺序也用作详情页"上一篇/下一篇"导航的扁平顺序。
   */
  sidebarItems: KbEntry[];
  /** 直接挂在一级分类下、没有二级目录的条目 */
  rootItems: KbEntry[];
  /** 按二级目录分组的子组，已排序 */
  subgroups: KbSubgroup[];
  /** 分类入口的描述：优先 index.md 的 description */
  description: string;
}

/** 推导一个条目的一级目录（分类 slug），entry.id 形如 `java/getting-started` 或 `java/index` */
function deriveCategorySlug(entry: KbEntry): string {
  const segments = entry.id.split("/");
  return segments.length > 1 ? segments[0] : "uncategorized";
}

/**
 * 推导一个条目所属的二级目录 slug。
 * - `interview/index` → null（分类首页）
 * - `interview/intro` → null（直接挂在分类下，归入 rootItems）
 * - `interview/java/overview` → 'java'
 * - `interview/java/jvm/gc` → 'java'（三级及以上仍归并到二级 subgroup）
 */
function deriveSubgroupSlug(entry: KbEntry): string | null {
  const segments = entry.id.split("/");
  if (segments.length <= 2) return null;
  return segments[1];
}

/** 把 kebab-case 的 slug 转为可展示名，例如 'system-design' → 'System Design' */
function humanizeSubgroup(slug: string): string {
  return slug
    .split("-")
    .map(w => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** 判断条目是否为分类首页（文件名为 index.md） */
export function isCategoryIndex(entry: KbEntry): boolean {
  return entry.id.split("/").at(-1) === "index";
}

/** 比较两个条目在同一分类内的展示顺序 */
function compareEntries(a: KbEntry, b: KbEntry): number {
  const orderDiff = a.data.order - b.data.order;
  if (orderDiff !== 0) return orderDiff;
  return a.data.title.localeCompare(b.data.title, "zh-Hans-CN");
}

/**
 * 构建一个条目在 /kb 命名空间下的完整 URL。
 * - 分类首页 (`<cat>/index`) → `/kb/<cat>`
 * - 其他条目 → `/kb/<cat>/<slug>`
 */
export function getKbPath(entry: KbEntry): string {
  const segments = entry.id.split("/");
  const last = segments.at(-1)!;
  const categorySegments = segments.slice(0, -1).map(s => slugifyStr(s));
  if (last === "index") {
    return ["/kb", ...categorySegments].join("/");
  }
  return ["/kb", ...categorySegments, slugifyStr(last)].join("/");
}

/** 把扁平的 collection entries 整理成按分类分组的树。已过滤 draft。 */
export function buildKbTree(entries: KbEntry[]): KbCategory[] {
  const visible = entries.filter(e => !e.data.draft);

  const byCategory = new Map<string, KbEntry[]>();
  for (const entry of visible) {
    const slug = deriveCategorySlug(entry);
    const bucket = byCategory.get(slug) ?? [];
    bucket.push(entry);
    byCategory.set(slug, bucket);
  }

  const categories: KbCategory[] = [];
  for (const [slug, items] of byCategory) {
    items.sort(compareEntries);
    const indexEntry = items.find(isCategoryIndex);
    const visibleItems = items.filter(
      e => !isCategoryIndex(e) && !e.data.hideInSidebar
    );

    // 二级分组：把可见条目按二级目录归类，没有二级目录的进入 rootItems
    const rootItems: KbEntry[] = [];
    const bySubgroup = new Map<string, KbEntry[]>();
    for (const item of visibleItems) {
      const subSlug = deriveSubgroupSlug(item);
      if (subSlug === null) {
        rootItems.push(item);
      } else {
        const bucket = bySubgroup.get(subSlug) ?? [];
        bucket.push(item);
        bySubgroup.set(subSlug, bucket);
      }
    }
    const subgroups: KbSubgroup[] = [];
    for (const [subSlug, subItems] of bySubgroup) {
      subItems.sort(compareEntries);
      subgroups.push({
        slug: subSlug,
        name: humanizeSubgroup(subSlug),
        items: subItems,
      });
    }
    // 子组之间的顺序：用子组内首个条目（已按 compareEntries 排序）的 order 作为权重
    subgroups.sort((a, b) => {
      const ao = a.items[0]?.data.order ?? Number.POSITIVE_INFINITY;
      const bo = b.items[0]?.data.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.slug.localeCompare(b.slug);
    });

    // 扁平的侧边栏顺序，也供 getPrevNext 使用
    const sidebarItems = [
      ...rootItems,
      ...subgroups.flatMap(g => g.items),
    ];

    const name = indexEntry?.data.category ?? indexEntry?.data.title ?? slug;
    const description = indexEntry?.data.description ?? "";
    categories.push({
      slug,
      name,
      items,
      indexEntry,
      sidebarItems,
      rootItems,
      subgroups,
      description,
    });
  }

  // 分类之间的顺序：把 index 条目的 order（若无则用 Infinity）作为分类权重
  categories.sort((a, b) => {
    const ao = a.indexEntry?.data.order ?? Number.POSITIVE_INFINITY;
    const bo = b.indexEntry?.data.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.slug.localeCompare(b.slug);
  });

  return categories;
}

/** 在分类内查找当前条目的上一篇 / 下一篇（用于详情页底部导航） */
export function getPrevNext(
  category: KbCategory,
  current: KbEntry
): { prev: KbEntry | undefined; next: KbEntry | undefined } {
  const list = category.sidebarItems;
  const idx = list.findIndex(e => e.id === current.id);
  if (idx < 0) return { prev: undefined, next: undefined };
  return {
    prev: idx > 0 ? list[idx - 1] : undefined,
    next: idx < list.length - 1 ? list[idx + 1] : undefined,
  };
}

/** 给 editPost 之类工具使用：判断 filePath 是否属于知识库 */
export function isKbFilePath(filePath: string | undefined): boolean {
  return !!filePath && filePath.includes(KB_PATH);
}
