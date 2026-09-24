# AI-Learning — Java 开发者 AI 应用开发学习路线

<p align="center">
  <img src="assets/course-banner.png" alt="AI 应用开发学习路线" width="960">
</p>

> **从 Transformer 原理到企业级 LLM 落地，32 课系统化笔记，专为有 Java 经验的开发者打造。**
> 每课遵循同一套讲法：理论原理 → 直观类比 → 项目中的实际对应 → 思考题。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)
[![Lessons](https://img.shields.io/badge/课程-32%20课-2ea44f)](00-学习路线图.md)
[![PDF](https://img.shields.io/badge/PDF-490%20页%20·%208.4MB-critical)](https://github.com/code-seeking/AI-project/raw/main/AI-Learning/AI应用开发.pdf)
[![Diagrams](https://img.shields.io/badge/图表-9%20架构图%20%2B%2031%20流程图-informational)](#课程地图)

## 这是什么？

一套**面向 Java 开发者的 AI 应用开发完整学习路线**。不是泛泛的 AI 科普，也不是 API 调用速查手册，而是结合真实企业项目（HR 招聘系统）的实战笔记。

如果你正在从传统 Java 后端转向 AI 应用开发，这套资料可以帮你系统补齐从底层原理到生产落地的全部知识——**全部免费，MIT 协议开放**。

## 立即开始

| 你想做什么 | 入口 |
| --- | --- |
| 逐课在线阅读 | 从 [第 01 课：Transformer 与 LLM 原理](01-Transformer与LLM原理.md) 开始 |
| 先看全貌再决定 | [00-学习路线图](00-学习路线图.md) |
| 下载完整 PDF（490 页合订本） | [在线阅读](https://github.com/code-seeking/AI-project/blob/main/AI-Learning/AI应用开发.pdf) / [直接下载](https://github.com/code-seeking/AI-project/raw/main/AI-Learning/AI应用开发.pdf) |

### 按目标选路径

| 你的情况 | 推荐路径 | 预计投入 |
| --- | --- | --- |
| 想快速建立全景认知 | 00 → 01 → 06 → 09 → 13 → 24 | 7 天，每天一课 |
| 从 Java 后端系统性转型 | 基础篇 01-12 顺序读 | 6-8 周，每课 1-2 天 |
| 已在做 AI 应用，补企业级能力 | 进阶篇 13-24 | 6-8 周 |
| 深耕 Agent 方向 | Agent 专题 25-32 | 4-6 周 |

## 课程地图

每一课都可以直接点击阅读。课程分三大篇章，建议按序号顺序学习——每课建立在前一课概念之上。

### 基础篇（01-12）：从原理到工程

| 课号 | 主题 | 你将学到 |
|------|------|---------|
| 01 | [Transformer 与 LLM 原理](01-Transformer与LLM原理.md) | Self-Attention 机制、Encoder-Decoder 架构、GPT vs BERT |
| 02 | [Tokenization 分词原理](02-Tokenization分词原理.md) | BPE / WordPiece / SentencePiece，模型如何看待文字 |
| 03 | [Prompt Engineering 提示工程](03-PromptEngineering提示工程.md) | 零样本、少样本、Chain-of-Thought、结构化 Prompt 设计 |
| 04 | [Embedding 与语义空间](04-Embedding与语义空间.md) | 向量化原理、余弦相似度、语义搜索基础 |
| 05 | [向量数据库](05-向量数据库.md) | pgvector / Milvus / Pinecone，ANN 索引（HNSW / IVF） |
| 06 | [RAG 检索增强生成（上）](06-RAG检索增强生成上.md) | 核心流程：文档切分 → Embedding → 检索 → 生成 |
| 07 | [RAG 检索增强生成（下）](07-RAG检索增强生成下.md) | 重排序、混合检索、查询改写、上下文压缩 |
| 08 | [Function Calling 与工具调用](08-FunctionCalling与工具调用.md) | 让 LLM 调用外部 API、数据库查询、执行代码 |
| 09 | [AI Agent 智能体](09-AIAgent智能体.md) | ReAct 模式、规划与记忆、自主决策循环 |
| 10 | [Multi-Agent 多智能体协作](10-MultiAgent多智能体协作.md) | 角色分工、消息传递、协作编排模式 |
| 11 | [AI 工作流引擎](11-AI工作流引擎.md) | 可视化编排 AI 任务链、条件分支、并行执行 |
| 12 | [AI 应用工程化](12-AI应用工程化.md) | 网关、缓存、限流、安全、监控、评估体系 |

### 进阶篇（13-24）：企业级落地

| 课号 | 主题 | 你将学到 |
|------|------|---------|
| 13 | [企业级 LLM 应用架构设计](13-企业级LLM应用架构设计.md) | 六层架构：模型层 / 上下文层 / 知识层 / 工具层 / 编排层 / 治理层 |
| 14 | [Token 经济与成本优化](14-Token经济与成本优化.md) | 成本模型、缓存策略、Prompt 压缩、路由分发 |
| 15 | [模型选型与部署策略](15-模型选型与部署策略.md) | 云 API vs 私有化 vs 开源模型，选型决策矩阵 |
| 16 | [企业级 RAG 深度实战](16-企业级RAG深度实战.md) | 多知识库、权限隔离、增量更新、质量评估 |
| 17 | [生产级 Prompt 工程](17-生产级Prompt工程.md) | 版本管理、灰度发布、A/B 测试、回滚机制 |
| 18 | [LLM 微调实战](18-LLM微调实战.md) | LoRA / QLoRA、数据准备、训练流程、效果评估 |
| 19 | [多模态应用实战](19-多模态应用实战.md) | PDF / 图片 / 语音 / 视频处理管线 |
| 20 | [AI 安全与合规](20-AI安全与合规.md) | Prompt 注入防御、内容过滤、数据脱敏、审计日志 |
| 21 | [AI 可观测性与运维](21-AI可观测性与运维.md) | Trace / Metrics / Logging、异常检测、SLA 保障 |
| 22 | [AI 测试与评估体系](22-AI测试与评估体系.md) | 自动化评测、回归检测、质量指标、防改坏机制 |
| 23 | [MCP 与 AI 工具生态](23-MCP与AI工具生态.md) | Model Context Protocol、标准化连接企业系统 |
| 24 | [端到端企业案例：AI 招聘系统](24-端到端企业案例AI招聘系统.md) | 完整架构串联全部 23 课知识 |

### Agent 专题篇（25-32）

参考 [Datawhale Hello-Agents](https://hello-agents.datawhale.cc) 课程体系，深入 Agent 理论与实践。

| 课号 | 主题 | 你将学到 |
|------|------|--------|
| 25 | [智能体发展史](25-智能体发展史.md) | 从符号主义到 LLM 驱动的 70 年演进脉络 |
| 26 | [Agent 经典范式构建](26-Agent经典范式构建.md) | ReAct / Plan-and-Solve / Reflection 三种思维范式 |
| 27 | [低代码平台 Agent 搭建](27-低代码平台Agent搭建.md) | Coze / Dify / FastGPT / n8n 快速搭建 Agent |
| 28 | [主流 Agent 框架实践](28-主流Agent框架实践.md) | AutoGen / AgentScope / CAMEL / LangGraph 对比 |
| 29 | [从 0 构建 Agent 框架](29-从0构建Agent框架.md) | 手把手构建 HelloAgents 智能体框架 |
| 30 | [上下文工程](30-上下文工程.md) | ContextBuilder / NoteTool / GSSC 流水线 |
| 31 | [Agent 通信协议](31-Agent通信协议.md) | MCP / A2A / ANP 三大协议深度解析 |
| 32 | [Agentic-RL 训练实战](32-Agentic-RL训练实战.md) | 从 SFT 到 GRPO 的 LLM Agent 训练路径 |

## 适合谁？

- 有 1-3 年 Java 经验，正在转向 AI 应用开发
- 想了解 LLM 应用全貌，不只是调 API
- 需要系统学习 RAG、Agent、MCP 等核心技术
- 关注企业级落地，不只是 Demo

## 如何使用？

1. **按顺序学习**：每课建立在前一课概念之上
2. **对照项目**：如果你有类似的 Java AI 项目，对照每课的实际对应部分阅读
3. **先理解再编码**：确保能用自己的话解释核心概念
4. **每课预计 1-2 天**：理解透彻比速度重要
5. **每课结尾有思考题**：答得上来，才算真正掌握

## 知识依赖关系

```
Transformer → Tokenization → Prompt Engineering
                                    ↓
                              Embedding → 向量数据库
                                              ↓
                                     RAG（上）→ RAG（下）
                                              ↓
                              Function Calling → AI Agent
                                                      ↓
                                           Multi-Agent → 工作流引擎
                                                              ↓
                                                       工程化 → 企业架构
```

## 技术栈关键词

`LLM` `Transformer` `RAG` `Embedding` `Vector Database` `pgvector` `Prompt Engineering` `Function Calling` `AI Agent` `Multi-Agent` `MCP` `Spring Boot` `Java` `LoRA` `Fine-tuning` `AI Engineering` `ReAct` `AutoGen` `LangGraph` `Context Engineering` `A2A` `Agentic RL`

## 更新日志

- **2026-09**：全部章节序号统一为阿拉伯数字；9 张架构图以 JPEG 内嵌 PDF；31 张 Mermaid 流程图渲染入 PDF；PDF 从 24MB 优化至 8.4MB
- **2026-09 之前**：32 课全部完成，490 页 PDF 合订本生成

## License

[MIT](../LICENSE) — 可自由阅读、转发、修改与商用，无需授权。
