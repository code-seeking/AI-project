# 第 02 课：Tokenization 分词原理

> **核心问题**：模型看到的不是文字，而是数字
> **预计时间**：1 天
> **前置知识**：第 01 课（Transformer 与 LLM 原理）

---

## 一、为什么需要 Tokenization？

Transformer 是数学模型，只接受**数字**作为输入。

所以第一步：**把人类文本转换成模型能处理的数字序列。**

```
"候选人经验丰富" → ??? → [847, 2091, 356, 10234]
```

这个过程就是 **Tokenization（分词/标记化）**。

---

## 二、分词方法的演进

### 2.1 词级分词（Word-level）

```
"候选人张三有5年经验" → ["候选人", "张三", "有", "5", "年", "经验"]
```

**问题**：
- 中文分词本身困难（"南京市长江大桥"怎么切？）
- 词汇表爆炸：中文词组几十万，全放进词汇表不现实

### 2.2 字符级分词（Character-level）

```
"候选人张三" → ["候", "选", "人", "张", "三"]
```

**问题**：词汇小但每个字符信息少，序列太长，模型需要更多层才能理解语义。

### 2.3 子词分词（Subword-level）—— 现代 LLM 的选择

**核心思想**：在词和字符之间找平衡。

```
常见词保持完整: "经验" 是一个 token
罕见词拆成子词: "微服务架构" 拆成 "微服务" + "架构"

英文示例：
"unbelievable" → ["un", "believ", "able"]
"running" → ["run", "ning"]
```

**好处**：词汇表可控（3-10 万），能处理任何语言，包括没见过的词。

---

## 三、主流 Tokenizer 算法

### 3.1 BPE（Byte Pair Encoding）—— GPT 系列使用

**算法思想**：从字符开始，反复合并最高频的相邻对。

```
训练过程（简化版）：

初始词汇表: 所有单字符 [a, b, c, ...]

第 1 轮: 发现 "th" 出现最多 → 合并为 "th"
第 2 轮: 发现 "an" 出现最多 → 合并为 "an"
第 3 轮: 发现 "the" 出现最多 → 合并为 "the"
...

重复直到词汇表达到目标大小（比如 50000）
```

### 3.2 WordPiece —— BERT 使用

类似 BPE，但合并标准是**语言模型似然度**的提升，而非纯频率。

### 3.3 SentencePiece —— 你项目中 Ollama 使用

**特点**：直接在原始字节上操作，不依赖预分词规则，对中文等语言特别友好。

---

## 四、Token 数量 = 成本 = 速度

### 4.1 为什么 Token 数这么重要？

```
LLM API 计费：输入 $X / 1000 tokens，输出 $Y / 1000 tokens
推理速度：每个 token 都要经过整个 Transformer 计算
```

### 4.2 中文 vs 英文的 Token 效率

**关键事实**：同一个意思，中文通常比英文用更多 token。

```
英文: "The candidate has 5 years of Java experience" 约 10-12 tokens
中文: "候选人有5年Java开发经验" 约 15-20 tokens
```

原因：大多数 Tokenizer 在英文语料上训练，对英文更高效。

### 4.3 实际估算表

| 内容类型 | 大约 Token 数 |
|---------|-------------|
| 一句中文（15字） | 10-20 tokens |
| 一段中文（200字） | 150-300 tokens |
| 一份简历（1000字） | 800-1500 tokens |
| 一篇长文档（5000字） | 4000-8000 tokens |

> 可用 OpenAI 的 Tokenizer 可视化工具 (https://platform.openai.com/tokenizer) 实测。

---

## 五、Special Tokens（特殊标记）

Tokenizer 还要添加**特殊标记**来标识结构：

```
BOS  (Beginning of Sequence)  → 序列开始
EOS  (End of Sequence)        → 序列结束
PAD  (Padding)                → 填充（batch 处理时对齐长度）
UNK  (Unknown)                → 未登录词
```

### Chat 模型的特殊标记（你每次调 API 都在用）

Chat 模型使用**特殊的对话格式**来区分不同角色的消息：

```
User: "你是HR助理，请分析这份简历"
Assistant: "好的，我来分析..."
```

实际上底层会转换为特殊 token 序列：

```
<|system|> 你是HR助理 <|end|> <|user|> 请分析简历 <|end|> <|assistant|> 好的，我来分析 <|end|>
```

**关键理解**：你在调用 LLM API 时发送的 messages 数组（system/user/assistant），最终都会被 Tokenizer 转换为带特殊标记的 token 序列，然后才进入 Transformer 计算。

---

## 六、与你项目的关联

### 6.1 为什么你的 Ollama Embedding 需要统一分词？

你项目中用 Ollama 做 Embedding 时，同样的文本必须用**同一个 Tokenizer** 处理，否则向量之间无法比较。

### 6.2 Token 成本优化实践

在你的简历分析功能中：

```java
// 优化前：把整份简历原文都塞给 LLM（可能 2000+ tokens）
// 优化后：先提取关键字段，只发送结构化摘要（500 tokens）

// 这就是你项目里"简历文本提取"模块存在的意义
// 好的提取 = 更少 token = 更快更省
```

### 6.3 长文本处理策略

当简历/文档超过模型上下文窗口时，需要：
- **截断**：只保留关键段落
- **分块**：把长文切成多个 chunk，分别处理（第 06 课 RAG 会详细讲）

---

## 七、本课小结

```
核心要点：
1. Tokenization 是把文本变成数字的第一步，Token 是模型处理文本的基本单位
2. 现代 LLM 使用子词分词（BPE/WordPiece/SentencePiece），平衡词汇量和表达力
3. Token 数量 = 成本 = 速度，中文比英文更费 token
4. 特殊标记（BOS/EOS 等）标识对话结构，你调 API 时底层都在发生
5. 控制 token 是 AI 应用优化的第一课
```

---

## 八、思考题

1. **为什么说"中文比英文更费 token"？这对中文 AI 应用的成本有什么影响？**
2. **如果要优化简历分析的 token 消耗，你会从哪些方面入手？**（提示：输入侧 vs 输出侧）
3. **模型上下文窗口（如 128K tokens）是什么意思？如果简历超过窗口会怎样？**
4. **为什么同一个 Tokenizer 的一致性很重要？**（提示：Embedding 向量可比性）

---

## 九、深度原理：BPE 完整算法与 Tokenizer 实战

### 9.1 BPE 训练算法的完整步骤

第 02 节只给了直觉，现在看可实现的算法：

```
输入：训练语料（文本）+ 目标词汇表大小 V

第 1 步：把语料按 UTF-8 拆成字节序列（byte-level）
  每个字节是一个初始 token

第 2 步：统计所有相邻 token 对的频率

第 3 步：找到频率最高的相邻对，合并成一个新 token
  例：'t','h' 出现 5000 万次最多 → 合并为 'th'

第 4 步：更新词汇表和语料（所有 't','h' 出现处替换为 'th'）

第 5 步：重复 2-4，直到词汇表达到目标大小 V

输出：词汇表（V 个 token）+ 合并规则序列
```

**关键理解**：
```
- 合并是贪心的（每次选当前最高频）
- 高频组合先合并 → 常见词/常见子词是完整 token
- 低频组合可能永远不会合并 → 生词被拆成更小片段
- 训练完成后，词汇表就固定了；
  推理时任何文本（包括没见过的词）都能被拆解
```

### 9.2 为什么用"字节级"（Byte-level）？

```
问题：词汇表放不下所有字符
  Unicode 有 15 万个字符（含各种文字、emoji）
  中文常用字 6000+，加上所有语言字符 → 词汇表爆炸

字节级方案（GPT-2 起）：
  把所有文本按 UTF-8 拆成字节（256 种）
  然后字节级别做 BPE 合并

好处：
  1. 词汇表从"所有字符"降到"所有字节组合"（可控）
  2. 任何语言的任何字符都能表示（Unicode 全覆盖）
  3. emoji、生僻字、乱码都能处理

代价：
  中文一个字 = 3 个 UTF-8 字节 → 初始序列变长
  但合并后高频汉字会形成独立 token，长度问题缓解
```

### 9.3 中文 Token 化的真实例子

用 GPT-4 的 tokenizer（cl100k_base）实测感受：

```
"经验"     → 约 1 个 token（高频词，被完整合并）
"候选人"   → 约 1-2 个 token
"微服务架构" → 2-4 个 token（"微服务"+"架构"）
"熵增定律"  → 可能 3-5 个 token（低频，拆得更碎）

规律：
  中文常用双字词 → 1 个 token
  四字词/低频词 → 拆成 2-4 个 token
  生僻字 → 每个字 1-2 个 token

对比英文：
  "experience" → 1-2 个 token
  英文常见词整体为一个 token 的比例更高
```

**企业含义**：
```
中文简历 2000 字 ≈ 1500-2500 tokens（因内容而异）
批量处理时要按"实测"而非"估算"来算成本
```

### 9.4 词汇表大小的权衡

```
词汇表大（10 万+，如 Llama 128K）：
  优点：词粒度细，序列短，效率高
  缺点：softmax 输出层大（10 万类别），模型参数和推理变贵

词汇表小（3 万，如早期 GPT）：
  优点：输出层小，便宜
  缺点：词拆得碎，序列长，效率低

现代趋势：词汇表越来越大（32K → 100K+ → 250K）
  因为推理引擎做了优化（如分组 softmax），大词汇表成本可控
```

### 9.5 SentencePiece 的两种模式

```
模式 1：BPE（同 GPT）
  合并规则基于频率

模式 2：Unigram LM（SentencePiece 的特色）⭐
  不靠"合并"，而是从大词汇表开始"删减"：
  1. 初始：把语料切分成所有可能的子词（大词汇表）
  2. 训练一个语言模型，计算每个 token 对整体似然的贡献
  3. 删掉贡献最小的 token，直到词汇表达到目标大小

  Unigram 的切分结果由概率决定：
  同一文本可能有多套切分，取概率最高的
  （训练时还可以采样多种切分 → 数据增强）

你项目的 Ollama（llama.cpp 生态）常用这两种模式之一
```

### 9.6 实操：用代码测 Token

```bash
# Python（tiktoken）
pip install tiktoken
python -c "
import tiktoken
enc = tiktoken.encoding_for_model('gpt-4')
tokens = enc.encode('候选人有5年Java开发经验')
print(len(tokens), tokens)
print(enc.decode(tokens))
"

# Java（jtokkit 或 BERT Tokenizer）
# 或直接调用你项目的 Ollama：
curl http://localhost:11434/api/embed -d '{"model":"bge-m3","input":"候选人有5年经验"}'
# 返回的 prompt_eval_count 就是 token 数

实战建议：
  给每个核心 Prompt 建一个"token 基线表"
  每次改 Prompt 后重新测量，防止悄然变贵
```

---

## 十、延伸阅读

- OpenAI Tokenizer 可视化工具：https://platform.openai.com/tokenizer
- BPE 原论文：《Neural Machine Translation of Rare Words with Subword Units》
- HuggingFace Tokenizer 文档：https://huggingface.co/docs/tokenizers

---

**下一课**：[03-Prompt Engineering 提示工程](./03-PromptEngineering提示工程.md) —— 怎么跟 AI "说话"才能得到好结果？