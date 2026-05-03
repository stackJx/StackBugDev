---
author: stackbug
pubDatetime: 2025-11-03T00:00:00+08:00
title: Spring AI 1.0.3 完全指南：从入门到企业级实践
slug: spring-ai-1-0-3-complete-guide
featured: false
draft: false
tags:
  - spring-ai
  - springboot
  - java
  - ai
description: Spring AI 1.0.3 完整教程：从基础概念、对话模型、RAG、工具调用到企业级落地实践。
---

Spring AI 1.0.3 完全指南：从入门到企业级实践

## 前言

Spring AI 1.0 正式版发布后，为 Java 开发者提供了一套 AI 应用开发框架。本文将介绍 Spring AI 的核心特性，包括对话模型集成、Function Calling、MCP 协议、向量存储、ChatClient Advisor API，以及企业级 AI Agent 平台架构设计方案。

## 目录

1. 常见问题
2. 最佳实践
3. 完整示例：智能客服系统
4. 企业级 AI Agent 平台架构设计
5. MCP（Model Context Protocol）
6. ChatClient Advisor API
7. Vector Store：向量存储与 RAG
8. Function Calling：让 AI 拥有"工具"
9. Chat Models：统一的多模型 API
10. 快速开始

---

## 一、快速开始

### 依赖引入

```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
    <version>1.0.3</version>
</dependency>

<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-pgvector-store-spring-boot-starter</artifactId>
    <version>1.0.3</version>
</dependency>

```

### 基础配置

```yaml
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
      chat:
        options:
          model: gpt-4o-mini
          temperature: 0.7

```

## 二、Chat Models：统一的多模型 API

### 为什么需要统一的 API？

在实际开发中，我们经常需要：

- 降级方案：主模型故障时切换到备用模型
- 模型对比测试：测试不同模型的表现
- 多模型切换：根据成本、性能选择不同模型

Spring AI 提供了统一的`ChatModel`接口，支持：

- 阿里通义千问
- 智谱 AI
- Ollama (本地部署)
- Google Gemini
- Anthropic Claude
- Azure OpenAI
- OpenAI (GPT-4, GPT-4o, GPT-3.5)

### 基础使用

```java
@RestController
public class ChatController {

    private final ChatModel chatModel;

    @GetMapping("/chat")
    public String chat(@RequestParam String message) {
        return chatModel.call(message);
    }
}

```

### 流式响应

流式响应可以实时输出内容，提升用户体验：

```java
@GetMapping("/chat/stream")
public Flux<String> chatStream(@RequestParam String message) {
    return chatModel.stream(new Prompt(message))
        .map(response -> response.getResult().getOutput().getText());
}

```

### 多模型配置

```java
@Configuration
public class ChatModelConfig {

    // OpenAI 模型
    @Bean("openAiChatModel")
    public ChatModel openAiChatModel(OpenAiApi openAiApi) {
        return new OpenAiChatModel(openAiApi,
            OpenAiChatOptions.builder()
                .model("gpt-4o-mini")
                .temperature(0.7)
                .build());
    }

    // Ollama 本地模型
    @Bean("ollamaChatModel")
    public ChatModel ollamaChatModel(OllamaApi ollamaApi) {
        return new OllamaChatModel(ollamaApi,
            OllamaOptions.builder()
                .model("llama3")
                .build());
    }
}

```

## 三、Function Calling：让 AI 拥有"工具"

### 什么是 Function Calling？

Function Calling 让 AI 能够自主调用外部工具来完成任务。比如：

- 用户问"帮我计算 123 * 456" → AI 调用计算器工具
- 用户问"北京今天天气怎么样？" → AI 调用天气 API 获取实时数据

### 实现天气查询工具

第一步：定义工具

```java
@Configuration
public class FunctionConfig {

    @Bean
    @Description("查询指定城市的天气信息")
    public Function<WeatherRequest, WeatherResponse> weatherFunction() {
        return request -> {
            // 调用天气 API
            String weather = callWeatherApi(request.city());
            return new WeatherResponse(request.city(), weather, "25°C");
        };
    }
}

record WeatherRequest(
    @JsonProperty(required = true, value = "city")
    @JsonPropertyDescription("城市名称，如：北京、上海、深圳")
    String city
) {}

record WeatherResponse(String city, String condition, String temperature) {}

```

第二步：注册并使用

```text
ChatResponse response = chatModel.call(
    new Prompt("北京今天天气怎么样？",
        ChatOptions.builder()
            .functions(List.of("weatherFunction"))
            .build())
);

```

### 多工具协同

AI 会根据用户问题智能选择合适的工具：

```java
@Bean
public Function<CalculatorRequest, Integer> calculatorFunction() {
    return request -> request.a() + request.b();
}

@Bean
public Function<SearchRequest, String> searchFunction() {
    return request -> performSearch(request.query());
}

// 同时注册多个工具
ChatOptions.builder()
    .functions(List.of(
        "weatherFunction",
        "calculatorFunction",
        "searchFunction"
    ))
    .build()

```

### Function Calling 工作流程

```text
用户: "北京天气怎么样？温度是多少？"
  ↓
AI 分析: 需要调用 weatherFunction
  ↓
Spring AI 自动调用: weatherFunction(city="北京")
  ↓
返回结果: {"city": "北京", "condition": "晴", "temperature": "25°C"}
  ↓
AI 生成回答: "北京今天天气晴朗，温度 25°C"

```

最佳实践：

- 避免工具功能重叠
- 返回值结构化（使用 Record 或 POJO）
- 参数描述要详细（使用`@JsonPropertyDescription`）
- 函数描述要清晰准确（使用`@Description`注解）

## 四、Vector Store：向量存储与 RAG

### 为什么需要向量存储？

AI 模型的知识是固定的（训练时的数据），无法回答：

- 实时业务数据
- 最新产品手册
- 企业内部文档

RAG（检索增强生成） 通过向量存储解决这个问题。

### 支持的向量数据库

Spring AI 支持多种向量数据库：

- Redis
- Weaviate
- Pinecone
- Chroma
- Milvus
- PGVector (PostgreSQL 扩展)

### PGVector 配置

第一步：安装 pgvector 扩展

```text
CREATE EXTENSION IF NOT EXISTS vector;

```

第二步：Spring 配置

```yaml
spring:
  ai:
    vectorstore:
      pgvector:
        jdbc-url: jdbc:postgresql://localhost:5432/vectordb
        username: postgres
        password: postgres
        dimensions: 1536  # OpenAI Embeddings 维度
        distance-type: COSINE_DISTANCE

```

第三步：配置 Embeddings

```yaml
spring:
  ai:
    openai:
      embedding:
        options:
          model: text-embedding-3-small

```

### 基础使用

```java
@Service
public class VectorStoreService {

    private final VectorStore vectorStore;

    // 存储文档
    public void addDocuments(List<String> texts) {
        List<Document> documents = texts.stream()
            .map(text -> new Document(text))
            .toList();
        vectorStore.add(documents);
    }

    // 相似度搜索
    public List<Document> search(String query) {
        return vectorStore.similaritySearch(
            SearchRequest.builder()
                .query(query)
                .topK(5)
                .similarityThreshold(0.7)
                .build()
        );
    }
}

```

### 文档元数据

```text
// 添加元数据便于过滤
Document doc = new Document(
    "Spring AI 是一个为 Java 开发者设计的 AI 应用框架",
    Map.of(
        "type", "technology",
        "category", "spring",
        "language", "zh-CN"
    )
);
vectorStore.add(List.of(doc));

// 基于元数据过滤
vectorStore.similaritySearch(
    SearchRequest.builder()
        .query("什么是 Spring AI？")
        .topK(5)
        .filterExpression("type == 'technology' && language == 'zh-CN'")
        .build()
);

```

## 五、ChatClient Advisor API ⭐ 核心特性

这是 Spring AI 的核心特性之一。

### 什么是 Advisor？

Advisor 是对话拦截器，可以在 AI 调用前后执行自定义逻辑：

- 响应后：记录日志、统计数据、保存历史
- 请求前：修改提示词、注入上下文、添加参数

### ChatClient 基础用法

```java
@Configuration
public class ChatClientConfig {

    @Bean
    public ChatClient chatClient(ChatModel chatModel) {
        return ChatClient.builder(chatModel)
            .defaultSystem("你是一个专业的AI助手")
            .build();
    }
}

// 使用
String response = chatClient.prompt()
    .user("介绍一下 Spring AI")
    .call()
    .content();

```

### 内置 Advisor

#### 1. MessageChatMemoryAdvisor - 对话记忆

让 AI 记住对话历史：

```java
@Bean
public ChatClient memoryChatClient(ChatModel chatModel, ChatMemory chatMemory) {
    return ChatClient.builder(chatModel)
        .defaultAdvisors(
            MessageChatMemoryAdvisor.builder(chatMemory).build()
        )
        .build();
}

```

使用示例：

```text
String conversationId = UUID.randomUUID().toString();

// 第一轮对话
chatClient.prompt()
    .user("我的名字是张三")
    .advisors(spec -> spec.param(CONVERSATION_ID, conversationId))
    .call();

// 第二轮对话（AI 会记住名字）
String response = chatClient.prompt()
    .user("我的名字是什么？")
    .advisors(spec -> spec.param(CONVERSATION_ID, conversationId))
    .call()
    .content();
// 输出："您的名字是张三"

```

核心特性：

- ✅ 消息窗口限制（MessageWindowChatMemory）
- ✅ 支持流式响应
- ✅ 会话隔离（不同 conversationId 互不干扰）
- ✅ 多轮对话能力

#### 2. PromptChatMemoryAdvisor - Prompt 形式记忆

将对话历史注入到 System Prompt：

```java
@Bean
public ChatClient promptMemoryChatClient(ChatModel chatModel, ChatMemory chatMemory) {
    return ChatClient.builder(chatModel)
        .defaultAdvisors(
            PromptChatMemoryAdvisor.builder(chatMemory).build()
        )
        .build();
}

```

与 MessageChatMemoryAdvisor 的区别：

- `PromptChatMemoryAdvisor`：历史格式化为文本注入 System Prompt
- `MessageChatMemoryAdvisor`：历史作为 Message 列表

#### 3. QuestionAnswerAdvisor - RAG 问答

自动从向量库检索相关文档并注入上下文：

```java
@Bean
public ChatClient ragChatClient(ChatModel chatModel, VectorStore vectorStore) {
    return ChatClient.builder(chatModel)
        .defaultAdvisors(
            QuestionAnswerAdvisor.builder(vectorStore)
                .searchRequest(SearchRequest.builder()
                    .similarityThreshold(0.7)
                    .topK(5)
                    .build())
                .build()
        )
        .build();
}

```

工作流程：

```text
用户问题："Spring AI 是什么？"
    ↓
QuestionAnswerAdvisor 向量检索
    ↓
找到相关文档：
  - Document 1: "Spring AI 是一个 AI 应用框架..."
  - Document 2: "Spring AI 提供统一的 API..."
    ↓
注入到 System Prompt：
  """
  基于以下上下文回答问题：
  [Document 1 内容]
  [Document 2 内容]

  用户问题：Spring AI 是什么？
  """
    ↓
AI 基于上下文生成回答

```

使用示例：

```text
// 1. 添加知识库
vectorStore.add(List.of(
    new Document("Spring AI 是一个为 Java 开发者设计的 AI 应用框架"),
    new Document("Spring AI 支持 OpenAI、Azure OpenAI、Anthropic 等多种模型")
));

// 2. 基于知识库问答
String answer = ragChatClient.prompt()
    .user("Spring AI 支持哪些模型？")
    .call()
    .content();
// AI 会基于向量库中的文档回答

```

#### 4. VectorStoreChatMemoryAdvisor - 向量存储记忆

使用向量数据库存储对话历史，支持语义检索：

```java
@Bean
public ChatClient vectorMemoryChatClient(ChatModel chatModel, VectorStore vectorStore) {
    return ChatClient.builder(chatModel)
        .defaultAdvisors(
            VectorStoreChatMemoryAdvisor.builder(vectorStore)
                .defaultTopK(10)
                .build()
        )
        .build();
}

```

特点对比：

| 对比项 | MessageChatMemoryAdvisor | VectorStoreChatMemoryAdvisor |
| --- | --- | --- |
| 存储方式 | 内存（InMemoryChatMemory） | 向量数据库 |
| 检索方式 | 按时间顺序（FIFO） | 语义相似度 |
| 适用场景 | 短期对话（几十条） | 长期记忆（数千条） |
| 性能 | 高 | 中等 |
| 数据持久化 | 否 | 是 |

使用场景：

```text
String conversationId = "user-12345";

// 分多次对话告诉 AI 信息
vectorMemoryChatClient.prompt()
    .user("我是一名 Java 开发工程师")
    .advisors(spec -> spec.param(CONVERSATION_ID, conversationId))
    .call();

vectorMemoryChatClient.prompt()
    .user("我擅长 Spring Boot 和微服务")
    .advisors(spec -> spec.param(CONVERSATION_ID, conversationId))
    .call();

// 一周后，基于语义检索历史
String response = vectorMemoryChatClient.prompt()
    .user("我擅长什么技术？")
    .advisors(spec -> spec.param(CONVERSATION_ID, conversationId))
    .call()
    .content();
// AI 会基于语义相似度检索到相关历史对话

```

### 自定义 Advisor

Spring AI 允许自定义 Advisor，实现各种扩展功能。

#### 示例 1：时间注入 Advisor

让 AI 知道当前时间：

```java
public class TimeInjectionAdvisor implements CallAdvisor, StreamAdvisor {

    private final DateTimeFormatter formatter =
        DateTimeFormatter.ofPattern("yyyy年MM月dd日 HH:mm:ss EEEE");

    @Override
    public String getName() {
        return "TimeInjectionAdvisor";
    }

    @Override
    public int getOrder() {
        return 50; // 优先级
    }

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
        String timeInfo = String.format("【当前时间: %s】\n\n",
            LocalDateTime.now().format(formatter));

        ChatClientRequest modifiedRequest = request.mutate()
            .prompt(request.prompt().augmentUserMessage(timeInfo))
            .build();

        return chain.nextCall(modifiedRequest);
    }

    @Override
    public Flux<ChatClientResponse> adviseStream(
            ChatClientRequest request, StreamAdvisorChain chain) {
        // 流式响应的实现
        String timeInfo = String.format("【当前时间: %s】\n\n",
            LocalDateTime.now().format(formatter));

        ChatClientRequest modifiedRequest = request.mutate()
            .prompt(request.prompt().augmentUserMessage(timeInfo))
            .build();

        return chain.nextStream(modifiedRequest);
    }
}

```

使用效果：

```text
// 用户："今天星期几？"
// 实际发送给 AI：
//   【当前时间: 2025年10月31日 14:30:00 星期四】
//   今天星期几？
// AI 回答："今天是星期四"

```

#### 示例 2：统计 Advisor

统计请求次数、响应时间等：

```java
public class StatisticsAdvisor implements CallAdvisor, StreamAdvisor {

    private final AtomicInteger requestCount = new AtomicInteger(0);
    private final AtomicLong totalResponseTime = new AtomicLong(0);
    private final AtomicInteger totalInputChars = new AtomicInteger(0);
    private final AtomicInteger totalOutputChars = new AtomicInteger(0);

    @Override
    public String getName() {
        return "StatisticsAdvisor";
    }

    @Override
    public int getOrder() {
        return Integer.MIN_VALUE; // 最外层执行
    }

    @Override
    public ChatClientResponse adviseCall(
            ChatClientRequest request, CallAdvisorChain chain) {

        long startTime = System.currentTimeMillis();
        String userText = request.prompt().getUserMessage().getText();

        requestCount.incrementAndGet();
        totalInputChars.addAndGet(userText.length());

        ChatClientResponse response = chain.nextCall(request);

        String aiText = response.chatResponse().getResult().getOutput().getText();
        totalOutputChars.addAndGet(aiText.length());

        long duration = System.currentTimeMillis() - startTime;
        totalResponseTime.addAndGet(duration);

        return response;
    }

    public void printStatistics() {
        int count = requestCount.get();
        long avgTime = count > 0 ? totalResponseTime.get() / count : 0;

        System.out.println("========== 统计信息 ==========");
        System.out.println("总请求数: " + count);
        System.out.println("总输入字数: " + totalInputChars.get());
        System.out.println("总输出字数: " + totalOutputChars.get());
        System.out.println("平均响应时间: " + avgTime + " ms");
    }
}

```

#### 示例 3：日志 Advisor

记录所有对话：

```java
public class LoggingAdvisor implements CallAdvisor, StreamAdvisor {

    private static final Logger log = LoggerFactory.getLogger(LoggingAdvisor.class);

    @Override
    public String getName() {
        return "LoggingAdvisor";
    }

    @Override
    public int getOrder() {
        return 100;
    }

    @Override
    public ChatClientResponse adviseCall(
            ChatClientRequest request, CallAdvisorChain chain) {

        String userInput = request.prompt().getUserMessage().getText();
        log.info("用户输入: {}", userInput);

        ChatClientResponse response = chain.nextCall(request);

        String aiOutput = response.chatResponse().getResult().getOutput().getText();
        log.info("AI 输出: {}", aiOutput);

        return response;
    }

    @Override
    public Flux<ChatClientResponse> adviseStream(
            ChatClientRequest request, StreamAdvisorChain chain) {
        String userInput = request.prompt().getUserMessage().getText();
        log.info("用户输入: {}", userInput);

        return chain.nextStream(request);
    }
}

```

### Advisor 组合使用

Advisor 的真正威力在于组合：

```java
@Bean
public ChatClient enhancedChatClient(
        ChatModel chatModel,
        VectorStore vectorStore,
        ChatMemory chatMemory,
        StatisticsAdvisor statisticsAdvisor) {

    return ChatClient.builder(chatModel)
        .defaultSystem("你是一个专业的AI助手")
        .defaultAdvisors(
            statisticsAdvisor,                                     // 统计监控
            new TimeInjectionAdvisor(),                            // 时间感知
            new LoggingAdvisor(),                                  // 日志记录
            MessageChatMemoryAdvisor.builder(chatMemory).build(),  // 对话记忆
            QuestionAnswerAdvisor.builder(vectorStore).build()     // RAG 检索
        )
        .build();
}

```

执行链路（按 Order 从小到大）：

```text
Request
   ↓
StatisticsAdvisor (order = MIN_VALUE, 最外层)
   ↓
TimeInjectionAdvisor (order = 50)
   ↓
LoggingAdvisor (order = 100)
   ↓
MessageChatMemoryAdvisor (order = 默认)
   ↓
QuestionAnswerAdvisor (order = 默认)
   ↓
ChatModel (AI 模型)
   ↓
Response
   ↓
LoggingAdvisor (记录输出)
   ↓
StatisticsAdvisor (统计完成)

```

### 动态添加 Advisor

除了配置到 ChatClient，还可以在调用时动态添加：

```text
// 临时添加 Advisor
String response = chatClient.prompt()
    .user("今天星期几？")
    .advisors(
        new TimeInjectionAdvisor(),
        new LoggingAdvisor()
    )
    .call()
    .content();

```

## 六、MCP（Model Context Protocol）

### 什么是 MCP？

MCP 是 Anthropic 提出的模型上下文协议，用于 AI 与外部系统交互。Spring AI 1.0.3 已经支持 MCP！

### 架构设计

```text
┌─────────────────┐
│   Spring AI     │  ← Java 应用
│   Application   │
└────────┬────────┘
         │ STDIO / SSE
┌────────▼────────┐
│  MCP Server     │  ← Node.js / Python
└────────┬────────┘
         │
┌────────▼────────┐
│  External       │  ← 文件系统 / 数据库 / API
│  Resources      │
└─────────────────┘

```

### 配置 MCP 客户端

```yaml
spring:
  ai:
    mcp:
      client:
        filesystem:
          transport:
            type: STDIO
            command: npx
            args:
              - "-y"
              - "@modelcontextprotocol/server-filesystem"
              - "/allowed/directory"

```

### 可用的 MCP 服务器

- @modelcontextprotocol/server-google-drive - Google Drive
- @modelcontextprotocol/server-github - GitHub API
- @modelcontextprotocol/server-postgres - PostgreSQL 数据库
- @modelcontextprotocol/server-filesystem - 文件系统操作

### 使用示例

```text
// AI 可以自动调用 MCP 工具
String response = chatClient.prompt()
    .user("帮我读取 /tmp/test.txt 的内容")
    .call()
    .content();
// AI 会自动调用 read_file 工具

```

---

## 七、企业级 AI Agent 平台架构设计 ⭐

基于 Spring AI，可以构建一套企业级 AI Agent 平台。以下是一个架构设计方案。

### 架构概览

```text
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent 平台架构                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  Agent   │───▶│  Client  │───▶│  Model   │             │
│  │  编排层   │    │  客户端层 │    │  模型层   │             │
│  └──────────┘    └──────────┘    └──────────┘             │
│       │               │                │                    │
│       │               ├─────┬──────┬──┴─────┬─────┐       │
│       │               │     │      │        │     │       │
│       ▼               ▼     ▼      ▼        ▼     ▼       │
│  ┌─────────┐    ┌────┐ ┌───┐ ┌────┐ ┌────┐ ┌────┐       │
│  │  Task   │    │API │ │MCP│ │RAG │ │Adv │ │Pmt │       │
│  │ 调度层   │    │配置 │ │工具│ │知识│ │顾问│ │提示│       │
│  └─────────┘    └────┘ └───┘ └────┘ └────┘ └────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

```

### 核心设计理念

分层设计：从底层 API 配置到顶层 Agent 编排，每一层职责清晰 可配置化：所有组件通过数据库配置，支持热更新 可编排性：一个 Agent 可以调用多个 Client，支持复杂流程 可调度性：支持定时任务，实现自动化运营

### 数据库表设计

#### 表结构总览

```text
┌─────────────────────────────────────────────────┐
│                   10 张核心表                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. ai_client_api          - API 配置表         │
│  2. ai_client_model        - 模型配置表         │
│  3. ai_client_tool_mcp     - MCP 工具表         │
│  4. ai_client_system_prompt - 系统提示词表      │
│  5. ai_client_advisor      - 顾问配置表         │
│  6. ai_client_rag_order    - 知识库记录表       │
│  7. ai_client              - 客户端基础表       │
│  8. ai_client_config       - 配置衔接关系表     │
│  9. ai_agent               - Agent 基础表       │
│ 10. ai_agent_flow_config   - Agent 流程表       │
│ 11. ai_agent_task_schedule - 任务调度表         │
│                                                 │
└─────────────────────────────────────────────────┘

```

#### 1. ai_client_api - API 配置表

OpenAiApi 是最基础的单元结构，可以被多个 OpenAiChatModel 使用。

```sql
CREATE TABLE ai_client_api (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    api_id          VARCHAR(64) UNIQUE NOT NULL COMMENT 'API唯一标识',
    api_name        VARCHAR(128) NOT NULL COMMENT 'API名称',
    api_type        VARCHAR(32) NOT NULL COMMENT 'API类型: openai, zhipuai, ollama',
    base_url        VARCHAR(256) NOT NULL COMMENT 'API Base URL',
    api_key         VARCHAR(256) COMMENT 'API Key (加密存储)',
    timeout         INT DEFAULT 60000 COMMENT '超时时间(ms)',
    config_json     TEXT COMMENT '额外配置(JSON格式)',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

设计说明：

- `config_json`存储额外配置，如代理、重试策略等
- `api_key`需要加密存储（如使用 Jasypt）
- 一个 API 配置可以被多个 ChatModel 复用

配置示例：

```text
// OpenAiApi 可以被多个 OpenAiChatModel 使用
OpenAiApi openAiApi = OpenAiApi.builder()
    .baseUrl("https://api.openai.com")
    .apiKey("sk-...")
    .build();

// 多个模型共享同一个 API 配置
ChatModel gpt4 = new OpenAiChatModel(openAiApi, options("gpt-4"));
ChatModel gpt35 = new OpenAiChatModel(openAiApi, options("gpt-3.5-turbo"));

```

#### 2. ai_client_model - 模型配置表

对话模型是一种固定资源，可以直接放到表中。

```sql
CREATE TABLE ai_client_model (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    model_id        VARCHAR(64) UNIQUE NOT NULL COMMENT '模型唯一标识',
    model_name      VARCHAR(128) NOT NULL COMMENT '模型名称',
    model_type      VARCHAR(64) NOT NULL COMMENT '模型类型: gpt-4, gpt-3.5, glm-4',
    temperature     DECIMAL(3,2) DEFAULT 0.7 COMMENT '温度参数',
    max_tokens      INT DEFAULT 2000 COMMENT '最大Token数',
    top_p           DECIMAL(3,2) DEFAULT 1.0 COMMENT 'Top P参数',
    frequency_penalty DECIMAL(3,2) DEFAULT 0.0 COMMENT '频率惩罚',
    presence_penalty  DECIMAL(3,2) DEFAULT 0.0 COMMENT '存在惩罚',
    config_json     TEXT COMMENT '额外配置(JSON格式)',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

设计说明：

- 不同场景使用不同配置（如创意写作用高 temperature，数据分析用低 temperature）
- 模型配置是相对固定的资源，可以预设多个配置模板

#### 3. ai_client_tool_mcp - MCP 工具表

MCP 服务是非常重要的，有 MCP 才有 Agent 服务。

```sql
CREATE TABLE ai_client_tool_mcp (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    mcp_id          VARCHAR(64) UNIQUE NOT NULL COMMENT 'MCP唯一标识',
    mcp_name        VARCHAR(128) NOT NULL COMMENT 'MCP名称',
    transport_type  VARCHAR(32) NOT NULL COMMENT '传输类型: STDIO, SSE',
    command         VARCHAR(256) COMMENT 'STDIO命令 (如: npx)',
    args_json       TEXT COMMENT 'STDIO参数 (JSON数组)',
    sse_url         VARCHAR(256) COMMENT 'SSE连接地址',
    config_json     TEXT COMMENT 'MCP配置 (JSON格式)',
    description     TEXT COMMENT 'MCP描述',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

设计说明：

- SSE 方式：存储`sse_url`
- STDIO 方式：存储`command`和`args_json`
- MCP 有两种传输方式：STDIO（本地进程通信）和 SSE（远程服务）

配置示例：

STDIO 方式（文件系统 MCP）：

```json
{
  "mcp_id": "mcp-filesystem",
  "transport_type": "STDIO",
  "command": "npx",
  "args_json": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"],
  "config_json": {
    "timeout": 30000,
    "retry": 3
  }
}

```

SSE 方式（远程 MCP 服务）：

```json
{
  "mcp_id": "mcp-database",
  "transport_type": "SSE",
  "sse_url": "http://mcp-server:8080/sse",
  "config_json": {
    "auth_token": "Bearer xxx"
  }
}

```

#### 4. ai_client_system_prompt - 系统提示词表

提示词等于智能体的大脑，需要单独拆分。

```sql
CREATE TABLE ai_client_system_prompt (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    prompt_id       VARCHAR(64) UNIQUE NOT NULL COMMENT '提示词唯一标识',
    prompt_name     VARCHAR(128) NOT NULL COMMENT '提示词名称',
    prompt_content  TEXT NOT NULL COMMENT '提示词内容',
    prompt_type     VARCHAR(32) COMMENT '提示词类型: system, user, assistant',
    variables_json  TEXT COMMENT '变量定义 (JSON格式)',
    version         INT DEFAULT 1 COMMENT '版本号',
    description     TEXT COMMENT '描述',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

设计说明：

- 可以为不同场景设计不同的提示词模板
- 支持版本管理，方便 A/B 测试
- 提示词支持变量替换，如`{user_name}`,`{current_time}`

提示词示例：

```sql
INSERT INTO ai_client_system_prompt VALUES (
    1, 'prompt-customer-service', '客服助手提示词',
    '你是一个专业的客服助手，名字是{bot_name}。

你的职责：
1. 回答用户关于产品的问题（基于知识库）
2. 查询订单状态（使用 queryOrderStatus 工具）
3. 处理售后问题（使用 createAfterSalesOrder 工具）

回答要求：
- 友好且专业
- 准确且简洁
- 如果不确定，建议转人工客服

当前时间：{current_time}',
    'system',
    '{"bot_name": "小智", "current_time": "auto"}',
    1, '客服场景的系统提示词', NOW(), NOW()
);

```

#### 5. ai_client_advisor - 顾问配置表

Advisor 以顾问的方式访问记忆上下文和知识库资源。

```sql
CREATE TABLE ai_client_advisor (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    advisor_id      VARCHAR(64) UNIQUE NOT NULL COMMENT '顾问唯一标识',
    advisor_name    VARCHAR(128) NOT NULL COMMENT '顾问名称',
    advisor_type    VARCHAR(64) NOT NULL COMMENT '顾问类型',
    config_json     TEXT COMMENT '顾问配置 (JSON格式)',
    `order`         INT DEFAULT 100 COMMENT '执行顺序',
    description     TEXT COMMENT '描述',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

顾问类型：

- `CUSTOM_LOGGING`- 自定义日志
- `CUSTOM_STATISTICS`- 自定义统计
- `CUSTOM_TIME_INJECTION`- 自定义时间注入
- `QUESTION_ANSWER`- RAG 问答
- `VECTOR_STORE_CHAT_MEMORY`- 向量存储记忆
- `PROMPT_CHAT_MEMORY`- 对话记忆（Prompt 形式）
- `MESSAGE_CHAT_MEMORY`- 对话记忆（Message 列表）

配置示例：

```text
[
  {
    "advisor_id": "advisor-memory",
    "advisor_type": "MESSAGE_CHAT_MEMORY",
    "config_json": {
      "maxMessages": 100,
      "windowSize": 10
    },
    "order": 200
  },
  {
    "advisor_id": "advisor-rag",
    "advisor_type": "QUESTION_ANSWER",
    "config_json": {
      "vectorStoreRef": "vectorstore-knowledge",
      "topK": 5,
      "similarityThreshold": 0.7,
      "filterExpression": "category == 'product'"
    },
    "order": 300
  }
]

```

#### 6. ai_client_rag_order - 知识库记录表

上传知识库做一个记录，Advisor 可以访问知识库内容。

```sql
CREATE TABLE ai_client_rag_order (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id        VARCHAR(64) UNIQUE NOT NULL COMMENT '知识库订单ID',
    file_name       VARCHAR(256) NOT NULL COMMENT '文件名',
    file_path       VARCHAR(512) COMMENT '文件路径',
    file_type       VARCHAR(32) COMMENT '文件类型: pdf, docx, txt',
    file_size       BIGINT COMMENT '文件大小(字节)',
    chunk_count     INT COMMENT '分块数量',
    vector_count    INT COMMENT '向量数量',
    metadata_json   TEXT COMMENT '元数据 (JSON格式)',
    status          VARCHAR(32) DEFAULT 'PENDING' COMMENT '状态: PENDING, PROCESSING, SUCCESS, FAILED',
    error_message   TEXT COMMENT '错误信息',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

使用流程：

```java
@Service
public class RagService {

    public String uploadDocument(MultipartFile file) {
        // 1. 创建记录
        String orderId = UUID.randomUUID().toString();
        RagOrder order = new RagOrder(orderId, file.getOriginalFilename());
        order.setStatus("PROCESSING");
        ragOrderRepository.save(order);

        try {
            // 2. 读取文档
            List<Document> documents = documentReader.read(file);

            // 3. 分块
            List<Document> chunks = textSplitter.split(documents);

            // 4. 添加元数据
            chunks.forEach(chunk -> chunk.getMetadata().putAll(Map.of(
                "order_id", orderId,
                "file_name", file.getOriginalFilename()
            )));

            // 5. 向量化并存储
            vectorStore.add(chunks);

            // 6. 更新记录
            order.setChunkCount(chunks.size());
            order.setStatus("SUCCESS");
            ragOrderRepository.save(order);

            return orderId;

        } catch (Exception e) {
            order.setStatus("FAILED");
            order.setErrorMessage(e.getMessage());
            ragOrderRepository.save(order);
            throw e;
        }
    }
}

```

#### 7. ai_client - 客户端基础表

ChatClient 本身只要有客户端的唯一 ID 和描述即可。

```sql
CREATE TABLE ai_client (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    client_id       VARCHAR(64) UNIQUE NOT NULL COMMENT '客户端唯一标识',
    client_name     VARCHAR(128) NOT NULL COMMENT '客户端名称',
    description     TEXT COMMENT '客户端描述',
    status          TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

#### 8. ai_client_config - 配置衔接关系表

用于配置 API、Model、MCP、Prompt、Advisor 的衔接关系。

```sql
CREATE TABLE ai_client_config (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    client_id       VARCHAR(64) NOT NULL COMMENT '关联 ai_client.client_id',
    api_id          VARCHAR(64) COMMENT '关联 ai_client_api.api_id',
    model_id        VARCHAR(64) COMMENT '关联 ai_client_model.model_id',
    prompt_id       VARCHAR(64) COMMENT '关联 ai_client_system_prompt.prompt_id',
    mcp_ids_json    TEXT COMMENT 'MCP列表 (JSON数组)',
    advisor_ids_json TEXT COMMENT 'Advisor列表 (JSON数组)',
    config_version  INT DEFAULT 1 COMMENT '配置版本',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_client_version (client_id, config_version)
);

```

配置示例：

```json
{
  "client_id": "client-customer-service",
  "api_id": "api-openai-prod",
  "model_id": "model-gpt4-mini",
  "prompt_id": "prompt-customer-service",
  "mcp_ids_json": ["mcp-filesystem", "mcp-database"],
  "advisor_ids_json": ["advisor-memory", "advisor-rag", "advisor-statistics"],
  "config_version": 1
}

```

构建流程：

```java
@Service
public class ChatClientFactory {

    public ChatClient createChatClient(String clientId) {
        // 第一步：加载配置
        ClientConfig config = loadClientConfig(clientId);

        // 第二步：构建 API
        OpenAiApi api = createApi(config.getApiId());

        // 第三步：构建 ChatModel
        ChatModel chatModel = createChatModel(api, config.getModelId());

        // 第四步：加载 Prompt
        String systemPrompt = loadSystemPrompt(config.getPromptId());

        // 第五步：配置 MCP
        List<McpClient> mcpClients = config.getMcpIds().stream()
            .map(this::createMcpClient)
            .toList();

        // 第六步：配置 Advisor
        List<Advisor> advisors = config.getAdvisorIds().stream()
            .map(this::createAdvisor)
            .toList();

        // 第七步：构建 ChatClient
        return ChatClient.builder(chatModel)
            .defaultSystem(systemPrompt)
            .defaultAdvisors(advisors)
            .defaultToolCallbacks(mcpClients)
            .build();
    }
}

```

#### 9. ai_agent + ai_agent_flow_config - Agent 编排表

一个 Agent 可以连续调用多个 Client。

ai_agent 表：

```sql
CREATE TABLE ai_agent (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id        VARCHAR(64) UNIQUE NOT NULL COMMENT 'Agent唯一标识',
    agent_name      VARCHAR(128) NOT NULL COMMENT 'Agent名称',
    description     TEXT COMMENT 'Agent描述',
    status          TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

ai_agent_flow_config 表：

```sql
CREATE TABLE ai_agent_flow_config (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_id        VARCHAR(64) NOT NULL COMMENT '关联 ai_agent.agent_id',
    step_order      INT NOT NULL COMMENT '执行顺序',
    client_id       VARCHAR(64) NOT NULL COMMENT '关联 ai_client.client_id',
    step_name       VARCHAR(128) COMMENT '步骤名称',
    step_type       VARCHAR(32) DEFAULT 'CALL' COMMENT '步骤类型: CALL, CONDITION, LOOP',
    condition_expr  TEXT COMMENT '条件表达式 (SpEL)',
    input_mapping   TEXT COMMENT '输入映射 (JSON)',
    output_mapping  TEXT COMMENT '输出映射 (JSON)',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,

    KEY idx_agent_order (agent_id, step_order)
);

```

使用场景：智能内容创作 Agent

1. 第四步：使用"内容优化 Client"优化文章质量
2. 第三步：使用"内容审核 Client"检查内容合规性
3. 第二步：使用"内容撰写 Client"根据大纲撰写内容
4. 第一步：使用"内容规划 Client"生成文章大纲

Agent 执行引擎：

```java
@Service
public class AgentExecutor {

    public AgentResult execute(String agentId, Map<String, Object> input) {
        // 1. 加载流程配置
        List<FlowStep> steps = loadAgentFlowConfig(agentId);

        // 2. 执行上下文
        Map<String, Object> context = new HashMap<>(input);

        // 3. 逐步执行
        for (FlowStep step : steps) {
            // 获取 ChatClient
            ChatClient client = chatClientFactory.createChatClient(step.getClientId());

            // 准备输入
            String prompt = buildPrompt(step.getInputMapping(), context);

            // 调用 Client
            String response = client.prompt().user(prompt).call().content();

            // 保存输出
            saveOutput(step.getOutputMapping(), response, context);
        }

        return new AgentResult(context);
    }
}

```

#### 10. ai_agent_task_schedule - 任务调度表

这是一种触达手段，让 Task 定时执行。

```sql
CREATE TABLE ai_agent_task_schedule (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id         VARCHAR(64) UNIQUE NOT NULL COMMENT '任务唯一标识',
    task_name       VARCHAR(128) NOT NULL COMMENT '任务名称',
    agent_id        VARCHAR(64) NOT NULL COMMENT '关联 ai_agent.agent_id',
    cron_expression VARCHAR(128) NOT NULL COMMENT 'Cron表达式',
    input_json      TEXT COMMENT '任务输入参数 (JSON)',
    status          VARCHAR(32) DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE, PAUSED, STOPPED',
    last_exec_time  DATETIME COMMENT '上次执行时间',
    next_exec_time  DATETIME COMMENT '下次执行时间',
    exec_count      INT DEFAULT 0 COMMENT '执行次数',
    fail_count      INT DEFAULT 0 COMMENT '失败次数',
    description     TEXT COMMENT '任务描述',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

```

使用场景：

- 运营活动报表
- 系统配置变更
- 舆情风险检测
- 系统异常巡检
- 自动发帖

任务调度实现：

```java
@Component
public class AgentTaskScheduler {

    private final AgentExecutor agentExecutor;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);

    @PostConstruct
    public void init() {
        List<TaskSchedule> tasks = loadActiveTasks();

        tasks.forEach(task -> {
            CronTrigger trigger = new CronTrigger(task.getCronExpression());
            scheduler.schedule(() -> executeTask(task), trigger);
        });
    }

    private void executeTask(TaskSchedule task) {
        try {
            Map<String, Object> input = parseInput(task.getInputJson());
            AgentResult result = agentExecutor.execute(task.getAgentId(), input);

            task.setLastExecTime(LocalDateTime.now());
            task.setExecCount(task.getExecCount() + 1);
            taskScheduleRepository.save(task);

        } catch (Exception e) {
            task.setFailCount(task.getFailCount() + 1);
            taskScheduleRepository.save(task);
        }
    }
}

```

### 完整构建流程

从配置到运行的完整流程：

```text
┌─────────────────────────────────────────────────────────────┐
│                   配置 → 构建 → 运行                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 配置 API (ai_client_api)                                │
│     └─ OpenAI API Key, Base URL                            │
│                                                             │
│  2. 配置 Model (ai_client_model)                            │
│     └─ gpt-4, temperature, max_tokens                      │
│                                                             │
│  3. 配置 MCP (ai_client_tool_mcp)                           │
│     └─ STDIO / SSE 配置                                     │
│                                                             │
│  4. 配置 Prompt (ai_client_system_prompt)                   │
│     └─ 系统提示词，支持变量                                  │
│                                                             │
│  5. 配置 Advisor (ai_client_advisor)                        │
│     └─ 记忆、RAG、自定义                                     │
│                                                             │
│  6. 配置 RAG (ai_client_rag_order)                          │
│     └─ 上传知识库文档                                        │
│                                                             │
│  7. 配置 Client (ai_client + ai_client_config)             │
│     └─ 衔接 API、Model、MCP、Prompt、Advisor                │
│                                                             │
│  8. 配置 Agent (ai_agent + ai_agent_flow_config)           │
│     └─ 流程编排，调用多个 Client                             │
│                                                             │
│  9. 配置 Task (ai_agent_task_schedule)                      │
│     └─ 定时任务，自动执行 Agent                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘

```

### 架构优势

#### 1. 分层清晰，职责明确

- Task 层：自动化调度，运营触达
- Agent 层：业务编排，流程控制
- Client 层：对话客户端，能力容器
- Model 层：对话模型配置，固定资源
- API 层：底层连接配置，可复用

#### 2. 高度可配置

所有组件都通过数据库配置，支持：

- ✅ 灰度发布（部分用户使用新配置）
- ✅ A/B 测试（同一场景多套配置对比）
- ✅ 版本管理（配置变更可追溯）
- ✅ 热更新（修改配置后动态生效）

#### 3. 可编排性

- 支持数据映射（输入输出转换）
- 支持循环（LOOP）
- 支持条件分支（IF-ELSE）
- Agent 可以调用多个 Client

#### 4. 可观测性

- 失败告警和重试机制
- 任务执行历史追踪
- 统计响应时间、Token 使用量
- 记录每次调用的输入输出

#### 5. 可扩展性

- 新增 Agent：配置流程即可
- 新增 Advisor：实现接口并注册
- 新增 MCP 服务：只需添加 MCP 配置
- 新增 AI 模型：只需添加 API 配置

---

## 八、完整示例：智能客服系统

基于上述架构，实现一个完整的智能客服系统。

### 数据库配置

```sql
-- 1. 配置 API
INSERT INTO ai_client_api VALUES (
    1, 'api-openai-prod', 'OpenAI生产API', 'openai',
    'https://api.openai.com', 'sk-xxx', 60000, '{}', NOW(), NOW()
);

-- 2. 配置 Model
INSERT INTO ai_client_model VALUES (
    1, 'model-gpt4-mini', 'GPT-4o-mini', 'gpt-4o-mini',
    0.7, 2000, 1.0, 0.0, 0.0, '{}', NOW(), NOW()
);

-- 3. 配置 MCP
INSERT INTO ai_client_tool_mcp VALUES (
    1, 'mcp-filesystem', '文件系统MCP', 'STDIO',
    'npx', '["-y", "@modelcontextprotocol/server-filesystem", "/knowledge"]',
    NULL, '{}', '提供文件读写能力', NOW(), NOW()
);

-- 4. 配置 Prompt
INSERT INTO ai_client_system_prompt VALUES (
    1, 'prompt-customer-service', '客服提示词',
    '你是专业的客服助手，请友好且准确地回答用户问题。',
    'system', '{}', 1, '', NOW(), NOW()
);

-- 5. 配置 Advisor
INSERT INTO ai_client_advisor VALUES (
    1, 'advisor-memory', '对话记忆', 'MESSAGE_CHAT_MEMORY',
    '{"maxMessages": 100}', 200, '', NOW(), NOW()
),
(
    2, 'advisor-rag', 'RAG问答', 'QUESTION_ANSWER',
    '{"topK": 5, "similarityThreshold": 0.7}', 300, '', NOW(), NOW()
);

-- 6. 配置 Client
INSERT INTO ai_client VALUES (
    1, 'client-customer-service', '客服客户端', '智能客服对话客户端', 1, NOW(), NOW()
);

-- 7. 配置衔接关系
INSERT INTO ai_client_config VALUES (
    1, 'client-customer-service', 'api-openai-prod', 'model-gpt4-mini',
    'prompt-customer-service', '["mcp-filesystem"]', '["advisor-memory", "advisor-rag"]',
    1, NOW(), NOW()
);

```

### 代码实现

```java
@RestController
@RequestMapping("/api/chat")
public class CustomerServiceController {

    private final ChatClientFactory chatClientFactory;

    @PostMapping("/message")
    public String chat(
            @RequestParam String sessionId,
            @RequestParam String message) {

        // 获取客服 ChatClient
        ChatClient client = chatClientFactory.createChatClient("client-customer-service");

        // 发起对话
        return client.prompt()
            .user(message)
            .advisors(spec -> spec.param(CONVERSATION_ID, sessionId))
            .call()
            .content();
    }
}

```

---

## 九、最佳实践

### 1. API Key 安全管理

```java
// 使用 Jasypt 加密存储
@Configuration
@EnableEncryptableProperties
public class SecurityConfig {

    @Bean
    public StringEncryptor stringEncryptor() {
        PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
        encryptor.setPassword(System.getenv("JASYPT_PASSWORD"));
        return encryptor;
    }
}

```

### 2. 配置热更新

```java
@Service
public class ChatClientCache {

    private final LoadingCache<String, ChatClient> cache = Caffeine.newBuilder()
        .maximumSize(100)
        .expireAfterWrite(10, TimeUnit.MINUTES)
        .build(clientId -> buildChatClient(clientId));

    public void invalidate(String clientId) {
        cache.invalidate(clientId);
    }
}

```

### 3. 并发查询优化

```java
@Service
public class ClientConfigLoader {

    private final ExecutorService executor = Executors.newFixedThreadPool(6);

    public ClientConfig loadConfig(String clientId) {
        // 并发查询 6 张表，性能提升 6 倍
        CompletableFuture<ApiConfig> apiFuture =
            CompletableFuture.supplyAsync(() -> loadApiConfig(clientId), executor);
        // ... 其他 5 张表

        CompletableFuture.allOf(apiFuture, ...).join();

        return new ClientConfig(...);
    }
}

```

### 4. ChatMemory 清理

```java
@Scheduled(fixedRate = 3600000)
public void cleanExpiredSessions() {
    LocalDateTime expireTime = LocalDateTime.now().minusHours(1);
    List<String> expiredSessions = sessionRepository.findExpiredSessions(expireTime);
    expiredSessions.forEach(chatMemory::clear);
}

```

---

## 十、常见问题

### 1. PGVector 扩展未安装

错误:`ERROR: type "vector" does not exist`解决:`CREATE EXTENSION IF NOT EXISTS vector;`

### 2. Advisor 执行顺序混乱

原因:`getOrder()`返回值设置不当 解决: 明确设置优先级，数字越小越先执行

### 3. MCP 连接失败

原因: STDIO 命令路径错误或 SSE 地址不可达 解决: 检查`command`和`args_json`配置

### 4. 配置更新不生效

原因: 缓存未刷新 解决: 调用`chatClientCache.invalidate(clientId)`清除缓存

---

## 总结

Spring AI 1.0.3 提供的这些能力，可以支撑企业级 AI Agent 平台的构建。

### 核心能力

1. MCP 支持 - 与外部系统集成
2. Advisor API - 强大的对话增强机制
3. Vector Store - 支持多种向量数据库
4. Function Calling - 让 AI 拥有工具调用能力
5. 统一的 ChatModel API - 支持多种 AI 模型

### 企业级架构

通过 10 张数据库表，实现：

- ✅ 热更新支持：配置修改动态生效
- ✅ 知识库管理：RAG 文档追踪
- ✅ 自动化运营：Task 定时调度
- ✅ 强大编排能力：Agent 可以调用多个 Client
- ✅ 高度可配置：所有组件通过数据库配置

### 学习资源

- Model Context Protocol
- Spring AI GitHub
- Spring AI 官方文档

---

Spring AI 版本: 1.0.3 最后更新: 2025-10-31

---

---

- Search
- 业务研发手册
- 开发项目推荐
- 关于
- 首页
