---
author: stackbug
pubDatetime: 2025-08-08T00:00:00+08:00
title: 使用 elasticdump 跨集群迁移 Elasticsearch 索引的完整指南
slug: elasticdump-cross-cluster-migration-guide
featured: false
draft: false
tags:
  - elasticsearch
  - devops
  - tutorial
description: 用 elasticdump 在不同 Elasticsearch 集群间迁移索引的全流程指南：mapping、setting、数据。
---

## 1. 背景

Elasticsearch 运维和开发中常见这几种需求：

- 将数据从测试环境迁移到生产环境
- 不同集群之间做数据备份
- 从旧版本 ES 迁移到新版本 ES
- 跨服务器同步部分索引

少量数据可以用`reindex` API 或手动导出导入；批量迁移多个索引时，用`elasticdump`更高效。

---

## 2. elasticdump 简介

elasticdump 是一个基于 Node.js 的命令行工具，可以将 Elasticsearch 的 mapping、settings、analyzer 和 data 从一个地方导出到另一个地方。支持：

- 从 ES 导出到文件
- 从文件导入到 ES
- 直接跨 ES 集群传输

优点：

- 跨版本兼容性好
- 安装简单
- 支持分批传输、并发控制
- 可通过参数过滤数据

---

## 3. 环境准备

### 3.1 安装 Node.js

如果系统未安装 Node.js，可以参考官方安装文档或使用包管理器：

```bash
# CentOS / RHEL
yum install -y nodejs npm

# Ubuntu / Debian
apt install -y nodejs npm
```

### 3.2 安装 elasticdump

```bash
npm install elasticdump -g
```

安装完成后，运行：

```bash
elasticdump --version
```

如果能看到版本号，说明安装成功。

---

## 4. 迁移场景

假设我们要将以下索引从 源 ES 迁移到 目标 ES：

索引列表：

```text
paper_snapshot_zkbj
question_info_zkbj
zkbj
read_me
```

- 源 ES：`http://127.0.0.1:9200`
- 目标 ES：`http://10.20.3.100:9200`

---

## 5. 编写迁移脚本

我们用 Bash 脚本批量执行迁移，每个索引会先迁移 mapping，再迁移数据。

### 迁移脚本 migrate.sh

```bash
#!/bin/bash
# 源 ES
SRC_ES="http://127.0.0.1:9200"
# 目标 ES
DST_ES="http://10.20.3.100:9200"

# 要迁移的索引
INDEXES=(
  "paper_snapshot_zkbj"
  "question_info_zkbj"
  "zkbj"
  "read_me"
)

# 每个索引迁移 mapping 和 data
for index in "${INDEXES[@]}"; do
  echo "===== 正在迁移索引: $index (mapping) ====="
  elasticdump \
    --input="$SRC_ES/$index" \
    --output="$DST_ES/$index" \
    --type=mapping

  echo "===== 正在迁移索引: $index (data) ====="
  elasticdump \
    --input="$SRC_ES/$index" \
    --output="$DST_ES/$index" \
    --type=data \
    --limit=2000 \
    --concurrency=5

  echo "===== 索引 $index 迁移完成 ====="
done
```

---

## 6. 运行迁移

### 6.1 给脚本执行权限

```bash
chmod +x migrate.sh
```

### 6.2 执行迁移

```bash
./migrate.sh
```

脚本会依次迁移所有索引，日志会显示迁移进度。

---

## 7. 验证迁移结果

迁移完成后，可以在目标 ES 查询数据量是否一致：

```bash
curl -s "http://10.20.3.100:9200/paper_snapshot_zkbj/_count?pretty"
```

也可以使用 Kibana 或其他可视化工具查看。

---

## 8. 常见问题

认证问题：如果 ES 开启了用户名密码，修改连接地址：

```bash
SRC_ES="http://user:[email protected]:9200"
DST_ES="http://user:[email protected]:9200"
```

性能优化：

- 增大`--limit`（默认 100）可以提高批量传输速度
- 使用`--concurrency`增加并发写入

数据过滤：如果只想迁移部分数据，可以用`--searchBody`参数：

```properties
--searchBody='{"query":{"range":{"@timestamp":{"gte":"now-1d"}}}}'
```

---

## 9. 总结

elasticdump 适合快速跨集群传输多个索引。通过脚本可以一次性完成 mapping + data 的迁移，减少人工操作和出错概率。

如果需要支持 断点续传 或 定时同步，还可以配合`cron`定时执行，或者用`Logstash`/`Flink`做实时传输。
