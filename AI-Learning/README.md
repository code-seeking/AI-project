# AI-Learning — Java 开发者 AI 应用开发学习路线

> 从 Transformer 原理到企业级 LLM 落地，25 课系统化笔记，专为有 Java 经验的开发者打造。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 这是什么？

一套**面向 Java 开发者的 AI 应用开发完整学习路线**。不是泛泛的 AI 科普，而是结合真实企业项目（HR 招聘系统）的实战笔记——每课都包含：

**理论原理 → 直观类比 → 项目中的实际对应 → 思考题**

如果你正在从传统 Java 后端转向 AI 应用开发，这套资料可以帮你系统补齐从底层原理到生产落地的全部知识。

## 内容覆盖

### 基础篇（01-12）

| 课号 | 主题 | 你将学到 |
|------|------|---------|
| 01 | Transformer 与 LLM 原理 | Self-Attention 机制、Encoder-Decoder 架构、GPT vs BERT |
| 02 | Tokenization 分词原理 | BPE / WordPiece / SentencePiece，模型如何看待文字 |
| 03 | Prompt Engineering | 零样本、少样本、Chain-of-Thought、结构化 Prompt 设计 |
| 04 | Embedding 与语义空间 | 向量化原理、余弦相似度、语义搜索基础 |
| 05 | 向量数据库 | pgvector / Milvus / Pinecone，ANN 索引（HNSW / IVF） |
| 06 | RAG 检索增强生成（上） | 核心流程：文档切分 → Embedding → 检索 → 生成 |
| 07 | RAG 检索增强生成（下） | 重排序、混合检索、查询改写、上下文压缩 |
| 08 | Function Calling 与工具调用 | 让 LLM 调用外部 API、数据库查询、执行代码 |
| 09 | AI Agent 智能体 | ReAct 模式、规划与记忆、自主决策循环 |
| 10 | Multi-Agent 多智能体协作 | 角色分工、消息传递、协作编排模式 |
| 11 | AI 工作流引擎 | 可视化编排 AI 任务链、条件分支、并行执行 |
| 12 | AI 应用工程化 | 网关、缓存、限流、安全、监控、评估体系 |

### 进阶篇（13-24）

| 课号 | 主题 | 你将学到 |
|------|------|---------|
| 13 | 企业级 LLM 应用架构设计 | 六层架构：模型层 / 上下文层 / 知识层 / 工具层 / 编排层 / 治理层 |
| 14 | Token 经济与成本优化 | 成本模型、缓存策略、Prompt 压缩、路由分发 |
| 15 | 模型选型与部署策略 | 云 API vs 私有化 vs 开源模型，选型决策矩阵 |
| 16 | 企业级 RAG 深度实战 | 多知识库、权限隔离、增量更新、质量评估 |
| 17 | 生产级 Prompt 工程 | 版本管理、灰度发布、A/B 测试、回滚机制 |
| 18 | LLM 微调实战 | LoRA / QLoRA、数据准备、训练流程、效果评估 |
| 19 | 多模态应用实战 | PDF / 图片 / 语音 / 视频处理管线 |
| 20 | AI 安全与合规 | Prompt 注入防御、内容过滤、数据脱敏、审计日志 |
| 21 | AI 可观测性与运维 | Trace / Metrics / Logging、异常检测、SLA 保障 |
| 22 | AI 测试与评估体系 | 自动化评测、回归检测、质量指标、防改坏机制 |
| 23 | MCP 与 AI 工具生态 | Model Context Protocol、标准化连接企业系统 |
| 24 | 端到端企业案例 | AI 招聘系统完整架构，串联全部 23 课知识 |

### 附：Codex 版课程

还包含一份 **Java AI 应用开发课程**（Codex 版），按知识点复杂度自适应展开，覆盖：
- LLM 与传统后端差异、AI 六层架构
- Token 与上下文窗口、模型能力边界
- RAG / Agent / MCP 工程实践

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
5. **进阶篇**：基础篇学完后再学，聚焦企业级落地

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

`LLM` `Transformer` `RAG` `Embedding` `Vector Database` `pgvector` `Prompt Engineering` `Function Calling` `AI Agent` `Multi-Agent` `MCP` `Spring Boot` `Java` `LoRA` `Fine-tuning` `AI Engineering`

## License

MIT
