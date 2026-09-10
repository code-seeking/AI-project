# 第 10 课：Multi-Agent 多智能体协作

> **核心问题**：多个 AI 角色分工合作
> **预计时间**：2 天
> **前置知识**：第 09 课（AI Agent 智能体）

---

## 一、为什么需要多个 Agent？

### 1.1 单 Agent 的局限

```
单 Agent 问题 1：上下文混乱
  一个 Agent 又要规划、又要执行、又要检查
  上下文塞满各种信息 → 决策质量下降

单 Agent 问题 2：提示词冲突
  "你既要做领域专家，又要检查错误，还要保持友好"
  角色越多 → 每个角色都做不好

单 Agent 问题 3：单点失败
  一个 Agent 出错 → 整个任务失败
  没有互相校验机制
```

### 1.2 多 Agent 的类比

```
单 Agent = 一个人开公司（老板、会计、销售都是自己）
多 Agent = 团队分工（CEO 规划、研发执行、QA 质检、销售对接）
```

**核心思想：每个 Agent 只做一件事，但做到最好。**

---

## 二、多 Agent 协作模式

### 模式 1：主管-工人模式（Supervisor-Worker）⭐ 最常用

```
                    ┌─────────────┐
                    │  主管 Agent   │  ← 负责拆解任务、调度、汇总
                    │ (Supervisor) │
                    └──────┬──────┘
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ 简历分析  │   │ 面试评估  │   │ 知识库检索 │
    │  Agent   │   │  Agent   │   │  Agent   │
    └──────────┘   └──────────┘   └──────────┘

流程：
  用户："评估张三并推荐合适岗位"
  主管：拆解 → 派给"简历分析 Agent" → 结果回传
        → 派给"岗位匹配 Agent" → 结果回传
        → 汇总 → 返回用户
```

**特点**：结构清晰、易扩展、易控制

### 模式 2：流水线模式（Pipeline）

```
Agent A → Agent B → Agent C → 结果
(提取)   (分析)    (生成报告)

每个 Agent 的输出是下一个 Agent 的输入
像工厂流水线，适合固定流程的任务
```

### 模式 3：辩论/评审模式（Critic）

```
生成 Agent（写方案）
    ↓
评审 Agent（找问题、打分）
    ↓ 不满意 → 反馈给生成 Agent 修改
    ↓ 满意
最终结果

典型应用：代码审查、文案评审、方案迭代
```

### 模式 4：对等协作（Peer-to-Peer）

```
Agent A ←→ Agent B ←→ Agent C
各自独立工作，通过消息交换信息

灵活但难控制，适合探索性任务
```

---

## 三、多 Agent 的消息传递

```
消息类型：
  任务分配：主管 → 工人（任务描述、参数）
  结果回报：工人 → 主管（执行结果、状态）
  请求确认：Agent → 用户（需要人工决策）
  状态广播：Agent → 所有（进度通知）

消息格式（结构化 JSON）：
{
  "from": "supervisor",
  "to": "resume_analyzer",
  "type": "task_assign",
  "task_id": "T-20260807-001",
  "goal": "分析候选人张三的简历",
  "data": {"resume_id": 101}
}
```

**你项目的实践**：工作流引擎的步骤间数据传递，本质上就是 Agent 消息传递。

---

## 四、多 Agent 状态管理

### 4.1 为什么需要状态管理？

```
多 Agent 是异步协作的：
  主管派任务 → 工人执行中（可能很久）
  → 系统崩溃 → 任务状态丢失 → 无法恢复

你需要：
  每个 Agent 的当前状态（待执行/执行中/完成/失败）
  任务之间的依赖关系
  中断后的恢复能力
```

### 4.2 状态机设计

```
Agent 状态：
  IDLE（空闲）
  RUNNING（执行中）
  WAITING（等待依赖完成）
  COMPLETED（完成）
  FAILED（失败）
  TIMEOUT（超时）

任务状态：
  PENDING → ASSIGNED → IN_PROGRESS → COMPLETED / FAILED
     ↑__________（重试/重新分配）__________↓

你项目的实践（记忆确认）：
  工作流 Redis 持久化 → 步骤状态可恢复
  WAIT_APPROVAL 状态 → 等待人工确认的挂起状态
```

### 4.3 持久化方案

```java
// Redis 存储 Agent 状态（你项目的模式）
// Key: agent:{taskId}:{agentId}
// Value: JSON 状态信息
{
  "status": "RUNNING",
  "current_step": "resume_analysis",
  "input": {...},
  "output": {...},
  "history": [...],
  "updated_at": "..."
}

// 崩溃恢复：扫描所有 RUNNING 状态的任务
// 超时的重新执行 / 标记失败
```

---

## 五点五、用 AI 工具实际体验

### 体验 1：用 ChatGPT 体验多 Agent 协作

```
🧑 用户提问（ChatGPT，Multi-Agent模式）：
评估候选人张三，并推荐合适岗位

🤖 Multi-Agent 执行过程：

[Supervisor Agent]
Thought: 这个任务需要拆解
Plan:
1. 让简历分析Agent评估张三
2. 让岗位匹配Agent推荐岗位
3. 汇总结果

[分配任务1]
→ ResumeAnalyzer Agent

[ResumeAnalyzer Agent]
Thought: 需要查看张三的简历
Action: getResume(candidateId=123)
Observation: 简历内容...
Thought: 分析简历
Final: 张三，5年Java，技术能力强，沟通良好

[Supervisor Agent]
Thought: 简历分析完成，现在让岗位匹配Agent推荐
→ PositionMatcher Agent

[PositionMatcher Agent]
Thought: 根据张三的技能匹配岗位
Action: searchPositions(skills=["Java", "Spring"])
Observation: 返回5个岗位
Thought: 评估匹配度
Final: 推荐岗位1：Java后端开发（匹配度92%）

[Supervisor Agent]
Thought: 所有任务完成，汇总结果
Final Answer: 
候选人张三评估完成：
- 技术能力：★★★★☆
- 推荐岗位：Java后端开发（匹配度92%）

📝 解读：多Agent协作让每个Agent专注于一件事，
   Supervisor负责协调，Worker负责执行，分工明确。
```

### 体验 2：用 Claude 体验辩论/评审模式

```
🧑 用户提问（Claude，Critic模式）：
请生成一份Java后端开发岗位的面试评估报告

🤖 Multi-Agent 执行过程：

[Generator Agent]
Thought: 生成初步评估报告
Draft: "候选人张三表现良好，建议通过"

[Critic Agent]
Thought: 审查报告
Feedback: 
- 报告太简短，缺少具体证据
- 没有评估技术细节
- 没有评估沟通能力
- 建议增加具体例子

[Generator Agent]
Thought: 根据反馈修改
Draft2: 
"候选人张三在技术面试中表现出色：
1. Java基础扎实：能准确回答HashMap原理、并发编程
2. 项目经验丰富：有微服务架构设计经验
3. 沟通良好：能清晰表达技术观点
建议：通过，推荐录用"

[Critic Agent]
Thought: 再次审查
Feedback: 报告质量良好，可以通过

[最终输出]
评估报告：...

📝 解读：辩论/评审模式让两个Agent互相审查，
   类似代码Review，能显著提升输出质量。
```

### 体验 3：用ChatGPT理解多Agent的成本问题

```
🧑 用户提问：
多Agent协作的成本是不是很高？

🤖 ChatGPT 回答：
多Agent的成本确实是主要挑战：

【成本构成】
每个Agent每次循环 = 一次LLM调用 = token成本
多Agent = 成本线性增长

【实例计算】
招聘筛选场景，3个Agent各3轮：

单Agent成本：
- 每轮输入：2000 token
- 3轮：2000 × 6 = 1.2万 token（输入+输出）

多Agent成本：
- 3个Agent：1.2万 × 3 = 3.6万 token/候选人
- 1000候选人：3600万 token
- 成本：$0.03/1K × 36000 = $1080

【优化策略】
1. 能单Agent完成的不用多Agent（原则！）
2. 简单子任务用便宜小模型
3. Worker之间不传递长文本（只传结论）
4. 复用工具结果（简历只解析一次）
5. 批处理：同构任务合并

【决策建议】
第一版先用单Agent + 工具
验证"确实是上下文/视角问题"后再拆多Agent
多Agent是"最后手段"，不是"先进标志"

📝 解读：多Agent的成本是单Agent的N倍，
   必须精打细算，不要过度设计。
```

---

## 五点六、Java 开发者视角：多 Agent 协作实现

```java
/**
 * Java 中的多 Agent 协作实现
 */
@Service
public class MultiAgentService {

    @Autowired
    private ChatModel chatModel;

    /**
     * 1. Supervisor-Worker 模式
     */
    public String supervisorWorkerPattern(String goal) {
        // Supervisor Agent
        String supervisorPrompt = """
            你是Supervisor Agent，负责拆解任务并分配给Worker。
            可用Worker：
            - ResumeAnalyzer：分析简历
            - PositionMatcher：匹配岗位
            
            目标：%s
            
            请拆解任务并分配。
            """.formatted(goal);
        
        // Supervisor拆解任务
        ChatResponse plan = chatModel.call(supervisorPrompt);
        
        // 解析任务分配
        List<Task> tasks = parseTasks(plan.getContent());
        
        // 分配给Worker
        Map<String, Object> results = new HashMap<>();
        for (Task task : tasks) {
            String workerResult = executeWorker(
                task.getWorkerName(), 
                task.getDescription()
            );
            results.put(task.getId(), workerResult);
        }
        
        // Supervisor汇总结果
        String summaryPrompt = """
            所有Worker已完成任务，结果如下：
            %s
            
            请汇总并生成最终报告。
            """.formatted(results.toString());
        
        return chatModel.call(summaryPrompt).getContent();
    }

    /**
     * 2. Worker Agent 执行
     */
    private String executeWorker(String workerName, String task) {
        String systemPrompt = getWorkerSystemPrompt(workerName);
        
        return chatModel.call(
            new Prompt(List.of(
                new SystemMessage(systemPrompt),
                new UserMessage(task)
            ))
        ).getContent();
    }

    /**
     * 3. Worker 的 System Prompt
     */
    private String getWorkerSystemPrompt(String workerName) {
        return switch (workerName) {
            case "ResumeAnalyzer" -> """
                你是简历分析Agent，专注于评估候选人的简历。
                输出格式：
                - 技术能力评分（0-100）
                - 优势列表
                - 风险点
                """;
            case "PositionMatcher" -> """
                你是岗位匹配Agent，专注于匹配候选人与岗位。
                输出格式：
                - 推荐岗位列表
                - 每个岗位的匹配度
                """;
            default -> "你是通用Worker Agent";
        };
    }

    /**
     * 4. Pipeline 模式
     */
    public String pipelinePattern(String input) {
        // Agent A: 提取
        String step1 = chatModel.call(
            "从以下内容中提取关键信息：" + input
        ).getContent();
        
        // Agent B: 分析
        String step2 = chatModel.call(
            "分析以下信息：" + step1
        ).getContent();
        
        // Agent C: 生成报告
        String step3 = chatModel.call(
            "生成报告：" + step2
        ).getContent();
        
        return step3;
    }

    /**
     * 5. Critic 模式（辩论/评审）
     */
    public String criticPattern(String topic) {
        String draft = "";
        
        for (int i = 0; i < 3; i++) {  // 最多3轮迭代
            // Generator 生成
            draft = chatModel.call(
                new Prompt(List.of(
                    new SystemMessage("你是内容生成Agent"),
                    new UserMessage("生成关于" + topic + "的内容\n" +
                                   (draft.isEmpty() ? "" : "参考之前的反馈：" + draft))
                ))
            ).getContent();
            
            // Critic 审查
            String feedback = chatModel.call(
                new Prompt(List.of(
                    new SystemMessage("你是评审Agent，负责审查内容质量"),
                    new UserMessage("审查以下内容：" + draft + "\n" +
                                   "如果不满意，给出改进建议。\n" +
                                   "如果满意，回复"APPROVED"")
                ))
            ).getContent();
            
            // 检查是否通过
            if (feedback.contains("APPROVED")) {
                return draft;  // 通过
            }
            
            // 未通过，继续迭代
            draft = feedback;
        }
        
        return draft;  // 返回最终版本
    }
}
```

> 💡 **生产建议**：
> - 先用单Agent + 工具，不够再拆多Agent
> - Worker之间只传结论，不传长文本
> - Supervisor用强模型，Worker用便宜模型
> - 设置最大迭代次数，防止死循环

---

## 六、多 Agent 的冲突与协调

```
冲突场景 1：资源竞争
  两个 Agent 同时改同一条数据 → 数据库锁/乐观锁

冲突场景 2：结果矛盾
  Agent A 说推荐，Agent B 说不推荐
  → 主管裁决 / 加权投票 / 交给人工

冲突场景 3：循环依赖
  A 等 B 的结果，B 等 A 的结果 → 死锁
  → 设计时避免循环依赖 / 超时检测

协调机制：
  1. 主管仲裁（Supervisor 拥有最终决定权）
  2. 优先级调度（重要任务优先）
  3. 超时降级（超时的 Agent 视为失败，走降级逻辑）
```

---

## 六、多 Agent 实战架构（结合你的项目）

```
你项目未来的 Agent Mesh（记忆确认）：

用户请求
   ↓
┌──────────────────────────┐
│ Orchestrator（总控）       │
│ - 理解用户意图             │
│ - 拆解任务                 │
│ - 调度 Agent              │
│ - 汇总结果                 │
└──────────────────────────┘
   ↓ 任务分发
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 简历分析   │ │ 岗位匹配   │ │ 面试模拟   │
│ Agent    │ │ Agent    │ │ Agent    │
└──────────┘ └──────────┘ └──────────┘
   ↓ 结果汇总
┌──────────────────────────┐
│ 报告生成 Agent             │
│ - 整合各 Agent 结果        │
│ - 生成结构化推荐报告        │
└──────────────────────────┘
   ↓
用户确认（人工闸门）
```

---

## 七、多 Agent 的成本与效率

```
成本构成：
  每个 Agent 每次循环 = 一次 LLM 调用 = token 成本
  多 Agent = 成本线性增长

优化策略：
  1. 能用工作流固定的步骤，不用 Agent（省钱）
  2. 简单任务用单 Agent（杀鸡不用牛刀）
  3. 工具调用用小模型（便宜），汇总用大模型（质量）
  4. 缓存 Agent 的中间结果（相同输入不重复计算）
  5. 并行执行独立任务（多个 Agent 同时跑）
```

---

## 八、本课小结

```
核心要点：
1. 多 Agent 解决：上下文混乱、角色冲突、单点失败
2. 四种模式：主管-工人（最常用）、流水线、辩论评审、对等协作
3. 消息传递：结构化 JSON，包含 from/to/type/task_id
4. 状态管理：状态机 + Redis 持久化 + 崩溃恢复
5. 冲突协调：主管仲裁、超时降级、避免循环依赖
6. 成本控制：能用工作流就不用 Agent，能并行就并行
```

---

## 九、思考题

1. **你的招聘场景中，哪些任务适合拆成多 Agent？画出架构图。**
2. **"简历分析"和"岗位匹配"两个 Agent 之间如何传递数据？消息格式是什么？**
3. **如果"简历分析 Agent"挂了，系统应该怎么办？**（降级？重试？人工？）
4. **什么时候应该用单 Agent 而不是多 Agent？判断标准是什么？**

---

## 十、实战练习

1. 把你项目的"推荐候选人"流程拆成 3 个 Agent，定义各自的职责
2. 画出它们之间的消息流（谁发给谁、传什么）
3. 设计状态机：每个 Agent 的状态有哪些？状态如何流转？
4. 模拟故障：如果"匹配 Agent"超时，主管应该怎么处理？

---

## 十一、深度原理：多 Agent 的机制与工程挑战

### 11.1 消息传递：多 Agent 通信的本质

```
多 Agent 协作 = 多个 LLM 循环通过"消息"交互

消息的两种范式：

范式 1：自然语言消息（灵活）
  Supervisor → Worker："请评估候选人张三的 Java 技能"
  Worker → Supervisor："评估完成：★★★★☆，证据见简历第 3 页"
  优点：灵活、无需预定义格式
  缺点：不可校验（模型可能答非所问）

范式 2：结构化消息（可靠）⭐ 企业首选
  {
    "type": "TASK",
    "taskId": "t-001",
    "agent": "resume_analyzer",
    "payload": {"candidateId": 42, "skill": "Java"},
    "deadline": "2026-08-07T12:00:00"
  }
  优点：可校验、可追踪、可重试
  缺点：需要设计 schema

工程铁律：
  Agent 之间的协议必须"结构化"
  自然语言只用于"人机"交互
  （机器-机器通信用自然语言 = 把可靠性交给概率）
```

### 11.2 编排模式的深层分析

```
模式 1：Supervisor-Worker（中央集权）
  所有决策集中在一个 Supervisor（常是更强/更贵模型）
  优点：方向一致、全局视角、容易控制
  缺点：Supervisor 是瓶颈和单点故障；每步都要过它
  适用：任务边界清晰、分工明确（招聘流程典型）

模式 2：Pipeline（流水线）
  顺序执行，前一个 Agent 输出 = 后一个输入
  优点：简单、延迟低（无需来回）
  缺点：错误无法回流（前面错了后面全错）
  缓解：每级加"输出校验"（schema 校验/规则校验）

模式 3：Critic（评审循环）
  Generator 生成 → Critic 审查 → 不合格打回重写
  优点：质量高（像代码 Review）
  缺点：token 消耗翻倍，可能死循环（限定迭代次数）
  适用：内容生成、评估报告（质量要求高）

模式 4：自由市场（无中心）
  所有 Agent 互相广播，自己决定响应
  优点：灵活
  缺点：不可控、成本不可预测
  适用：探索性实验（不建议生产使用）
```

### 11.3 状态管理：会话级 vs 任务级

```
核心问题：多个 Agent 共享什么状态？

会话级状态（对话上下文）：
  每个 Agent 有独立的对话历史（各自的消息列表）
  例：ResumeAnalyzer 的历史只含简历分析相关消息
  → 隔离：各 Agent 上下文干净，token 可控

任务级状态（全局共享）：
  所有 Agent 可见的"事实"：
  {
    "candidateId": 42,
    "skillMatch": 0.85,
    "riskFlags": ["空窗期 8 个月"],
    "status": "ANALYZING"
  }
  实现：Redis / 数据库记录（你的项目结构正好）

两种状态必须分离！
  对话历史：不可共享（太长 + 泄露内部推理）
  任务事实：必须共享（协作的依据）

状态一致性问题：
  两个 Agent 同时改同一字段 → 覆盖
  → 写入用"最后写入胜"+ 版本号乐观锁
```

### 11.4 多 Agent 的成本公式

```
成本 = Σ(每个 Agent 的调用次数 × 每次调用成本)

多 Agent 的"放大效应"：
  单 Agent 循环已贵 10-50 倍（第 09 课）
  多 Agent 每个都是独立循环 → 成本再乘 N

实例（招聘筛选，3 个 Agent 各 3 轮）：
  每个 Agent 每轮输入 ≈ 2000 token
  单 Agent 3 轮 ≈ 2000×6 = 1.2 万 token
  3 个 Agent ≈ 3.6 万 token/候选人
  1000 候选人 → 3600 万 token ← 必须精打细算

控制策略：
  1. 能单 Agent 完成的不用多 Agent（原则！）
  2. 简单子任务用便宜小模型（路由）
  3. Worker 之间不传递长文本（只传结论/引用）
  4. 复用工具结果（简历只解析一次）
  5. 批处理：同构任务合并（一次处理 10 个候选人）
```

### 11.5 多 Agent 的失败模式与诊断

```
失败模式 1：指令扭曲（传话筒效应）
  消息经过 N 个 Agent 后偏离原意
  例："评估技能"→"给出建议"→"推荐岗位"（逐渐跑偏）
  对策：关键约束在每个 Agent 的 system prompt 里重申

失败模式 2：回声室（互相强化错误）
  Agent A 的结论被 B 引用，B 的结论又被 A 引用
  错误被放大（类似舆论回声室）
  对策：事实必须"溯源"（标注来自哪个 Agent/工具）

失败模式 3：任务重复执行
  两个 Worker 都执行了同一工具（浪费/副作用）
  对策：任务 ID 去重（幂等键）

失败模式 4：Supervisor 决策疲劳
  子任务过多时，Supervisor 的分配质量下降
  对策：两级编排（组长-组员），减少单点扇出

诊断方法论：
  多 Agent 问题 = 单 Agent 问题 × N + 通信问题
  先逐 Agent 单测（单独跑，验证输出）
  再测两两通信（消息格式、语义保真）
  最后全链路（成本、延迟、成功率）
```

### 11.6 多 Agent vs 单 Agent + 工具（清醒的选择）

```
残酷事实：很多"多 Agent"场景，单 Agent + 多工具就够了

单 Agent + 工具的优点：
  - 共享全部上下文（不需要传递）
  - 成本低一半以上
  - 调试简单（一条链路）

真正需要多 Agent 的信号：
  □ 需要"不同角色视角"同时工作（评审、对抗）
  □ 任务可并行化且互不依赖（批量处理）
  □ 单个 Agent 的上下文装不下（需隔离）
  □ 需要"专业分工"（不同 Agent 用不同模型/提示词）

决策建议：
  第一版先用单 Agent + 工具
  验证"确实是上下文/视角问题"后再拆多 Agent
  多 Agent 是"最后手段"，不是"先进标志"
```

---

## 十二、延伸阅读

- AutoGen（微软）：https://github.com/microsoft/autogen
- CrewAI：https://github.com/crewAIInc/crewAI
- MetaGPT：https://github.com/geekan/MetaGPT

---

## 导航

| 上一课 | 下一课 |
| --- | --- |
| [第 09 课：AI Agent 智能体](09-AIAgent智能体.md) | [第 11 课：AI 工作流引擎](11-AI工作流引擎.md) |
