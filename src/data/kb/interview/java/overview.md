---
title: Java 面试概览
description: Java 方向的面试重点分布与复习路径。
order: 10
updated: 2026-05-26
created: 2026-05-26
---

## 重点分布

Java 面试通常围绕四块：

1. **语言基础**：泛型、注解、反射、IO/NIO、字符串、序列化
2. **JVM**：内存模型、GC、类加载、字节码、性能调优
3. **并发**：JUC、锁、AQS、`volatile`、CAS、线程池、虚拟线程
4. **集合**：HashMap、ConcurrentHashMap、ArrayList、LinkedList

## 复习路径

建议自底向上：JMM → JVM 内存结构 → GC 与调优 → 并发原语 → 高级容器。先把"为什么这样设计"讲清楚，再去记 API 与参数。
