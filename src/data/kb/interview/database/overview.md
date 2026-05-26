---
title: 数据库面试概览
description: MySQL 与 Redis 在面试中的核心考点与思考方式。
order: 30
updated: 2026-05-26
created: 2026-05-26
---

## 重点分布

**MySQL**

- 存储引擎：InnoDB 的 B+ 树、聚簇索引、行格式
- 事务与锁：隔离级别、MVCC、间隙锁与 Next-Key Lock、死锁
- 索引设计：覆盖索引、最左前缀、回表、索引下推

**Redis**

- 数据结构：String / Hash / List / Set / ZSet 底层实现
- 持久化：RDB vs AOF、混合持久化
- 高可用：主从、Sentinel、Cluster；缓存穿透/击穿/雪崩

## 复习路径

先打通"一条 SQL 是怎么执行的"和"一条 Redis 命令是怎么处理的"两个主线，再钻细节会更省力。
