---
author: stackbug
pubDatetime: 2026-05-17T00:00:00+08:00
title: Spring AI + Google ADK：打造多 Agent 并行的 AI 应用脚手架
slug: spring-ai-adk-multi-agent-scaffold
featured: true
draft: false
tags:
  - spring-ai
  - google-adk
  - java
  - ai-agent
  - multi-agent
  - gemini
  - backend
description: 基于 Spring AI 1.1.5 和 Google ADK 1.0 搭建一个生产级多 Agent 并行编排脚手架，从项目初始化到 Supervisor/Parallel 模式完整落地。
---

> 2026 年，Java 生态的 AI Agent 开发已经走向成熟。Spring AI 提供了模型抽象层，Google ADK 提供了 Agent 编排引擎 —— 两者结合，恰好填补了"从模型调用到生产级 Agent 系统"之间的工程空白。本文带你从零搭建一套可复用的脚手架。

## Table of contents

---

## 一、为什么是 Spring AI + Google ADK？

先厘清两件事：

**Spring AI 做什么？** 模型抽象层。统一的 `ChatClient` 接口对接 20+ 模型提供商（OpenAI、Anthropic、Google Gemini、Ollama 等），加上 `@Tool` 注解、MCP 协议支持、Advisors 拦截器链。

**Google ADK 做什么？** Agent 编排引擎。`LlmAgent` 定义单个 Agent、`ParallelAgent` 做并行扇出、`SequentialAgent` 串行管道、`LoopAgent` 迭代优化，外加内置的 Session/记忆管理、A2A 协议、插件体系。

分开用都能干活，但**组合起来才像是一个完整的工程框架**：

```
┌─────────────────────────────────────────┐
│           Spring Boot (应用容器)          │
├─────────────────────────────────────────┤
│  Google ADK (Agent 编排 & 生命周期)       │
│  ├── LlmAgent  ├── ParallelAgent         │
│  ├── SequentialAgent  ├── LoopAgent      │
│  ├── Session 管理  ├── A2A 协议           │
├─────────────────────────────────────────┤
│  Spring AI (模型抽象 & 工具注册)          │
│  ├── ChatClient   ├── @Tool 注解         │
│  ├── MCP Client   ├── Advisors           │
├─────────────────────────────────────────┤
│  LLM Provider (Gemini / OpenAI / ...)    │
└─────────────────────────────────────────┘
```

Spring AI 负责"怎么调用模型"，Google ADK 负责"Agent 之间怎么协作"。分层清晰，边界明确。

---

## 二、脚手架初始化

### 2.1 技术选型（2026 年 5 月稳定版）

| 组件 | 版本 | 说明 |
|------|------|------|
| JDK | 21 | LTS，虚拟线程可用 |
| Spring Boot | 3.5.x | 最新稳定基线 |
| Spring AI | 1.1.5 | 生产就绪 |
| Google ADK | 1.0.0 | 2026 年 3 月 GA |
| google-adk-spring-ai | 0.8.1 | ADK ↔ Spring AI 桥接 |
| Maven | 3.9+ | 构建工具 |

一项关键决策：目前建议用 Spring AI **1.1.5**（而非 2.0.0-Mx）。2.0 的 GA 预计在 5 月底，但 1.1.5 是稳定版，且 ADK 桥接模块已经与之适配。等 2.0 GA 后可以平滑升级。

### 2.2 pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.5.4</version>
    </parent>

    <groupId>dev.stackbug</groupId>
    <artifactId>ai-agent-scaffold</artifactId>
    <version>1.0.0</version>

    <properties>
        <java.version>21</java.version>
        <spring-ai.version>1.1.5</spring-ai.version>
        <adk.version>1.0.0</adk.version>
        <adk-spring-ai.version>0.8.1</adk-spring-ai.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.ai</groupId>
                <artifactId>spring-ai-bom</artifactId>
                <version>${spring-ai.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <dependencies>
        <!-- Spring Boot Web -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <!-- Spring AI Google GenAI Starter -->
        <dependency>
            <groupId>org.springframework.ai</groupId>
            <artifactId>spring-ai-google-genai-spring-boot-starter</artifactId>
        </dependency>

        <!-- Google ADK Core -->
        <dependency>
            <groupId>com.google.adk</groupId>
            <artifactId>google-adk</artifactId>
            <version>${adk.version}</version>
        </dependency>

        <!-- ADK + Spring AI 桥接 -->
        <dependency>
            <groupId>com.google.adk</groupId>
            <artifactId>google-adk-spring-ai</artifactId>
            <version>${adk-spring-ai.version}</version>
        </dependency>

        <!-- 可选：ADK 内置 Web UI -->
        <dependency>
            <groupId>com.google.adk</groupId>
            <artifactId>google-adk-dev</artifactId>
            <version>${adk.version}</version>
            <scope>runtime</scope>
        </dependency>
    </dependencies>
</project>
```

### 2.3 application.yml

```yaml
spring:
  ai:
    google:
      genai:
        api-key: ${GOOGLE_API_KEY}
        chat:
          options:
            model: gemini-2.5-flash
            temperature: 0.3

# ADK 相关配置（可选，按需开启）
adk:
  agents:
    source-dir: src/main/java/dev/stackbug/scaffold/agents
  session:
    type: in-memory          # 开发环境用内存，生产切 firestore
```

### 2.4 项目结构

```
src/main/java/dev/stackbug/scaffold/
├── AiAgentScaffoldApplication.java
├── config/
│   └── AgentConfig.java          # Agent Bean 集中配置
├── agents/
│   ├── ResearchAgent.java        # 研究员 Agent
│   ├── WriterAgent.java          # 撰稿员 Agent
│   └── ReviewerAgent.java        # 审核员 Agent
├── tools/
│   ├── WebSearchTools.java       # @Tool 注解的工具类
│   └── FileTools.java            # 文件读写工具
├── orchestration/
│   ├── OrchestrationService.java # 编排服务
│   └── MergeStrategies.java      # 自定义结果合并策略
├── controller/
│   └── AgentController.java      # REST API + SSE 流式
└── prompts/
    └── system-prompts.properties # 系统提示词集中管理
```

---

## 三、模型接入 —— Spring AI 负责

脚手架的第一步是让 Spring AI 能调用模型。这里用 Google Gemini（也可以换成其他任何 `ChatModel` 实现）。

```java
// 不需要额外配置 Bean，Starter 已自动装配
// 直接注入即可使用
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatClient chatClient;

    public ChatController(ChatClient.Builder builder) {
        this.chatClient = builder
            .defaultSystem("你是一个专业的技术助手。")
            .build();
    }

    @GetMapping("/stream")
    public Flux<String> stream(@RequestParam String question) {
        return chatClient.prompt()
            .user(question)
            .stream()
            .content();
    }
}
```

`@Tool` 注解让模型能调用你的业务方法，这是 Agent 能"动手"的基础：

```java
@Component
public class WebSearchTools {

    @Tool(description = "搜索互联网获取最新信息")
    public String webSearch(
        @ToolParam(description = "搜索关键词") String query,
        @ToolParam(description = "最多返回条数") int maxResults
    ) {
        // 接入真实搜索引擎
        return "搜索结果: ...";
    }

    @Tool(description = "读取指定 URL 的完整内容")
    public String fetchUrl(
        @ToolParam(description = "目标 URL") String url
    ) {
        // HTTP 抓取 + 正文提取
        return "页面内容: ...";
    }
}
```

标注了 `@Tool` 的方法会被框架自动发现并注册。不需要手动 `FunctionTool.create(...)`。

---

## 四、Agent 定义 —— Google ADK 负责

### 4.1 单个 LlmAgent

Google ADK 的核心是 `LlmAgent`。你用一个 Builder 定义它的名字、指令、模型、工具：

```java
@Configuration
public class AgentConfig {

    private final ChatModel chatModel;          // Spring AI 注入
    private final WebSearchTools webSearchTools;

    public AgentConfig(ChatModel chatModel, WebSearchTools webSearchTools) {
        this.chatModel = chatModel;
        this.webSearchTools = webSearchTools;
    }

    @Bean
    public BaseAgent researchAgent() {
        return LlmAgent.builder()
            .name("research_agent")
            .description("研究员：搜索互联网收集信息，输出结构化简报")
            .model(chatModel)                           // ← Spring AI ChatModel
            .instruction("""
                你是一名专业研究员。收到用户主题后：
                1. 拆解为 2-3 个关键搜索维度
                2. 调用 webSearch 工具分别搜索每个维度
                3. 汇总为一页结构化简报（含信息来源）
                输出键：research_brief
                """)
            .tools(FunctionTool.create(webSearchTools, "webSearch"))
            .outputKey("research_brief")
            .build();
    }

    @Bean
    public BaseAgent writerAgent() {
        return LlmAgent.builder()
            .name("writer_agent")
            .description("撰稿员：基于研究简报撰写文章初稿")
            .model(chatModel)
            .instruction("""
                你是一名资深技术撰稿人。基于 {research_brief} 的内容：
                1. 撰写一篇面向开发者的技术文章
                2. 结构清晰：背景 → 核心内容 → 实现 → 总结
                3. 代码示例要实用，不要太学术化
                输出键：draft_article
                """)
            .outputKey("draft_article")
            .build();
    }

    @Bean
    public BaseAgent reviewerAgent() {
        return LlmAgent.builder()
            .name("reviewer_agent")
            .description("审核员：检查文章质量，修正事实错误和语病")
            .model(chatModel)
            .instruction("""
                你是技术主编。审校 {draft_article}：
                1. 事实准确性（与 {research_brief} 交叉验证）
                2. 代码可运行性（明显的类型/语法错误）
                3. 表达清晰度（过长的句子、模糊的描述）
                输出格式：先给整体评价（通过/需修改），再逐条列出修改建议。
                输出键：review_report
                """)
            .outputKey("review_report")
            .build();
    }
}
```

几个要点：

- `model(chatModel)` 这一行是 ADK ↔ Spring AI 的桥接点。ADK 不直接调用 Gemini API，而是通过 Spring AI 的 `ChatModel` 接口。
- `outputKey` 是 ADK Session 中存储输出的键。下游 Agent 可以在 `instruction` 里用 `{key_name}` 引用上游输出。
- `tools(...)` 注册的 Spring AI `@Tool` 方法对 ADK 透明 —— ADK 只看到一组可调用函数。

### 4.2 一行代码跑起来

```java
var runner = new InMemoryRunner(researchAgent);
runner.runAsync("user-1", "session-1", "Spring AI 2.0 的新特性")
    .blockingForEach(event -> {
        if (event instanceof AgentOutputEvent<?> output) {
            System.out.println(output.getContent());
        }
    });
```

`InMemoryRunner` 适合本地调试，生产环境可以换成 `VertexAiRunner` 或通过 A2A 协议暴露。

---

## 五、多 Agent 编排 —— 核心部分

### 5.1 流水线：SequentialAgent

最简单的多 Agent 模式：A → B → C，上一个的输出是下一个的输入。

```java
@Bean
public BaseAgent articlePipeline() {
    return SequentialAgent.builder()
        .name("article_pipeline")
        .description("文章生产流水线：调研 → 撰写 → 审核")
        .subAgents(List.of(
            researchAgent(),
            writerAgent(),
            reviewerAgent()
        ))
        .build();
}
```

ADK 内部自动处理了 Session 状态的传递 —— `research_brief` 和 `draft_article` 在 Agent 之间自动流转，不需要手动搬运。

### 5.2 并行扇出：ParallelAgent

当一个任务可以拆成多个互不依赖的子任务时，用 `ParallelAgent` 让它们同时跑。

```java
@Bean
public BaseAgent researchParallel() {
    return ParallelAgent.builder()
        .name("research_parallel")
        .description("并行搜索多个数据源")
        .subAgents(List.of(
            LlmAgent.builder()
                .name("web_searcher")
                .model(chatModel)
                .instruction("搜索 {topic} 的最新文章和新闻")
                .tools(FunctionTool.create(webSearchTools, "webSearch"))
                .outputKey("web_results")
                .build(),
            LlmAgent.builder()
                .name("github_searcher")
                .model(chatModel)
                .instruction("在 GitHub 上找 {topic} 相关的热门仓库")
                .tools(FunctionTool.create(githubTools, "searchRepos"))
                .outputKey("github_results")
                .build(),
            LlmAgent.builder()
                .name("docs_searcher")
                .model(chatModel)
                .instruction("查阅 {topic} 的官方文档，获取权威信息")
                .tools(FunctionTool.create(webSearchTools, "fetchUrl"))
                .outputKey("docs_results")
                .build()
        ))
        .build();
}
```

三个搜索 Agent 同时启动，全部完成后返回聚合的 `Map<String, Object>`。下游 Agent 可以用 `{web_results}`、`{github_results}`、`{docs_results}` 分别引用。

### 5.3 管道套扇出：Sequential + Parallel 组合

生产环境中最实用的模式：**先并行收集 → 再串行加工**。

```java
@Bean
public BaseAgent fullPipeline() {
    return SequentialAgent.builder()
        .name("full_content_pipeline")
        .description("并行调研 → 串行撰写 → 串行审核")
        .subAgents(List.of(
            researchParallel(),   // 第一步：三路并行搜索
            writerAgent(),        // 第二步：撰稿（读到三路搜索结果后）
            reviewerAgent()       // 第三步：审核
        ))
        .build();
}
```

执行顺序：

```
Input: "Spring AI 2.0 多 Agent 特性"
  │
  ├─[Parallel]─────────────────────
  │   web_searcher   ─┐
  │   github_searcher ─┤ 并发执行
  │   docs_searcher   ─┘
  │
  ├─ writerAgent       （串行，读取三路结果）
  │
  └─ reviewerAgent     （串行，读取稿件）
      │
Output: 审核报告
```

### 5.4 监督者模式：SupervisorAgent（复杂场景）

对于需要"动态判断下一步该做什么"的场景，`SequentialAgent` 的固定顺序不够用，需要监督者模式。

```java
@Bean
public BaseAgent supervisorWorkflow() {
    // 监督者自己是带有决策能力的 LlmAgent
    var supervisor = LlmAgent.builder()
        .name("workflow_supervisor")
        .description("工作流调度器：判断当前阶段，决定下一步调用哪个子 Agent")
        .model(chatModel)
        .instruction("""
            你是一个工作流调度器。根据当前状态决定下一步：
            1. 如果 research_brief 为空 → 调用 researcher
            2. 如果有简报但无草稿 → 调用 writer
            3. 如果有草稿但审核未通过 → 调用 writer（修改）
            4. 如果审核通过 → 输出 FINISH

            当前主题：{input}
            """)
        .subAgents(List.of(
            ToolAgent.from(researchAgent()),
            ToolAgent.from(writerAgent()),
            ToolAgent.from(reviewerAgent())
        ))
        .build();

    return supervisor;
}
```

监督者把每个子 Agent 封装为 `ToolAgent`，通过函数调用来触发。这意味着监督者自己就是 LLM —— 它先"想"要调用谁，再"调"，拿到结果后继续"想"下一步。这是一个真正的 **推理-行动-观察** 闭环。

---

## 六、REST API + SSE 流式输出

编排好的 Agent 暴露给前端/外部系统。

```java
@RestController
@RequestMapping("/api/agent")
public class AgentController {

    private final BaseAgent pipeline;
    private final InMemoryRunner runner;

    public AgentController(BaseAgent pipeline) {
        this.pipeline = pipeline;
        this.runner = new InMemoryRunner(pipeline);
    }

    // SSE 流式：实时推送每个 Agent 的进展
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<AgentProgress>> runStreaming(
        @RequestParam String topic,
        @RequestParam(defaultValue = "anonymous") String userId
    ) {
        String sessionId = UUID.randomUUID().toString();

        return Flux.fromStream(
            runner.runAsync(userId, sessionId, topic)
                .stream()
        )
        .filter(e -> !(e instanceof RunnerEvent.StreamingChunk))
        .map(event -> {
            AgentProgress progress = mapToProgress(event);
            return ServerSentEvent.<AgentProgress>builder()
                .event("agent-progress")
                .data(progress)
                .build();
        });
    }

    // 同步：一次性返回完整结果
    @GetMapping("/run")
    public ResponseEntity<Map<String, Object>> runSync(
        @RequestParam String topic
    ) {
        String sessionId = UUID.randomUUID().toString();
        Map<String, Object> results = new LinkedHashMap<>();

        runner.runAsync("api-user", sessionId, topic)
            .blockingForEach(event -> {
                if (event instanceof AgentOutputEvent<?> output) {
                    results.put(
                        output.getAgentName(),
                        output.getContent()
                    );
                }
            });

        return ResponseEntity.ok(results);
    }

    private AgentProgress mapToProgress(Object event) {
        // 提取 agent 名称、阶段、输出内容
        // 具体实现略
        return new AgentProgress(/* ... */);
    }
}
```

前端可以这样消费：

```javascript
const eventSource = new EventSource('/api/agent/stream?topic=Spring+AI+2.0');

eventSource.addEventListener('agent-progress', (e) => {
    const { agent, stage, content } = JSON.parse(e.data);
    // 可视化每个 Agent 的实时进展
    updateAgentCard(agent, stage, content);
});
```

---

## 七、脚手架的一键启动

本地开发就两步：

```bash
# 1. 设置 API Key
export GOOGLE_API_KEY="your-gemini-api-key"

# 2. 启动
./mvnw spring-boot:run
```

如果需要 ADK 自带的调试 Web UI（适合快速验证 Agent 行为）：

```bash
./mvnw exec:java \
  -Dexec.mainClass="com.google.adk.web.AdkWebServer" \
  -Dexec.args="--adk.agents.source-dir=src/main/java/dev/stackbug/scaffold/agents"
```

浏览器打开 `http://localhost:8000` 就能和 Agent 对话调试了。

---

## 八、生产环境注意事项

### 8.1 Session 持久化

开发环境用 `InMemory` 没问题，生产环境有这些可选方案：

- **Vertex AI Session Service**（Google Cloud 托管，零运维）
- **Firestore Session Service**（Google ADK 内置支持）
- **自实现** `SessionService` 接口（接入 Redis / 数据库）

```java
// 生产环境 Runner 示例
var sessionService = new FirestoreSessionService(
    firestore, "agent-sessions"
);
var artifactService = new GcsArtifactService(
    storage, "agent-artifacts"
);
var runner = new DefaultRunner(
    pipeline, sessionService, artifactService
);
```

### 8.2 上下文压缩

长时间运行的多 Agent 会话会导致上下文膨胀。ADK 内置了事件压缩：

```java
var runner = DefaultRunner.builder()
    .agent(pipeline)
    .sessionService(sessionService)
    .compactionConfig(CompactionConfig.builder()
        .tokenThreshold(64_000)       // 超过此 token 数触发压缩
        .overlapTokens(2_000)         // 新旧窗口之间的重叠量
        .retainRecentEvents(20)       // 始终保留最近 20 个事件
        .build()
    )
    .build();
```

### 8.3 A2A 协议暴露

ADK Agent 可以通过 A2A（Agent-to-Agent）协议暴露给其他系统：

```java
@Bean
public A2AServer a2aServer(BaseAgent agent) {
    return A2AServer.builder()
        .agent(agent)
        .port(9090)
        .build();
}
```

其他 Java/Python/TypeScript Agent 可以通过标准的 JSON-RPC 2.0 来调用你的 Agent。这就是真正的"多框架互通"。

### 8.4 可观测性

ADK 内置 OpenTelemetry 集成，每个模型调用和工具执行都产生结构化 Trace：

```yaml
adk:
  observability:
    otel:
      enabled: true
      exporter: cloud-trace    # 或 otlp / jaeger / zipkin
```

---

## 九、完整代码清单

为了方便直接使用，我把脚手架的核心类汇总在一起：

**AgentConfig.java** —— 所有 Agent 的定义：

```java
@Configuration
public class AgentConfig {

    @Bean
    public BaseAgent researchAgent(ChatModel chatModel, WebSearchTools tools) {
        return LlmAgent.builder()
            .name("research_agent")
            .model(chatModel)
            .instruction("...")
            .tools(FunctionTool.create(tools, "webSearch"))
            .outputKey("research_brief")
            .build();
    }

    @Bean
    public BaseAgent writerAgent(ChatModel chatModel) {
        return LlmAgent.builder()
            .name("writer_agent")
            .model(chatModel)
            .instruction("...")
            .outputKey("draft_article")
            .build();
    }

    @Bean
    public BaseAgent reviewerAgent(ChatModel chatModel) {
        return LlmAgent.builder()
            .name("reviewer_agent")
            .model(chatModel)
            .instruction("...")
            .outputKey("review_report")
            .build();
    }

    @Bean
    public BaseAgent fullPipeline() {
        return SequentialAgent.builder()
            .name("content_pipeline")
            .subAgents(List.of(
                researchAgent(null, null),   // Spring 会自动注入
                writerAgent(null),
                reviewerAgent(null)
            ))
            .build();
    }
}
```

> 注意：上面 `researchAgent(null, null)` 是示意。实际项目中，要么改为 `@Autowired` 字段注入，要么把 pipeline 的构建逻辑写到一个带参数的 `@Bean` 方法里让 Spring 自动装配。这里为了聚焦 ADK 的编排逻辑，略去了 Spring DI 的细节。

**AgentController.java** —— REST 入口，见上一节完整代码。

**application.yml** —— 见第二节。

完整项目只有 **4-5 个 Java 文件 + 1 个 yml + 1 个 pom.xml**，非常简练。

---

## 十、总结与选型建议

### 什么时候用这套栈？

| 场景 | 推荐做法 |
|------|----------|
| 简单的单 Agent 问答 | Spring AI `ChatClient` 就够了，不需要 ADK |
| 固定流程的多 Agent 编排 | Spring AI `ChatClient` + ADK `SequentialAgent` |
| 需要并行加速的多数据源查询 | +ADK `ParallelAgent` |
| 动态决策的复杂工作流 | +ADK 监督者模式 (`ToolAgent`) |
| 跨系统/跨语言的 Agent 协作 | +A2A 协议暴露 |
| 生产级多 Agent 系统 | +Session 持久化 + OpenTelemetry + 上下文压缩 |

### 两个框架的职责划分

记住一句话：**Spring AI 管模型，ADK 管编排**。不要让 Spring AI 的 `ChatClient` 直接做多 Agent 调度，也不要在 ADK 的 `LlmAgent` 里手动写 HTTP 调模型 —— 各司其职，分界线就是 `model(chatModel)` 这一行。

### 当前局限

1. **google-adk-spring-ai 仍是 0.8.x**，API 可能还有小调整。核心模式（LlmAgent / ParallelAgent / SequentialAgent）已经稳定。
2. **Spring AI 1.1.5 没有内置的多 Agent 编排 API** —— `ParallelAgent`、`SequentialAgent` 等是 ADK 的，不是 Spring AI 的。如果你不想引入 ADK，就需要用 Spring AI Alibaba 的 `spring-ai-alibaba-agent-framework`。
3. **工具注册有两种风格**：Spring AI 的 `@Tool` 注解和 ADK 的 `FunctionTool.create()`，两边都能用，但要注意不要重复注册。

---

这套脚手架的本质是 **把最好的模型抽象层和最好的 Agent 编排引擎搭在一起**。你不用在 Spring AI 的编排能力不够时自己造轮子，也不用在 ADK 的工具注册不够灵活时写样板代码。两者各取所长，工作量就剩下写 Agent 的 instruction 和业务 tools 了。
