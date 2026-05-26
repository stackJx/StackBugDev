---
title: Spring 面试概览
description: Spring / Spring Boot / Spring Cloud 的核心考点与原理切入点。
order: 20
updated: 2026-05-26
created: 2026-05-26
---

## 重点分布

1. **IoC 与 AOP**：BeanFactory vs ApplicationContext、循环依赖、三级缓存、代理机制（JDK vs CGLIB）
2. **Spring Boot**：自动装配、`@Conditional`、starter 设计、配置加载顺序
3. **Spring MVC**：`DispatcherServlet` 生命周期、`HandlerMapping`、参数解析与返回值处理
4. **Spring Cloud**：服务注册发现、配置中心、熔断限流、链路追踪

## 复习路径

从 IoC 容器的 bean 生命周期切入 → AOP 与事务的实现 → Spring Boot 的自动装配如何嫁接其上 → 再扩展到分布式生态。
