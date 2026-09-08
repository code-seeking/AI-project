const fs = require("fs");
const path = require("path");
const puppeteer = require("D:\\acme\\pdf-gen\\node_modules\\puppeteer");

const outDir = __dirname;
const generatedAt = "2026-08-07";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const mdPath = path.join(outDir, "Java_AI应用开发课程.md");
const htmlPath = path.join(outDir, "Java_AI应用开发课程.html");
const pdfPath = path.join(outDir, "Java_AI应用开发课程.pdf");
const manifestPath = path.join(outDir, "course-manifest.json");

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function list(items) {
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function bullets(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function codeBlock(lines) {
  return `<pre><code>${escapeHtml(lines.join("\n"))}</code></pre>`;
}

function diagram(steps) {
  return `<div class="diagram">${steps.map((step, index) => `
    <div class="step">
      <span>${index + 1}</span>
      <strong>${escapeHtml(step)}</strong>
    </div>
  `).join("")}</div>`;
}

const modules = [
  {
    week: "第 1 周",
    title: "AI 应用开发认知",
    domain: "architecture",
    output: "学习笔记 + 总体架构图",
    overview: "先建立企业级 AI 应用的正确视角：模型不是系统本身，AI 应用是模型、上下文、知识、工具、流程和治理组合出来的工程系统。",
    concepts: ["LLM 与传统后端的差异", "AI 应用六层架构", "Token 与上下文窗口", "模型能力边界", "幻觉的工程本质", "AI 应用价值判断", "Java 开发者的优势", "从聊天到工作流", "人机协作闭环", "学习路线总图"]
  },
  {
    week: "第 2 周",
    title: "模型 API 与流式聊天",
    domain: "api",
    output: "Spring Boot Chat Demo",
    overview: "把模型调用封装成稳定的后端能力。重点不是会调接口，而是模型路由、SSE、超时、fallback、token 成本和调用审计。",
    concepts: ["Chat Completion 调用链路", "System Prompt 与 User Prompt", "模型参数 temperature/top_p", "SSE 流式输出", "模型路由策略", "超时、重试与 fallback", "Token 成本核算", "Prompt Cache", "OpenAI 兼容接口", "模型调用日志"]
  },
  {
    week: "第 3 周",
    title: "Prompt 与结构化输出",
    domain: "prompt",
    output: "结构化分析接口",
    overview: "把 Prompt 当成接口协议来设计，让模型输出能被 Java 系统稳定消费的 JSON、字段、分类、评分和解释。",
    concepts: ["Prompt 是接口协议", "角色与任务拆分", "上下文选择", "Few-shot 示例", "结构化输出", "JSON 修复策略", "输出字段设计", "Prompt Injection", "Prompt 版本管理", "Prompt 评估集"]
  },
  {
    week: "第 4 周",
    title: "Spring AI 入门",
    domain: "spring",
    output: "Spring AI 聊天服务",
    overview: "理解 Spring AI 的工程抽象：ChatClient、Advisor、PromptTemplate、VectorStore、Tool Callback 如何进入 Spring Boot 分层架构。",
    concepts: ["ChatClient 抽象", "ChatClient.Builder", "Model 抽象", "Advisor 机制", "PromptTemplate", "VectorStore 抽象", "Tool Calling 集成", "自动配置与排除", "AI 测试策略", "与现有项目融合"]
  },
  {
    week: "第 5 周",
    title: "Embedding 与向量库",
    domain: "embedding",
    output: "语义搜索接口",
    overview: "理解语义检索的底层逻辑。向量不是魔法，Embedding 质量、文本构造、索引、元数据和评估决定检索效果。",
    concepts: ["Embedding 本质", "向量维度", "相似度度量", "语义文本构造", "Chunk 策略", "Metadata 设计", "pgvector", "Milvus/Redis Vector", "TopK 与阈值", "语义搜索评估"]
  },
  {
    week: "第 6 周",
    title: "RAG 知识库 v1",
    domain: "rag",
    output: "知识库问答系统",
    overview: "搭建最小可用 RAG：采集、解析、清洗、切分、向量化、检索、上下文组装、引用和资料不足拒答。",
    concepts: ["RAG 第一性原理", "文档采集", "文档解析", "内容清洗", "切分与重叠", "检索器 Retriever", "上下文组装", "引用来源", "资料不足拒答", "增量更新"]
  },
  {
    week: "第 7 周",
    title: "RAG 工程优化",
    domain: "rag",
    output: "知识库 v2",
    overview: "把能用的 RAG 变得更准、更稳、更可解释。优化覆盖 query rewrite、hybrid search、rerank、权限过滤、压缩和评估。",
    concepts: ["Query Rewrite", "混合检索", "Rerank", "Metadata Filter", "Parent-child Chunk", "Context Compression", "Table RAG", "Graph RAG", "RAG 评估集", "线上反馈闭环"]
  },
  {
    week: "第 8 周",
    title: "Tool Calling",
    domain: "tool",
    output: "业务工具助手",
    overview: "让模型调用 Java 业务能力。核心是安全边界：模型可以提出工具调用，应用必须负责参数校验、权限、审计和高风险确认。",
    concepts: ["Tool Calling 本质", "工具 Schema", "参数校验", "只读优先", "工具结果摘要", "工具审计", "MCP Server", "Tool Registry", "工具失败恢复", "Human Confirmation"]
  },
  {
    week: "第 9 周",
    title: "数据库问答助手",
    domain: "sql",
    output: "安全 SQL 助手",
    overview: "学习 NL2SQL。它价值高，风险也高，必须用语义层、只读账号、SQL Guard、脱敏、限流和审计包住。",
    concepts: ["NL2SQL 本质", "语义层", "Schema Linking", "SQL 生成计划", "SQL Guard", "只读账号", "分页和超时", "结果解释", "敏感数据脱敏", "NL2SQL 评估"]
  },
  {
    week: "第 10 周",
    title: "Agent 工作流",
    domain: "agent",
    output: "业务 Agent",
    overview: "Agent 不是更长的 Prompt，而是模型、工具、记忆、状态、规划、终止条件和安全护栏组成的受控执行系统。",
    concepts: ["Agent 本质", "ReAct 模式", "Planning 规划", "Memory 记忆", "State 状态", "ToolNode", "Multi-Agent 协作", "终止条件", "Agent 安全", "企业 Agent 流程"]
  },
  {
    week: "第 11 周",
    title: "工程化与安全治理",
    domain: "governance",
    output: "企业级基础框架",
    overview: "把 AI 应用从能跑变成可上线。重点是网关、权限、审计、成本、评估、观测、安全和灰度回滚。",
    concepts: ["模型网关", "Prompt 管理", "调用审计", "AI 可观测性", "质量评估", "成本治理", "权限与租户", "敏感信息脱敏", "Prompt 注入防护", "灰度与回滚"]
  },
  {
    week: "第 12 周",
    title: "综合设计与架构表达",
    domain: "architecture",
    output: "作品集项目方案",
    overview: "训练架构表达能力。你要能把业务目标拆成 AI 能力、数据流、工具流、风险点、验收指标和阶段路线。",
    concepts: ["从业务价值出发", "数据流设计", "控制流设计", "风险点标注", "验收指标", "分阶段路线", "团队角色", "架构图表达", "汇报方式", "后续实战准备"]
  }
];

const domainText = {
  architecture: {
    label: "AI 应用架构",
    components: ["业务目标", "模型能力", "上下文工程", "私有知识", "业务工具", "治理闭环"],
    flow: ["定义价值", "拆能力边界", "组织数据流", "接入模型/知识/工具", "校验与审计", "反馈改进"],
    modes: ["聊天入口：适合快速验证，但业务价值有限。", "知识增强：用 RAG 接入企业知识，适合制度、文档、规范问答。", "流程增强：把 AI 输出接入审批、工单、招聘、运维等流程，才会形成真实生产力。"],
    code: ["// AI architecture decision flow", "BusinessGoal goal = clarifyBusinessValue(request);", "Capabilities caps = splitIntoModelKnowledgeTools(goal);", "RiskMap risks = identifyRisks(caps);", "AiFlow flow = designDataAndControlFlow(caps, risks);", "Metrics metrics = defineAcceptance(flow);", "return roadmap(flow, metrics);"],
    cases: ["企业知识库平台", "数据问答系统", "招聘/客服/运维助手", "AI 工作流审批助手"],
    pitfalls: ["先选模型再找场景，容易做成炫技 Demo。", "只画组件不画数据流，无法判断敏感数据和权限边界。", "没有失败路径，一旦模型答错就不知道如何兜底。", "没有验收指标，最后只能凭感觉判断效果。"],
    metrics: ["业务节省时间", "回答准确率", "人工采纳率", "失败可解释率", "审计完整率"]
  },
  api: {
    label: "模型 API 工程化",
    components: ["消息结构", "模型参数", "模型网关", "SSE 流式通道", "重试/fallback", "token 与成本日志"],
    flow: ["接收请求", "构造消息", "选择模型", "调用或流式调用", "解析响应", "记录指标"],
    modes: ["同步调用：适合短回答和结构化结果。", "SSE 流式：适合长报告和解释型内容，能降低感知等待。", "异步任务：适合批量分析、长文档处理和可恢复任务。"],
    code: ["// model gateway pattern", "ModelRoute route = router.choose(taskType, quality, cost, latency);", "try {", "  AiResponse res = modelClient.call(messages, route.options(), timeout);", "} catch (ModelException ex) {", "  AiResponse res = fallbackClient.call(compact(messages));", "}", "metrics.record(model, tokens, latency, status);"],
    cases: ["通用聊天接口", "报告生成", "批量文本分析", "低成本模型路由"],
    pitfalls: ["Controller 直接调用模型，后续无法统一治理。", "没有超时和 fallback，模型波动会拖垮业务接口。", "没有 token 统计，成本会在上线后失控。", "流式输出没有取消和异常处理，前端体验会非常不稳定。"],
    metrics: ["P95 延迟", "首 token 时间", "fallback 率", "token 成本", "错误率"]
  },
  prompt: {
    label: "提示词与结构化输出",
    components: ["角色", "任务", "上下文", "约束", "输出 Schema", "服务端校验"],
    flow: ["定义任务", "选择上下文", "编写约束", "定义 JSON", "模型生成", "校验修复"],
    modes: ["零样本 Prompt：适合简单任务，但稳定性有限。", "Few-shot Prompt：用示例约束风格、尺度和边界。", "结构化 Prompt：配合 JSON Schema 和服务端校验，适合进入业务系统。"],
    code: ["// prompt as contract", "PromptTemplate template = promptRegistry.load(name, version);", "String prompt = template.render(input, context, constraints);", "String raw = chatClient.call(prompt);", "JsonNode json = jsonRepair.parse(raw);", "Result result = validator.validate(json);", "return result;"],
    cases: ["简历结构化抽取", "合同风险字段抽取", "客服质检", "舆情分类和摘要"],
    pitfalls: ["把角色、任务、格式、业务规则混在一段大作文里，后续无法维护。", "只约束 JSON 格式，不约束字段含义和业务边界。", "没有 Prompt 版本，线上效果变差无法回滚。", "忽略 Prompt Injection，把用户输入当系统指令执行。"],
    metrics: ["JSON 合法率", "字段完整率", "业务规则命中率", "拒答正确率", "版本对比胜率"]
  },
  spring: {
    label: "Spring AI 工程抽象",
    components: ["ChatClient", "PromptTemplate", "Advisor", "ModelOptions", "VectorStore", "Tool Callback"],
    flow: ["配置模型", "注入 Builder", "构建客户端", "组合 Advisor", "调用模型", "解析结果"],
    modes: ["最小接入：Controller 调 ChatClient，适合 Demo。", "服务层封装：AI Gateway + Application Service，适合业务项目。", "平台化接入：模型、工具、知识库、日志和评估统一治理。"],
    code: ["// Spring AI service boundary", "@Service", "class AiApplicationService {", "  Result handle(Request req) {", "    Prompt prompt = promptFactory.create(req);", "    return chatClient.prompt(prompt)", "      .advisors(auditAdvisor)", "      .call().entity(Result.class);", "  }", "}"],
    cases: ["Spring Boot 聊天服务", "知识库问答后端", "业务工具助手", "统一 AI Gateway"],
    pitfalls: ["把 Spring AI 当万能框架，忽略业务边界。", "Prompt 写在 Controller，无法测试和版本管理。", "Advisor 堆太多，调用链变黑盒。", "没有集成测试，只靠人工看回答。"],
    metrics: ["调用成功率", "结构化解析通过率", "Advisor 命中率", "集成测试覆盖率", "业务接口延迟"]
  },
  embedding: {
    label: "语义向量检索",
    components: ["Embedding Model", "语义文本", "向量空间", "相似度度量", "索引", "元数据过滤"],
    flow: ["构造文本", "生成向量", "写入向量库", "查询向量化", "相似召回", "业务重排"],
    modes: ["语义搜索：根据意义找内容，不依赖关键词完全一致。", "语义匹配：把岗位、候选人、商品、工单等对象构造成画像后匹配。", "向量召回 + 业务重排：先找可能相关，再用规则和模型重排。"],
    code: ["// semantic retrieval pipeline", "String text = semanticTextBuilder.build(businessObject);", "float[] vector = embeddingModel.embed(text);", "vectorStore.upsert(id, vector, metadata);", "float[] queryVector = embeddingModel.embed(userQuery);", "List<Match> matches = vectorStore.search(queryVector, filter, topK);", "return rerankWithBusinessRules(matches);"],
    cases: ["岗位与候选人匹配", "相似工单召回", "商品语义搜索", "知识片段去重"],
    pitfalls: ["混用不同 embedding 模型生成的向量，距离没有意义。", "只存正文不存元数据，后续无法权限过滤和溯源。", "chunk 太大噪声多，太小语义不足。", "直接把相似度当业务评分，容易误导决策。"],
    metrics: ["Recall@K", "MRR", "命中率", "权限过滤正确率", "人工相关性评分"]
  },
  rag: {
    label: "RAG 知识检索增强",
    components: ["Ingestion", "Parser", "Chunk", "Retriever", "Rerank", "Generator"],
    flow: ["采集文档", "解析清洗", "切分入库", "检索召回", "重排压缩", "带引用生成"],
    modes: ["Naive RAG：向量 TopK 后直接生成，简单但容易噪声大。", "Hybrid RAG：关键词、向量和元数据过滤结合，更适合企业知识。", "Advanced RAG：改写、重排、压缩、引用校验和评估闭环一起工作。"],
    code: ["// retrieval augmented generation", "String query = queryRewriter.rewrite(userQuestion);", "List<Chunk> candidates = hybridSearch(query, metadataFilter, 30);", "List<Chunk> topChunks = reranker.rank(query, candidates).take(5);", "String context = contextBuilder.withCitations(topChunks);", "Answer answer = chatClient.call(ragPrompt(userQuestion, context));", "return groundednessChecker.validate(answer, topChunks);"],
    cases: ["制度知识库问答", "产品文档助手", "售后相似案例检索", "研发规范问答"],
    pitfalls: ["整篇文档塞给模型，成本高且干扰大。", "没有引用来源，用户无法判断可信度。", "资料不足还强答，会把幻觉包装成制度。", "没有权限过滤，会造成知识泄露。"],
    metrics: ["召回正确率", "引用正确率", "拒答正确率", "答案 groundedness", "用户采纳率"]
  },
  tool: {
    label: "工具调用",
    components: ["Tool Schema", "参数生成", "权限校验", "业务执行", "结果摘要", "审计日志"],
    flow: ["判断需要工具", "生成参数", "服务端校验", "执行工具", "返回观察结果", "模型总结"],
    modes: ["只读工具：查询事实和状态，风险低。", "建议型工具：AI 生成建议，人确认后执行。", "写操作工具：必须有幂等、审批、审计和回滚。"],
    code: ["// safe tool calling", "ToolCall call = model.decideTool(userIntent, toolSchemas);", "Args args = validator.validate(call.args(), currentUser, tenant);", "ToolResult result = businessService.executeReadOnly(args);", "Observation observation = summarizer.compact(result);", "Answer answer = model.answer(userIntent, observation);", "audit.save(call, args, result);"],
    cases: ["查询订单状态", "查询员工假期余额", "创建工单草稿", "读取知识库并生成摘要"],
    pitfalls: ["暴露大而全 Service，模型不知道如何正确使用。", "让模型直接传 SQL 或执行写库动作，风险极高。", "工具返回结果过大，撑爆上下文。", "没有审计，出问题无法追踪。"],
    metrics: ["工具选择准确率", "参数校验通过率", "工具失败率", "人工确认率", "审计完整率"]
  },
  sql: {
    label: "数据问答",
    components: ["语义层", "Schema Linking", "SQL Plan", "SQL Guard", "只读执行", "结果解释"],
    flow: ["理解问题", "匹配指标", "绑定表字段", "生成 SQL", "安全校验", "解释结果"],
    modes: ["直接 NL2SQL：快但风险高，只适合受限只读场景。", "语义层 NL2SQL：先定义指标和口径，再生成 SQL。", "查询计划 + SQL Guard：先生成计划，再校验 SQL，适合生产。"],
    code: ["// secure NL2SQL", "Intent intent = semanticLayer.parse(userQuestion);", "SqlPlan plan = planner.create(intent, allowedMetrics);", "String sql = generator.generate(plan);", "sqlGuard.assertSelectOnly(sql).assertLimit().assertWhitelist();", "Rows rows = readonlyJdbc.query(sql);", "return resultExplainer.explain(rows, intent);"],
    cases: ["经营指标问答", "招聘漏斗分析", "库存趋势查询", "客服 SLA 报表解释"],
    pitfalls: ["高权限账号执行模型生成 SQL，可能造成灾难。", "没有表字段白名单，模型会猜库结构。", "没有 LIMIT 和超时，可能拖垮数据库。", "敏感字段没有脱敏，容易泄露隐私。"],
    metrics: ["SQL 正确率", "安全拦截率", "查询成功率", "结果解释准确率", "敏感字段泄露率"]
  },
  agent: {
    label: "智能体编排",
    components: ["LLM 大脑", "Tools 工具", "Planning 规划", "Memory 记忆", "State 状态", "Guardrail 护栏"],
    flow: ["接收目标", "规划步骤", "调用工具", "观察结果", "反思修正", "完成或转人工"],
    modes: ["ReAct Agent：思考、行动、观察循环，最常用。", "Workflow Agent：步骤固定成状态机，更适合正式业务。", "Multi-Agent：多个专家协作，能力强但调度和一致性更复杂。"],
    code: ["// controlled agent loop", "while (!state.done() && state.steps() < MAX_STEPS) {", "  Decision decision = llm.plan(state, allowedTools);", "  ToolResult toolResult = toolExecutor.executeIfAllowed(decision);", "  state = reducer.merge(state, decision, toolResult);", "}", "return finalAnswerWithAudit(state);"],
    cases: ["智能客服多轮处理", "运维故障排查助手", "招聘流程推荐与确认", "合同审阅任务分解"],
    pitfalls: ["没有最大步数，Agent 可能无限循环。", "工具权限过大，模型错误规划会造成真实损失。", "没有状态记录，无法回放过程。", "高风险动作自动执行，没有人工确认。"],
    metrics: ["任务完成率", "平均步数", "工具调用准确率", "转人工率", "高风险拦截率"]
  },
  governance: {
    label: "工程治理",
    components: ["模型网关", "Prompt 管理", "权限策略", "审计日志", "质量评估", "成本监控"],
    flow: ["需求分级", "模型路由", "安全校验", "调用记录", "质量评估", "持续优化"],
    modes: ["单应用治理：先把日志、权限、成本和评估做进一个应用。", "统一网关治理：多个系统统一路由、限流、审计。", "组织级治理：模型、Prompt、知识库、工具和评估集全生命周期管理。"],
    code: ["// governance wrapper", "Policy policy = policyEngine.check(user, task, dataScope);", "String requestId = audit.start(user, model, promptVersion);", "AiResponse response = aiGateway.callWithPolicy(policy, request);", "Evaluation evaluation = evaluator.score(response, rules);", "costCenter.record(response.usage());", "audit.finish(requestId, response, evaluation);"],
    cases: ["模型调用审计平台", "Prompt 灰度发布", "AI 成本看板", "敏感数据脱敏网关"],
    pitfalls: ["没有日志，线上问题无法排查。", "没有成本预算，上线后 token 成本失控。", "没有灰度和回滚，新 Prompt 可能让效果突然变差。", "只靠 Prompt 防注入，没有权限和工具层隔离。"],
    metrics: ["审计完整率", "单位任务成本", "质量评分", "安全拦截率", "灰度胜率"]
  }
};

function profile(module, concept) {
  const domain = domainText[module.domain];
  return {
    title: concept,
    domain,
    principle: `${concept} 属于「${domain.label}」能力。它的价值不是让模型说得更像人，而是把语言能力、知识能力或行动能力放进可控制的工程结构中。学习时要拆清输入、输出、组件职责、失败路径和评估指标。`,
    deepReason: `传统 Java 系统依赖确定逻辑：请求进来，代码按规则执行，数据库返回确定结果。AI 系统引入了概率生成，所以 ${concept} 的关键任务，是在不确定能力外面建立确定边界。这个边界通常由服务层、数据层、权限层、校验层、审计层共同完成。`,
    example: `在企业应用中，${concept} 可以迁移到 HR、客服、政务、知识库、数据分析、运维、合同审查、研发效能等场景。是否需要结合 HR，要看这个知识点是否真的服务于 HR 流程，而不是为了套场景而套场景。`
  };
}

function componentDetails(domain, concept) {
  return domain.components.map((item) => {
    if (item.includes("业务目标")) {
      return `${item}：负责回答“为什么要做”。没有业务目标，${concept} 很容易变成模型能力展示，而不是能被验收的业务改进。要把目标落到效率、质量、成本、风险或体验指标上。`;
    }
    if (item.includes("治理闭环")) {
      return `${item}：负责把线上反馈、失败样本、成本数据和质量评估回流到下一轮优化。它决定 ${concept} 是一次性 Demo，还是可以持续进化的系统能力。`;
    }
    if (item.includes("模型") || item.includes("LLM") || item.includes("ChatClient")) {
      return `${item}：负责理解任务和生成候选输出。它不是事实库，也不是权限系统；必须通过上下文、工具、检索和校验来约束。`;
    }
    if (item.includes("Prompt") || item.includes("上下文") || item.includes("消息") || item.includes("角色") || item.includes("任务")) {
      return `${item}：负责告诉模型“看什么、做什么、不能做什么、按什么格式输出”。这里的设计质量直接决定 ${concept} 的稳定性。`;
    }
    if (item.includes("知识") || item.includes("Retriever") || item.includes("Chunk") || item.includes("Parser") || item.includes("Embedding")) {
      return `${item}：负责提供可验证事实。生产环境必须保留来源、版本、权限、时间和召回证据，不能只把文本塞给模型。`;
    }
    if (item.includes("工具") || item.includes("Tool") || item.includes("业务执行")) {
      return `${item}：负责连接外部系统。模型只能请求调用，Java 服务必须做参数校验、权限判断、幂等控制和审计。`;
    }
    if (item.includes("权限") || item.includes("审计") || item.includes("评估") || item.includes("成本") || item.includes("Guard") || item.includes("护栏")) {
      return `${item}：负责生产级安全和可运营。没有它，${concept} 即使 Demo 效果很好，也很难进入真实企业环境。`;
    }
    return `${item}：负责 ${concept} 链路中的一个明确职责。要弄清它的输入、输出、上下游依赖、失败表现和兜底方式。`;
  });
}

function pitfallFix(pitfall, module, concept, index) {
  const domain = module.domain;
  const fixes = {
    architecture: [
      "先写业务价值假设和验收指标，再决定是否需要模型、RAG、工具或 Agent。架构评审时必须能说出不用 AI 的替代方案。",
      "补一张数据流图，标明用户输入、业务数据、检索数据、模型上下文、工具参数和审计日志分别流向哪里。",
      "为每条主链路设计失败分支：模型失败、检索为空、权限不足、成本超限、人工拒绝时分别怎么处理。",
      "把验收指标写进项目方案：准确率、节省时间、采纳率、成本、延迟、安全事件都要可统计。"
    ],
    api: [
      "抽出统一 AiGateway，Controller 只调用业务服务，业务服务再通过网关选择模型、参数和返回形式。",
      "设置连接超时、读取超时、最大重试次数和降级模型，失败时返回可解释错误，而不是让请求一直挂住。",
      "记录 input tokens、output tokens、模型单价、重试次数和调用人，把成本按用户、业务线和模型维度聚合。",
      "SSE 需要支持断线取消、心跳、异常事件、前端重连提示和服务端审计补记。"
    ],
    prompt: [
      "把角色、任务、上下文、约束、输出格式拆成模板字段，并用版本号管理，不要混成不可维护的大段文本。",
      "为每个字段写含义、类型、允许范围和缺失策略，服务端用 JSON Schema 或 Java Validator 二次校验。",
      "Prompt 发布要有灰度、对照样本和回滚开关，不能直接覆盖线上版本。",
      "把用户输入当数据而不是指令，系统提示词、工具权限和输出校验共同防注入。"
    ],
    spring: [
      "框架只解决调用抽象，业务边界仍放在 Application Service 中，避免 Controller 直接堆 AI 逻辑。",
      "Prompt、Advisor、Tool、VectorStore 都要可配置、可测试、可替换，不能写死在接口方法里。",
      "为 Advisor 增加调用链日志，记录它注入了什么上下文、检索了什么内容、修改了什么消息。",
      "测试不要求文本完全一致，而是断言结构、引用、拒答、权限、工具调用和关键业务字段。"
    ],
    embedding: [
      "向量表记录 embedding model、维度、版本和生成时间，不同模型的向量必须分集合或分字段存储。",
      "元数据至少包含来源、租户、权限、版本、时间、业务类型和可追溯 ID，检索时先过滤再召回。",
      "根据文档结构切分，表格、标题、条款、代码块要不同策略；用召回评估集调 chunk 大小。",
      "相似度只作为召回信号，最终排序要结合业务规则、时间、权限、质量分和人工反馈。"
    ],
    rag: [
      "建立文档解析和 chunk 流水线，控制每次进入模型的片段数量、长度和来源，不允许整篇文档无脑进入上下文。",
      "答案必须带来源编号、标题、版本和片段 ID；前端允许用户点回原文验证。",
      "检索分数低、冲突来源多或没有命中时直接拒答，并说明缺少什么资料。",
      "检索前必须带租户、部门、地区、角色、有效期等 metadata filter，不能只靠模型自觉不泄露。"
    ],
    tool: [
      "工具命名和描述要单一明确，大工具拆成多个只读小工具，避免模型把一个万能接口当魔法盒。",
      "禁止模型直接传 SQL、脚本或自由表名；所有工具参数都要用枚举、ID、范围和权限做白名单校验。",
      "工具结果先摘要再给模型，只返回完成回答所需的字段，避免敏感数据和大结果集进入上下文。",
      "每次工具调用记录调用人、参数、权限判定、结果摘要、耗时和风险等级，高风险动作必须人工确认。"
    ],
    sql: [
      "数据库账号只读且限定 schema，SQL Guard 拦截 update、delete、drop、alter、truncate 等危险语句。",
      "维护业务指标字典和表字段白名单，让模型先生成查询计划，再绑定真实表字段。",
      "所有 SQL 自动加 LIMIT、超时、分页和执行计划检查，复杂统计转异步任务。",
      "敏感字段按角色脱敏或禁止返回，结果解释只输出业务结论，不泄露原始隐私明细。"
    ],
    agent: [
      "设置最大步数、最大工具调用次数和最大耗时，超过阈值立即停止并输出当前进展和转人工建议。",
      "工具按风险分级，只读工具可自动执行，写操作、外部通知、金额和审批必须人工确认。",
      "Agent State 要保存用户目标、计划、工具调用、观察结果、中间答案和终止原因，便于回放。",
      "先用固定 Workflow Agent 上线，等单链路稳定后再考虑 ReAct 或 Multi-Agent。"
    ],
    governance: [
      "AI 调用日志记录 requestId、用户、模型、Prompt 版本、知识来源、工具调用、token、耗时和最终结果。",
      "设置团队、业务线、用户和模型维度预算，超预算时降级模型、压缩上下文或转异步。",
      "所有模型、Prompt、RAG 策略发布都走灰度，对照评估集胜出后再扩大流量。",
      "把注入防护放在输入隔离、知识过滤、工具权限、输出校验四层，而不是只靠一句系统提示词。"
    ]
  };
  const selected = fixes[domain] || fixes.architecture;
  return `${pitfall} 处理建议：${selected[index % selected.length]} 对 ${concept} 来说，治理动作必须落到系统机制上，而不是停留在口头规范。`;
}

function renderCover() {
  return `
    <section class="page cover">
      <div class="eyebrow">JAVA AI APPLICATION DEVELOPMENT</div>
      <h1>Java AI 应用开发课程<br/>深度讲义版</h1>
      <p class="subtitle">从第一页重新排版：每周主题后紧跟知识点详解，每个知识点按“核心讲解、组件深挖、模式与示例、生产坑与验收”展开。</p>
      <div class="cover-grid">
        <div><strong>定位</strong>面向 Java 开发者，目标是企业级 AI 应用开发，不是玩具 Demo。</div>
        <div><strong>规模</strong>12 周，120 个知识点，480+ 页讲义级内容。</div>
        <div><strong>风格</strong>参考大课讲解：先讲本质，再拆组件，再给流程和工程骨架。</div>
        <div><strong>重点</strong>减少强行套 HR，更多讲知识点本身，并扩展到多种企业场景。</div>
      </div>
      <p class="meta">生成日期：${generatedAt}<br/>目录：D:\\acme\\AI-Learning\\codex版</p>
    </section>
  `;
}

function renderHowToUse() {
  return `
    <section class="page">
      <div class="page-kicker">学习方法</div>
      <h1>如何使用这份深度讲义</h1>
      <div class="quote big">
        <p>这份课程不追求“概念扫盲”，而是训练你把每个 AI 知识点讲成系统设计。看到任何一个概念，都要问：它为什么存在、由哪些组件组成、数据如何流动、失败如何发生、如何监控和验收。</p>
      </div>
      <h2>推荐学习节奏</h2>
      ${list([
        "每天学习 1 到 2 个知识点，先复述本质，再画流程图，最后说出生产坑。",
        "不要只看代码。先理解输入、输出、边界，再看代码为什么这样组织。",
        "每周结束后，用自己的项目经验举 2 个非 HR 场景，训练知识迁移能力。",
        "后续实战项目统一规划时，再把这些知识点组合成完整系统。"
      ])}
      <h2>学有所成的判断标准</h2>
      ${bullets([
        "能用 3 分钟讲清一个知识点，不依赖背诵原文。",
        "能画出组件协作图和数据流图。",
        "能写出最小工程骨架，而不是只说概念。",
        "能指出至少 5 个生产风险和对应治理手段。",
        "能为功能设计质量、成本、安全和业务指标。"
      ])}
    </section>
  `;
}

function renderModuleIntro(module, index) {
  const domain = domainText[module.domain];
  return `
    <section class="page module-cover">
      <div class="page-kicker">MODULE ${index + 1} · ${module.week}</div>
      <h1>${escapeHtml(module.title)}</h1>
      <div class="quote big">
        <p>${escapeHtml(module.overview)}</p>
      </div>
      <h2>本周学习重点</h2>
      ${list([
        `理解「${module.title}」在企业级 AI 应用中的位置。`,
        "拆清核心组件：谁负责理解，谁负责事实，谁负责执行，谁负责校验和审计。",
        "能把知识点迁移到 HR、客服、政务、运维、数据分析、研发效能等不同场景。",
        "用生产视角思考质量、成本、权限、延迟、失败恢复和持续评估。"
      ])}
      <h2>本周主流程图</h2>
      ${diagram(domain.flow)}
      <h2>本周产出</h2>
      <div class="callout">${escapeHtml(module.output)}。后续每个知识点都会紧跟本周主题展开，不再只给概要表。</div>
    </section>
  `;
}

function renderConceptCore(module, concept, index) {
  const p = profile(module, concept);
  return `
    <section class="page">
      <div class="page-kicker">${module.week} · ${escapeHtml(module.title)} · 知识点 ${index + 1}</div>
      <h1>${escapeHtml(concept)} 核心讲解</h1>
      <div class="quote">
        <p><strong>本质：</strong>${escapeHtml(p.principle)}</p>
        <p><strong>为什么重要：</strong>${escapeHtml(p.deepReason)}</p>
      </div>
      <h2>1. 先把问题讲透</h2>
      <p>${escapeHtml(concept)} 要解决的不是“模型能不能回答”，而是“模型回答如何进入企业系统，并在错误、权限、成本、延迟和审计约束下仍然可用”。这就是 AI 应用开发和普通接口开发最大的不同。</p>
      <p>对 Java 开发者来说，学习重点不是追新名词，而是把这个能力翻译成服务边界、DTO、网关、存储、权限、日志、测试和监控。</p>
      <h2>2. 四个追问</h2>
      ${list([
        `输入是什么：${concept} 需要用户问题、业务对象、文档片段、模型参数、工具结果还是历史状态？`,
        "输出是什么：输出是自然语言、结构化 JSON、检索候选、SQL、工具调用请求还是流程状态？",
        "边界在哪里：哪些事情交给模型，哪些必须由后端规则、权限系统、数据库或人工确认控制？",
        "如何验收：用什么指标判断它真的变好，而不是只是回答更长、更像样？"
      ])}
      <div class="callout">学这个知识点时，不要满足于“我知道它是什么”。你要能讲清它在系统里怎么活、怎么错、怎么被观察、怎么被改进。</div>
    </section>
  `;
}

function renderConceptComponents(module, concept) {
  const domain = domainText[module.domain];
  return `
    <section class="page">
      <div class="page-kicker">${module.week} · ${escapeHtml(module.title)}</div>
      <h1>${escapeHtml(concept)} 组件深挖</h1>
      <h2>1. 核心组件</h2>
      ${list(componentDetails(domain, concept))}
      <h2>2. 组件协作图</h2>
      ${diagram(domain.flow)}
      <h2>3. 拆解时的关键边界</h2>
      ${bullets([
        "模型边界：模型负责理解、生成、规划或总结，但不负责最终权限和真实业务执行。",
        "数据边界：进入模型的数据必须经过筛选、脱敏、权限过滤和上下文压缩。",
        "工程边界：每个组件都要能被测试、记录、替换和降级。",
        "业务边界：最终结果必须能被业务人员验证，而不是只让技术人员觉得炫。"
      ])}
    </section>
  `;
}

function renderConceptPatterns(module, concept) {
  const domain = domainText[module.domain];
  return `
    <section class="page">
      <div class="page-kicker">${module.week} · ${escapeHtml(module.title)}</div>
      <h1>${escapeHtml(concept)} 模式与工程示例</h1>
      <h2>1. 主流模式</h2>
      ${list(domain.modes)}
      <h2>2. 企业级应用场景</h2>
      ${bullets(domain.cases)}
      <div class="quote">
        <p>${escapeHtml(profile(module, concept).example)}</p>
      </div>
      <h2>3. 最小工程骨架</h2>
      ${codeBlock(domain.code)}
    </section>
  `;
}

function renderConceptProduction(module, concept) {
  const domain = domainText[module.domain];
  return `
    <section class="page">
      <div class="page-kicker">${module.week} · ${escapeHtml(module.title)}</div>
      <h1>${escapeHtml(concept)} 生产坑与验收</h1>
      <h2>1. 生产环境常见坑</h2>
      ${list(domain.pitfalls.map((item, index) => pitfallFix(item, module, concept, index)))}
      <h2>2. 推荐验收指标</h2>
      ${bullets(domain.metrics)}
      <h2>3. 学完必须能回答</h2>
      ${bullets([
        `${concept} 的输入、输出、依赖组件和失败表现分别是什么？`,
        `如果把 ${concept} 用到企业系统，哪些能力应该由模型负责，哪些必须由 Java 后端负责？`,
        `如何设计 ${concept} 的日志、评估集、质量指标和成本指标？`,
        `出现错误时，是重试、降级、拒答、转人工，还是回滚 Prompt/模型/知识库？`
      ])}
      <h2>4. 小练习</h2>
      <div class="callout">拿你熟悉的一个业务系统，画出 ${escapeHtml(concept)} 的数据流和控制流，并标出 3 个高风险点、3 个监控指标、1 个降级方案。</div>
    </section>
  `;
}

function renderPages() {
  const pages = [renderCover(), renderHowToUse()];
  modules.forEach((module, moduleIndex) => {
    pages.push(renderModuleIntro(module, moduleIndex));
    module.concepts.forEach((concept, conceptIndex) => {
      pages.push(renderConceptCore(module, concept, conceptIndex));
      pages.push(renderConceptComponents(module, concept));
      pages.push(renderConceptPatterns(module, concept));
      pages.push(renderConceptProduction(module, concept));
    });
  });
  pages.push(`
    <section class="page">
      <div class="page-kicker">参考资料</div>
      <h1>后续深度学习资料</h1>
      ${bullets([
        "Spring AI Reference: https://docs.spring.io/spring-ai/reference/",
        "Spring AI Examples: https://github.com/spring-projects/spring-ai-examples",
        "Spring AI Alibaba: https://github.com/alibaba/spring-ai-alibaba",
        "LangChain4j Documentation: https://docs.langchain4j.dev/",
        "LangChain4j Examples: https://github.com/langchain4j/langchain4j-examples",
        "MCP Java SDK: https://github.com/modelcontextprotocol/java-sdk",
        "OpenAI Java SDK: https://github.com/openai/openai-java",
        "OpenSquilla: https://github.com/opensquilla/opensquilla",
        "Dify: https://github.com/langgenius/dify",
        "RAGFlow: https://github.com/infiniflow/ragflow"
      ])}
    </section>
  `);
  return pages.join("\n");
}

function renderMarkdown() {
  const lines = [
    "# Java AI 应用开发课程 - 深度讲义版",
    "",
    `生成日期：${generatedAt}`,
    "",
    "本版从第一页开始重新排版，每周主题后紧跟知识点详细讲解。每个知识点包含核心讲解、组件深挖、模式与工程示例、生产坑与验收。",
    ""
  ];
  modules.forEach((module) => {
    lines.push(`## ${module.week}：${module.title}`, "", module.overview, "");
    module.concepts.forEach((concept, index) => {
      const domain = domainText[module.domain];
      lines.push(`### 知识点 ${index + 1}：${concept}`);
      lines.push(`- 核心定位：${profile(module, concept).principle}`);
      lines.push(`- 核心组件：${domain.components.join("、")}`);
      lines.push(`- 主流程：${domain.flow.join(" -> ")}`);
      lines.push(`- 生产坑：${domain.pitfalls.join("；")}`);
      lines.push(`- 验收指标：${domain.metrics.join("、")}`);
      lines.push("");
    });
  });
  return lines.join("\n");
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Java AI 应用开发课程 - 深度讲义版</title>
  <style>
    @page { size: A4; margin: 14mm 13mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif;
      color: #111827;
      font-size: 14.8px;
      line-height: 1.78;
      background: white;
    }
    .page {
      min-height: 267mm;
      page-break-after: always;
      padding: 4mm 3mm 2mm;
      position: relative;
    }
    .cover {
      padding: 26mm 14mm;
      background: linear-gradient(135deg, #f8fbfd, #f4faf7);
      border: 1px solid #dce8ef;
      border-radius: 10px;
    }
    .eyebrow, .page-kicker {
      color: #0d8061;
      font-size: 12px;
      letter-spacing: 1.1px;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 7px;
    }
    h1 {
      font-size: 30px;
      line-height: 1.25;
      color: #102f50;
      margin: 0 0 14px;
      font-weight: 900;
    }
    h2 {
      font-size: 18px;
      color: #111827;
      margin: 15px 0 7px;
      font-weight: 900;
    }
    p { margin: 6px 0; }
    .subtitle { font-size: 18px; color: #344960; max-width: 90%; }
    .meta { margin-top: 32mm; color: #536779; }
    .cover-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 22mm;
    }
    .cover-grid div {
      background: white;
      border: 1px solid #d8e7ef;
      border-radius: 10px;
      padding: 13px;
      min-height: 84px;
    }
    .cover-grid strong { display: block; color: #0e4f7e; margin-bottom: 4px; }
    .quote {
      border-left: 5px solid #b9bec7;
      padding: 8px 0 8px 15px;
      margin: 8px 0 14px;
      background: #fbfbfc;
    }
    .quote.big { font-size: 15.8px; }
    ol, ul { margin: 7px 0 11px 24px; padding: 0; }
    li { margin: 4px 0; }
    .callout {
      border-left: 5px solid #f59e0b;
      background: #fff8e8;
      padding: 10px 12px;
      margin-top: 10px;
      border-radius: 7px;
      font-weight: 700;
    }
    .diagram {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
      align-items: stretch;
      margin: 10px 0 12px;
      page-break-inside: avoid;
    }
    .step {
      border: 1px solid #cbdde8;
      background: #f8fbfd;
      border-radius: 8px;
      padding: 8px 5px;
      text-align: center;
      min-height: 64px;
    }
    .step span {
      display: inline-flex;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #0d8061;
      color: white;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 4px;
    }
    .step strong { display: block; color: #0e4f7e; font-size: 12.8px; line-height: 1.35; }
    pre {
      background: #f7f7f8;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12.4px;
      line-height: 1.5;
      overflow: hidden;
      white-space: pre-wrap;
      color: #111827;
    }
    .module-cover h1 { font-size: 34px; }
  </style>
</head>
<body>
  ${renderPages()}
</body>
</html>`;

fs.writeFileSync(mdPath, renderMarkdown(), "utf8");
fs.writeFileSync(htmlPath, html, "utf8");
fs.writeFileSync(manifestPath, JSON.stringify({
  title: "Java AI 应用开发课程 - 深度讲义版",
  generatedAt,
  version: "v8-deepdive",
  targetDirectory: "D:\\acme\\AI-Learning\\codex版",
  pageDesign: "Large-font lecture notes. Each concept has four pages: core explanation, component deep dive, patterns and engineering example, production pitfalls and acceptance.",
  modules: modules.length,
  concepts: modules.reduce((sum, module) => sum + module.concepts.length, 0)
}, null, 2), "utf8");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: edgePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="font-family: Microsoft YaHei, sans-serif; width: 100%; font-size: 10px; color: #667085; padding: 0 13mm; display: flex; justify-content: space-between;"><span>Java AI 应用开发课程 - 深度讲义版</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "14mm", right: "13mm", bottom: "16mm", left: "13mm" }
  });
  await browser.close();
  console.log(JSON.stringify({ pdfPath, htmlPath, mdPath, manifestPath }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
