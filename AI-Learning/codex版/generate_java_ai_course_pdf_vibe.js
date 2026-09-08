const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const puppeteer = require("D:\\acme\\pdf-gen\\node_modules\\puppeteer");

const outDir = __dirname;
const generatedAt = "2026-08-09";
const sourcePath = path.join(outDir, "generate_java_ai_course_pdf_adaptive.js");
const pdfPath = path.join(outDir, "Java_AI应用开发课程_vibe讲义版.pdf");
const htmlPath = path.join(outDir, "Java_AI应用开发课程_vibe讲义版.html");
const mdPath = path.join(outDir, "Java_AI应用开发课程_vibe讲义版.md");
const outlinePath = path.join(outDir, "vibe-course-outline.json");
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const pythonPath = "C:\\Users\\ci25531\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

function escapeHtml(input) {
  return String(input).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function li(items) { return items.map((x) => `<li>${escapeHtml(x)}</li>`).join(""); }
function code(lines) { return `<pre><code>${escapeHtml(lines.join("\n"))}</code></pre>`; }
function concept(name, level, essence, detail = {}) { return { name, level, essence, ...detail }; }

function loadCourseData() {
  const src = fs.readFileSync(sourcePath, "utf8");
  const domainsMatch = src.match(/const domains = ([\s\S]*?);\n\nconst modules = /);
  const modulesMatch = src.match(/const modules = ([\s\S]*?);\n\nfunction classifyPlan/);
  if (!domainsMatch || !modulesMatch) throw new Error("Cannot parse course data from adaptive generator.");
  const sandbox = { concept, domains: null, modules: null };
  vm.createContext(sandbox);
  vm.runInContext(`domains = ${domainsMatch[1]}; modules = ${modulesMatch[1]};`, sandbox);
  return { domains: sandbox.domains, modules: sandbox.modules };
}

const { domains, modules } = loadCourseData();

const profiles = {
  architecture: {
    label: "不是模型问题，是系统边界问题",
    story: "团队第一次做 AI 功能时，最容易冲进模型选型、Prompt 调参、页面 Demo。跑通以后才发现真正难的是：谁给事实、谁管权限、谁确认结果、错了谁兜底。AI 应用不是一个模型接口，而是一条业务链路。",
    decision: "把“会调用模型”改成“能稳定交付一个业务结果”。模型只是一段能力，工程系统才负责确定性。",
    pain: [
      ["只画模型调用", "架构图里只有前端、后端、模型，缺少知识、工具、权限、审计、评估。", "补数据流和控制流，标出每个组件的输入、输出和兜底方。"],
      ["目标不清", "上线后很难判断到底节省了什么，质量提升在哪里。", "先写业务价值假设和验收指标，再做技术方案。"],
      ["失败路径缺失", "资料不足也回答，工具失败也继续编，用户不满意也没有回路。", "为拒答、降级、转人工、重新检索设计分支。"]
    ],
    sketch: ["业务目标", "上下文", "知识/工具", "模型生成", "服务端校验", "审计反馈"],
    code: ["Goal goal = clarify(request);", "AiBoundary boundary = splitModelKnowledgeTools(goal);", "Context ctx = contextBuilder.build(request, boundary);", "AiResult draft = model.generate(ctx);", "CheckedResult result = verifier.check(draft, policy);", "audit.record(request, ctx, result);"]
  },
  api: {
    label: "不是 HTTP 问题，是稳定性入口问题",
    story: "最早大家会在 Controller 里直接写模型 SDK。第一个 Demo 很快，第二个模型、第三个业务线、第四个降级策略一来，代码就开始散。模型 API 工程化，就是把外部不稳定能力包成内部稳定能力。",
    decision: "先有 AI Gateway，再有具体模型调用。业务层只关心任务类型、成本等级、质量等级和返回契约。",
    pain: [
      ["接口散落", "每个业务方法都拼 messages、配参数、处理异常。", "统一 ModelClient/AiGateway，集中路由、降级、审计。"],
      ["流式不可控", "用户关闭页面后后台还在生成，异常事件也没记录。", "SSE 增加 cancel、heartbeat、error event 和审计补记。"],
      ["成本黑盒", "看不到 input/output token、重试次数、fallback 率。", "把 token、模型、耗时、状态码写入调用日志。"]
    ],
    sketch: ["HTTP 请求", "鉴权限流", "组装消息", "模型路由", "SSE/普通响应", "成本日志"],
    code: ["AiRequest req = requestFactory.from(httpRequest);", "Route route = router.choose(req.taskType(), req.quality());", "AiResponse res = aiGateway.call(req, route);", "metrics.record(route.model(), res.tokens(), res.latency());", "return responseMapper.toHttp(res);"]
  },
  prompt: {
    label: "不是写作文，是设计接口协议",
    story: "Prompt 写得越长，团队越觉得安全。但真正出问题时，没人知道哪句话导致行为变化、哪个字段该修、哪个版本该回滚。把 Prompt 当接口协议，才有工程治理的可能。",
    decision: "Prompt 要拆成角色、任务、上下文、约束、输出格式、失败策略，并像接口一样版本化和评估。",
    pain: [
      ["提示词大作文", "角色、任务、规则、示例全混在一起，改一处影响全局。", "拆模板字段，给每个字段明确责任。"],
      ["结构化输出漂", "JSON 不稳定、字段缺失、业务含义不清。", "用 JSON Schema/Java record 做输出契约和校验修复。"],
      ["注入风险", "用户把恶意指令伪装成资料，让模型忽略规则。", "输入隔离、工具权限、输出校验三层一起防。"]
    ],
    sketch: ["任务定义", "上下文选择", "约束条件", "Schema 输出", "服务端校验", "评估回归"],
    code: ["PromptTemplate tpl = registry.load(\"risk-analysis\", version);", "String prompt = tpl.render(input, context, constraints);", "JsonNode raw = model.call(prompt).json();", "RiskResult result = validator.validate(raw, RiskResult.class);", "evalSet.record(promptVersion, result);"]
  },
  spring: {
    label: "不是框架魔法，是工程抽象落位",
    story: "Spring AI 能让调用变简单，但它不会自动帮你做权限、引用、评估和降级。框架真正的价值，是让 ChatClient、Advisor、VectorStore、Tool Callback 这些能力放到 Spring 分层里。",
    decision: "把 AI 能力当成应用服务的一部分，而不是 Controller 里的一个模型调用片段。",
    pain: [
      ["Controller 过胖", "HTTP 层拼 Prompt、查知识库、调模型、解析结果。", "按 Controller -> Application Service -> AI Adapter 分层。"],
      ["Advisor 黑盒", "不知道注入了什么上下文，也不知道检索命中了哪些片段。", "Advisor 链路记录上下文、来源、耗时和命中。"],
      ["测试缺失", "只测接口 200，不测结构化字段、拒答和权限过滤。", "建立 AI 集成测试和固定评估样本。"]
    ],
    sketch: ["Controller", "Application Service", "ChatClient", "Advisor 链", "VectorStore/Tool", "测试评估"],
    code: ["@Service", "class AiApplicationService {", "  Answer ask(Question q) {", "    return chatClient.prompt(promptFactory.create(q))", "      .advisors(ragAdvisor, auditAdvisor)", "      .call().entity(Answer.class);", "  }", "}"]
  },
  embedding: {
    label: "不是相似度游戏，是语义召回工程",
    story: "很多团队第一次做向量检索，都会把正文一切、向量一存、TopK 一查，然后觉得 RAG 完成了。真正上线后才发现，搜到的相似片段可能过期、无权限、不权威，甚至根本不能回答问题。",
    decision: "Embedding 只负责召回候选，生产质量来自文本构造、元数据、过滤、重排和评估。",
    pain: [
      ["向量混用", "不同模型生成的向量混在一个集合里。", "按 embedding model/version 隔离集合。"],
      ["元数据缺失", "无法按租户、权限、来源、版本过滤。", "元数据设计先于入库，至少保留 source、tenant、acl、version。"],
      ["TopK 迷信", "调大 TopK 以为更准，实际噪声更多。", "用 Recall@K、MRR、人工相关性评分校准。"]
    ],
    sketch: ["语义文本", "Embedding", "向量库", "Metadata Filter", "TopK 召回", "Rerank/评估"],
    code: ["String text = semanticTextBuilder.build(doc);", "float[] vector = embeddingModel.embed(text);", "vectorStore.upsert(doc.id(), vector, metadata);", "List<Match> hits = vectorStore.search(queryVector, filter, topK);", "List<Match> ranked = reranker.rank(query, hits);"]
  },
  rag: {
    label: "不是向量库加模型，是证据流水线",
    story: "RAG 的坑通常不在回答那一刻，而在更早的资料治理：文档解析错了、chunk 切断了、权限没带上、来源不可追溯。最后模型只是把这些问题用流畅中文暴露出来。",
    decision: "把 RAG 当成“证据生产线”：离线生产可信片段，在线选择证据，生成时必须带引用和拒答条件。",
    pain: [
      ["chunk 粗糙", "整页、整章、固定字数切分，标题和表格语义丢失。", "按标题层级、段落、表格、条款分别切。"],
      ["无引用", "答案看起来正确，但无法点回原文验证。", "回答对象必须携带 sourceId、chunkId、version。"],
      ["资料不足强答", "没检索到证据时仍然生成。", "低置信度、冲突证据、无命中时拒答并说明缺什么。"]
    ],
    sketch: ["采集解析", "清洗切分", "向量入库", "检索召回", "重排压缩", "带引用回答"],
    code: ["String rewritten = queryRewriter.rewrite(question);", "List<Chunk> candidates = retriever.search(rewritten, aclFilter);", "List<Chunk> evidence = reranker.rank(question, candidates).take(5);", "Answer answer = generator.answer(question, cite(evidence));", "groundedness.check(answer, evidence);"]
  },
  tool: {
    label: "不是模型有手脚，是系统给它受控能力",
    story: "Tool Calling 让模型看起来能查库、调接口、读文件，但真正的执行权不能交给模型。模型只提出意图，应用系统必须做参数、权限、风险、审计和人工确认。",
    decision: "工具越小、越只读、越单职责，越适合交给模型调用；写操作和高风险动作必须进入人工确认。",
    pain: [
      ["工具过大", "把内部 Service 整个暴露给模型。", "拆成单职责小工具，并限制参数范围。"],
      ["参数直信", "模型生成 SQL、ID、金额、状态后直接执行。", "Java 后端校验枚举、权限、租户、幂等和风险。"],
      ["MCP 误解", "以为 MCP 只是另一种工具调用写法。", "理解 Host/Client/Server，让工具一次实现多处复用。"]
    ],
    sketch: ["用户任务", "工具选择", "参数生成", "服务端校验", "工具执行", "观察结果"],
    code: ["ToolCall call = model.decideTool(intent, toolSchemas);", "Args args = argValidator.validate(call.args(), user);", "PolicyDecision pd = policy.check(user, call.tool(), args);", "ToolResult result = executor.executeReadOnly(pd, args);", "audit.save(call, args.digest(), result.summary());"]
  },
  sql: {
    label: "不是自然语言转 SQL，是安全数据问答",
    story: "NL2SQL 的演示很容易惊艳：一句话生成 SQL。上线时真正吓人：模型猜表、猜字段、越权查敏感数据、没 LIMIT 跑满数据库。数据库问答必须先建语义层和安全层。",
    decision: "自然语言先转业务指标和查询计划，再由白名单 schema 渲染 SQL，最后通过 SQL Guard 执行。",
    pain: [
      ["自由猜表", "模型凭字段名语感拼 SQL。", "用指标字典、表字段白名单、Schema Linking 约束。"],
      ["高权限执行", "模型生成什么就执行什么。", "只读账号、限定 schema、禁止危险关键字。"],
      ["结果泄露", "把明细、手机号、身份证等敏感字段返回。", "字段策略、角色脱敏、聚合优先。"]
    ],
    sketch: ["理解问题", "指标映射", "Schema Linking", "SQL Plan", "SQL Guard", "结果解释"],
    code: ["Intent intent = semanticLayer.parse(question);", "SqlPlan plan = planner.plan(intent, metricDict);", "String sql = renderer.render(plan, tableWhitelist);", "sqlGuard.assertSafe(sql).assertLimit().assertReadOnly();", "ResultSet rows = readOnlyJdbc.query(sql);"]
  },
  agent: {
    label: "不是万能机器人，是受控运行时",
    story: "Agent 最迷人的地方是它会自己拆任务、调工具、继续思考；最危险的地方也是这里。没有最大步数、状态回放、工具分级和人工确认，Agent 会把小问题跑成大事故。",
    decision: "先做固定 Workflow Agent，再做 ReAct；先把状态、工具、终止条件跑稳，再谈 Multi-Agent。",
    pain: [
      ["无限循环", "模型不断反思、不断调用工具。", "设置 maxSteps、maxToolCalls、timeout、终止条件。"],
      ["状态不可回放", "出了问题不知道为什么调用某工具。", "State 记录目标、计划、工具结果、中间答案、终止原因。"],
      ["权限过大", "Agent 自动执行高风险动作。", "工具分级，高风险必须 Human Confirmation。"]
    ],
    sketch: ["目标输入", "状态构建", "规划", "Skill/Tool", "观察", "终止/转人工"],
    code: ["while (!state.done() && state.steps() < MAX_STEPS) {", "  Decision d = llm.plan(state, allowedTools);", "  Observation o = toolNode.executeIfAllowed(d, policy);", "  state = reducer.merge(state, d, o);", "}", "return finalizer.answer(state);"]
  },
  governance: {
    label: "不是上线后补规范，是从第一天内置护栏",
    story: "AI 系统刚上线时，大家关心准确率；真正跑起来后，成本、权限、审计、灰度、回滚、注入防护都会变成生产问题。治理不是文档，是运行时机制。",
    decision: "模型、Prompt、RAG、工具、Agent 都要有版本、日志、评估、预算和回滚。",
    pain: [
      ["日志缺失", "只知道用户说答错了，不知道用的哪个模型和哪些证据。", "记录 requestId、promptVersion、model、chunks、tools、tokens。"],
      ["成本失控", "长上下文、重试、流式、批量任务堆在一起。", "按用户、团队、业务线、模型设置预算和限流。"],
      ["只靠 Prompt 防注入", "用户绕过规则或诱导工具调用。", "输入隔离、知识过滤、工具权限、输出校验四层防护。"]
    ],
    sketch: ["模型网关", "Prompt 版本", "权限策略", "审计日志", "评估集", "灰度回滚"],
    code: ["Policy policy = policyEngine.check(user, task, dataScope);", "AuditTrace trace = audit.start(request, promptVersion);", "AiResponse res = aiGateway.callWithPolicy(policy, request);", "Evaluation eval = evaluator.score(res, rules);", "release.decide(eval, budget, risk);"]
  }
};

function profile(domain) {
  return profiles[domain] || profiles.architecture;
}

function sketch(title, steps) {
  return `<div class="sketch"><div class="sketch-title">${escapeHtml(title)}</div><div class="sketch-row">${steps.map((s, i) => `<div class="sketch-note"><span>${i + 1}</span><b>${escapeHtml(s)}</b></div>`).join("<i></i>")}</div><div class="sketch-foot">看图时按两条线读：一条是业务请求如何变成结果，另一条是权限、审计、评估如何贯穿全程。</div></div>`;
}

function table(rows) {
  return `<table><thead><tr><th>真实卡点</th><th>长什么样</th><th>工程抓手</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${escapeHtml(r[0])}</b></td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td></tr>`).join("")}</tbody></table>`;
}

function conceptLanding(module, conceptItem, index) {
  const actions = {
    architecture: ["画出数据流和控制流，标出模型、知识、工具、权限、审计各自负责什么。", "先写验收指标，再决定模型/RAG/Tool/Agent 的组合。", "为拒答、降级、转人工和反馈设计明确分支。"],
    api: ["统一走 AiGateway，不让业务 Controller 直接拼模型请求。", "记录模型、token、耗时、重试、fallback 和错误码，形成调用账本。", "普通调用和 SSE 流式调用都要有超时、取消和异常事件。"],
    prompt: ["把 Prompt 拆成角色、任务、上下文、约束、输出 Schema 和失败策略。", "结构化输出必须经过 JSON Schema 或 Java record 校验。", "建立评估样本，Prompt 改动必须能对比和回滚。"],
    spring: ["把 ChatClient、Advisor、VectorStore、Tool Callback 放进 Spring 分层。", "Advisor 要能记录注入的上下文、命中的知识和耗时。", "AI 集成测试要覆盖结构化解析、拒答、权限过滤和工具调用。"],
    embedding: ["向量集合按 embedding model/version 隔离，不混用。", "元数据必须包含来源、权限、租户、版本和可追溯 ID。", "用 Recall@K、MRR、人工相关性评分调 TopK 和阈值。"],
    rag: ["离线链路先保证文档解析、chunk、元数据和版本正确。", "在线链路要做检索、过滤、重排、压缩和带引用生成。", "无证据、低置信或冲突证据时拒答，并说明缺什么资料。"],
    tool: ["工具要小、只读、单职责，参数用 schema 和枚举约束。", "模型只生成工具调用意图，Java 后端负责权限、校验和执行。", "高风险写操作必须人工确认，所有工具调用都要审计。"],
    sql: ["先识别业务指标和查询计划，再生成 SQL。", "Schema Linking 只允许绑定白名单表字段。", "SQL Guard 要检查只读、LIMIT、超时、敏感字段和危险关键字。"],
    agent: ["先做 Workflow Agent，再逐步引入 ReAct 和 Multi-Agent。", "State 要记录目标、计划、工具结果、中间答案和终止原因。", "必须设置 maxSteps、maxToolCalls、timeout 和 Human Confirmation。"],
    governance: ["所有模型、Prompt、RAG 策略和工具 schema 都要版本化。", "调用日志要覆盖 requestId、用户、模型、Prompt、知识、工具、token 和结果。", "质量、成本、安全、灰度和回滚要进入发布流程。"]
  };
  const selected = actions[module.domain] || actions.architecture;
  return selected[index % selected.length];
}

function conceptTable(module) {
  const rows = module.concepts.map((c, index) => `<tr><td><b>${escapeHtml(c.name)}</b><br/><span>${escapeHtml(c.level)}</span></td><td>${escapeHtml(c.essence)}</td><td>${escapeHtml(conceptLanding(module, c, index))}</td></tr>`).join("");
  return `<table class="concept-table"><thead><tr><th>知识点</th><th>先别背定义，先看它解决什么</th><th>这一章的落地判断</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function page(cls, body) {
  return `<section class="page ${cls || ""}">${body}</section>`;
}

function renderCover() {
  return page("cover", `<div class="doc-type">JAVA AI APPLICATION DEVELOPMENT</div><h1>Java AI 应用开发课程<br/>Vibe 讲义版</h1><p class="subtitle">参考《从 Vibe Coding 到 Harness》的长文实战复盘模式：少讲空泛概念，多讲真实卡点、判断标准、工程抓手和可复盘流程。</p><div class="hero-card"><b>读这版的方式</b><span>先看故事里的问题，再看表格里的判断，最后把流程图和代码骨架画到自己的项目里。</span></div><p class="meta">生成日期：${generatedAt}<br/>输出目录：D:\\acme\\AI-Learning\\codex版</p>`);
}

function renderIntro() {
  return page("", `<h1>写在前面：这不是另一份名词表</h1><blockquote>AI 应用开发最容易误判的一点是：以为难点都在模型。真正落地以后你会发现，难的是协作、流程、信任、权限、验证、回滚和持续优化。</blockquote><p>这一版不追求把每个概念平均展开，而是按工程复盘的方式讲：先说一个具体问题，再把背后的知识点拆出来，最后给出 Java 开发者能落地的结构。</p><ul>${li(["如果你正在从 Java 后端转 AI 应用开发，先抓住系统边界，不要先追 Agent。", "如果你已经会调模型，下一步要学会把模型调用变成可观察、可评估、可回滚的业务能力。", "如果你要做企业级应用，请始终问自己：事实从哪来，权限谁判断，失败怎么停，结果谁验证。"])}</ul><div class="greybox"><b>一句话：</b>AI 工程化不是把模型接进系统，而是把不确定能力关进确定流程里。</div>`);
}

function renderModuleOpening(module, index) {
  const p = profile(module.domain);
  return page("", `<div class="chapter">第 ${index + 1} 章</div><h1>${escapeHtml(module.title)}</h1><p class="lead">${escapeHtml(module.overview)}</p>${sketch(`${module.title} - 一张图先建立直觉`, p.sketch)}<h2>这一章先给结论</h2><blockquote>${escapeHtml(p.label)}。${escapeHtml(p.decision)}</blockquote>`);
}

function renderStory(module) {
  const p = profile(module.domain);
  return page("", `<h1>${escapeHtml(module.title)}：先讲一个真实卡点</h1><p>${escapeHtml(p.story)}</p><div class="greybox">${escapeHtml(p.decision)}</div><h2>问题不长这样，别急着写代码</h2>${table(p.pain)}<p class="after">注意，这些问题没有一个是“模型太笨”能解释完的。它们通常是系统边界、数据治理、协作流程和验证手段的问题。</p>`);
}

function renderConcepts(module) {
  return page("wide", `<h1>${escapeHtml(module.title)}：知识点地图</h1><p>这一页不是目录，而是本章的“问题索引”。每个知识点都要能回答：它解决什么问题，输入输出是什么，边界在哪里，失败时怎么处理。</p>${conceptTable(module)}<div class="greybox"><b>读法：</b>不要孤立背概念。把每一行都放回本章流程图里，看它到底卡在哪个环节。</div>`);
}

function renderProcess(module) {
  const p = profile(module.domain);
  return page("wide", `<h1>${escapeHtml(module.title)}：流程拆解图</h1><p>复杂知识点要像工程流程一样拆：谁发起，谁理解，谁补事实，谁调用工具，谁执行，谁校验，谁反馈。</p>${sketch(`${module.title} 运行链路`, p.sketch)}<div class="flow-notes"><div><b>主流程</b><span>业务请求到结果返回，必须能复盘每一步。</span></div><div><b>补充流</b><span>知识、数据、工具、历史状态只在需要时进入上下文。</span></div><div><b>治理流</b><span>权限、审计、成本、评估贯穿全链路。</span></div></div>`);
}

function renderJava(module) {
  const p = profile(module.domain);
  return page("", `<h1>${escapeHtml(module.title)}：Java 落地骨架</h1><p>下面的代码不是让你照抄，而是让你抓住工程边界：模型在哪，校验在哪，审计在哪，失败怎么停。</p>${code(p.code)}<h2>落地判断标准</h2><ul>${li(["业务入口不要直接调用模型，先抽应用服务或 AI Gateway。", "模型输出只能作为候选结果，最终进入业务系统前必须经过校验。", "日志要能回放：用户输入、上下文、模型、知识来源、工具调用、token、耗时和结果。", "所有高风险动作都要有人类确认或明确策略。"])}</ul><blockquote>让生产问题的人，同时生产验证手段。否则“开发完成”只是把风险从代码里转移到了用户那里。</blockquote>`);
}

function renderChecklist(module) {
  const p = profile(module.domain);
  return page("", `<h1>${escapeHtml(module.title)}：学完要能自查</h1><h2>必须能回答</h2><ul>${li(["这个模块的输入、输出、上下游依赖分别是什么？", "哪些事由模型负责，哪些事必须由 Java 系统负责？", "如果资料不足、权限不足、工具失败、成本超限，系统怎么停下来？", "怎么设计评估样本，证明这次改动真的变好？"])}</ul><h2>本章小结</h2><div class="greybox"><b>${escapeHtml(p.label)}：</b>${escapeHtml(p.decision)}</div><h2>带走一个动作</h2><p>把你现在项目里的一个 AI 功能画成六步链路：${p.sketch.map(escapeHtml).join(" -> ")}。如果画不出来，说明这个功能现在还不是一个可治理的工程能力。</p>`);
}

function renderReferences() {
  return page("", `<h1>参考资料与继续深挖</h1><ul>${li(["Spring AI Reference: https://docs.spring.io/spring-ai/reference/", "Spring AI Examples: https://github.com/spring-projects/spring-ai-examples", "Model Context Protocol: https://modelcontextprotocol.io/", "MCP Java SDK: https://github.com/modelcontextprotocol/java-sdk", "Microsoft Advanced RAG: https://learn.microsoft.com/en-us/azure/developer/ai/advanced-retrieval-augmented-generation", "OpenAI Java SDK: https://github.com/openai/openai-java", "LangChain4j Documentation: https://docs.langchain4j.dev/", "Dify: https://github.com/langgenius/dify", "RAGFlow: https://github.com/infiniflow/ragflow"])}</ul><blockquote>资料不是为了收藏。每读一个项目或文档，都要问：它解决哪个真实卡点？它的边界是什么？它怎么验证自己是对的？</blockquote>`);
}

function buildPages() {
  const pages = [renderCover(), renderIntro()];
  modules.forEach((module, index) => {
    pages.push(renderModuleOpening(module, index));
    pages.push(renderStory(module));
    pages.push(renderConcepts(module));
    pages.push(renderProcess(module));
    pages.push(renderJava(module));
    pages.push(renderChecklist(module));
  });
  pages.push(renderReferences());
  return pages;
}

function buildOutline() {
  let pageNo = 1;
  const outline = [
    { title: "封面 - Java AI 应用开发课程 Vibe 讲义版", page: pageNo++ },
    { title: "写在前面：这不是另一份名词表", page: pageNo++ }
  ];
  modules.forEach((module, index) => {
    const item = { title: `第 ${index + 1} 章 ${module.title}`, page: pageNo, children: [] };
    item.children.push({ title: `${module.title} - 一张图先建立直觉`, page: pageNo++ });
    item.children.push({ title: `${module.title} - 真实卡点`, page: pageNo++ });
    item.children.push({ title: `${module.title} - 知识点地图`, page: pageNo++ });
    item.children.push({ title: `${module.title} - 流程拆解图`, page: pageNo++ });
    item.children.push({ title: `${module.title} - Java 落地骨架`, page: pageNo++ });
    item.children.push({ title: `${module.title} - 学完自查`, page: pageNo++ });
    outline.push(item);
  });
  outline.push({ title: "参考资料与继续深挖", page: pageNo });
  return outline;
}

function renderMarkdown() {
  const lines = ["# Java AI 应用开发课程 - Vibe 讲义版", "", `生成日期：${generatedAt}`, ""];
  modules.forEach((module, index) => {
    const p = profile(module.domain);
    lines.push(`## 第 ${index + 1} 章：${module.title}`, "", p.story, "", `核心判断：${p.decision}`, "");
    module.concepts.forEach((c) => lines.push(`- ${c.name}：${c.essence}`));
    lines.push("");
  });
  return lines.join("\n");
}

const pages = buildPages();
const outline = buildOutline();
const css = `
@page{size:A4;margin:18mm 20mm 18mm} @page widePage{size:A4 landscape;margin:14mm 12mm 14mm}
*{box-sizing:border-box} body{margin:0;background:#fff;color:#2b3440;font-family:"Microsoft YaHei","Noto Sans CJK SC",sans-serif;font-size:15.2px;line-height:1.9}
.page{page-break-after:always;min-height:255mm}.wide{page:widePage;min-height:178mm}.cover{padding-top:10mm}.doc-type{color:#8a97a8;font-size:13px;font-weight:700;letter-spacing:1px}.chapter{color:#1677d2;border-left:5px solid #1677d2;padding-left:10px;font-weight:900;margin-bottom:8px}
h1{font-size:28px;line-height:1.25;margin:0 0 16px;color:#1f2933;font-weight:900}h2{font-size:19px;color:#111;margin:18px 0 8px;font-weight:900;border-left:5px solid #1677d2;padding-left:10px;break-after:avoid}p{margin:10px 0}.lead{font-size:16px;color:#3d4856}.subtitle{font-size:18px;max-width:720px;color:#4b5563}.meta{margin-top:28mm;color:#697586}.hero-card{margin:22mm 0 16mm;background:#f2f4f7;border-left:5px solid #9aa4b2;padding:18px 22px;font-size:18px}.hero-card b{display:block;font-size:22px;color:#111;margin-bottom:6px}
blockquote{margin:16px 0;padding:14px 18px;background:#f1f2f4;border-left:5px solid #9aa4b2;font-weight:700;color:#202936}.greybox{background:#f1f2f4;border-left:5px solid #9aa4b2;padding:14px 18px;margin:15px 0;font-weight:700}.after{font-weight:700;color:#384252}
ul{margin:10px 0 14px 24px;padding:0}li{margin:5px 0}table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13.6px;line-height:1.55}th{background:#efefef;color:#111;font-weight:900}td,th{border:1px solid #d9d9d9;padding:9px 10px;vertical-align:top}td span{color:#7a8491;font-size:12px}
pre{background:#272c34;color:#e7edf5;border-radius:8px;padding:17px 20px;margin:16px 0;box-shadow:0 4px 14px rgba(0,0,0,.18);font-size:13px;line-height:1.8;white-space:pre-wrap}
.sketch{border:1px solid #e0d9c8;background:#fffaf0;border-radius:14px;padding:18px;margin:16px 0 18px;position:relative;box-shadow:0 2px 8px rgba(90,70,30,.08)}.sketch:before,.sketch:after{content:"";position:absolute;width:70px;height:22px;background:rgba(255,212,100,.5);top:-10px;transform:rotate(-5deg)}.sketch:before{left:38px}.sketch:after{right:45px;transform:rotate(6deg)}.sketch-title{text-align:center;font-size:22px;font-weight:900;color:#1f2933;margin-bottom:15px}.sketch-row{display:flex;align-items:center;justify-content:center;gap:8px}.sketch-row i{width:30px;border-top:3px solid #d67b28;position:relative}.sketch-row i:after{content:"";position:absolute;right:-2px;top:-6px;border-left:8px solid #d67b28;border-top:5px solid transparent;border-bottom:5px solid transparent}.sketch-note{min-width:105px;max-width:135px;min-height:82px;background:white;border:2px solid #30343b;border-radius:12px;transform:rotate(-1.5deg);padding:9px;text-align:center}.sketch-note:nth-child(4n){transform:rotate(1.6deg)}.sketch-note span{display:inline-flex;width:24px;height:24px;border-radius:50%;background:#ffd166;align-items:center;justify-content:center;font-weight:900;margin-bottom:5px}.sketch-note b{display:block;font-size:13px;color:#111}.sketch-foot{text-align:center;margin-top:14px;font-weight:800;color:#5b4636;background:#fff3cd;border-radius:8px;padding:8px}
.wide .sketch-note{min-width:130px}.flow-notes{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}.flow-notes div{border:1px solid #d9e2ec;border-radius:10px;padding:12px;background:#f8fbfd}.flow-notes b{display:block;color:#1677d2;font-size:17px}.flow-notes span{font-size:13px}.concept-table{font-size:12.4px;line-height:1.5}.concept-table td,.concept-table th{padding:6px 8px}
`;

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>Java AI 应用开发课程 - Vibe 讲义版</title><style>${css}</style></head><body>${pages.join("\n")}</body></html>`;
const outlinePython = `
import json
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject

pdf_path, outline_path = sys.argv[1], sys.argv[2]
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
        page_index = int(item["page"]) - 1
        if 0 <= page_index < len(writer.pages):
            node = writer.add_outline_item(item["title"], page_index, parent=parent)
            add_items(item.get("children", []), node)
add_items(outline)
writer.root_object.update({NameObject("/PageMode"): NameObject("/UseOutlines")})
tmp_path = pdf_path + ".tmp"
with open(tmp_path, "wb") as f:
    writer.write(f)
import os
os.replace(tmp_path, pdf_path)
`;

fs.writeFileSync(htmlPath, html, "utf8");
fs.writeFileSync(mdPath, renderMarkdown(), "utf8");
fs.writeFileSync(outlinePath, JSON.stringify(outline, null, 2), "utf8");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", executablePath: edgePath, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="font-family: Microsoft YaHei, sans-serif; width: 100%; font-size: 10px; color: #667085; padding: 0 18mm; display: flex; justify-content: space-between;"><span>Java AI 应用开发课程 - Vibe 讲义版</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "18mm", right: "20mm", bottom: "18mm", left: "20mm" }
  });
  await browser.close();
  const outlineScriptPath = path.join(outDir, "add_vibe_outline.py");
  fs.writeFileSync(outlineScriptPath, outlinePython, "utf8");
  execFileSync(pythonPath, [outlineScriptPath, pdfPath, outlinePath], { stdio: "inherit" });
  console.log(JSON.stringify({ pdfPath, htmlPath, mdPath, pages: outline.length }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
