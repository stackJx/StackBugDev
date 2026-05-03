---
author: stackbug
pubDatetime: 2025-08-26T00:00:00+08:00
title: 为什么 Elasticsearch 精确查询要用 keyword？
slug: elasticsearch-keyword-vs-text
featured: false
draft: false
tags:
  - elasticsearch
  - backend
description: 从 ES 分词机制讲清楚精确查询为什么要用 keyword 而不是 text，以及如何映射多字段。
---

为什么 Elasticsearch 精确查询要用 keyword？

在使用 Elasticsearch 的过程中，很多同学都会遇到一个问题： 明明字段里有值，但直接用 term 查询查不到，非要写`.keyword`才能命中。

比如下面的查询：

```json
{
  "query": {
    "term": {
      "attributionId": "A08"
    }
  }
}
```

可能查不到结果，而改成这样就能查到：

```json
{
  "query": {
    "term": {
      "attributionId.keyword": "A08"
    }
  }
}
```

这是为什么呢？

---

## 1. Elasticsearch 的字段类型

Elasticsearch 的字符串类型字段分为两种主要 mapping：

text

- 用于全文检索，会经过分词器（analyzer）处理，存储为多个倒排索引的 token。
- 不适合精确匹配。
- 默认`term`查询时，输入值也会走分词，导致结果对不上。

keyword

- 不分词，整条字符串作为一个完整值存储。
- 适合精确匹配、聚合、排序。
- term/terms 查询天然支持。

---

## 2. 为什么 .keyword 能查到？

大多数情况下，我们在定义字符串字段时，如果没特别指定，Elasticsearch 会自动建一个 multi-field：

```text
"attributionId": {
  "type": "text",
  "fields": {
    "keyword": {
      "type": "keyword",
      "ignore_above": 256
    }
  }
}

```

这意味着：

- `attributionId`：是 text 类型，用来分词检索。
- `attributionId.keyword`：是 keyword 类型，用来精确匹配。

所以：

- 查`attributionId`→ 走分词逻辑，可能查不到。
- 查`attributionId.keyword`→ 直接精确匹配，能查到。

---

## 3. 如何选择查询方式？

精确匹配（id、编码、枚举类型） 用`.keyword`：

```json
{ "term": { "attributionId.keyword": "A08" } }
```

全文搜索（标题、描述、内容） 用`match`或查原始字段：

```json
{ "match": { "title": "Elasticsearch 教程" } }
```

---

## 4. 最佳实践

建模时区分好字段类型

- 业务 ID、状态码、分类：用`keyword`
- 可全文检索的文本：用`text`

查询时用对字段

- 精确查`.keyword`
- 模糊查原始字段

---

## 5. 总结

查不到数据并不是 ES “坏了”，而是你查错了字段。

- 必要时调整 mapping 如果字段不需要分词，可以直接定义成`keyword`，避免混淆。
- `text`用于全文检索，不适合精确匹配。
- `keyword`用于精确匹配、聚合、排序。
- 在写查询时一定要根据字段用途选择正确的类型。
