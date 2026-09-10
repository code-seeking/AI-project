# 第 07 课：RAG 检索增强生成（下）—— 进阶优化

> **核心问题**：怎么让 RAG 更准、更快、更省 Token？
> **预计时间**：2 天
> **前置知识**：第 06 课（RAG 核心流程）

---

## 一、RAG 的进阶架构全景

> 📊 **架构图参考**：
> ![RAG 进阶架构](rag-architecture.png)

```
基础 RAG（第 06 课）
    ↓ 优化方向
┌────────────┬─────────────┬─────────────┐
│ 检索质量    │ 生成质量     │ 系统性能     │
│ (更准)      │ (更准)      │ (更快更省)   │
├────────────┼─────────────┼─────────────┤
│ 混合检索    │ 重排序      │ 语义缓存     │
│ 查询改写    │ Prompt 优化  │ 并行检索     │
│ 元数据过滤  │ 引用溯源     │ 增量索引     │
│ 父子分块    │ 多轮追问     │ 流式输出     │
│ 上下文压缩  │ 自评校验     │ 降级策略     │
└────────────┴─────────────┴─────────────┘
```

---

## 二、检索质量优化（更准）

### 2.1 混合检索（Hybrid Search）—— 最重要的优化

**问题**：纯向量检索有两个盲区

```
盲区 1：精确关键词
  用户搜 "JDK 25" —— 向量检索可能把 "Java Development Kit version 25" 也找出来
  但用户可能只想找含 "JDK 25" 原文的文档

盲区 2：专有名词/缩写
  "RPA"、"OKR" 等缩写，向量可能不敏感
  但关键词（全文/倒排）检索一找一个准
```

**混合检索实现**：

```
向量检索（语义） + 关键词检索（BM25/全文） → 合并排序

你项目的实现（Memory 确认）：
  "向量相似度检索为主，关键词检索兜底"
  → 当向量检索结果置信度低（低于阈值）时，用关键词检索补充

合并策略：
  1. RRF（Reciprocal Rank Fusion）：
     对两种检索结果按排名倒数加权合并
     score = Σ 1/(k + rank_i)
  2. 分数归一化后加权：0.6×向量分 + 0.4×关键词分
```

### 2.2 查询改写（Query Rewriting）

用户的问题往往不适合直接检索：

```
原始问题："它怎么配置啊？"（指代不明）
改写后："Spring Boot 如何配置数据源？"

改写方式：
  1. 指代消解：结合历史对话，"它" → 具体对象
  2. 短查询扩写："Java" → "Java 编程语言的特性"
  3. 假设式改写："你们支持什么语言" → "招聘系统的支持语言列表"

实现：用一个小 LLM 调用做改写（成本低，收益大）
```

### 2.3 元数据过滤（Metadata Filtering）

```
检索前先过滤，缩小候选集：

场景：知识库有多个分类
  用户问"Java 面试题" → 只检索 category='面试题' 的 chunk

场景：简历检索
  用户要求"3年以上经验的" → 先过滤 experience>=3
  或拆两步：结构化条件用 SQL 过滤 + 语义检索

关键：元数据过滤要"预过滤"（检索前）而非"后过滤"（检索后）
```

### 2.4 父子分块（Parent-Child Chunking）

**问题**：小块精准但上下文不足；大块上下文足但主题混杂

```
方案：父子两级分块
  子块：小（200字）→ 用于向量检索（精准定位）
  父块：大（2000字）→ 用于喂给 LLM（上下文完整）

流程：
  子块向量检索 → 命中子块 → 返回其父块 → 父块进 Prompt

效果：定位精准 + 上下文完整
```

### 2.5 上下文压缩（Context Compression）

**问题**：Top-K 里可能有冗余内容，浪费 token

```
方案 1：相关性过滤
  检索后用小模型给每个 chunk 打分，过滤不相关的

方案 2：摘要压缩
  把长 chunk 压缩成摘要再送 LLM（小模型做，便宜）

方案 3：关键句提取
  只保留 chunk 中与问题相关的句子
```

---

## 三、生成质量优化（更准）

### 3.1 重排序（Reranking）—— 效果提升最大的一招

**问题**：向量检索的 Top-K 排序并不完全可靠

```
向量检索 → 粗排：快速拿到 20 条候选
重排序模型 → 精排：对 20 条逐一精细打分，取 Top 5

BGE-Reranker 等重排序模型：
  输入：(问题, chunk) 对
  输出：相关性分数（比向量相似度更精细）

为什么有效：
  向量检索是"全局语义"相似
  重排序是"针对具体问题"的相关性判断
```

```
代码流程：
1. 向量检索 top 20（召回）
2. Rerank(question, chunks) → 排序
3. 取前 5 进 Prompt（精排）

成本：多一次模型调用（小模型，便宜）
收益：回答准确率显著提升
```

### 3.2 引用溯源（Citation）

```
要求模型输出引用编号，可验证、可追溯：

回答："Spring Boot 2.4 中配置数据源有三种方式[1][3]，
其中推荐使用配置文件方式[1]。"

好处：
  1. 用户可核对原始文档
  2. 降低幻觉（模型知道会被查）
  3. 便于调试 RAG 管线
```

### 3.3 多轮对话（Multi-turn RAG）

```
用户连续提问时：
  Q1: "RAG 是什么？"
  A1: "RAG 是检索增强生成..."
  Q2: "它有哪些优化方向？"（"它"指 RAG）

实现：
  1. 把历史对话和当前问题一起给"改写模型"
  2. 改写为独立问题："RAG 有哪些优化方向？"
  3. 用改写后的问题去检索

注意：历史对话会占 token，超出窗口时做摘要压缩
```

### 3.4 自我校验（Self-Check）

```
生成后校验回答是否有依据：

方案 1：LLM 自评
  再调用一次模型："回答中的每个结论是否都有资料支撑？列出无依据的部分"

方案 2：事实核对
  从回答中抽取关键实体/数值，回向量库再检索核对

方案 3：置信度输出
  要求模型给出"依据充分度"打分，低于阈值时提示用户"仅供参考"
```

---

## 四、系统性能优化（更快更省）

### 4.1 语义缓存（Semantic Caching）

**问题**：相似问题重复检索重复调用，浪费钱和时间

```
方案：缓存"问题 → 回答"

实现：
  1. 新问题 Embedding
  2. 与缓存中的问题向量算相似度
  3. 相似度 > 0.92 → 直接返回缓存答案
  4. 否则 → 正常 RAG 流程，并把结果写入缓存

效果：
  重复/相似问题直接命中缓存
  节省 30-70% 的 LLM 调用成本
```

### 4.2 索引增量更新

```
文档更新场景：
  全文重建 → 慢（几万 chunk 重新 Embedding 要很久）
  增量更新 → 只对新/变更的 chunk 重新 Embedding
  定时批量 → 每 5 分钟合并一次变更

你的项目已实践：知识 Embedding 的 CRUD API
  → 增删改都只影响对应 chunk，不用全量重建
```

### 4.3 流式输出

```
LLM 生成是自回归的（逐 token）
流式输出：生成一个 token 就推给前端一个

好处：
  1. 用户感知快（TTFT：首 token 时间短）
  2. 长回答不用等全部生成完
```

### 4.4 降级策略（Graceful Degradation）

```
LLM 不可用时（超时/限流/欠费）：

  一级降级：重试 2 次（指数退避）
  二级降级：切换备用模型（主 → 备）
  三级降级：返回检索到的原始文档（不生成回答）
  四级降级：返回友好错误提示

你的项目实践："AI 建议必须支持一键执行"
  → AI 生成失败时，业务功能仍可用（降级友好）
```

---

## 五、RAG 评估（怎么知道做得好不好）

### 5.1 评估维度

```
检索质量：
  Recall@K：正确答案是否在 Top-K 中
  Precision@K：Top-K 中有多少是相关的
  MRR：第一个正确答案的排名

生成质量：
  忠实度（Faithfulness）：回答是否忠于检索资料
  相关性（Relevance）：回答是否回答了问题
  完整性：是否遗漏关键信息
```

### 5.2 评估方法

```
人工评估：构建 50-100 条测试集（问题 + 标准答案），人工打分
LLM 评估：用 GPT-4 等强模型给回答打分（RAGAS 框架）
对比实验：优化前后跑同一测试集，对比指标

RAGAS 开源框架：
  faithfulness（忠实度）
  answer_relevancy（回答相关性）
  context_precision（上下文精确率）
```

### 5.3 优化优先级建议

```
按"投入产出比"排序：

1. 重排序（Rerank）        → 效果提升最大
2. 混合检索                → 解决关键词盲区
3. Prompt 组装优化         → 防幻觉、引溯源
4. 查询改写                → 解决模糊问题
5. 语义缓存                → 省钱省时
6. 切块调优                → 基础但重要
```

---

## 五点五、用 AI 工具实际体验

### 体验 1：用 ChatGPT 理解混合检索的优势

```
🧑 用户提问：
请解释为什么混合检索（向量+关键词）比纯向量检索更好？

🤖 ChatGPT 回答：
混合检索的优势在于"互补"：

【纯向量检索的盲区】
1. 精确匹配不敏感：
   搜索"JDK 25" → 可能找到"Java Development Kit version 25"
   但用户可能只想找含"JDK 25"原文的文档

2. 专有名词/缩写不敏感：
   搜索"RPA" → 向量可能不区分"RPA"和"RPA技术"
   但关键词检索一找一个准

【纯关键词检索的盲区】
1. 同义词无法命中：
   搜索"涨工资" → 文档写"薪资调整" → 零命中
   字面不同，但语义相同

2. 口语化表达无法命中：
   搜索"怎么配置" → 文档写"配置方法" → 可能漏掉

【混合检索 = 两路互补】
向量路：抓"语义相近但字面不同"
关键词路：抓"字面精确"（型号、人名、缩写）

合并策略：RRF（Reciprocal Rank Fusion）
score(d) = 1/(k+rank_向量) + 1/(k+rank_关键词)

效果：
✓ 召回率提升（两路都找到）
✓ 精确度提升（两路都命中的最相关）

📝 解读：这就是为什么第07课强调"混合检索是最重要的优化"，
   两路互补能显著提升检索质量。
```

### 体验 2：用 Claude 理解重排序（Rerank）的原理

```
🧑 用户提问（Claude）：
为什么向量检索后还要做Rerank？两者有什么区别？

🤖 Claude 回答：
Rerank 的本质是"粗排→精排"的两阶段检索：

【第一阶段：向量检索（召回）】
目标：快速找到"可能相关"的候选集
方法：双编码器（Bi-Encoder）
  - 查询单独编码 → 向量A
  - 文档单独编码 → 向量B
  - 相似度 = cos(A, B)
速度：百万文档毫秒级
代价：查询和文档"没看过对方"，交互不足

【第二阶段：Rerank（精排）】
目标：对候选集精细排序
方法：交叉编码器（Cross-Encoder）
  - 查询和文档"拼在一起"输入模型
  - 例："[CLS] 查询文本 [SEP] 文档文本 [CLS]"
  - 模型能看到两者完整交互
速度：每对都要过模型，只能对Top-50/100用
精度：理解深层语义关系，更准确

【流程】
向量检索 Top-100（快而全）
  ↓
Rerank 重排（慢而准）
  ↓
取 Top-5 进 Prompt

【为什么有效】
向量检索：全局语义相似（粗粒度）
Rerank：针对具体问题判断相关性（细粒度）

例：
查询："Spring Boot如何配置数据源？"
向量检索：找到100个含"Spring Boot"的chunk
Rerank：判断哪些chunk真正回答了"如何配置"

📝 解读：Rerank是"性价比最高"的优化，
   多一次小模型调用，但准确率显著提升。
```

### 体验 3：用ChatGPT理解语义缓存的实现

```
🧑 用户提问：
语义缓存是怎么工作的？怎么判断两个问题"相似"？

🤖 ChatGPT 回答：
语义缓存的实现流程：

【步骤1：新问题Embedding】
问题："Spring Boot怎么配置？"
→ Embedding → 向量A

【步骤2：检索缓存库】
缓存库存储：
{
  "question_vector": 向量B,
  "answer": "Spring Boot配置方式有三种...",
  "created_at": "2026-01-01"
}

计算相似度：cos(A, B)

【步骤3：判断是否命中】
相似度 > 阈值（如0.92）→ 命中缓存
相似度 < 阈值 → 正常RAG流程

【阈值设定】
0.95+：几乎只有"完全重复"才命中
  "Spring Boot怎么配置？" vs "Spring Boot怎么配置？"
  → 命中

0.90：相似问法也能命中
  "Spring Boot怎么配置？" vs "Spring Boot如何配置？"
  → 命中

0.85：更宽松
  "Spring Boot怎么配置？" vs "Java配置方式"
  → 可能命中（但可能误判）

推荐：0.90-0.95

【缓存失效】
TTL：24小时过期
知识更新时主动清缓存
容量上限：LRU淘汰

效果：
节省30-70%的LLM调用成本
重复问题直接返回，响应更快

📝 解读：语义缓存是"省钱利器"，
   但要小心阈值设太低导致"答旧题"。
```

---

## 五点六、Java 开发者视角：混合检索 + Rerank 实现

```java
/**
 * Java 中的混合检索 + Rerank 实现
 */
@Service
public class AdvancedRagService {

    @Autowired
    private VectorRepository vectorRepository;

    @Autowired
    private FullTextSearchRepository fullTextRepository;

    @Autowired
    private RerankModel rerankModel;

    @Autowired
    private EmbeddingModel embeddingModel;

    /**
     * 1. 混合检索（向量 + 关键词）
     */
    public List<Chunk> hybridSearch(String query, int topK) {
        // 1.1 向量检索
        float[] queryVector = embeddingModel.call(query);
        List<Chunk> vectorResults = vectorRepository.searchTopK(
            queryVector, 
            topK * 2,  // 多召回一些
            0.6
        );
        
        // 1.2 关键词检索（BM25/全文）
        List<Chunk> keywordResults = fullTextRepository.search(
            query, 
            topK * 2
        );
        
        // 1.3 RRF融合
        Map<Long, Double> rrfScores = new HashMap<>();
        int k = 60;  // 平滑常数
        
        // 向量路得分
        for (int i = 0; i < vectorResults.size(); i++) {
            long chunkId = vectorResults.get(i).getId();
            rrfScores.merge(chunkId, 1.0 / (k + i + 1), Double::sum);
        }
        
        // 关键词路得分
        for (int i = 0; i < keywordResults.size(); i++) {
            long chunkId = keywordResults.get(i).getId();
            rrfScores.merge(chunkId, 1.0 / (k + i + 1), Double::sum);
        }
        
        // 1.4 按RRF得分排序
        List<Long> sortedIds = rrfScores.entrySet().stream()
            .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
            .limit(topK)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
        
        return vectorRepository.findByIds(sortedIds);
    }

    /**
     * 2. Rerank 重排序
     */
    public List<Chunk> rerank(String query, List<Chunk> candidates, int topK) {
        // 对每个候选计算精细相关度
        List<RerankResult> results = candidates.stream()
            .map(chunk -> {
                double score = rerankModel.rerank(query, chunk.getText());
                return new RerankResult(chunk, score);
            })
            .sorted(Comparator.comparingDouble(RerankResult::getScore).reversed())
            .limit(topK)
            .collect(Collectors.toList());
        
        return results.stream()
            .map(RerankResult::getChunk)
            .collect(Collectors.toList());
    }

    /**
     * 3. 完整的 Advanced RAG 流程
     */
    public String answerWithAdvancedRag(String question) {
        // 3.1 混合检索 Top-20
        List<Chunk> candidates = hybridSearch(question, 20);
        
        // 3.2 Rerank 取 Top-5
        List<Chunk> topChunks = rerank(question, candidates, 5);
        
        // 3.3 组装Prompt
        String prompt = buildRagPrompt(topChunks, question);
        
        // 3.4 LLM生成
        return chatModel.call(prompt);
    }
}
```

> 💡 **性能提示**：
> - 混合检索比纯向量检索慢，但准确率高
> - Rerank 模型用小模型（如 BGE-Reranker），成本低
> - 先混合检索 Top-20，再 Rerank Top-5，是最佳实践

---

## 六、本课小结

```
核心要点：
1. 检索优化：混合检索 + 查询改写 + 元数据过滤 + 父子分块
2. 生成优化：重排序 + 引用溯源 + 多轮对话 + 自我校验
3. 性能优化：语义缓存 + 增量索引 + 流式输出 + 降级策略
4. RAG 评估：忠实度/相关性/召回率，用测试集持续评估
5. 最高性价比：先做重排序，再做混合检索
```

---

## 七、思考题

1. **为什么"重排序"能比向量检索更准？两者判断"相关"的维度有什么不同？**
2. **你的简历检索场景，适合用混合检索吗？哪些关键词场景会受益？**
3. **语义缓存的相似度阈值设多高？设低了会有什么问题？**
4. **如果 RAG 回答质量变差，你应该怎么系统性地排查？列出排查步骤。**

---

## 八、实战练习

1. 检查你项目的检索：是纯向量还是混合？加入关键词检索对比效果
2. 给你的 RAG 加一个语义缓存（Redis 即可），测试重复问题的响应时间
3. 构建 10 条测试问题，人工评估当前回答的忠实度和相关性
4. 评估后列出 3 个待优化点，按性价比排序

---

## 九、深度原理：混合检索与评估的数学

### 9.1 为什么"混合检索"比单路好（数学视角）

```
单路向量检索的问题：
  Embedding 对"精确匹配"和"罕见词"不敏感
  例：搜"JDK 25 发布时间"，文档里写的是 "Java 25"
    向量接近但未必进 Top-K → 漏召回

单路关键词检索的问题：
  同义词、口语化表达无法命中
  例：搜"涨工资"，文档写"薪资调整" → 零命中

混合 = 两路互补：
  向量路：抓"语义相近但字面不同"
  关键词路：抓"字面精确"（型号、人名、缩写）
  两路交集：都命中的通常最相关
  两路差集：各自独有的，恰好互补
```

### 9.2 RRF 融合的数学原理

```
问题：两路结果的分数不可比
  向量相似度：0.0-1.0 的连续值
  BM25 分数：无上界（几到几十）
  直接相加 = 权重失衡

RRF（Reciprocal Rank Fusion）巧妙的解法：

  对每个文档 d：
  score(d) = Σ 1 / (k + rankᵢ(d))

  rankᵢ(d)：文档 d 在第 i 路结果中的排名（1,2,3...）
  k：平滑常数（通常 60）

只依赖"排名"，不依赖分数！
  → 天然消除了不同检索器的分数尺度差异

举例：
  文档 A：向量路第 2，关键词路第 5
    score = 1/(60+2) + 1/(60+5) = 0.0161 + 0.0154 = 0.0315
  文档 B：向量路第 1，关键词路没进前 10
    score = 1/(60+1) = 0.0164
  → A 胜出（两路都有它 = 更可能相关）

k=60 的含义：
  排名第 1 的得分 ≈ 0.016，排名第 60 的得分 ≈ 0.008
  前 10 名的得分差距足够大，后 50 名差距小
```

### 9.3 Rerank 的原理：双编码器 vs 交叉编码器

```
为什么 Top-K 之后还要 Rerank？
  第一阶段（Embedding 检索）追求"快而全"（召回）
  第二阶段（Rerank）追求"精而准"（排序）

两种模型的本质区别：

双编码器（Bi-Encoder）——Embedding 模型：
  查询单独编码，文档单独编码 → 各自向量
  相似度 = 余弦（向量已算好，可离线缓存）
  快：百万文档也能秒级检索
  代价：查询和文档"没看过对方"，交互不足

交叉编码器（Cross-Encoder）——Rerank 模型：
  查询和文档"拼在一起"输入模型 → 直接输出相关分
  例："[CLS] 查询文本 [SEP] 文档文本 [CLS]"
  模型能看到两者完整交互（每个 token 互看）
  准：理解深层语义关系
  代价：每对都要过一遍模型 → 只能对 Top-50/100 用

流程：向量检索 Top-100 → Rerank 重排 → 取 Top-5
```

### 9.4 检索评估指标的精确定义

```
Recall@K（召回率）：
  相关文档在前 K 个结果中出现的比例
  例：10 个相关文档，前 5 个结果里命中 4 个
    Recall@5 = 0.4
  衡量："该找到的有没有找到"

MRR（平均倒数排名）：
  第一个正确答案的排名的倒数
  例：正确答案在第 2 位 → 1/2 = 0.5
  例：第 1 位 → 1.0
  衡量："第一个正确答案多靠前"（单答案场景）

NDCG@K（归一化折损累积增益）：
  考虑"排序质量"：正确答案越靠前得分越高
  折损：排名 i 的增益除以 log2(i+1)
  例：答案在第 1 位 → 增益 1；第 3 位 → 增益 1/log2(4)=0.5
  衡量："整体排序有多合理"（多答案场景）

企业实操：
  建立评估集（50-100 个问题 + 标准答案来源）
  每次改检索链路后跑一遍这三个指标
  Recuall@K 不达标 → 索引/切块问题
  MRR/NDCG 不达标 → Rerank/排序问题
```

### 9.5 语义缓存的阈值理论

```
缓存命中判断：新查询与缓存查询的相似度 > 阈值？

阈值怎么定（不要拍脑袋）：
  用你的真实查询日志做实验：
  1. 取 1000 条真实查询，两两算相似度
  2. 人工标注"是否同一意图"
  3. 画 ROC 曲线，选"误判率可接受"的阈值

典型值：
  0.9+：几乎只有"完全重复"才能命中（保守）
  0.85：相似问法也能命中（如"JDK版本"vs"Java版本"）
  0.8 以下：误命中风险高（不同意图被判为相同）

风险：缓存"旧答案"
  知识有时效性（如薪资政策调整）
  → 缓存必须带 TTL，或知识变更时主动清缓存
```

### 9.6 RAG 架构的演进路径（看清全局）

```
第一代 Naive RAG：
  切块 → Embedding → 检索 Top-K → 拼 Prompt → 生成
  问题：检索质量差时整体崩（一步错步步错）

第二代 Advanced RAG：
  加了：查询改写、混合检索、Rerank、父子块、
        元数据过滤、答案溯源、上下文压缩
  这是你项目当前的水平（第 16 课继续深入）

第三代 Modular RAG：
  每个环节可插拔、可组合（路由、规划、工具调用）
  例：先判断"有没有标准答案"→ 路由到不同处理链

第四代 Graph RAG / Agentic RAG：
  用知识图谱结构化（实体-关系）或
  让 Agent 自己决定"检索什么、检索几次"

演进主线：
  从"单次检索" → "多次检索 + 自我评估 + 动态调整"
  从"结果拼凑" → "结构化推理"
```

---

## 十、延伸阅读

- RAGAS 框架：https://github.com/explodinggradients/ragas
- BM25 算法：《Probabilistic relevance framework for BM25》
- LangChain 高级 RAG 模式：https://blog.langchain.dev/advanced-rag/

---

## 导航

| 上一课 | 下一课 |
| --- | --- |
| [第 06 课：RAG 检索增强生成（上）](06-RAG检索增强生成上.md) | [第 08 课：Function Calling 与工具调用](08-FunctionCalling与工具调用.md) |
