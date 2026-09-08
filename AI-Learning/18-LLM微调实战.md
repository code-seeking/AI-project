# 第 18 课：LLM 微调实战

> **核心问题**：什么时候该微调？怎么用 LoRA 用私有数据微调模型？
> **预计时间**：3 天
> **前置知识**：第 01 课（Transformer 原理）、第 15 课（模型选型）

---

## 一、微调 vs RAG vs Prompt（决策框架）

```
先问：你的问题是什么？

问题类型                   方案
──────────────────────────────────────────────
知识不足（没数据/数据新）      → RAG（检索补充）
推理/格式不稳定              → Prompt 优化
输出风格不像"你们公司的"      → Few-shot → 微调
需要高频稳定执行特定任务       → 微调
需要学习私有领域"思维方式"     → 微调
需要学习私有数据"事实"        → RAG（别微调！事实会过时）

核心原则：
  微调学"行为和格式"，不学"事实"
  事实会变 → 用 RAG；行为不变 → 微调
```

### 1.1 何时值得微调？

```
值得微调的信号：
  ✓ 每天调用量大（微调摊薄成本）
  ✓ 输出格式高度固定（JSON 结构化、特定风格）
  ✓ Few-shot 已经不够（示例太长太贵）
  ✓ 模型总是不听指令（特定领域指令理解差）
  ✓ 需要模仿特定专家风格（HR 报告、法务意见）

不值得微调的信号：
  ✗ 知识型问题（该用 RAG）
  ✗ 调用量小（微调投入 > 收益）
  ✗ 模型换得快（微调成果绑定模型版本）
  ✗ 没有高质量数据（垃圾进垃圾出）
```

---

## 二、微调核心概念

### 2.1 三种微调方式

```
全参数微调（Full Fine-tuning）：
  调整模型所有参数（7B = 70 亿参数）
  需要大量 GPU（7B 全参 ≈ 60GB+ 显存）
  效果最好但成本最高

LoRA（Low-Rank Adaptation）⭐ 主流
  冻结原模型，只训练两个小矩阵（低秩分解）
  训练参数减少 99%+（7B 只训练 0.1-1% 参数）
  消费级显卡就能训（7B LoRA ≈ 16GB 显存）

QLoRA（量化 + LoRA）：
  LoRA + 4bit 量化基座模型
  7B QLoRA ≈ 8GB 显存（笔记本可跑！）
  效果接近全量微调
```

### 2.2 LoRA 原理（一句话版）

```
原始：更新 W 全部参数（70 亿个）
LoRA：W' = W + A×B（A、B 是小矩阵，只有几百万个参数）

训练时只更新 A、B，W 冻结
推理时把 A×B 加回去 → 模型行为改变，参数几乎没变

好处：
  1. 训练快（参数少）
  2. 显存小（不需要存梯度）
  3. 可插拔（一个底座 + 多个 LoRA 适配器，按需加载）
```

---

## 三、微调数据准备（决定成败的关键）

### 3.1 数据格式

```
主流格式：指令（Instruction）数据

{
  "instruction": "分析以下简历与Java后端岗位的匹配度",
  "input": "张三，5年Java经验，熟悉Spring Boot...",
  "output": "匹配度：85分。优势：...不足：..."
}

对话格式（多轮）：
{
  "messages": [
    {"role": "system", "content": "你是HR招聘专家"},
    {"role": "user", "content": "分析这份简历"},
    {"role": "assistant", "content": "好的，这份简历..."}
  ]
}
```

### 3.2 数据质量要求

```
数量：任务简单 500-2000 条；复杂任务 5000+ 条

质量比数量重要：
  1. 每条数据必须真实、准确（错误数据 = 教坏模型）
  2. 覆盖各种边界情况（空字段、超长、异常输入）
  3. 输出格式严格统一（模型学的就是你给的）
  4. 去重（重复数据导致过拟合）

数据来源：
  1. 历史高质量回答（人工筛选）
  2. 人工编写（专家标注）
  3. LLM 生成 + 人工审核（性价比高）
  4. 你的业务数据（脱敏后）

数据清洗：
  去除：个人信息、公司机密、错误样本、重复样本
  规范化：格式统一、术语统一
  比例控制：难样本 20-30%（太难学不会）
```

### 3.3 数据集划分

```
训练集 80%：模型学习
验证集 10%：训练过程监控（防过拟合）
测试集 10%：最终评估（模型没见过的）

⚠️ 测试集绝不能参与训练！否则评估失真
```

---

## 四、微调实战流程（LLaMA-Factory 示例）

### 4.1 环境准备

```bash
# 需要：Python 3.10+、PyTorch、CUDA 显卡（16GB 以上）
pip install llama-factory

# 或克隆官方仓库
git clone https://github.com/hiyouga/LLaMA-Factory.git
cd LLaMA-Factory
pip install -e .
```

### 4.2 数据准备

```bash
# data/dataset_info.json 注册数据集
{
  "hr_resume_analysis": {
    "file_name": "hr_resume_analysis.json",
    "formatting": "sharegpt",
    "columns": {
      "messages": "messages"
    }
  }
}
```

### 4.3 启动训练（QLoRA）

```bash
# 命令行训练 7B 模型（16GB 显存可跑）
llamafactory-cli train \
  --model_name_or_path Qwen/Qwen2.5-7B-Instruct \
  --dataset hr_resume_analysis \
  --finetuning_type lora \
  --quantization_bit 4 \
  --lora_target all \
  --output_dir ./lora_hr \
  --num_train_epochs 3 \
  --learning_rate 2e-4 \
  --per_device_train_batch_size 4 \
  --gradient_accumulation_steps 4 \
  --logging_steps 10 \
  --save_steps 500 \
  --eval_steps 500 \
  --do_train true \
  --do_eval true
```

### 4.4 训练监控

```
观察指标：
  loss（训练损失）：下降趋势正常（3→0.5）
  eval_loss（验证损失）：下降 → 上升 = 过拟合信号！
  学习率曲线：正常衰减

过拟合处理：
  减少 epoch（3 → 2）
  增加数据量
  调低学习率
```

### 4.5 合并与导出

```bash
# LoRA 适配器合并到基础模型（生成完整模型文件）
llamafactory-cli export \
  --model_name_or_path Qwen/Qwen2.5-7B-Instruct \
  --adapter_name_or_path ./lora_hr \
  --template qwen \
  --finetuning_type lora \
  --export_dir ./merged_hr_model
```

### 4.6 部署（vLLM / Ollama）

```bash
# vLLM 部署合并后的模型
vllm serve ./merged_hr_model --port 8000

# 或转 GGUF 给 Ollama（量化后本地跑）
ollama create hr-expert -f Modelfile
# Modelfile: FROM ./merged_hr_model-q4.gguf
```

---

## 五、微调评估（必须做的验证）

### 5.1 对比评估

```
同一批测试集，对比三个版本：
  原始模型 vs Prompt 优化 vs 微调后

评估维度：
  1. 格式正确率（JSON 是否合法）
  2. 内容准确率（关键信息是否提取对）
  3. 指令遵循率（是否按规则输出）
  4. 幻觉率（编造信息的比例）
  5. 成本（token 消耗是否减少）

结论判断：
  微调后明显更好 → 值得
  差不多 → 微调不值得，Prompt 够了
  变差 → 数据有问题或参数不对
```

### 5.2 防灾难性遗忘

```
微调可能"忘掉"通用能力：
  微调后数学/代码/常识能力下降

检测：跑一遍通用测试集（MMLU 子集）
预防：
  混合通用数据（10-20% 通用指令）
  不要过度训练（epoch 过多）
```

---

## 六、微调常见坑

```
坑 1：数据错误 → 模型"学会"错误
  对策：数据三重检查（规则校验 + 人工抽查 + 小样本试训）

坑 2：过拟合 → 只会背题
  对策：验证集监控 eval_loss，早停；数据多样化

坑 3：格式不一致 → 模型输出混乱
  对策：输出格式严格统一（每条都要一样）

坑 4：领域漂移 → 通用能力下降
  对策：混入通用数据、控制训练量

坑 5：评估用训练数据 → 假高分
  对策：测试集绝对独立

坑 6：微调后没解决 → 问题其实在别处
  对策：先确认是"行为问题"再微调（回到第一章决策框架）
```

---

## 七、微调在企业的实际应用案例

```
案例：HR 简历分析微调

痛点：
  GPT-4o 分析简历输出格式不稳定（有时 JSON 有时散文）
  每次都要重试 2-3 次，成本高

方案：
  1. 收集 800 条高质量分析样例（人工修正 LLM 输出）
  2. QLoRA 微调 Qwen2.5-7B（本地部署）
  3. 结果：格式正确率 92% → 99%，成本降 90%

注意：这个方案的前提是"格式行为"问题，不是"知识"问题
如果简历分析需要最新行业知识 → 仍需 RAG 配合
```

---

## 八、本课小结

```
核心要点：
1. 决策框架：学"行为"用微调，学"事实"用 RAG
2. LoRA/QLoRA：只训 1% 参数，消费级显卡可跑
3. 数据决定成败：500-2000 条高质量、格式统一、边界覆盖
4. 流程：注册数据 → 训练（监控 loss）→ 合并 → 部署 → 评估
5. 评估必须对比：原模型 vs Prompt vs 微调
6. 防灾难性遗忘：混合通用数据、控制 epoch
7. 微调是"最后的武器"，先用完 Prompt 和 RAG 的潜力
```

---

## 九、思考题

1. **你们项目的简历分析，是"知识问题"还是"行为问题"？微调值得吗？**
2. **为什么微调学"事实"不好？事实会过时的例子是什么？**
3. **LoRA 为什么比全参数微调省这么多资源？原理是什么？**
4. **如果微调后模型开始"一本正经胡说"，先检查什么？**（数据？参数？）

---

## 十、实战练习

1. 从你的历史 AI 分析记录中整理 20 条微调样本（instruction/input/output）
2. 检查这 20 条的输出格式是否完全一致（不一致先统一）
3. 用 LLaMA-Factory 对 Qwen2.5-3B 做一次 1 epoch 试训（如果显卡允许）
4. 设计一个对比实验：同一测试集，原模型 vs 微调模型，列出评估维度

---

## 十一、延伸阅读

- LoRA 论文：《LoRA: Low-Rank Adaptation of Large Language Models》
- QLoRA 论文：《QLoRA: Efficient Finetuning of Quantized LLMs》
- LLaMA-Factory 文档：https://github.com/hiyouga/LLaMA-Factory
