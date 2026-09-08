const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const puppeteer = require("D:\\acme\\pdf-gen\\node_modules\\puppeteer");

const outDir = __dirname;
const generatedAt = "2026-08-08";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const pdfPath = path.join(outDir, "Java_AI应用开发课程.pdf");
const htmlPath = path.join(outDir, "Java_AI应用开发课程.html");
const mdPath = path.join(outDir, "Java_AI应用开发课程.md");
const manifestPath = path.join(outDir, "course-manifest.json");
const outlinePath = path.join(outDir, "course-outline.json");
const outlineScriptPath = path.join(outDir, "add_pdf_outline.py");
const pythonPath = "C:\\Users\\ci25531\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

function escapeHtml(input) {
  return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function ol(items) { return `<ol>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ol>`; }
function ul(items) { return `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`; }
function code(lines) { return `<pre><code>${escapeHtml(lines.join("\n"))}</code></pre>`; }
function flow(steps) {
  return `<div class="flow">${steps.map((s, i) => `<div class="flow-step"><span>${i + 1}</span><b>${escapeHtml(s)}</b></div>`).join("")}</div>`;
}
function swimlane(lanes, steps) {
  const grouped = Object.fromEntries(lanes.map((lane) => [lane, []]));
  steps.forEach((step) => grouped[step.lane].push(step));
  return `<div class="swimlane">${lanes.map((lane) => `<div class="lane"><div class="lane-title">${escapeHtml(lane)}</div>${grouped[lane].map((step) => `<div class="lane-card"><b>${step.no}. ${escapeHtml(step.title)}</b><p>${escapeHtml(step.desc)}</p></div>`).join("")}</div>`).join("")}</div>`;
}
function concept(name, level, essence, detail = {}) { return { name, level, essence, ...detail }; }

const levelNames = { small: "基础概念", medium: "核心能力", complex: "复杂系统" };
const levelPages = { small: 2, medium: 3, complex: 5 };

const domains = {
  architecture: {
    label: "AI 应用架构",
    components: ["业务价值", "模型能力", "上下文工程", "私有知识", "业务工具", "治理闭环"],
    flow: ["定义目标", "拆能力边界", "组织数据流", "接入模型/知识/工具", "校验审计", "反馈改进"],
    pitfalls: ["先选模型再找场景", "只画组件不画数据流", "没有失败路径", "没有验收指标"],
    metrics: ["业务节省时间", "回答准确率", "人工采纳率", "失败可解释率", "审计完整率"]
  },
  api: {
    label: "模型 API 工程化",
    components: ["消息结构", "模型参数", "模型网关", "SSE 流式通道", "重试/fallback", "token 成本日志"],
    flow: ["接收请求", "构造消息", "选择模型", "调用/流式调用", "解析响应", "记录指标"],
    pitfalls: ["Controller 直接调模型", "没有超时和降级", "没有 token 成本统计", "流式输出缺少取消和异常处理"],
    metrics: ["P95 延迟", "首 token 时间", "fallback 率", "token 成本", "错误率"]
  },
  prompt: {
    label: "Prompt 与结构化输出",
    components: ["角色", "任务", "上下文", "约束", "输出 Schema", "服务端校验"],
    flow: ["定义任务", "选择上下文", "编写约束", "定义 JSON", "模型生成", "校验修复"],
    pitfalls: ["把提示词写成大作文", "只约束格式不约束业务", "没有版本管理", "忽略 Prompt Injection"],
    metrics: ["JSON 合法率", "字段完整率", "业务规则命中率", "拒答正确率", "版本对比胜率"]
  },
  spring: {
    label: "Spring AI 工程抽象",
    components: ["ChatClient", "PromptTemplate", "Advisor", "ModelOptions", "VectorStore", "Tool Callback"],
    flow: ["配置模型", "注入 Builder", "构建客户端", "组合 Advisor", "调用模型", "解析结果"],
    pitfalls: ["把框架当万能", "Prompt 写在 Controller", "Advisor 链路黑盒", "没有 AI 集成测试"],
    metrics: ["调用成功率", "结构化解析通过率", "Advisor 命中率", "测试覆盖率", "业务接口延迟"]
  },
  embedding: {
    label: "Embedding 与向量库",
    components: ["Embedding Model", "语义文本", "向量空间", "相似度度量", "索引", "元数据过滤"],
    flow: ["构造文本", "生成向量", "写入向量库", "查询向量化", "相似召回", "业务重排"],
    pitfalls: ["混用不同向量模型", "只存正文不存元数据", "chunk 粒度不合适", "把相似度当业务评分"],
    metrics: ["Recall@K", "MRR", "命中率", "权限过滤正确率", "人工相关性评分"]
  },
  rag: {
    label: "RAG 知识检索增强",
    components: ["Ingestion", "Parser", "Chunk", "Retriever", "Rerank", "Generator"],
    flow: ["采集文档", "解析清洗", "切分入库", "检索召回", "重排压缩", "带引用生成"],
    pitfalls: ["整篇文档塞给模型", "没有引用来源", "资料不足还强答", "没有权限过滤"],
    metrics: ["召回正确率", "引用正确率", "拒答正确率", "答案 groundedness", "用户采纳率"]
  },
  tool: {
    label: "Tool Calling 与 MCP",
    components: ["Tool Schema", "参数生成", "权限校验", "业务执行", "结果摘要", "审计日志"],
    flow: ["判断需要工具", "生成参数", "服务端校验", "执行工具", "返回观察结果", "模型总结"],
    pitfalls: ["暴露大而全 Service", "让模型直接传 SQL", "工具结果过大", "没有工具审计"],
    metrics: ["工具选择准确率", "参数校验通过率", "工具失败率", "人工确认率", "审计完整率"]
  },
  sql: {
    label: "数据库问答",
    components: ["语义层", "Schema Linking", "SQL Plan", "SQL Guard", "只读执行", "结果解释"],
    flow: ["理解问题", "匹配指标", "绑定表字段", "生成 SQL", "安全校验", "解释结果"],
    pitfalls: ["高权限账号执行 SQL", "没有表字段白名单", "没有 LIMIT 和超时", "敏感字段泄露"],
    metrics: ["SQL 正确率", "安全拦截率", "查询成功率", "结果解释准确率", "敏感字段泄露率"]
  },
  agent: {
    label: "Agent 工作流",
    components: ["大模型 LLM", "Agent Runtime", "Skills", "MCP", "Tools", "Memory/State"],
    flow: ["接收目标", "理解意图", "规划步骤", "选择 Skill/Tool", "执行与观察", "反思迭代", "返回结果"],
    pitfalls: ["没有最大步数", "工具权限过大", "状态不可回放", "高风险动作自动执行"],
    metrics: ["任务完成率", "平均步数", "工具调用准确率", "转人工率", "高风险拦截率"]
  },
  governance: {
    label: "工程化与治理",
    components: ["模型网关", "Prompt 管理", "权限策略", "审计日志", "质量评估", "成本监控"],
    flow: ["需求分级", "模型路由", "安全校验", "调用记录", "质量评估", "持续优化"],
    pitfalls: ["没有日志", "没有成本预算", "没有灰度和回滚", "只靠 Prompt 防注入"],
    metrics: ["审计完整率", "单位任务成本", "质量评分", "安全拦截率", "灰度胜率"]
  }
};

const modules = [
  { week: "第 1 周", title: "AI 应用开发认知", domain: "architecture", overview: "建立企业级 AI 应用的总视角：模型不是系统本身，AI 应用是模型、上下文、知识、工具、流程和治理组合出来的工程系统。", concepts: [
    concept("LLM 与传统后端的差异", "medium", "LLM 是概率生成系统，传统后端是确定逻辑系统。企业 AI 的核心工作，是在不确定能力外面包一层确定工程边界。"),
    concept("AI 应用六层架构", "complex", "企业 AI 至少包含模型层、上下文层、知识层、工具层、编排层和治理层。缺任何一层，Demo 上线后都会暴露问题。"),
    concept("Token 与上下文窗口", "medium", "模型看到的是 token 序列，不是无限记忆。上下文窗口决定模型一次能参考多少信息，也直接影响成本和稳定性。"),
    concept("模型能力边界", "medium", "模型擅长语言理解、生成和归纳，但不天然具备企业实时事实、权限判断和业务执行能力。"),
    concept("幻觉的工程本质", "complex", "幻觉不是简单 bug，而是资料不足、约束不足或目标不清时，模型仍倾向生成合理文本。工程上要用 RAG、工具、拒答和评估约束。"),
    concept("AI 应用价值判断", "small", "不是所有功能都值得 AI 化。适合 AI 的任务通常语言密集、规则复杂、信息分散、人工成本高。"),
    concept("Java 开发者的优势", "small", "Java 开发者擅长系统边界、事务、权限、稳定性和工程化，这正是企业 AI 落地最缺的能力。"),
    concept("从聊天到工作流", "complex", "聊天只是入口，真正的企业价值来自把回答变成流程节点、数据更新、审批建议和可追踪结论。"),
    concept("人机协作闭环", "medium", "AI 负责分析、生成和建议，人负责目标、判断、确认和反馈，系统负责记录过程并推动迭代。"),
    concept("学习路线总图", "small", "学习要按模型调用、Prompt、Embedding、RAG、Tool、Agent、治理逐层推进，不要一开始就追复杂 Agent。")
  ]},
  { week: "第 2 周", title: "模型 API 与流式聊天", domain: "api", overview: "把模型调用封装成稳定后端能力，重点是路由、流式、超时、fallback、成本和调用审计。", concepts: [
    concept("Chat Completion 调用链路", "complex", "一次模型调用包含 system/user 消息、参数、上下文、模型选择、响应解析和错误处理，不只是一个 HTTP 请求。"),
    concept("System Prompt 与 User Prompt", "medium", "System Prompt 定义角色和边界，User Prompt 承载具体任务。两者混用会让提示词不可治理。"),
    concept("模型参数 temperature/top_p", "small", "参数决定输出稳定性和发散度。事实问答偏低温度，创意生成可提高。"),
    concept("SSE 流式输出", "complex", "流式输出优化用户感知等待，但带来断线、取消、异常补偿、审计和前端状态管理复杂度。"),
    concept("模型路由策略", "medium", "不同模型适合不同任务。企业要按质量、成本、延迟、隐私和可用性做路由。"),
    concept("超时、重试与 fallback", "medium", "模型服务不稳定是常态。系统必须有超时、有限重试、降级模型和友好错误。"),
    concept("Token 成本核算", "medium", "成本由输入 token、输出 token、模型价格、重试、上下文长度和缓存命中共同决定。"),
    concept("Prompt Cache", "small", "重复问题或稳定上下文可以缓存，但必须注意权限、时效和个性化差异。"),
    concept("OpenAI 兼容接口", "small", "兼容接口不代表行为完全一致，参数、流式、错误码和工具调用都要测试。"),
    concept("模型调用日志", "medium", "日志是评估、成本、审计和安全的基础，不能只为排错记录。")
  ]},
  { week: "第 3 周", title: "Prompt 与结构化输出", domain: "prompt", overview: "把 Prompt 当成接口协议，让模型输出能稳定进入 Java 系统。", concepts: [
    concept("Prompt 是接口协议", "complex", "Prompt 的作用是定义模型执行任务的协议，不是写一段求模型听话的作文。"),
    concept("角色与任务拆分", "medium", "角色定义模型身份，任务定义要完成的工作，拆开后才可复用、测试和治理。"),
    concept("上下文选择", "medium", "上下文围绕任务目标选择，不是越多越好。多余上下文会增加成本并引入干扰。"),
    concept("Few-shot 示例", "medium", "少量高质量示例能约束输出风格和判断尺度，但示例必须覆盖边界情况。"),
    concept("结构化输出", "complex", "结构化输出让 AI 结果进入业务系统，必须配合 JSON Schema、Java record、校验和异常处理。"),
    concept("JSON 修复策略", "medium", "模型偶尔会输出非法 JSON，系统需要提取、修复、重试和降级。"),
    concept("输出字段设计", "medium", "字段越贴近业务决策，AI 越有价值。字段要区分结论、证据、风险、缺失信息和建议动作。"),
    concept("Prompt Injection", "complex", "用户可能通过输入诱导模型忽略规则。防护要结合系统提示词、工具权限和输出校验。"),
    concept("Prompt 版本管理", "medium", "Prompt 是线上逻辑，要版本化、灰度、回滚和效果对比。"),
    concept("Prompt 评估集", "medium", "没有评估集就无法判断提示词是否变好。评估集要覆盖常见、边界和失败样本。")
  ]},
  { week: "第 4 周", title: "Spring AI 入门", domain: "spring", overview: "理解 Spring AI 的工程抽象，并放入 Spring Boot 分层架构。", concepts: ["ChatClient 抽象", "ChatClient.Builder", "Model 抽象", "Advisor 机制", "PromptTemplate", "VectorStore 抽象", "Tool Calling 集成", "自动配置与排除", "AI 测试策略", "与现有项目融合"].map((n) => concept(n, /Advisor|Tool|测试|融合/.test(n) ? "medium" : "small", `${n} 是 Spring AI 中需要理解的工程抽象，重点是它在分层架构中的职责和边界。`))},
  { week: "第 5 周", title: "Embedding 与向量库", domain: "embedding", overview: "理解语义检索底层逻辑：向量模型、文本构造、索引、元数据和评估。", concepts: [
    concept("Embedding 本质", "complex", "Embedding 把文本映射到高维向量空间，让语义相近的文本在距离上更接近。"), concept("向量维度", "small", "维度由 embedding 模型决定，不同模型向量空间不可混用。"), concept("相似度度量", "medium", "常见度量有 cosine、dot product、L2，必须和模型训练方式及索引匹配。"), concept("语义文本构造", "medium", "向量化前的文本组织决定召回质量，要把业务字段合成模型能理解的语义画像。"), concept("Chunk 策略", "complex", "chunk 影响召回粒度。太大干扰多，太小语义不足，要按标题、段落和语义边界切。"), concept("Metadata 设计", "complex", "元数据用于权限、过滤、溯源和版本治理，是生产级向量库关键。"), concept("pgvector", "medium", "pgvector 适合 Java 企业项目快速落地，能和 PostgreSQL 事务、SQL、权限结合。"), concept("Milvus/Redis Vector", "small", "Milvus 偏大规模检索，Redis Vector 偏低延迟和缓存场景。"), concept("TopK 与阈值", "medium", "TopK 不是越大越好，阈值要通过评估集校准。"), concept("语义搜索评估", "medium", "评估要看是否搜到正确答案、是否排序靠前、是否带正确元数据。")
  ]},
  { week: "第 6 周", title: "RAG 知识库 v1", domain: "rag", overview: "搭建最小可用 RAG 链路：采集、解析、切分、检索、引用和拒答。", concepts: ["RAG 第一性原理", "文档采集", "文档解析", "内容清洗", "切分与重叠", "检索器 Retriever", "上下文组装", "引用来源", "资料不足拒答", "增量更新"].map((n) => concept(n, /第一性|切分|检索器|上下文|引用|拒答/.test(n) ? "complex" : "medium", `${n} 是 RAG 链路中的关键环节，决定系统能否基于可信事实回答。`))},
  { week: "第 7 周", title: "RAG 工程优化", domain: "rag", overview: "把能用的 RAG 变成更准、更稳、更可解释的 RAG。", concepts: ["Query Rewrite", "混合检索", "Rerank", "Metadata Filter", "Parent-child Chunk", "Context Compression", "Table RAG", "Graph RAG", "RAG 评估集", "线上反馈闭环"].map((n) => concept(n, /混合|Rerank|Parent|Table|Graph|评估|反馈/.test(n) ? "complex" : "medium", `${n} 是 RAG 从 Demo 走向生产的优化能力，重点是召回、排序、压缩、权限和评估。`))},
  { week: "第 8 周", title: "Tool Calling", domain: "tool", overview: "让模型调用 Java 业务能力，但执行权永远在应用系统手里。", concepts: ["Tool Calling 本质", "工具 Schema", "参数校验", "只读优先", "工具结果摘要", "工具审计", "MCP Server", "Tool Registry", "工具失败恢复", "Human Confirmation"].map((n) => concept(n, /本质|Schema|参数|MCP|Registry|失败|Confirmation/.test(n) ? "complex" : "medium", `${n} 负责把外部能力安全暴露给模型，同时保持权限、校验和审计边界。`))},
  { week: "第 9 周", title: "数据库问答助手", domain: "sql", overview: "NL2SQL 价值高也风险高，必须用语义层、安全层和审计层包住。", concepts: ["NL2SQL 本质", "语义层", "Schema Linking", "SQL 生成计划", "SQL Guard", "只读账号", "分页和超时", "结果解释", "敏感数据脱敏", "NL2SQL 评估"].map((n) => concept(n, /NL2SQL|语义层|Schema|SQL Guard|脱敏|评估/.test(n) ? "complex" : "medium", `${n} 是安全数据问答能力中的关键知识点，不能只追求生成 SQL。`))},
  { week: "第 10 周", title: "Agent 工作流", domain: "agent", overview: "Agent 是模型、工具、记忆、状态、规划、终止条件和护栏组成的受控执行系统。", concepts: ["Agent 本质", "ReAct 模式", "Planning 规划", "Memory 记忆", "State 状态", "ToolNode", "Multi-Agent 协作", "终止条件", "Agent 安全", "企业 Agent 流程"].map((n) => concept(n, "complex", `${n} 是 Agent 系统的核心组成，要按运行流程、状态变化、工具边界和安全护栏讲清楚。`))},
  { week: "第 11 周", title: "工程化与安全治理", domain: "governance", overview: "把 AI 应用从能跑变成可上线、可追踪、可回滚、可持续优化。", concepts: ["模型网关", "Prompt 管理", "调用审计", "AI 可观测性", "质量评估", "成本治理", "权限与租户", "敏感信息脱敏", "Prompt 注入防护", "灰度与回滚"].map((n) => concept(n, /网关|审计|观测|评估|权限|脱敏|注入|灰度/.test(n) ? "complex" : "medium", `${n} 是企业级 AI 治理能力，决定系统能否真正上线。`))},
  { week: "第 12 周", title: "综合设计与架构表达", domain: "architecture", overview: "训练把业务目标拆成 AI 能力、数据流、控制流、风险点和验收指标的能力。", concepts: ["从业务价值出发", "数据流设计", "控制流设计", "风险点标注", "验收指标", "分阶段路线", "团队角色", "架构图表达", "汇报方式", "后续实战准备"].map((n) => concept(n, /数据流|控制流|风险|指标|架构/.test(n) ? "complex" : "medium", `${n} 是 AI 项目从想法到落地的架构表达能力。`))}
];

function classifyPlan(concept) {
  if (concept.level === "complex") return ["讲本质", "拆组件", "画全流程", "工程示例", "生产治理"];
  if (concept.level === "medium") return ["讲本质", "拆组件", "工程化", "验收"];
  return ["讲本质", "使用边界", "小练习"];
}
function componentDetails(domain, conceptName) {
  return domain.components.map((c) => {
    if (/业务价值|业务目标/.test(c)) return `${c}：回答“为什么要做”。学习「${conceptName}」时，先判断它是否能带来效率、质量、成本、风险或体验改进，否则很容易变成模型能力展示。`;
    if (/模型能力|大模型|LLM|ChatClient|Model/.test(c)) return `${c}：负责理解、生成、归纳、规划或总结，但不负责事实真实性、最终权限和业务事务。它的输出必须被上下文、工具、检索和服务端校验约束。`;
    if (/上下文|消息结构|Prompt|角色|任务|约束|Schema/.test(c)) return `${c}：负责告诉模型“看什么、做什么、不能做什么、按什么格式输出”。它是模型行为的接口协议，必须可版本化、可评估、可回滚。`;
    if (/私有知识|Ingestion|Parser|Chunk|Retriever|Rerank|Generator|Embedding|Vector|语义文本|向量|索引|元数据/.test(c)) return `${c}：负责把企业事实变成可检索、可引用、可过滤的上下文。关键不是把资料塞给模型，而是保留来源、权限、版本、时间和召回证据。`;
    if (/业务工具|Tool|MCP|参数|执行|结果摘要|审计日志/.test(c)) return `${c}：负责连接外部系统。模型只能提出调用意图，Java 服务必须校验参数、权限、幂等、风险等级和审计日志。`;
    if (/语义层|SQL|只读|结果解释|Schema Linking/.test(c)) return `${c}：负责把自然语言问题约束成安全、可解释、可审计的数据查询。不要让模型自由猜表、猜字段或直接执行高权限 SQL。`;
    if (/治理|权限|审计|评估|成本|Guard|监控|Memory|State/.test(c)) return `${c}：负责让「${conceptName}」从 Demo 变成可上线能力。它要记录过程、控制风险、评估质量、限制成本，并把失败样本回流到下一轮优化。`;
    return `${c}：这是「${conceptName}」链路中的一个职责点。要讲清它的输入、输出、上下游依赖、失败表现，以及应该由模型、Java 服务、数据库还是人工来兜底。`;
  });
}
function specificAnalysis(module, conceptItem) {
  const name = conceptItem.name;
  const profiles = {
    architecture: {
      conclusion: `${name} 要解决的不是“会不会接模型”，而是把一个概率生成能力放进确定性的企业系统里。判断一个 AI 架构是否成熟，关键看它有没有把目标、上下文、知识、工具、执行、审计和反馈串成闭环。`,
      mechanism: [
        `第一步不是选模型，而是拆业务目标：这个功能到底提高效率、降低风险、改善质量，还是只是看起来新鲜。目标越虚，后面的 Prompt、RAG、Agent 都会变成堆概念。`,
        `第二步拆能力边界：模型负责理解和生成，知识库负责事实补充，工具负责实时数据和业务动作，Java 后端负责权限、事务、规则、审计和兜底。`,
        `第三步画数据流和控制流：用户输入如何进入上下文，知识片段如何被选择，工具参数如何被校验，结果如何被人工确认或自动进入下一步。`,
        `第四步设计失败路径：模型不确定、资料不足、工具失败、权限不足、成本超限、用户不满意时，系统应该拒答、降级、转人工还是重新检索。`
      ],
      landing: [
        `Java 项目里先抽出 AiApplicationService 或 AiGateway，Controller 只处理 HTTP，不要把模型调用、Prompt、RAG 和工具执行混在控制层。`,
        `把每条 AI 链路都当成业务流程建模：Request、Context、Decision、Evidence、Action、AuditRecord 这些对象要清楚。`,
        `验收时不要只看“回答像不像”，还要看可追溯来源、权限正确性、失败可解释、成本可控和人工采纳率。`
      ],
      trap: `最常见的误区是把 AI 架构画成“前端 -> 模型 -> 答案”。真实企业链路至少还要有知识、工具、权限、审计、评估、降级和反馈，否则 Demo 越漂亮，上线越危险。`
    },
    api: {
      conclusion: `${name} 的本质是把不稳定的外部模型服务包装成稳定的企业后端能力。模型 API 不只是 HTTP 调用，它同时牵涉消息协议、参数、流式传输、路由、成本、重试、fallback 和日志。`,
      mechanism: [
        `一次调用先由业务请求生成 messages：system 定边界，user 给任务，assistant 保留历史，tool/result 补充外部事实。消息结构混乱，模型行为就会漂。`,
        `模型参数不是玄学调参：temperature 控制随机性，max tokens 控制输出上限，stop/response format/tools 决定能不能被系统稳定消费。`,
        `AI Gateway 要负责模型路由、超时、重试、降级、限流和成本统计；业务代码不应该到处散落 provider SDK。`,
        `SSE 流式输出提升体验，但服务端必须处理客户端断开、任务取消、异常事件、审计补记和前端重连状态。`
      ],
      landing: [
        `定义统一 ModelClient 接口，屏蔽 OpenAI 兼容、国产模型、本地模型的差异。`,
        `每次调用生成 requestId，记录模型、Prompt 版本、input/output token、耗时、状态码、重试次数和降级原因。`,
        `事实问答类任务默认低温度、短超时、有限重试；创意生成可以更高温度，但必须限制输出长度和预算。`
      ],
      trap: `不要让 Controller 直接调用模型。那样初期最快，后期会在路由、审计、成本、安全、fallback 上全线失控。`
    },
    prompt: {
      conclusion: `${name} 不是写一段“请你扮演专家”的话，而是在给模型设计一份接口协议。好的 Prompt 会明确角色、任务、上下文、约束、输出格式、失败策略和可验证证据。`,
      mechanism: [
        `角色只解决“用什么视角回答”，任务才解决“要完成什么动作”。如果角色和任务混在一起，Prompt 后续很难复用和评估。`,
        `上下文是输入数据，不是越多越好。无关材料会扩大 token 成本，也会把模型注意力拉偏。`,
        `结构化输出要先从业务字段反推：结论、原因、证据、风险、缺失信息、建议动作分别用什么字段表达。`,
        `Prompt Injection 的本质是用户把“数据”伪装成“指令”。防护不能只靠一句“不要听用户乱说”，而要靠输入隔离、工具权限和输出校验。`
      ],
      landing: [
        `用 PromptTemplate 管理模板字段，用版本号管理变更，用 JSON Schema 或 Java record 做输出契约。`,
        `把 promptId、version、变量值摘要和输出校验结果写入日志，方便回放问题。`,
        `为每个关键 Prompt 准备评估集，覆盖正常、边界、恶意输入和资料不足样本。`
      ],
      trap: `最危险的 Prompt 是看起来很长、很认真，但没有字段契约、没有评估集、没有版本号。它上线后不可治理。`
    },
    spring: {
      conclusion: `${name} 要放在 Spring Boot 分层架构里理解。Spring AI 的价值不是让你少写几行调用代码，而是把模型、Prompt、Advisor、VectorStore、Tool 变成可组合、可替换、可测试的工程组件。`,
      mechanism: [
        `ChatClient 是面向应用层的调用入口，它把消息、参数、模型和响应解析组合起来，但不应该承担业务权限和事务。`,
        `Advisor 类似 AI 调用链的拦截器，可用于注入 RAG 上下文、记录日志、做安全检查或改写请求。链路越复杂，Advisor 的顺序越关键。`,
        `VectorStore、Tool Callback 和 ModelOptions 是基础设施能力，应该通过配置和 Bean 注入管理，而不是散落在业务方法里。`,
        `Spring AI 解决的是工程抽象，不解决业务正确性。RAG 准不准、工具安全吗、Prompt 稳不稳，仍然需要你设计。`
      ],
      landing: [
        `推荐 Controller -> Application Service -> AI Service -> Infrastructure Adapter 分层，AI Service 聚合 ChatClient、PromptFactory、Retriever、ToolRegistry。`,
        `测试不要只 mock 模型返回值，还要测结构化解析、Advisor 是否注入上下文、权限过滤是否生效、工具是否被拦截。`,
        `把模型配置、Prompt 版本、TopK、rerank 开关、工具白名单放入配置中心或数据库，支持灰度和回滚。`
      ],
      trap: `不要把 Spring AI 当成魔法框架。框架只给抽象和接线，真正的生产质量来自边界设计、数据治理和测试。`
    },
    embedding: {
      conclusion: `${name} 的核心是把文本放进一个语义空间，让“意思相近”可以用向量距离近似计算。它不是数据库索引的替代品，而是召回候选事实的一种信号。`,
      mechanism: [
        `Embedding 模型会把文本压缩成固定维度向量。维度、训练语料和归一化方式不同，向量空间就不同，不能混用。`,
        `语义文本构造比很多人想象得重要：标题、业务字段、同义词、时间、状态、所属组织是否进入文本，会直接影响召回。`,
        `向量库检索先给候选，不给最终答案。TopK、阈值、metadata filter 和 rerank 共同决定哪些片段能进入模型上下文。`,
        `元数据是生产生命线：来源、租户、权限、版本、时间、对象 ID、文档类型缺失时，检索结果即使相似也可能不能用。`
      ],
      landing: [
        `向量表至少保存 id、vector、content、metadata、embeddingModel、embeddingVersion、sourceId、updatedAt。`,
        `文档重建向量时要按模型版本隔离集合，避免新旧向量混在同一索引中。`,
        `用 Recall@K、MRR、人工相关性评分评估语义搜索，不要只凭几次查询感觉“还行”。`
      ],
      trap: `不要把相似度分数当业务正确性。相似只说明“语义像”，不说明“有权限、最新、权威、能回答”。`
    },
    rag: {
      conclusion: `${name} 的本质是让模型基于外部证据回答，而不是依赖训练记忆瞎猜。RAG 不是“向量库 + 大模型”，而是一条从资料治理到答案引用的证据流水线。`,
      mechanism: [
        `离线链路决定知识质量：采集、解析、清洗、切分、去重、入库、版本管理，每一步都会影响线上回答。`,
        `在线链路决定回答质量：query rewrite、召回、metadata filter、rerank、context compression、生成和引用校验要配合。`,
        `chunk 策略是 RAG 的地基。太大导致噪声多，太小导致语义断裂；标题层级、表格、列表、代码和制度条款应采用不同策略。`,
        `资料不足时拒答是能力，不是失败。生产 RAG 必须能说明缺少什么资料，而不是编一个看起来合理的答案。`
      ],
      landing: [
        `建立 DocumentIngestionJob，把解析结果、chunk、embedding、metadata、source version 全部可追踪。`,
        `回答对象包含 answer、citations、confidence、missingInfo、usedChunks，前端能点回原文。`,
        `评估集按问题、标准答案、期望引用、拒答条件组织，持续回归测试检索和生成策略。`
      ],
      trap: `RAG 最大误区是只调 TopK。真正要调的是文档结构、chunk、元数据、检索策略、重排、上下文压缩和答案证据约束。`
    },
    tool: {
      conclusion: `${name} 的核心不是让模型“拥有工具”，而是让模型在受控边界内提出工具调用意图，由 Java 系统负责校验和执行。MCP 进一步把工具连接标准化，减少每个应用重复对接。`,
      mechanism: [
        `模型看到的是工具名称、描述和参数 schema，它生成的是“建议调用哪个工具、带哪些参数”，不是直接执行权。`,
        `服务端必须校验参数类型、枚举范围、用户权限、租户范围、风险等级和幂等性。模型生成的任何参数都不能直接信任。`,
        `工具结果要变成 observation 再回给模型。结果过大时先摘要、裁剪和脱敏，只返回回答所需字段。`,
        `MCP 的角色是 Host、Client、Server。Host 管理上下文和权限，Client 与 Server 通信，Server 暴露 tools/resources/prompts。`
      ],
      landing: [
        `工具优先设计成只读、小粒度、单职责，例如 queryOrderStatus，不要暴露 doEverythingService。`,
        `高风险动作必须 Human Confirmation，例如发通知、改状态、扣费、审批、删除、外部提交。`,
        `每次工具调用记录 traceId、toolName、argsDigest、policyDecision、duration、resultSummary 和风险等级。`
      ],
      trap: `最危险的做法是把内部 Service 全量暴露给模型。模型负责建议，系统负责执行边界，这条线不能模糊。`
    },
    sql: {
      conclusion: `${name} 是高价值也高风险的 AI 能力。它不是把自然语言直接翻译成 SQL，而是通过语义层、Schema Linking、SQL Plan、SQL Guard 和只读执行，把问题约束成安全查询。`,
      mechanism: [
        `第一步应识别业务指标，而不是猜表名。用户说“活跃员工”时，系统要知道指标口径、过滤条件和数据权限。`,
        `Schema Linking 把自然语言中的对象、指标、时间、维度映射到白名单表字段。没有语义层，模型会凭语感猜字段。`,
        `SQL Guard 要检查只读、LIMIT、超时、禁止关键字、schema 白名单、敏感字段和查询成本。`,
        `结果解释要区分“SQL 查询结果”和“业务解释”。模型可以总结，但不能编造数据库没有返回的事实。`
      ],
      landing: [
        `准备 MetricDictionary、TableWhitelist、ColumnPolicy、SqlGuard、ReadOnlyDataSource 五个基础组件。`,
        `生成 SQL 前先生成查询计划，计划被校验后再渲染 SQL，减少模型自由发挥空间。`,
        `线上每条 SQL 都记录自然语言、计划、SQL、执行耗时、返回行数、脱敏字段和用户权限。`
      ],
      trap: `不要把数据库账号权限交给模型，也不要让模型自由选择表字段。NL2SQL 的关键不是生成 SQL，而是安全地限制 SQL。`
    },
    agent: {
      conclusion: `${name} 不是更长的 Prompt，也不是会连续聊天的机器人。Agent 是一个受控运行时：它围绕目标维护状态，选择技能和工具，执行观察，再根据结果决定继续、停止或转人工。`,
      mechanism: [
        `Agent Runtime 负责接收目标、维护 State、选择下一步、调度 Skill/Tool、合并 observation、检查终止条件。`,
        `LLM 在 Agent 中像“大脑”，负责理解、规划和参数生成；但它不应该拥有权限、事务、数据库连接或外部动作执行权。`,
        `Memory 和 State 不一样。Memory 偏长期经验和用户偏好，State 是当前任务运行过程中的完整上下文、计划、工具结果和终止原因。`,
        `ReAct 适合工具问答和探索任务；固定 Workflow 适合企业流程；Multi-Agent 适合职责复杂但协同成本也更高的场景。`
      ],
      landing: [
        `先做 Workflow Agent，再做 ReAct Agent。生产项目不要一开始追无限自主循环。`,
        `为 Agent 设置 maxSteps、maxToolCalls、timeout、riskPolicy、humanApprovalPolicy 和 replayLog。`,
        `所有中间状态必须可回放，方便排查为什么调用了某个工具、为什么终止、为什么转人工。`
      ],
      trap: `Agent 最容易翻车在“无限循环”和“权限过大”。只要没有最大步数、工具分级、人工确认和状态回放，就不该上线。`
    },
    governance: {
      conclusion: `${name} 决定 AI 应用能不能真正上线。治理不是最后补文档，而是从第一天就嵌入模型调用、Prompt、RAG、工具、Agent 和发布流程。`,
      mechanism: [
        `模型网关治理调用入口：统一路由、限流、预算、日志、超时、fallback 和 provider 差异。`,
        `质量治理依赖评估集：没有固定样本，就无法判断 Prompt、模型、RAG 策略和工具描述是否变好。`,
        `安全治理要分层：输入隔离、知识权限、工具权限、输出校验、敏感数据脱敏和高风险人工确认。`,
        `发布治理要可回滚：模型、Prompt、检索策略、工具 schema 都要版本化和灰度，不要一次性全量替换。`
      ],
      landing: [
        `建立 AiAuditLog、PromptRegistry、EvaluationSet、CostBudget、PolicyEngine、ReleaseStrategy 这些基础设施。`,
        `把质量、成本、延迟、安全拦截、拒答、人工采纳率做成仪表盘，别等用户投诉才发现问题。`,
        `把失败样本回流成评估集，而不是只在群里讨论“这次模型又答错了”。`
      ],
      trap: `只靠 Prompt 做安全是脆弱的。真正的安全来自权限系统、数据边界、工具边界、输出校验和审计回放。`
    }
  };
  return profiles[module.domain] || profiles.architecture;
}
function governanceFixes(module, conceptItem) {
  const d = domains[module.domain];
  const fixes = {
    architecture: ["先写业务价值假设和验收指标，再决定是否需要模型、RAG、工具或 Agent。", "补数据流图，标明用户输入、业务数据、检索数据、模型上下文、工具参数和审计日志流向。", "为模型失败、检索为空、权限不足、成本超限、人工拒绝分别设计分支。", "把准确率、节省时间、采纳率、成本、延迟、安全事件写进项目验收。"],
    api: ["抽出统一 AiGateway，Controller 不直接调模型。", "设置连接超时、读取超时、最大重试次数和降级模型。", "记录 input/output token、模型单价、重试次数、调用人和业务线。", "SSE 增加断线取消、心跳、异常事件、前端重连提示和服务端审计补记。"],
    prompt: ["把角色、任务、上下文、约束、输出格式拆成模板字段，并用版本号管理。", "为字段写含义、类型、范围和缺失策略，服务端用 JSON Schema 或 Java Validator 校验。", "Prompt 发布要走灰度、对照样本和回滚开关。", "把用户输入当数据而不是指令，用系统提示词、工具权限和输出校验共同防注入。"],
    spring: ["把 AI 逻辑放到 Application Service，不要堆在 Controller。", "Prompt、Advisor、Tool、VectorStore 都要可配置、可测试、可替换。", "为 Advisor 增加调用链日志，记录注入了什么上下文、检索了什么内容。", "测试断言结构、引用、拒答、权限、工具调用和关键业务字段。"],
    embedding: ["向量表记录 embedding model、维度、版本和生成时间，不同模型向量分集合存储。", "元数据至少包含来源、租户、权限、版本、时间、业务类型和可追溯 ID。", "根据文档结构切分，表格、标题、条款、代码块使用不同策略。", "相似度只作为召回信号，最终排序结合业务规则、时间、权限、质量分和反馈。"],
    rag: ["建立文档解析和 chunk 流水线，控制进入模型的片段数量、长度和来源。", "答案必须带来源编号、标题、版本和片段 ID，前端允许点回原文验证。", "检索分数低、冲突来源多或无命中时拒答，并说明缺少什么资料。", "检索前带租户、部门、地区、角色、有效期等 metadata filter。"],
    tool: ["工具命名和描述要单一明确，大工具拆成多个只读小工具。", "禁止模型直接传 SQL、脚本或自由表名，参数用枚举、ID、范围和权限白名单校验。", "工具结果先摘要再给模型，只返回回答所需字段。", "记录调用人、参数、权限判定、结果摘要、耗时和风险等级，高风险动作人工确认。"],
    sql: ["数据库账号只读且限定 schema，SQL Guard 拦截危险语句。", "维护业务指标字典和表字段白名单，让模型先生成查询计划，再绑定真实表字段。", "所有 SQL 自动加 LIMIT、超时、分页和执行计划检查。", "敏感字段按角色脱敏或禁止返回，结果解释不泄露原始隐私明细。"],
    agent: ["设置最大步数、最大工具调用次数和最大耗时，超过阈值停止并转人工。", "工具按风险分级，只读工具可自动执行，写操作、外部通知、金额和审批必须确认。", "Agent State 保存用户目标、计划、工具调用、观察结果、中间答案和终止原因。", "先用固定 Workflow Agent 上线，单链路稳定后再考虑 ReAct 或 Multi-Agent。"],
    governance: ["AI 调用日志记录 requestId、用户、模型、Prompt 版本、知识来源、工具调用、token、耗时和结果。", "设置团队、业务线、用户和模型维度预算，超预算时降级模型或压缩上下文。", "模型、Prompt、RAG 策略发布都走灰度，对照评估集胜出后再扩大流量。", "把注入防护放在输入隔离、知识过滤、工具权限、输出校验四层。"]
  };
  const selected = fixes[module.domain] || fixes.architecture;
  return d.pitfalls.map((p, i) => `${p}：对「${conceptItem.name}」来说，处理建议是：${selected[i % selected.length]} 这类治理必须落到系统机制上，而不是停留在口头规范。`);
}
function engineeringSkeleton(module, conceptItem) {
  const name = conceptItem.name.replace(/\s+/g, "");
  const d = domains[module.domain];
  const snippets = {
    architecture: [`// ${name}: architecture decision`, "Goal goal = clarifyBusinessValue(request);", "CapabilityMap caps = splitModelKnowledgeTools(goal);", "RiskMap risks = identifyRisks(caps);", "AiFlow flow = designDataAndControlFlow(caps, risks);", "Metrics metrics = defineAcceptance(flow);"],
    api: [`// ${name}: model gateway`, "Route route = router.choose(taskType, quality, cost, latency);", "AiResponse response = modelClient.call(messages, route.options(), timeout);", "Fallback fallback = fallbackPolicy.onFailure(response);", "metrics.record(model, tokens, latency, status);"],
    prompt: [`// ${name}: prompt contract`, "PromptTemplate template = promptRegistry.load(name, version);", "String prompt = template.render(input, context, constraints);", "JsonNode json = jsonRepair.parse(chatClient.call(prompt));", "Result result = validator.validate(json);"],
    spring: [`// ${name}: Spring AI service`, "@Service", "class AiApplicationService {", "  Result handle(Request req) {", "    return chatClient.prompt(promptFactory.create(req)).call().entity(Result.class);", "  }", "}"],
    embedding: [`// ${name}: semantic retrieval`, "String text = semanticTextBuilder.build(object);", "float[] vector = embeddingModel.embed(text);", "vectorStore.upsert(id, vector, metadata);", "List<Match> matches = vectorStore.search(queryVector, filter, topK);"],
    rag: [`// ${name}: RAG pipeline`, "String query = queryRewriter.rewrite(question);", "List<Chunk> candidates = retriever.search(query, metadataFilter);", "List<Chunk> top = reranker.rank(query, candidates).take(5);", "Answer answer = generator.answer(question, contextWithCitations(top));"],
    tool: [`// ${name}: safe tool calling`, "ToolCall call = model.decideTool(intent, toolSchemas);", "Args args = validator.validate(call.args(), user, tenant);", "ToolResult result = toolExecutor.executeReadOnly(args);", "audit.save(call, args, result);"],
    sql: [`// ${name}: secure NL2SQL`, "Intent intent = semanticLayer.parse(question);", "SqlPlan plan = planner.create(intent, allowedMetrics);", "String sql = sqlGenerator.generate(plan);", "sqlGuard.assertSelectOnly(sql).assertLimit().assertWhitelist();"],
    agent: [`// ${name}: controlled agent loop`, "while (!state.done() && state.steps() < MAX_STEPS) {", "  Decision decision = llm.plan(state, allowedTools);", "  Observation obs = toolNode.executeIfAllowed(decision);", "  state = reducer.merge(state, decision, obs);", "}"],
    governance: [`// ${name}: governance wrapper`, "Policy policy = policyEngine.check(user, task, dataScope);", "String requestId = audit.start(user, model, promptVersion);", "AiResponse response = aiGateway.callWithPolicy(policy, request);", "Evaluation eval = evaluator.score(response, rules);"]
  };
  return snippets[module.domain] || snippets.architecture;
}
function agentSwimlane() {
  return swimlane(["用户", "Agent", "Skills", "LLM", "MCP", "工具"], [
    { lane: "用户", no: "1", title: "提出问题", desc: "输入目标、约束和业务上下文。" },
    { lane: "Agent", no: "2", title: "接收输入", desc: "建立任务对象和 traceId。" },
    { lane: "Agent", no: "3", title: "理解意图", desc: "判断是问答、检索、工具调用还是流程任务。" },
    { lane: "Agent", no: "4", title: "构建上下文", desc: "加入历史、记忆、权限和当前状态。" },
    { lane: "Agent", no: "5", title: "意图识别", desc: "拆成子任务，判断是否需要 Skill 或工具。" },
    { lane: "Agent", no: "6", title: "决定调用 Skills", desc: "选择检索、SQL、报告、审批等能力。" },
    { lane: "Skills", no: "7", title: "选择合适 Skill", desc: "找到可复用流程，不把所有事丢给模型。" },
    { lane: "Skills", no: "8", title: "准备 Skill 输入", desc: "提取参数、校验类型、补充必要上下文。" },
    { lane: "Skills", no: "9", title: "执行 Skill 逻辑", desc: "运行可控流程，必要时请求 LLM 推理。" },
    { lane: "LLM", no: "10", title: "规划/推理", desc: "生成计划、参数或下一步动作。" },
    { lane: "Skills", no: "11", title: "判断是否需外部工具", desc: "不需要则直接返回结构化 Skill 结果。" },
    { lane: "MCP", no: "12", title: "选择目标工具", desc: "按协议寻找查询、计算、检索等工具。" },
    { lane: "MCP", no: "13", title: "封装请求", desc: "适配协议、参数、权限和调用格式。" },
    { lane: "工具", no: "14", title: "执行工具操作", desc: "查询数据库、调用接口、读取文件或计算。" },
    { lane: "工具", no: "15", title: "返回原始结果", desc: "返回数据、文本、状态码或错误信息。" },
    { lane: "MCP", no: "16", title: "解析标准化", desc: "把工具结果转成 observation。" },
    { lane: "LLM", no: "17", title: "接收观察", desc: "结合工具结果重新推理是否继续。" },
    { lane: "Agent", no: "18", title: "整合最终回答", desc: "融合中间结果、引用、解释和风险提示。" },
    { lane: "Agent", no: "19", title: "评估是否满意", desc: "检查目标达成、质量、权限和终止条件。" },
    { lane: "用户", no: "20", title: "接收或继续追问", desc: "用户验证结果，反馈进入记忆和优化闭环。" }
  ]);
}
function genericSwimlane(module) {
  const d = domains[module.domain];
  return swimlane(["用户/业务", "应用服务", "AI 能力", "数据/工具", "治理"], d.flow.map((s, i) => ({
    lane: ["用户/业务", "应用服务", "AI 能力", "数据/工具", "治理"][i % 5], no: String(i + 1), title: s, desc: `该步骤要明确输入、输出、失败处理和审计记录。`
  })));
}

function architectureDiagram(module, c) {
  const diagrams = {
    architecture: [
      ["业务入口", ["用户目标", "业务对象", "权限身份"]],
      ["AI 能力层", ["模型生成", "上下文工程", "知识检索"]],
      ["业务执行层", ["Java Service", "数据库", "外部工具"]],
      ["治理闭环", ["日志审计", "质量评估", "反馈优化"]]
    ],
    api: [
      ["入口层", ["Controller", "SSE/WebSocket", "请求校验"]],
      ["AI Gateway", ["模型路由", "超时重试", "fallback"]],
      ["模型供应商", ["OpenAI 兼容", "本地模型", "云模型"]],
      ["观测成本", ["token 统计", "延迟指标", "错误追踪"]]
    ],
    prompt: [
      ["Prompt 合约", ["System", "User", "上下文"]],
      ["约束层", ["规则", "示例", "输出 Schema"]],
      ["模型输出", ["自然语言", "JSON", "工具参数"]],
      ["服务端校验", ["解析修复", "字段校验", "版本评估"]]
    ],
    spring: [
      ["Web 层", ["Controller", "DTO", "鉴权"]],
      ["应用层", ["AI Service", "PromptFactory", "AiGateway"]],
      ["Spring AI", ["ChatClient", "Advisor", "ToolCallback"]],
      ["基础设施", ["VectorStore", "Model", "Observability"]]
    ],
    embedding: [
      ["数据准备", ["业务对象", "语义文本", "元数据"]],
      ["向量化", ["Embedding Model", "维度", "向量版本"]],
      ["向量库", ["pgvector", "Milvus", "Redis Vector"]],
      ["检索评估", ["TopK", "阈值", "人工相关性"]]
    ],
    rag: [
      ["知识入库", ["采集", "解析清洗", "Chunk/Embedding"]],
      ["检索链路", ["Query Rewrite", "Hybrid Search", "Rerank"]],
      ["生成链路", ["上下文组装", "LLM 生成", "引用校验"]],
      ["生产治理", ["权限过滤", "拒答策略", "评估反馈"]]
    ],
    tool: [
      ["模型侧", ["工具定义", "Schema", "参数生成"]],
      ["应用侧", ["参数校验", "权限判断", "幂等控制"]],
      ["工具侧", ["HTTP API", "数据库查询", "文件/计算"]],
      ["回传侧", ["结果摘要", "Observation", "最终回答"]]
    ],
    sql: [
      ["自然语言", ["用户问题", "指标词", "过滤条件"]],
      ["语义层", ["指标口径", "Schema Linking", "查询计划"]],
      ["安全层", ["SQL Guard", "只读账号", "LIMIT/超时"]],
      ["结果层", ["结果解释", "脱敏", "审计"]]
    ],
    agent: [
      ["Agent Runtime", ["目标解析", "状态管理", "终止条件"]],
      ["能力选择", ["Skills", "Tools", "MCP Server"]],
      ["LLM 推理", ["规划", "参数生成", "反思"]],
      ["安全闭环", ["最大步数", "人工确认", "状态回放"]]
    ],
    governance: [
      ["入口治理", ["模型网关", "权限身份", "限流"]],
      ["过程治理", ["Prompt 版本", "工具审计", "Trace"]],
      ["质量治理", ["评估集", "线上反馈", "回归测试"]],
      ["运营治理", ["成本预算", "灰度发布", "回滚"]]
    ]
  };
  const columns = diagrams[module.domain] || diagrams.architecture;
  return `<div class="arch"><div class="arch-title">${escapeHtml(c.name)} 架构图</div><div class="arch-grid">${columns.map((col, i) => `<div class="arch-col"><div class="arch-head">${i + 1}. ${escapeHtml(col[0])}</div>${col[1].map((item) => `<div class="arch-node">${escapeHtml(item)}</div>`).join("")}</div>`).join("")}</div><div class="arch-guard">横向看数据流：输入如何变成上下文、工具调用或模型输出；纵向看治理流：权限、审计、评估和反馈必须贯穿全链路。</div></div>`;
}

function moduleArchitectureDiagram(module) {
  const diagrams = {
    architecture: {
      lanes: ["业务方", "Java 应用", "AI 能力", "数据/工具", "治理"],
      steps: [
        ["业务方", "1", "提出业务目标", "明确效率、质量、成本或风险目标。"],
        ["Java 应用", "2", "拆能力边界", "判断模型、知识、工具分别负责什么。"],
        ["AI 能力", "3", "组织上下文", "构造 Prompt、历史、规则和约束。"],
        ["数据/工具", "4", "补充事实", "检索知识、查询数据或调用工具。"],
        ["AI 能力", "5", "生成候选结果", "输出答案、JSON、计划或建议。"],
        ["Java 应用", "6", "服务端校验", "校验权限、格式、引用和业务规则。"],
        ["治理", "7", "记录审计", "记录输入、模型、知识来源、工具和成本。"],
        ["业务方", "8", "验证反馈", "人工确认质量，反馈进入下一轮优化。"]
      ]
    },
    api: {
      lanes: ["用户端", "API 服务", "AI Gateway", "模型供应商", "观测成本"],
      steps: [
        ["用户端", "1", "发起请求", "普通问答、结构化任务或 SSE 流式任务。"],
        ["API 服务", "2", "鉴权限流", "校验用户、租户、输入长度和业务参数。"],
        ["API 服务", "3", "构造消息", "组装 system/user/context/options。"],
        ["AI Gateway", "4", "模型路由", "按质量、成本、延迟选择模型。"],
        ["模型供应商", "5", "执行推理", "云模型、本地模型或兼容接口返回结果。"],
        ["AI Gateway", "6", "重试降级", "超时、错误码、fallback 统一处理。"],
        ["用户端", "7", "流式/一次性返回", "SSE token 流或完整结构化结果。"],
        ["观测成本", "8", "记录指标", "token、耗时、错误率、fallback 率。"]
      ]
    },
    prompt: {
      lanes: ["业务需求", "Prompt 合约", "LLM", "校验修复", "评估集"],
      steps: [
        ["业务需求", "1", "定义任务", "明确分类、抽取、评分、生成或拒答。"],
        ["Prompt 合约", "2", "拆角色任务", "System、User、Context 分离。"],
        ["Prompt 合约", "3", "加入约束", "规则、示例、输出 Schema、禁止项。"],
        ["LLM", "4", "生成结果", "自然语言、JSON、工具参数或计划。"],
        ["校验修复", "5", "解析校验", "JSON 修复、字段校验、业务规则检查。"],
        ["评估集", "6", "对照样本", "用黄金样本比较版本效果。"],
        ["Prompt 合约", "7", "灰度回滚", "新版本小流量验证，不合格回滚。"]
      ]
    },
    spring: {
      lanes: ["Web 层", "应用服务", "Spring AI", "基础设施", "治理"],
      steps: [
        ["Web 层", "1", "Controller 接入", "接收 DTO，完成鉴权和参数校验。"],
        ["应用服务", "2", "AI Service 编排", "选择 Prompt、模型、Advisor、Tool。"],
        ["Spring AI", "3", "ChatClient 调用", "统一构造模型请求。"],
        ["Spring AI", "4", "Advisor 增强", "注入记忆、RAG、日志或安全策略。"],
        ["基础设施", "5", "VectorStore/Tool", "访问向量库或业务工具。"],
        ["基础设施", "6", "Model 推理", "调用云端或本地模型。"],
        ["治理", "7", "测试观测", "结构校验、trace、指标、回归样本。"]
      ]
    },
    embedding: {
      lanes: ["业务数据", "文本构造", "Embedding", "向量库", "检索评估"],
      steps: [
        ["业务数据", "1", "收集对象", "文档、岗位、候选人、商品或工单。"],
        ["文本构造", "2", "构造语义文本", "合并字段、标题、标签和上下文。"],
        ["Embedding", "3", "生成向量", "记录模型、维度、版本和时间。"],
        ["向量库", "4", "写入索引", "保存 vector、metadata、source id。"],
        ["检索评估", "5", "查询向量化", "用户问题或业务对象生成 query vector。"],
        ["向量库", "6", "TopK 召回", "相似度检索并做 metadata filter。"],
        ["检索评估", "7", "业务重排", "结合规则、时间、权限和人工反馈。"]
      ]
    },
    rag: {
      lanes: ["知识源", "入库管道", "检索链路", "LLM 生成", "治理反馈"],
      steps: [
        ["知识源", "1", "采集文档", "PDF、Word、网页、表格、制度和 FAQ。"],
        ["入库管道", "2", "解析清洗", "保留标题、表格、层级和来源。"],
        ["入库管道", "3", "Chunk/Embedding", "按语义边界切分并向量化。"],
        ["检索链路", "4", "查询改写", "把口语问题改成可检索查询。"],
        ["检索链路", "5", "混合召回", "关键词、向量、metadata filter。"],
        ["检索链路", "6", "重排压缩", "Rerank 后压缩上下文。"],
        ["LLM 生成", "7", "带引用回答", "只基于检索证据生成答案。"],
        ["治理反馈", "8", "拒答/评估", "资料不足拒答，失败样本回流。"]
      ]
    },
    tool: {
      lanes: ["用户", "LLM", "应用校验", "MCP", "工具", "审计"],
      steps: [
        ["用户", "1", "提出任务", "查询、计算、检索、生成或业务操作。"],
        ["LLM", "2", "判断需工具", "识别缺少事实或外部能力。"],
        ["LLM", "3", "生成工具参数", "根据 Tool Schema 生成候选参数。"],
        ["应用校验", "4", "参数权限校验", "类型、范围、租户、角色、幂等。"],
        ["MCP", "5", "协议适配", "选择工具并封装请求。"],
        ["工具", "6", "执行操作", "HTTP、数据库、文件、计算或搜索。"],
        ["MCP", "7", "返回 Observation", "标准化工具结果给模型。"],
        ["LLM", "8", "总结回答", "解释工具结果并给出结论。"],
        ["审计", "9", "全链路记录", "调用人、参数、结果、风险和耗时。"]
      ]
    },
    sql: {
      lanes: ["用户", "语义层", "LLM Planner", "SQL Guard", "只读数据库", "解释审计"],
      steps: [
        ["用户", "1", "自然语言问题", "指标、筛选条件、时间范围。"],
        ["语义层", "2", "识别指标口径", "定义分子、分母、维度和范围。"],
        ["语义层", "3", "Schema Linking", "绑定真实表和字段。"],
        ["LLM Planner", "4", "生成查询计划", "先计划，再生成 SQL。"],
        ["SQL Guard", "5", "安全校验", "只读、白名单、LIMIT、超时。"],
        ["只读数据库", "6", "执行查询", "只读账号访问受控 schema。"],
        ["解释审计", "7", "解释结果", "生成业务解读并脱敏。"],
        ["解释审计", "8", "记录审计", "保存问题、SQL、耗时、结果摘要。"]
      ]
    },
    agent: {
      lanes: ["用户", "Agent", "Skills", "LLM", "MCP", "工具"],
      steps: [
        ["用户", "1", "提出问题", "输入目标、约束和业务上下文。"],
        ["Agent", "2", "接收输入", "建立任务对象和 traceId。"],
        ["Agent", "3", "理解意图", "判断问答、检索、工具调用或流程任务。"],
        ["Agent", "4", "构建上下文", "加入历史、记忆、权限和当前状态。"],
        ["Agent", "5", "意图识别", "拆成子任务，判断是否需要 Skill 或工具。"],
        ["Agent", "6", "决定调用 Skills", "选择检索、SQL、报告、审批能力。"],
        ["Skills", "7", "选择合适 Skill", "找到可复用流程。"],
        ["Skills", "8", "准备 Skill 输入", "提取参数、校验类型、补充上下文。"],
        ["Skills", "9", "执行 Skill 逻辑", "运行可控流程，必要时请求 LLM。"],
        ["LLM", "10", "规划/推理", "生成计划、参数或下一步动作。"],
        ["Skills", "11", "判断是否需工具", "不需要则返回结构化结果。"],
        ["MCP", "12", "选择目标工具", "按协议寻找工具。"],
        ["MCP", "13", "封装请求", "适配协议、参数、权限和调用格式。"],
        ["工具", "14", "执行工具操作", "查询、调用接口、读取文件或计算。"],
        ["工具", "15", "返回原始结果", "返回数据、文本、状态码或错误。"],
        ["MCP", "16", "解析标准化", "转成 observation。"],
        ["LLM", "17", "接收观察", "结合工具结果判断是否继续。"],
        ["Agent", "18", "整合最终回答", "融合中间结果、引用和风险提示。"],
        ["Agent", "19", "评估是否满意", "检查目标达成、质量和终止条件。"],
        ["用户", "20", "接收或继续追问", "反馈进入记忆和优化闭环。"]
      ]
    },
    governance: {
      lanes: ["业务入口", "模型网关", "安全", "评估", "观测", "发布"],
      steps: [
        ["业务入口", "1", "任务分级", "区分低风险问答、高风险动作。"],
        ["模型网关", "2", "统一路由", "模型选择、限流、fallback。"],
        ["安全", "3", "权限与脱敏", "租户、角色、敏感字段保护。"],
        ["安全", "4", "注入防护", "输入隔离、工具权限、输出校验。"],
        ["评估", "5", "质量评估", "引用正确率、格式、拒答、安全。"],
        ["观测", "6", "日志成本", "trace、token、延迟、错误、预算。"],
        ["发布", "7", "灰度回滚", "Prompt、模型、RAG 策略灰度。"],
        ["评估", "8", "反馈闭环", "失败样本回流到评估集和知识源。"]
      ]
    }
  };
  const spec = diagrams[module.domain] || diagrams.architecture;
  return swimlane(spec.lanes, spec.steps.map(([lane, no, title, desc]) => ({ lane, no, title, desc })));
}

function mcpInfographic() {
  return `
    <div class="mcp-map">
      <div class="mcp-title">MCP 协议 - 一张图连通</div>
      <div class="mcp-subtitle">工具方实现一次，多个 AI 应用复用；应用侧统一管理权限、上下文和工具调用。</div>
      <div class="mcp-host">Host 宿主：Claude Code / Cursor / IDE / 企业 AI 平台<br/><span>管理多个 Client，负责权限把关、上下文汇总、能力暴露给模型</span></div>
      <div class="mcp-row clients"><div>Client A</div><div>Client B</div><div>Client C</div></div>
      <div class="mcp-row servers"><div>文件 Server<br/><span>本地文件系统</span></div><div>GitHub Server<br/><span>Issue / PR / 代码</span></div><div>Postgres Server<br/><span>查库只读</span></div></div>
      <div class="mcp-row caps"><div>Tools 工具<br/><span>tools/call</span></div><div>Resources 资源<br/><span>只读 URI</span></div><div>Prompts 提示<br/><span>用户控制 / 模板</span></div></div>
      <div class="mcp-transport"><span>本地：stdio 子进程</span><b>Server 跑在哪？</b><span>远程：HTTP 端点</span></div>
      <div class="mcp-bottom">MCP 解决的不是“怎么调工具”，而是“工具如何被所有 AI 应用安全复用”。核心关键词：N x M、三角色、JSON-RPC、双向 Sampling、安全边界。</div>
    </div>
  `;
}

function moduleVisual(module) {
  if (module.domain === "tool") return mcpInfographic();
  return moduleArchitectureDiagram(module);
}

function renderCover() {
  return `<section class="page cover"><div class="eyebrow">JAVA AI APPLICATION DEVELOPMENT</div><h1>Java AI 应用开发课程<br/>自适应深讲版</h1><p class="subtitle">参考流程图与大课讲义模式重新完善：不再固定每个知识点页数，而是按复杂度展开。复杂知识点给全流程图、组件拆解、工程骨架和生产治理；简单知识点短讲但讲透。</p><div class="cover-grid"><div><b>课程定位</b>Java 开发者转企业级 AI 应用开发</div><div><b>讲解方式</b>本质 - 组件 - 流程 - 示例 - 治理</div><div><b>页数策略</b>按知识点复杂度自适应，不机械凑页</div><div><b>重点变化</b>复杂点画全链路图，简单点讲清边界和应用</div></div><p class="meta">生成日期：${generatedAt}<br/>目录：D:\\acme\\AI-Learning\\codex版</p></section>`;
}
function renderHowToUse() {
  return `<section class="page"><div class="page-kicker">学习方法</div><h1>这版应该怎么学</h1><div class="quote big"><p>学习 AI 应用开发，不是把每个名词平均展开，而是看它在系统中承担多大复杂度。像 Agent、RAG、Tool Calling、NL2SQL、治理这种复杂知识点，必须画全流程；像 temperature、向量维度、只读账号这种基础点，讲清边界和应用就够。</p></div><div class="callout">这版资料的阅读顺序，和《vibe coding.pdf》一样：先看真实问题，再看判断标准，最后才看流程图和代码骨架。</div><h2>学习动作</h2>${ol(["先看本质，确认这个知识点解决什么问题。", "再看组件，确认每个组件负责什么、不负责什么。", "复杂点一定自己重画流程图，尤其是 Agent、RAG、Tool、NL2SQL。", "最后用生产坑和验收指标倒推：如果上线，怎么知道它是好的？"])}<h2>掌握标准</h2>${ul(["能用自己的话讲清输入、输出、边界、失败路径。", "能把复杂知识点画成流程图或泳道图。", "能写出最小 Java 工程骨架。", "能说出质量、成本、安全、权限和审计指标。"] )}</section>`;
}
function renderModuleIntro(module, idx) {
  const d = domains[module.domain];
  const concern = d.pitfalls.slice(0, 2).join("；");
  const judgement = d.metrics.slice(0, 3).join("、");
  return `<section class="page landscape module-cover"><div class="page-kicker">MODULE ${idx + 1} · ${module.week}</div><h1>${escapeHtml(module.title)} 模块架构图</h1><p class="module-lead">${escapeHtml(module.overview)}</p><div class="quote big"><p><b>这一章先看什么：</b>${escapeHtml(d.label)} 不是背概念，而是看它在系统里怎么落位。先把 ${escapeHtml(concern)} 这类问题看懂，再回头看图，才知道每条线为什么这么连。</p></div>${moduleVisual(module)}<div class="legend"><span>主线：业务请求到结果返回</span><span>补充：知识/工具/数据调用</span><span>治理：权限、审计、评估、反馈</span></div></section>`;
}
function renderConceptCore(module, c) {
  const d = domains[module.domain];
  const lecture = specificAnalysis(module, c);
  return `<section class="page"><div class="page-kicker">${module.week} · ${escapeHtml(module.title)} · ${levelNames[c.level]}</div><h1>${escapeHtml(c.name)} 核心讲解</h1><div class="quote"><p><b>本质：</b>${escapeHtml(c.essence)}</p><p><b>定位：</b>${escapeHtml(c.name)} 属于「${d.label}」能力。不要先背名词，先判断它在系统里解决什么问题、依赖哪些组件、失败时由谁兜底。</p></div><div class="takeaway"><b>先给结论</b><p>${escapeHtml(lecture.conclusion)}</p></div><h2>1. 运行机制拆解</h2>${ol(lecture.mechanism)}<h2>2. Java 工程落地抓手</h2>${ul(lecture.landing)}<h2>3. 核心架构图</h2>${architectureDiagram(module, c)}<div class="trap"><b>关键误区：</b>${escapeHtml(lecture.trap)}</div><div class="callout">判断是否学会：你能讲清「${escapeHtml(c.name)}」的输入、输出、边界、失败表现和验收指标，并能把上面的图复画出来。</div></section>`;
}
function renderConceptComponents(module, c) {
  const d = domains[module.domain];
  return `<section class="page"><div class="page-kicker">${module.week} · ${escapeHtml(module.title)}</div><h1>${escapeHtml(c.name)} 组件拆解</h1><h2>1. 组件职责</h2>${ol(componentDetails(d, c.name))}<h2>2. 组件协作</h2>${flow(d.flow)}<h2>3. 边界提醒</h2>${ul(["模型负责理解、生成、规划或总结，不负责最终权限和真实业务执行。", "数据进入模型前要筛选、脱敏、过滤权限和压缩上下文。", "每个组件都要能测试、记录、替换和降级。", "最终结果必须能被业务人员验证，而不是只让技术人员觉得炫。"] )}</section>`;
}
function renderConceptFlow(module, c) {
  const isAgent = module.domain === "agent";
  return `<section class="page landscape"><div class="page-kicker">${module.week} · ${escapeHtml(module.title)}</div><h1>${escapeHtml(c.name)} 全流程图</h1><p>复杂知识点必须像流程图一样拆清楚：谁发起、谁理解、谁调用、谁执行、谁校验、谁反馈。下面这张图用于建立全局视角。</p>${isAgent ? agentSwimlane() : genericSwimlane(module)}<div class="legend"><span>实线：主流程</span><span>虚线：数据/工具补充</span><span>红线含义：失败后循环或转人工</span></div></section>`;
}
function renderConceptExample(module, c) {
  const d = domains[module.domain];
  return `<section class="page"><div class="page-kicker">${module.week} · ${escapeHtml(module.title)}</div><h1>${escapeHtml(c.name)} 工程示例</h1><h2>1. 最小工程骨架</h2>${code(engineeringSkeleton(module, c))}<h2>2. 可迁移场景</h2>${ul(["HR：制度问答、候选人匹配、面试总结、招聘漏斗分析。", "客服：意图识别、知识库回答、工单摘要、工具查询。", "政务/企业内网：制度解读、流程办理、数据问答、文档生成。", "运维/研发：日志分析、故障排查、代码解释、规范问答。"])}<h2>3. 不要这样用</h2>${ul([`不要把「${c.name}」写成孤立 Demo。`, "不要让模型绕过 Java 后端权限和审计。", "不要只看回答像不像，要看是否可验证、可追踪、可回滚。"] )}</section>`;
}
function renderConceptGovernance(module, c) {
  const d = domains[module.domain];
  return `<section class="page"><div class="page-kicker">${module.week} · ${escapeHtml(module.title)}</div><h1>${escapeHtml(c.name)} 生产坑与验收</h1><h2>1. 常见生产坑</h2>${ol(governanceFixes(module, c))}<h2>2. 推荐验收指标</h2>${ul(d.metrics)}<h2>3. 学完必须能回答</h2>${ul([`${c.name} 的输入、输出、依赖组件分别是什么？`, `哪些能力交给模型，哪些必须由 Java 后端负责？`, `如果 ${c.name} 失败，是重试、降级、拒答、转人工，还是回滚配置？`, `如何记录日志、设计评估集、观察成本和质量？`])}<div class="callout">小练习：拿你熟悉的一个业务系统，画出「${escapeHtml(c.name)}」的数据流和控制流，并标出 3 个高风险点、3 个监控指标、1 个降级方案。</div></section>`;
}
function renderConcept(module, c) {
  const pages = [renderConceptCore(module, c)];
  if (c.level !== "small") pages.push(renderConceptComponents(module, c));
  if (c.level === "complex") pages.push(renderConceptFlow(module, c));
  if (c.level !== "small") pages.push(renderConceptExample(module, c));
  pages.push(renderConceptGovernance(module, c));
  return pages.join("\n");
}
function renderReferences() {
  return `<section class="page"><div class="page-kicker">参考资料</div><h1>后续深度学习资料</h1>${ul(["Spring AI Reference: https://docs.spring.io/spring-ai/reference/", "Spring AI Tool Calling: https://docs.spring.io/spring-ai/reference/api/tools.html", "Spring AI Advisors: https://docs.spring.io/spring-ai/reference/api/advisors.html", "Spring AI Examples: https://github.com/spring-projects/spring-ai-examples", "Spring AI Alibaba: https://github.com/alibaba/spring-ai-alibaba", "Model Context Protocol Architecture: https://modelcontextprotocol.io/specification/2025-06-18/architecture", "MCP Java SDK: https://github.com/modelcontextprotocol/java-sdk", "Microsoft Advanced RAG: https://learn.microsoft.com/en-us/azure/developer/ai/advanced-retrieval-augmented-generation", "Azure AI Search RAG: https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview", "LangChain4j Documentation: https://docs.langchain4j.dev/", "OpenAI Java SDK: https://github.com/openai/openai-java", "OpenSquilla: https://github.com/opensquilla/opensquilla", "Dify: https://github.com/langgenius/dify", "RAGFlow: https://github.com/infiniflow/ragflow"] )}</section>`;
}
function renderPages() {
  return [renderCover(), renderHowToUse(), ...modules.flatMap((m, i) => [renderModuleIntro(m, i), ...m.concepts.map((c) => renderConcept(m, c))]), renderReferences()].join("\n");
}
function renderMarkdown() {
  const lines = ["# Java AI 应用开发课程 - 自适应深讲版", "", `生成日期：${generatedAt}`, "", "本版按知识点复杂度自适应展开，不再固定每个知识点页数。", ""];
  for (const m of modules) {
    lines.push(`## ${m.week}：${m.title}`, "", m.overview, "");
    for (const c of m.concepts) {
      lines.push(`### ${c.name}`, `- 复杂度：${levelNames[c.level]}`, `- 本质：${c.essence}`, `- 学习动作：${classifyPlan(c).join(" -> ")}`, "");
    }
  }
  return lines.join("\n");
}
function pageTitlesForConcept(c) {
  const titles = ["核心讲解"];
  if (c.level !== "small") titles.push("组件拆解");
  if (c.level === "complex") titles.push("全流程图");
  if (c.level !== "small") titles.push("工程示例");
  titles.push("生产坑与验收");
  return titles;
}

function buildOutline() {
  let page = 1;
  const outline = [
    { title: "封面", page: page++ },
    { title: "学习方法", page: page++ }
  ];
  for (const module of modules) {
    const moduleItem = { title: `${module.week} ${module.title}`, page, children: [] };
    page += 1;
    for (const c of module.concepts) {
      const conceptItem = { title: c.name, page, children: [] };
      for (const title of pageTitlesForConcept(c)) {
        conceptItem.children.push({ title: `${c.name} - ${title}`, page });
        page += 1;
      }
      moduleItem.children.push(conceptItem);
    }
    outline.push(moduleItem);
  }
  outline.push({ title: "参考资料", page });
  return outline;
}

const outlinePython = `
import json
import os
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject

pdf_path = sys.argv[1]
outline_path = sys.argv[2]

reader = PdfReader(pdf_path)
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)

if reader.metadata:
    metadata = {str(k): str(v) for k, v in reader.metadata.items() if v is not None}
    if metadata:
        writer.add_metadata(metadata)

with open(outline_path, "r", encoding="utf-8") as f:
    outline = json.load(f)

def add_items(items, parent=None):
    for item in items:
        page_number = int(item["page"]) - 1
        if 0 <= page_number < len(writer.pages):
            node = writer.add_outline_item(item["title"], page_number, parent=parent)
            add_items(item.get("children", []), node)

add_items(outline)
writer.root_object.update({NameObject("/PageMode"): NameObject("/UseOutlines")})

tmp_path = pdf_path + ".outline.tmp"
with open(tmp_path, "wb") as f:
    writer.write(f)
os.replace(tmp_path, pdf_path)
`;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>Java AI 应用开发课程 - 自适应深讲版</title><style>
@page{size:A4;margin:14mm 13mm 16mm}.landscape{page:landscapePage}@page landscapePage{size:A4 landscape;margin:10mm 8mm 12mm}*{box-sizing:border-box}body{margin:0;font-family:"Microsoft YaHei","Noto Sans CJK SC",sans-serif;color:#111827;font-size:14.8px;line-height:1.78;background:#fff}.page{min-height:267mm;page-break-after:always;padding:4mm 3mm 2mm}.landscape{min-height:180mm;padding:2mm 1mm}.landscape h1{font-size:26px;margin-bottom:6px}.landscape p{font-size:12px;line-height:1.45;margin:3px 0}h1{font-size:30px;line-height:1.25;color:#102f50;margin:0 0 14px;font-weight:900}h2{font-size:18px;color:#111827;margin:15px 0 7px;font-weight:900;break-after:avoid;page-break-after:avoid}p{margin:6px 0}.eyebrow,.page-kicker{color:#087f5b;font-size:12px;letter-spacing:1.1px;font-weight:900;text-transform:uppercase;margin-bottom:7px}.cover{padding:26mm 14mm;background:linear-gradient(135deg,#f8fbfd,#f4faf7);border:1px solid #dce8ef;border-radius:10px}.subtitle{font-size:18px;color:#344960;max-width:90%}.meta{margin-top:30mm;color:#536779}.cover-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20mm}.cover-grid div{background:#fff;border:1px solid #d8e7ef;border-radius:10px;padding:13px;min-height:82px}.cover-grid b{display:block;color:#0e4f7e;margin-bottom:4px}.quote{border-left:5px solid #b9bec7;padding:8px 0 8px 15px;margin:8px 0 12px;background:#fbfbfc}.quote.big{font-size:15.8px}.takeaway{border:2px solid #2f80ed;background:linear-gradient(135deg,#eef7ff,#ffffff);border-radius:12px;padding:10px 13px;margin:8px 0 12px}.takeaway b{display:inline-block;background:#102f50;color:white;border-radius:999px;padding:3px 12px;margin-bottom:4px}.takeaway p{font-size:15px;font-weight:700;color:#16324f}.trap{border:1px solid #f2b36d;background:#fff7ed;border-radius:10px;padding:9px 12px;margin:8px 0;color:#7c3f00}.trap b{color:#b45309}ol,ul{margin:7px 0 11px 24px;padding:0}li{margin:4px 0}.callout{border-left:5px solid #f59e0b;background:#fff8e8;padding:10px 12px;margin-top:10px;border-radius:7px;font-weight:700}.flow{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;align-items:stretch;margin:10px 0 12px;page-break-inside:avoid}.flow-step{border:1px solid #cbdde8;background:#f8fbfd;border-radius:8px;padding:8px 5px;text-align:center;min-height:64px}.flow-step span{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#0d8061;color:white;align-items:center;justify-content:center;font-size:12px;font-weight:900;margin-bottom:4px}.flow-step b{display:block;color:#0e4f7e;font-size:12.8px;line-height:1.35}.arch{border:1px solid #d6e4ec;background:#f8fbfd;border-radius:10px;padding:10px;margin:8px 0 12px;page-break-inside:avoid}.arch-title{font-weight:900;color:#0e4f7e;margin-bottom:8px}.arch-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.arch-col{background:#fff;border:1px solid #dbe7ef;border-radius:9px;padding:8px;position:relative}.arch-col:not(:last-child)::after{content:"";position:absolute;right:-8px;top:50%;width:8px;border-top:2px solid #5aa9d6}.arch-head{font-weight:900;color:#0d8061;margin-bottom:6px}.arch-node{border:1px solid #cbdde8;background:#fff;border-radius:7px;padding:6px 7px;margin:5px 0;text-align:center;font-weight:700;color:#102f50}.arch-guard{margin-top:8px;border-left:4px solid #f59e0b;background:#fff8e8;border-radius:7px;padding:8px 10px;font-size:13px;font-weight:700}.mcp-map{border:1px solid #d6e4ec;background:#fffdfa;border-radius:12px;padding:10px;margin-top:6px}.mcp-title{text-align:center;font-size:24px;font-weight:900;color:#102f50}.mcp-subtitle{text-align:center;font-size:13px;font-weight:800;color:#5b6472;margin:2px 0 8px}.mcp-host{max-width:520px;margin:0 auto 10px;background:#e95f38;color:white;border-radius:10px;padding:8px;text-align:center;font-size:16px;font-weight:900}.mcp-host span{font-size:11px;font-weight:700;color:#fff5ef}.mcp-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0}.mcp-row div{border:2px solid #3b91d8;border-radius:10px;background:#eaf4ff;text-align:center;padding:7px;font-size:16px;font-weight:900;color:#236da8}.mcp-row div span{display:block;font-size:11px;color:#555;font-weight:700}.mcp-row.servers div{border-color:#48ad73;background:#eaf8ef;color:#2b7e4e}.mcp-row.caps div{border:2px dashed #f59e0b;background:#fffaf0;color:#b77900}.mcp-transport{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px auto;max-width:760px}.mcp-transport span{background:#2f7db7;color:white;border-radius:999px;padding:8px 16px;font-weight:900}.mcp-transport b{border:2px solid #f59e0b;background:#fff8e8;padding:8px 35px;clip-path:polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%);color:#9a6700}.mcp-bottom{border:2px solid #55a4e6;background:#eaf4ff;border-radius:10px;padding:8px;text-align:center;font-size:15px;font-weight:900;color:#246aa1}pre{background:#f7f7f8;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:12.4px;line-height:1.5;overflow:hidden;white-space:pre-wrap;color:#111827}.module-cover h1{font-size:34px}.swimlane{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:5px}.lane{border:1px solid #d9e5ec;border-radius:7px;background:#fbfdff;min-height:130mm;padding:4px}.lane-title{text-align:center;color:#fff;font-weight:900;background:#1677d2;border-radius:6px;padding:4px;margin-bottom:4px;font-size:11px}.lane:nth-child(1) .lane-title{background:#54b948}.lane:nth-child(3) .lane-title{background:#fb8c00}.lane:nth-child(4) .lane-title{background:#9c27b0}.lane:nth-child(5) .lane-title{background:#3aa6a6}.lane:nth-child(6) .lane-title{background:#f6a609}.lane-card{border:1px solid #cbdde8;border-radius:6px;background:white;margin:4px 0;padding:4px;font-size:9.2px;line-height:1.25}.lane-card b{font-size:9.8px}.lane-card p{margin:2px 0 0;font-size:9px;line-height:1.25}.legend{display:flex;gap:18px;margin-top:5px;font-size:10px;color:#475569}
.module-lead{font-size:15px!important;color:#344960;max-width:95%;margin-bottom:10px}.module-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}.module-strip div{background:#fff;border:1px solid #dbe7ef;border-radius:8px;padding:8px}.module-strip b{display:block;color:#0e4f7e;margin-bottom:4px}.module-strip span{font-size:11px;line-height:1.35;color:#3b4a5a}
</style></head><body>${renderPages()}</body></html>`;

fs.writeFileSync(mdPath, renderMarkdown(), "utf8");
fs.writeFileSync(htmlPath, html, "utf8");
fs.writeFileSync(manifestPath, JSON.stringify({ title: "Java AI 应用开发课程 - 自适应深讲版", generatedAt, version: "v9-adaptive", modules: modules.length, concepts: modules.reduce((s,m)=>s+m.concepts.length,0), strategy: "Adaptive pages by concept complexity. Complex concepts include full process/swimlane diagrams." }, null, 2), "utf8");
(async()=>{const browser=await puppeteer.launch({headless:"new",executablePath:edgePath,args:["--no-sandbox","--disable-setuid-sandbox"]});const page=await browser.newPage();await page.setContent(html,{waitUntil:"networkidle0"});await page.pdf({path:pdfPath,format:"A4",printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:"<div></div>",footerTemplate:`<div style="font-family: Microsoft YaHei, sans-serif; width: 100%; font-size: 10px; color: #667085; padding: 0 13mm; display: flex; justify-content: space-between;"><span>Java AI 应用开发课程 - 自适应深讲版</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,margin:{top:"14mm",right:"13mm",bottom:"16mm",left:"13mm"}});await browser.close();execFileSync(pythonPath,["D:\\\\acme\\\\add_outline_from_pdf.py"],{stdio:"inherit"});console.log(JSON.stringify({pdfPath,htmlPath,mdPath,manifestPath,outlinePath},null,2));})().catch((err)=>{console.error(err);process.exit(1);});
