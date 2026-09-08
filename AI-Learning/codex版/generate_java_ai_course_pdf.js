const fs = require("fs");
const path = require("path");

const puppeteer = require("D:\\acme\\pdf-gen\\node_modules\\puppeteer");

const root = __dirname;
const outDir = root;
fs.mkdirSync(outDir, { recursive: true });

const generatedAt = "2026-08-07";

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const code = {
  chatClient: `@RestController
@RequestMapping("/api/ai")
public class AiChatController {

    private final ChatClient chatClient;

    public AiChatController(ChatClient.Builder builder) {
        this.chatClient = builder
                .defaultSystem("""
                    你是企业内部 AI 助手。
                    回答必须准确、简洁；不确定时要说明不确定。
                    涉及制度、订单、客户信息时必须基于工具或知识库。
                    """)
                .build();
    }

    @GetMapping("/chat")
    public String chat(@RequestParam String question) {
        return chatClient.prompt()
                .user(question)
                .call()
                .content();
    }
}`,
  streaming: `@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> stream(@RequestParam String question) {
    return chatClient.prompt()
            .user(question)
            .stream()
            .content();
}`,
  structured: `public record RiskAnalysis(
        String summary,
        String riskLevel,
        List<String> reasons,
        List<String> actions
) {}

RiskAnalysis result = chatClient.prompt()
        .system("你是风控分析助手，只能输出符合 Java record 的结构化结果。")
        .user("分析这段客户投诉内容：" + complaintText)
        .call()
        .entity(RiskAnalysis.class);`,
  rag: `public String answerWithKnowledge(String question) {
    List<Document> chunks = vectorStore.similaritySearch(
            SearchRequest.builder()
                    .query(question)
                    .topK(5)
                    .similarityThreshold(0.72)
                    .build()
    );

    String context = chunks.stream()
            .map(Document::getText)
            .collect(Collectors.joining("\\n---\\n"));

    return chatClient.prompt()
            .system("""
                你是企业知识库助手。
                只能基于【资料】回答；资料不足时回答“当前资料不足以判断”。
                回答末尾列出引用来源。
                """)
            .user("""
                【问题】
                %s

                【资料】
                %s
                """.formatted(question, context))
            .call()
            .content();
}`,
  tool: `public class OrderTools {

    private final OrderService orderService;

    public OrderTools(OrderService orderService) {
        this.orderService = orderService;
    }

    @Tool(description = "根据订单号查询订单状态、金额、支付状态和物流状态")
    public OrderView getOrderStatus(String orderNo) {
        return orderService.queryOrder(orderNo);
    }
}

String answer = chatClient.prompt()
        .user("帮我查一下订单 OD202608070001 为什么还没发货")
        .tools(new OrderTools(orderService))
        .call()
        .content();`,
  sqlGuard: `public String safeQuery(String sql) {
    String normalized = sql.trim().toLowerCase(Locale.ROOT);

    if (!normalized.startsWith("select")) {
        throw new IllegalArgumentException("只允许 SELECT 查询");
    }
    if (normalized.contains(" delete ")
            || normalized.contains(" update ")
            || normalized.contains(" insert ")
            || normalized.contains(" drop ")
            || normalized.contains(" alter ")) {
        throw new IllegalArgumentException("SQL 包含高风险关键字");
    }
    if (!allowedTables.containsAll(extractTables(normalized))) {
        throw new IllegalArgumentException("查询表不在白名单内");
    }

    return jdbcTemplate.queryForList(addLimit(sql, 100)).toString();
}`
};

const weeks = [
  ["第 1 周", "AI 应用开发认知", "理解 LLM、Prompt、Embedding、RAG、Tool Calling、Agent；画出 Java AI 应用总体架构。", "学习笔记 + 架构图"],
  ["第 2 周", "模型 API 与流式聊天", "接入模型 API，完成普通聊天和 SSE 流式输出。", "Spring Boot Chat Demo"],
  ["第 3 周", "Prompt 与结构化输出", "学习提示词约束、JSON 输出、格式修复和幻觉控制。", "结构化分析接口"],
  ["第 4 周", "Spring AI 入门", "学习 ChatClient、PromptTemplate、Advisor、模型配置。", "Spring AI 聊天服务"],
  ["第 5 周", "Embedding 与向量库", "理解向量化和相似度检索，接入 pgvector、Milvus 或 Redis Vector。", "语义搜索接口"],
  ["第 6 周", "RAG 知识库 v1", "完成上传、解析、切分、向量化、检索、回答和来源引用。", "知识库问答系统"],
  ["第 7 周", "RAG 工程优化", "优化 chunk、topK、rerank、query rewrite、权限过滤和质量评估。", "知识库 v2"],
  ["第 8 周", "Tool Calling", "把 Java 方法暴露给模型，完成工具入参、出参和异常处理。", "业务工具助手"],
  ["第 9 周", "数据库问答助手", "实现自然语言转 SQL、只读账号、白名单、分页、审计和结果解释。", "安全 SQL 助手"],
  ["第 10 周", "Agent 工作流", "实现意图识别、工具选择、工具调用、结果汇总、审批和失败重试。", "业务 Agent"],
  ["第 11 周", "工程化与安全治理", "加入权限、限流、成本统计、日志追踪、脱敏和 Prompt 注入防护。", "企业级基础框架"],
  ["第 12 周", "综合项目实战", "完成知识库 + 工具调用 + 报告生成，并输出部署与演示材料。", "作品集项目"]
];

const enterpriseScenarios = [
  ["智能客服", "RAG + 工单系统 + Tool Calling", "先基于知识库答复，无法解决时创建工单并转人工。", "客服成本下降、回复一致性提升。"],
  ["企业知识库", "文档解析 + 向量库 + 权限过滤", "员工询问制度、合同、项目材料，回答带来源引用。", "减少找资料时间，沉淀组织知识。"],
  ["数据库问答", "NL2SQL + SQL Guard + 只读账号", "业务人员用自然语言查询销售、库存、工单趋势。", "降低报表依赖，提升数据可达性。"],
  ["运维助手", "日志检索 + 告警分析 + Runbook 工具", "分析异常日志，定位可能原因，给出处置步骤。", "缩短故障定位时间。"],
  ["代码研发助手", "代码检索 + 测试生成 + PR 审查", "解释模块、生成单测、检查风险和迁移影响。", "提升研发效率和交付质量。"],
  ["合同合规助手", "文档抽取 + 规则库 + 风险分类", "识别付款、违约、保密、续约等关键条款风险。", "提升法务和采购审核效率。"],
  ["销售助手", "CRM 工具 + 客户画像 + 话术生成", "根据客户历史、行业、商机阶段生成跟进建议。", "提高销售跟进质量。"],
  ["经营分析助手", "BI 指标 + 报告生成 + 可视化", "自动生成周报、月报、异常指标解释。", "提升管理层决策效率。"]
];

const capabilityMatrix = [
  ["模型调用层", "统一 Chat、Embedding、Streaming、结构化输出。", "模型切换、失败降级、超时、重试、成本统计。"],
  ["上下文层", "管理系统提示词、多轮历史、用户画像、任务状态。", "上下文窗口有限，需要摘要、裁剪和记忆策略。"],
  ["知识层", "文档解析、向量化、检索、重排、引用。", "权限过滤、来源可信度、增量同步、版本管理。"],
  ["工具层", "把 Java 方法、RPC、数据库、工作流暴露给模型。", "工具描述、参数校验、执行权限、幂等和审计。"],
  ["Agent 层", "规划步骤、选择工具、循环执行、生成最终结果。", "限制最大步数、失败退出、人工审批、过程可追踪。"],
  ["治理层", "权限、安全、日志、成本、评估、观测。", "Prompt 注入防护、敏感信息脱敏、租户隔离。"]
];

const githubProjects = [
  ["Spring AI", "https://github.com/spring-projects/spring-ai", "Java 主线框架", "学习 ChatClient、Advisor、Tool Calling、VectorStore、结构化输出、模型适配和 Spring Boot 自动配置。", "把源码中的核心抽象画成类图：ChatClient -> Model -> Advisor -> VectorStore -> Tool。"],
  ["Spring AI Examples", "https://github.com/spring-projects/spring-ai-examples", "官方示例集", "重点看 chat、prompt-engineering、rag、tool-calling、model-context-protocol、agentic-patterns 等目录。", "每周挑一个示例迁移到自己的 Spring Boot 项目里。"],
  ["Spring AI Alibaba", "https://github.com/alibaba/spring-ai-alibaba", "国内生态与企业集成", "学习通义千问/DashScope 接入、Graph Workflow、MCP、A2A、NL2SQL、可观测和企业工程封装思路。", "对照你现有的 DashScope/OpenAI 兼容配置，整理一份模型供应商切换清单。"],
  ["Spring AI Alibaba Examples", "https://github.com/spring-ai-alibaba/examples", "中文场景示例", "适合学习 RAG、NL2SQL、tool-calling、evaluation、MCP、observability 等实战场景。", "优先复刻 NL2SQL 和 RAG 示例，再接入你自己的 HR/知识库数据。"],
  ["LangChain4j", "https://github.com/langchain4j/langchain4j", "Java AI 编排框架", "学习 AI Service、工具调用、RAG、记忆、Guardrail、模型适配和测试思路。", "把同一个功能分别用 Spring AI 和 LangChain4j 写一遍，比较抽象差异。"],
  ["LangChain4j Examples", "https://github.com/langchain4j/langchain4j-examples", "Java 示例仓库", "适合看 RAG、agent、embedding store、pgvector、qdrant、mcp、web-search 等具体代码。", "把 pgvector RAG 示例改造成企业知识库问答。"],
  ["MCP Java SDK", "https://github.com/modelcontextprotocol/java-sdk", "工具生态协议", "学习 MCP Server、MCP Client、transport、capability、Spring AI 集成方式。", "做一个 company-tools MCP Server：查询候选人、职位、面试、知识库。"],
  ["OpenAI Java SDK", "https://github.com/openai/openai-java", "模型 API 底层能力", "学习 Responses/Chat/Streaming、超时、重试、错误处理和 SDK 级别封装。", "实现一个独立 AiClient，然后再对比 Spring AI 的抽象收益。"],
  ["OpenSquilla", "https://github.com/opensquilla/opensquilla", "Agent 运行时视野", "不是 Java 主线，但适合研究工具、记忆、沙箱、模型路由和 Agent 微内核设计。", "只学架构，不照搬代码；用它反推 Java Agent 框架需要哪些模块。"],
  ["Dify", "https://github.com/langgenius/dify", "AI 应用平台视野", "学习工作流、知识库、应用发布、运营配置、插件生态和多租户产品设计。", "从产品角度理解企业 AI 平台需要哪些后台能力。"],
  ["RAGFlow", "https://github.com/infiniflow/ragflow", "生产级 RAG 平台视野", "学习文档解析、切分、知识库管理、检索链路、引用和评估思路。", "对照你的 RAG 实现，补齐文档质量、chunk 策略和召回评估。"]
];

const booksAndCourses = [
  ["AI Engineering", "Chip Huyen", "https://www.oreilly.com/library/view/ai-engineering/9781098166298/", "从工程角度理解基座模型应用：数据、评估、反馈、成本、延迟、产品化。", "中高级主线书"],
  ["Designing Machine Learning Systems", "Chip Huyen", "https://www.oreilly.com/library/view/designing-machine-learning-systems/9781098107956/", "学习 ML 系统设计、数据分布、监控、部署和反馈闭环，补工程基本功。", "工程化底座"],
  ["LLM Engineer's Handbook", "Paul Iusztin / Maxime Labonne", "https://www.packtpub.com/en-us/product/llm-engineers-handbook-9781836200079", "覆盖 LLM 应用工程、RAG、评估、微调、部署和生产实践。", "实战手册"],
  ["Build a Large Language Model From Scratch", "Sebastian Raschka", "https://www.manning.com/books/build-a-large-language-model-from-scratch", "从 tokenizer、attention、Transformer 到预训练和微调，补底层原理。", "原理深入"],
  ["Spring AI in Action", "Craig Walls", "https://www.manning.com/books/spring-ai-in-action", "面向 Spring 开发者学习 Spring AI 应用开发。", "Java/Spring 专项"],
  ["Spring AI Reference", "Spring 官方文档", "https://docs.spring.io/spring-ai/reference/", "Spring AI 最新 API、模型适配、Advisor、VectorStore、Tool Calling、MCP。", "必须常查"],
  ["LangChain4j Documentation", "LangChain4j 官方文档", "https://docs.langchain4j.dev/", "Java 生态另一个重要 AI 应用框架，适合横向比较。", "Java 横向视野"],
  ["OpenAI API Documentation", "OpenAI 官方文档", "https://platform.openai.com/docs", "理解模型 API、工具调用、结构化输出、流式响应和多模态能力。", "底层 API 视野"]
];

const studyPaths = [
  ["第 1 层：跑通", "Spring AI Examples + OpenAI Java SDK", "先跑通普通聊天、流式输出、结构化输出。", "能解释一次请求从 Controller 到模型返回的完整链路。"],
  ["第 2 层：接知识", "Spring AI RAG 示例 + LangChain4j RAG 示例", "学习文档解析、chunk、embedding、vector store、topK、引用。", "做一个可引用来源的知识库问答接口。"],
  ["第 3 层：接业务", "Tool Calling 示例 + MCP Java SDK", "把 Java Service 暴露成模型可调用工具，但由应用负责校验和执行。", "做候选人查询、职位匹配、面试安排三个工具。"],
  ["第 4 层：做治理", "Spring AI Alibaba + Dify + RAGFlow", "学习平台化、可观测、评估、权限、多租户、成本管理。", "输出一张企业 AI 平台治理架构图。"],
  ["第 5 层：做 Agent", "OpenSquilla + LangChain4j Agent 示例", "研究规划、工具选择、观察、反思、终止条件、人工审批。", "做一个固定流程 HR Agent，不做无限自主循环。"]
];

const advancedTopics = [
  ["Context Engineering", "把系统提示词、用户问题、历史摘要、检索资料、工具结果、输出协议组合成稳定上下文。", "上下文不是越多越好，要围绕任务目标做裁剪、排序、摘要和冲突处理。", "提示词版本、上下文长度、引用资料命中率、输出格式合规率。"],
  ["生产级 RAG", "从文档采集到回答评估的完整知识链路。", "RAG 不是向量库查询，而是文档治理、检索策略、引用可信度和答案评估的系统工程。", "召回率、引用准确率、无答案拒答率、权限过滤正确率。"],
  ["Tool / MCP 安全", "把 Java Service、数据库只读查询、审批流、邮件、文件等能力安全暴露给模型。", "模型只负责选择工具和生成参数，业务系统负责权限、参数校验、幂等、审计和回滚。", "工具成功率、危险调用拦截数、人工审批通过率、审计完整性。"],
  ["Agent 工作流边界", "用状态机和工作流约束 Agent，而不是放任模型无限循环。", "企业优先做可控 Agent：有限步骤、明确终止条件、失败降级、关键动作人工确认。", "平均步骤数、超时率、人工接管率、任务完成率。"],
  ["评估与观测", "把 AI 输出质量变成可监控、可回放、可改进的数据。", "没有评估就没有工程闭环；不能只靠主观感觉判断模型效果。", "正确性、完整性、稳定性、延迟、成本、用户反馈。"],
  ["成本治理", "管理 token、模型等级、缓存、批处理、降级和路由策略。", "企业 AI 成本不是 API 价格表，而是用户量、上下文长度、检索策略、重试和模型选择共同决定。", "单次调用成本、缓存命中率、fallback 比例、月度预算消耗。"]
];

const ragChecklist = [
  ["文档采集", "来源、权限、版本、更新时间、租户归属。"],
  ["解析清洗", "去页眉页脚、表格保真、图片 OCR、异常编码、重复内容。"],
  ["切分策略", "按标题、段落、语义边界切分，保留章节路径和来源元数据。"],
  ["索引策略", "向量检索 + 关键词检索 + 元数据过滤，必要时加入 rerank。"],
  ["回答生成", "引用资料编号，资料不足时拒答，不编造制度、金额、日期。"],
  ["质量评估", "构建问题集，评估召回、引用、答案正确性和拒答表现。"]
];

const toolChecklist = [
  ["工具描述", "名称清晰、职责单一、参数少而明确，让模型知道什么时候该用。"],
  ["参数校验", "Java 侧校验必填、枚举、范围、租户、用户权限，不信任模型参数。"],
  ["执行控制", "只读优先，高风险动作必须审批，所有外部调用设置超时。"],
  ["幂等审计", "写操作带 requestId，记录调用人、工具、参数、结果和耗时。"],
  ["结果压缩", "工具返回给模型的内容要摘要化，避免把大结果集塞回上下文。"],
  ["失败降级", "工具失败时给可解释错误，引导模型换路或请求人工处理。"]
];

const evalMetrics = [
  ["回答质量", "事实正确率、引用正确率、拒答正确率、格式合规率。"],
  ["检索质量", "TopK 命中率、召回率、rerank 前后差异、低分过滤比例。"],
  ["系统质量", "P95 延迟、超时率、重试率、fallback 率、异常率。"],
  ["安全质量", "越权拦截、敏感信息泄露、Prompt 注入拦截、危险工具拦截。"],
  ["成本质量", "输入/输出 token、单次成本、缓存命中率、模型路由分布。"],
  ["业务质量", "用户采纳率、人工转接率、问题解决率、反馈评分。"]
];

const architecturePatterns = [
  ["模型网关模式", "所有模型调用先经过统一网关，负责模型路由、超时、重试、fallback、成本和审计。", "适合多模型、多团队、多场景的企业。"],
  ["RAG 平台模式", "把文档解析、向量化、检索、评估做成平台能力，业务只提交知识源和问答策略。", "适合多个业务线都需要知识库问答。"],
  ["MCP 工具平台模式", "把内部系统能力封装成标准工具协议，让不同 AI 应用复用。", "适合工具越来越多、需要跨应用复用的阶段。"],
  ["工作流 Agent 模式", "把 Agent 限定在可观测的工作流中，用节点和状态控制步骤。", "适合审批、招聘、运维、合规等流程明确场景。"],
  ["Human-in-the-loop 模式", "低风险自动执行，高风险进入人工确认或审批。", "适合涉及金额、通知、写库、外部发送、合规判断的场景。"]
];

const deepModules = [
  {
    week: "第 1 周",
    title: "AI 应用开发认知",
    hook: "先建立地图：AI 应用不是“接一个模型接口”，而是把不确定的生成能力接入确定的企业系统。",
    principle: "LLM 本质上是概率生成器，企业应用本质上是约束系统。AI 应用开发的核心工作，就是用上下文、知识、工具、权限、评估和工作流，把概率生成控制在业务可接受范围内。",
    breadth: "除了聊天助手，还包括知识库、数据问答、合同审核、运维排障、销售陪练、代码辅助、审批流自动化、流程挖掘、经营分析和智能报表。",
    misconceptions: "不要把模型当数据库；不要把 Prompt 当魔法咒语；不要把 Agent 当万能自动化；不要把 Demo 的效果等同于生产效果。",
    example: "同一个问题“这个候选人适合 Java 架构师吗”：普通聊天只会泛泛分析；企业 AI 要读取简历、职位画像、历史面试、评分规则、权限范围，并输出可追溯结论。",
    questions: "这个需求是否需要私有知识？是否需要实时数据？是否会触发业务动作？错了会造成什么损失？谁来审批？怎么评估？"
  },
  {
    week: "第 2 周",
    title: "模型 API 与流式聊天",
    hook: "模型 API 是最容易跑通、也最容易被低估的部分。真正的重点不是 call 一下，而是把一次模型调用做成可治理的后端能力。",
    principle: "一次模型调用包含模型选择、system prompt、user prompt、参数、上下文窗口、超时、重试、流式传输、错误处理、token 统计和审计日志。流式输出不是为了炫技，而是为了降低用户感知延迟。",
    breadth: "企业会同时使用云模型、本地模型、OpenAI 兼容供应商、Embedding 模型和轻量分类模型。不同模型适合不同任务：高质量分析、低成本分类、低延迟问答、代码生成、离线批处理。",
    misconceptions: "不要只封装一个 ChatService 就完事；不要在业务代码里散落模型调用；不要忽略超时和重试；不要让每个团队各接各的模型。",
    example: "AI 网关应统一接入 qwen、OpenAI 兼容接口、Ollama，本地缓存常见问答，把高风险分析路由到高质量模型，把简单分类路由到低成本模型。",
    questions: "这次调用用什么模型？为什么？超时时间是多少？失败降级到哪里？是否记录 token 和成本？是否支持流式和非流式两种模式？"
  },
  {
    week: "第 3 周",
    title: "Prompt 与结构化输出",
    hook: "Prompt 不是写作文，而是写“模型执行协议”。结构化输出则是让模型从聊天对象变成系统组件的关键一步。",
    principle: "Prompt 要定义角色、任务、上下文、约束、输出格式和失败策略。结构化输出要结合 JSON Schema、Java record、服务端校验和失败修复，而不是相信模型永远输出合法 JSON。",
    breadth: "结构化输出可用于风险评级、合同条款抽取、简历标签提取、工单分类、客户意向识别、SQL 生成计划、报告大纲和审批意见生成。",
    misconceptions: "不要把所有规则塞进一段很长 Prompt；不要让模型输出后直接入库；不要只做格式约束而不做业务校验；不要忽略中文枚举和金额日期单位。",
    example: "候选人分析输出应是 CandidateAssessment，包括 skills、riskLevel、evidence、missingInfo、recommendation，而不是一段散文式评价。",
    questions: "输出对象有哪些字段？哪些字段必须有证据？哪些字段允许为空？格式错了怎么修复？业务校验失败怎么处理？"
  },
  {
    week: "第 4 周",
    title: "Spring AI 入门",
    hook: "Spring AI 的价值不是替你思考 AI，而是把模型、向量库、工具调用这些能力放进 Spring Boot 熟悉的工程体系里。",
    principle: "ChatClient 是应用层入口，Model 是底层模型适配，Advisor 是对话过程增强，VectorStore 是知识检索抽象，Tool Calling 是业务能力暴露机制。理解这些抽象之间的边界，比背 API 更重要。",
    breadth: "Spring AI 可以连接 OpenAI、Azure OpenAI、Ollama、Vertex、Bedrock、DashScope 兼容接口，也能和 pgvector、Redis、Milvus、Qdrant 等向量存储组合。",
    misconceptions: "不要把 Spring AI 当成万能框架；不要忽略版本兼容和自动配置；不要把所有 Prompt 写死在 Controller；不要让框架抽象掩盖业务边界。",
    example: "企业项目里推荐 Controller 调用 Application Service，Application Service 编排 ChatClient、RAG、Tool、Gateway，而不是 Controller 直接 prompt().call()。",
    questions: "ChatClient 应该在哪里创建？系统 Prompt 如何版本化？Advisor 放什么逻辑？模型配置如何按环境隔离？"
  },
  {
    week: "第 5 周",
    title: "Embedding 与向量数据库",
    hook: "Embedding 不是“高级模糊搜索”，它是把语义放进可计算空间。理解向量空间，才能理解为什么 RAG 有时搜不到、搜偏了、搜出相似但无关的内容。",
    principle: "Embedding 模型把文本映射为高维向量，语义相近的文本在向量空间距离更近。向量检索依赖距离函数、索引结构、维度、归一化、chunk 内容质量和查询表达质量。",
    breadth: "向量检索可用于知识库、相似候选人、职位匹配、相似案件、商品推荐、异常日志聚类、客服问题归并、重复文档检测。",
    misconceptions: "不要以为换个向量库就能提升准确率；不要混用不同 embedding 模型生成的向量；不要只存正文不存元数据；不要忽略中文、表格和长文档切分。",
    example: "候选人匹配不能只 embed 简历全文，还要构造“技能、年限、行业、项目、学历、期望职位”的语义画像，再和职位画像做相似度比较。",
    questions: "用哪个 embedding 模型？维度是多少？chunk 如何切？元数据有哪些？相似度阈值怎么定？召回结果如何评估？"
  },
  {
    week: "第 6 周",
    title: "RAG 知识库 v1",
    hook: "RAG 的第一性原理：模型不知道的，先检索出来；模型容易编的，用引用约束住。",
    principle: "RAG = Retrieval + Augmented + Generation。关键链路是采集、解析、切分、向量化、检索、上下文组装、生成、引用。每一步都会影响最终答案。",
    breadth: "RAG 不只问文档，还能问制度、合同、API 文档、故障手册、项目资料、产品说明、历史工单、会议纪要和代码知识。",
    misconceptions: "不要把整篇文档塞给模型；不要没有引用；不要资料不足还强答；不要忽略权限过滤；不要只看向量相似度分数。",
    example: "员工问“试用期请假会影响转正吗”，RAG 应找到制度条款、HR FAQ 和审批流程，回答时引用来源，并说明缺少地区或合同类型时无法判断。",
    questions: "答案引用了哪些 chunk？这些 chunk 是否属于当前用户权限？资料是否足够？模型是否添加了资料外内容？"
  },
  {
    week: "第 7 周",
    title: "RAG 工程优化",
    hook: "RAG v1 能回答，RAG v2 要回答得准、稳、可解释、可评估。",
    principle: "RAG 优化不是单点优化，而是检索前、检索中、检索后、生成后全链路优化：query rewrite、混合检索、metadata filter、rerank、context compression、answer verification。",
    breadth: "高级 RAG 会涉及多路召回、知识图谱、父子 chunk、表格检索、时间版本、权限裁剪、个性化检索、多语言检索和离线评估集。",
    misconceptions: "不要盲目提高 topK；不要把 rerank 当银弹；不要忽略低质量文档；不要只优化 Prompt 不优化知识源；不要没有评估集。",
    example: "查询“上季度招聘渠道质量”，需要先把“上季度”解析成时间范围，再检索指标定义、渠道数据和历史报告，而不是只搜文本相似度。",
    questions: "问题是否需要改写？关键词检索和向量检索谁更合适？是否需要 rerank？是否有黄金问题集？线上失败样本如何回流？"
  },
  {
    week: "第 8 周",
    title: "Tool Calling",
    hook: "RAG 解决“知道什么”，Tool Calling 解决“能做什么”。但模型不能直接做事，必须通过应用边界做事。",
    principle: "工具调用流程是：模型选择工具和参数，应用校验权限和参数，业务服务执行，结果返回模型总结。模型没有执行权，只有建议调用权。",
    breadth: "工具可包括订单查询、库存查询、候选人查询、职位匹配、日程安排、邮件草稿、审批创建、报表生成、知识库搜索、日志查询。",
    misconceptions: "不要把大而全 Service 暴露给模型；不要让模型传 SQL 直接执行；不要没有审计；不要把工具返回的大结果直接塞回上下文。",
    example: "“帮我安排候选人面试”至少需要查询候选人、查询面试官日程、生成建议时间、请求用户确认，确认后才创建面试记录。",
    questions: "这个工具是否只做一件事？参数是否可校验？是否涉及写操作？是否需要人工确认？失败如何恢复？"
  },
  {
    week: "第 9 周",
    title: "数据库问答与 NL2SQL",
    hook: "数据库问答最容易让业务看到价值，也最容易出事故，因为它把自然语言直接连到了核心数据。",
    principle: "NL2SQL 应该分成意图解析、指标识别、SQL 计划、SQL 安全校验、只读执行、结果解释。模型生成的 SQL 只是候选方案，不是最终可信指令。",
    breadth: "适合经营分析、招聘漏斗、销售趋势、库存分析、财务摘要、工单统计、运营看板，但不适合无限制开放全库自由查询。",
    misconceptions: "不要使用高权限账号；不要允许 update/delete/drop；不要让模型猜表结构；不要把敏感字段直接返回；不要忽略分页和超时。",
    example: "用户问“最近 30 天 Java 岗位转化率如何”，系统应识别指标口径，查询岗位、候选人、面试、offer 表，并解释分母分子。",
    questions: "指标口径定义在哪里？允许查询哪些表？SQL 是否只读？是否脱敏？结果是否可解释？"
  },
  {
    week: "第 10 周",
    title: "Agent 工作流",
    hook: "Agent 不是一个更长的 Prompt，而是一个带状态、工具、记忆、终止条件和人工确认的执行系统。",
    principle: "Agent 的核心循环是 plan、act、observe、reflect、finish。但企业系统应优先做有限状态工作流 Agent，而不是开放式无限循环 Agent。",
    breadth: "Agent 可用于招聘流程助手、运维排障助手、数据分析助手、合同审核助手、研发辅助助手、合规检查助手、销售跟进助手。",
    misconceptions: "不要把所有复杂任务都交给自主 Agent；不要没有最大步数；不要没有失败退出；不要让 Agent 直接执行高风险动作。",
    example: "招聘 Agent 可以先分析岗位，再检索候选人，再生成推荐理由，再等待 HR 确认，而不是自动发 offer。",
    questions: "任务有几个状态？每步调用什么工具？何时停止？何时转人工？如何回放 Agent 的决策过程？"
  },
  {
    week: "第 11 周",
    title: "工程化、安全与治理",
    hook: "AI 应用上线后，真正决定成败的不是第一次回答惊艳，而是长期稳定、可控、可解释、可评估。",
    principle: "工程化要覆盖模型网关、Prompt 版本、配置隔离、权限、审计、限流、脱敏、成本、评估、监控、灰度和回滚。",
    breadth: "企业 AI 治理涉及安全、法务、业务、运维、财务和研发。越是连接核心业务系统，治理越要前置设计。",
    misconceptions: "不要没有日志；不要没有成本预算；不要忽略 Prompt 注入；不要让不同业务线重复造模型网关；不要只上线不评估。",
    example: "知识库问答需要记录问题、检索 chunk、模型、回答、引用、用户反馈，但敏感输入要脱敏，日志访问要受控。",
    questions: "谁能看调用日志？Prompt 如何发布回滚？成本超预算怎么办？敏感信息如何处理？模型升级如何灰度？"
  },
  {
    week: "第 12 周",
    title: "综合设计与架构表达",
    hook: "真正的能力不是写一个 Demo，而是能把一个业务问题拆成 AI 架构，并讲清楚边界、风险、成本和评估。",
    principle: "综合设计要从业务价值出发，反推知识、工具、模型、流程、权限、评估和交付。架构图要表达数据流、控制流、风险点和治理闭环。",
    breadth: "同一套方法可以迁移到 HR AI、智能客服、运维助手、数据问答、合同审核、知识库、销售助手和经营分析。",
    misconceptions: "不要先选模型再找场景；不要只画组件不画数据流；不要忽略失败路径；不要没有验收指标。",
    example: "设计 HR AI 平台时，要把候选人数据、职位数据、简历解析、向量匹配、面试工具、审批确认、评估反馈放到一张端到端架构图里。",
    questions: "业务闭环是什么？AI 在哪一步创造价值？风险在哪里？如何验证效果？实战项目后续统一设计时用什么指标验收？"
  }
];

const markdown = `# Java AI 应用开发课程 - Codex 版

生成日期：${generatedAt}

## 课程目标

这是一份面向 Java 后端开发者的 AI 应用开发课程。它的重点不是训练大模型，而是让你具备企业级 AI 应用的设计和交付能力：模型 API、Prompt、上下文、Embedding、RAG、Tool Calling、Agent、权限、安全、成本和运维。

## 第一章：企业级 AI 应用全景

AI 应用不是一个“会聊天的接口”。在企业系统里，它通常由六层组成：

1. 模型调用层：负责 Chat、Embedding、Streaming、结构化输出。
2. 上下文层：负责系统提示词、多轮历史、任务状态和用户偏好。
3. 知识层：负责文档解析、向量化、检索、重排和引用。
4. 工具层：负责把 Java 方法、数据库、RPC、工作流系统暴露给模型。
5. Agent 层：负责规划、工具选择、执行循环和结果汇总。
6. 治理层：负责权限、审计、安全、成本、质量评估和可观测性。

## 第二章：LLM 的工作原理

大模型的核心行为可以粗略理解为：根据输入上下文，预测下一个最可能出现的 token。它不是数据库，也不是规则引擎。它擅长语言理解、模式归纳、文本生成和模糊推理，但不天然具备实时事实、企业私有数据和可靠动作执行能力。

因此企业 AI 应用必须补三块能力：

- 用 RAG 补知识。
- 用 Tool Calling 补实时数据和业务动作。
- 用治理系统补权限、安全和可追踪性。

## 第三章：Java 示例

### Spring AI ChatClient 示例

\`\`\`java
${code.chatClient}
\`\`\`

### SSE 流式输出

\`\`\`java
${code.streaming}
\`\`\`

### 结构化输出

\`\`\`java
${code.structured}
\`\`\`

### RAG 问答

\`\`\`java
${code.rag}
\`\`\`

### Tool Calling

\`\`\`java
${code.tool}
\`\`\`

### SQL 安全校验

\`\`\`java
${code.sqlGuard}
\`\`\`

## 第四章：企业场景广度

${enterpriseScenarios.map(row => `- ${row[0]}：${row[2]} 技术组合：${row[1]}。业务价值：${row[3]}`).join("\n")}

## 12 周逐周深度课程

${weeks.map((row, index) => {
  const m = deepModules[index];
  return `### ${row[0]}：${row[1]}

- 学习重点：${row[2]}
- 本周产出：${row[3]}
- 专家定位：${m.hook}
- 核心讲解：${m.principle}
- 企业级广度：${m.breadth}
- 常见误区：${m.misconceptions}
- 贴近 HR 系统的例子：${m.example}
- 学完必须能回答：${m.questions}`;
}).join("\n\n")}

## GitHub 深度学习项目地图

${githubProjects.map(row => `- [${row[0]}](${row[1]})：${row[2]}。重点：${row[3]} 建议作业：${row[4]}`).join("\n")}

## 书籍与系统资料

${booksAndCourses.map(row => `- [${row[0]}](${row[2]})：${row[1]}。${row[3]} 定位：${row[4]}`).join("\n")}

## 从资料到实战的学习路径

${studyPaths.map(row => `- ${row[0]}：参考 ${row[1]}；学习动作：${row[2]}；验收标准：${row[3]}`).join("\n")}

## 高级主题：从 Demo 到企业级的分水岭

${advancedTopics.map(row => `- ${row[0]}：${row[1]} 核心判断：${row[2]} 关注指标：${row[3]}`).join("\n")}

## 生产级 RAG 检查清单

${ragChecklist.map(row => `- ${row[0]}：${row[1]}`).join("\n")}

## Tool / MCP 安全检查清单

${toolChecklist.map(row => `- ${row[0]}：${row[1]}`).join("\n")}

## AI 应用评估与观测指标

${evalMetrics.map(row => `- ${row[0]}：${row[1]}`).join("\n")}

## 企业 AI 架构模式

${architecturePatterns.map(row => `- ${row[0]}：${row[1]} 适用：${row[2]}`).join("\n")}

`;

function tableRows(rows) {
  return rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
}

function codeBlock(source) {
  return `<pre><code>${escapeHtml(source)}</code></pre>`;
}

function weeklyCourseSections() {
  return weeks.map((week, index) => {
    const module = deepModules[index];
    const forceBreak = index === 0 || index % 2 === 0 ? " page-break" : "";
    return `
      <section class="week-module${forceBreak}">
        <div class="week-head">
          <div>
            <div class="week-label">${escapeHtml(week[0])}</div>
            <h3>${escapeHtml(week[1])}</h3>
          </div>
          <div class="week-output"><strong>本周产出</strong>${escapeHtml(week[3])}</div>
        </div>
        <table class="week-table">
          <tbody>
            <tr><th style="width:18%">学习重点</th><td>${escapeHtml(week[2])}</td></tr>
            <tr><th>专家定位</th><td>${escapeHtml(module.hook)}</td></tr>
          </tbody>
        </table>
        <div class="expert-block"><strong>核心讲解</strong>${escapeHtml(module.principle)}</div>
        <div class="module-grid">
          <div class="module-item"><strong>企业级广度</strong>${escapeHtml(module.breadth)}</div>
          <div class="module-item"><strong>常见误区</strong>${escapeHtml(module.misconceptions)}</div>
          <div class="module-item"><strong>贴近 HR 系统的例子</strong>${escapeHtml(module.example)}</div>
          <div class="module-item"><strong>学完必须能回答</strong>${escapeHtml(module.questions)}</div>
        </div>
      </section>
    `;
  }).join("");
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Java AI 应用开发课程 - Codex 版</title>
  <style>
    @page { size: A4; margin: 15mm 14mm 17mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif;
      color: #152338;
      font-size: 12.6px;
      line-height: 1.62;
      background: white;
    }
    .cover {
      min-height: 250mm;
      padding: 26mm 15mm 20mm;
      background:
        linear-gradient(135deg, rgba(14, 89, 145, 0.11), rgba(37, 145, 97, 0.08)),
        radial-gradient(circle at 84% 15%, rgba(25, 132, 255, 0.18), transparent 30%),
        #f8fbfd;
      border: 1px solid #dce8ef;
      page-break-after: always;
    }
    .eyebrow { color: #0d8061; font-weight: 800; letter-spacing: 1.5px; font-size: 12px; }
    h1 { margin: 18mm 0 8mm; font-size: 38px; line-height: 1.18; color: #0e294a; }
    .subtitle { width: 88%; font-size: 17px; color: #344960; line-height: 1.7; }
    .cover-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 24mm; }
    .cover-card { padding: 13px 15px; background: rgba(255,255,255,.8); border: 1px solid #d8e7ef; border-radius: 10px; min-height: 78px; }
    .cover-card strong { display: block; color: #0e4f7e; font-size: 15px; margin-bottom: 5px; }
    .meta { margin-top: 25mm; color: #536779; font-size: 12px; }
    h2 { margin: 18px 0 10px; padding-bottom: 5px; font-size: 22px; color: #10355c; border-bottom: 2px solid #d9e8f2; page-break-after: avoid; }
    h3 { margin: 14px 0 7px; font-size: 16px; color: #0f5c78; page-break-after: avoid; }
    h4 { margin: 10px 0 5px; font-size: 14px; color: #0e4f7e; }
    p { margin: 6px 0; }
    ul, ol { margin: 7px 0 12px 22px; padding: 0; }
    li { margin: 3px 0; }
    .note { padding: 10px 12px; border: 1px solid #e4cf95; background: #fff9e8; border-radius: 8px; margin: 10px 0; }
    .principle { border-left: 5px solid #189277; background: #f6fcfb; padding: 10px 13px; margin: 10px 0; }
    .flow { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 12px 0; page-break-inside: avoid; }
    .flow div { text-align: center; border: 1px solid #cbdde8; border-radius: 8px; padding: 8px 5px; background: #f8fbfd; font-weight: 700; color: #0e4f7e; min-height: 44px; }
    table { width: 100%; border-collapse: collapse; margin: 9px 0 15px; font-size: 11.4px; page-break-inside: avoid; }
    th { background: #103d63; color: white; text-align: left; padding: 7px; border: 1px solid #103d63; }
    td { padding: 7px; border: 1px solid #cfdce6; vertical-align: top; }
    tr:nth-child(even) td { background: #f7fbfd; }
    pre { background: #0f1f2f; color: #e7f3ff; padding: 11px 12px; border-radius: 8px; overflow: hidden; font-size: 9.2px; line-height: 1.42; page-break-inside: avoid; white-space: pre-wrap; }
    code { font-family: "Consolas", "Cascadia Mono", monospace; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
    .card { border: 1px solid #d4e4ee; border-left: 5px solid #189277; border-radius: 8px; padding: 9px 11px; background: #fbfefd; min-height: 70px; }
    .card strong { color: #0f5c78; display: block; margin-bottom: 4px; }
    .diagram { border: 1px solid #cddfea; border-radius: 12px; padding: 12px; margin: 12px 0 16px; background: linear-gradient(135deg, #f8fcff, #f5fbf8); page-break-inside: avoid; }
    .diagram-title { font-weight: 800; color: #10355c; margin-bottom: 9px; }
    .stack { display: grid; grid-template-columns: 1.1fr .22fr 1.1fr .22fr 1.1fr; gap: 7px; align-items: stretch; }
    .stack .box { border: 1px solid #c7d9e7; border-radius: 9px; background: white; padding: 8px; min-height: 68px; }
    .stack .box strong { display: block; color: #0f5c78; margin-bottom: 3px; }
    .stack .arrow { display: flex; align-items: center; justify-content: center; color: #0d8061; font-weight: 900; font-size: 18px; }
    .layered { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .layered div { border: 1px solid #c7d9e7; background: white; border-radius: 8px; padding: 8px; min-height: 48px; }
    .layered strong { color: #0f5c78; display: block; }
    .path { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .path div { background: #ffffff; border: 1px solid #c7d9e7; border-radius: 8px; padding: 8px 6px; text-align: center; min-height: 58px; }
    .path strong { display: block; color: #0e4f7e; margin-bottom: 3px; }
    .module { border: 1px solid #d4e4ee; border-radius: 12px; padding: 12px 14px; margin: 12px 0 16px; background: #fbfefd; page-break-inside: avoid; }
    .module h3 { margin-top: 0; color: #10355c; border-bottom: 1px solid #d9e8f2; padding-bottom: 4px; }
    .module-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .module-item { border-left: 4px solid #189277; background: #f7fbfd; padding: 8px 9px; border-radius: 7px; min-height: 64px; }
    .module-item strong { display: block; color: #0f5c78; margin-bottom: 3px; }
    .week-module { border: 1px solid #cfe0ea; border-radius: 13px; padding: 13px 14px; margin: 13px 0 18px; background: linear-gradient(135deg, #fbfdff, #f7fbf8); page-break-inside: avoid; }
    .week-head { display: grid; grid-template-columns: 1fr 190px; gap: 12px; align-items: stretch; margin-bottom: 8px; }
    .week-label { color: #0d8061; font-size: 12px; font-weight: 900; letter-spacing: 1px; }
    .week-head h3 { margin: 2px 0 0; color: #10355c; font-size: 19px; }
    .week-output { border: 1px solid #d8e7ef; border-radius: 9px; padding: 8px 10px; background: #ffffff; color: #344960; }
    .week-output strong { display: block; color: #0e4f7e; margin-bottom: 3px; }
    .week-table { margin: 8px 0 10px; font-size: 11.8px; }
    .week-table th { background: #e9f3f8; color: #0e4f7e; border-color: #cbdde8; }
    .expert-block { border-left: 5px solid #103d63; background: #f5f9fc; padding: 9px 11px; border-radius: 8px; margin: 9px 0; }
    .expert-block strong { display: block; color: #10355c; margin-bottom: 3px; }
    .page-break { page-break-before: always; }
    a { color: #0b65b1; text-decoration: none; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="eyebrow">JAVA AI APPLICATION DEVELOPMENT</div>
    <h1>Java AI 应用开发课程<br/>Codex 版</h1>
    <div class="subtitle">从 Java 后端走向企业级 AI 应用开发：原理讲透、示例跑通、场景拉宽、工程可落地。</div>
    <div class="cover-grid">
      <div class="cover-card"><strong>主线</strong>模型 API -> Prompt -> RAG -> Tool Calling -> Agent -> 治理。</div>
      <div class="cover-card"><strong>方法</strong>先理解原理，再用 Java/Spring Boot 把能力接到业务系统。</div>
      <div class="cover-card"><strong>广度</strong>客服、知识库、数据库问答、运维、研发、合规、销售、经营分析。</div>
      <div class="cover-card"><strong>产出</strong>一套能持续追加的 PDF 课程和可实战的项目路线。</div>
    </div>
    <div class="meta">生成日期：${generatedAt}<br/>维护目录：D:\\acme\\AI-Learning\\codex版</div>
  </section>

  <h2>一、课程定位：Java 开发者该怎样进入 AI 应用开发</h2>
  <p>Java 开发者进入 AI 应用开发，不应该把第一目标放在训练大模型上。企业里真正需要你解决的问题通常是：怎样把模型能力稳定、安全、低成本地接进已有业务系统。</p>
  <div class="principle"><strong>核心判断：</strong>AI 应用开发本质上仍然是后端工程，只是多了模型调用、上下文管理、知识检索、工具调用和智能编排。</div>
  <p>一个成熟的企业级 AI 应用，至少要回答六个问题：模型从哪里来、上下文怎么管、企业知识怎么接入、业务动作怎么执行、安全权限怎么控制、效果和成本怎么评估。</p>

  <h2>二、企业级 AI 应用六层架构</h2>
  <div class="flow">
    <div>模型调用层</div><div>上下文层</div><div>知识层</div><div>工具层</div><div>Agent 层</div><div>治理层</div>
  </div>
  <table>
    <thead><tr><th style="width:18%">层级</th><th>作用</th><th>企业级关注点</th></tr></thead>
    <tbody>${tableRows(capabilityMatrix)}</tbody>
  </table>
  <p>很多 Demo 只做了模型调用层，所以看起来很快。但企业项目真正难的是后五层：上下文、知识、工具、Agent 和治理。这里面每一层都对应实际工程成本。</p>

  <h2>三、LLM 原理：它为什么会答，也为什么会错</h2>
  <h3>1. Token：模型看到的不是字，而是 token 序列</h3>
  <p>大模型处理文本时，会先把输入拆成 token。中文里一个字、词片段、标点都可能成为 token。模型不是直接理解“句子”，而是在 token 序列上计算下一个 token 的概率分布。</p>
  <div class="note">工程影响：上下文窗口、计费、响应速度都和 token 数有关。企业系统必须统计每次调用的输入 token、输出 token、用户、功能和场景。</div>

  <h3>2. 预测下一个 token：语言能力来自概率建模</h3>
  <p>LLM 的生成过程可以粗略理解为：给定当前上下文，预测下一个最可能出现的 token；再把这个 token 加入上下文，继续预测下一个。这个过程重复进行，就形成了回答。</p>
  <p>所以模型擅长语言组织、归纳、改写、解释、生成和模糊推理。但它不是数据库，也不是权限系统，更不是天然可靠的业务执行器。</p>

  <h3>3. Temperature：创造性和稳定性的旋钮</h3>
  <p>temperature 越低，输出越稳定；temperature 越高，输出越发散。企业问答、风控分析、合同审核通常要低温度；头脑风暴、营销文案可以适当提高。</p>
  <table>
    <thead><tr><th>场景</th><th>建议</th><th>原因</th></tr></thead>
    <tbody>
      <tr><td>制度问答</td><td>低 temperature</td><td>要求准确、稳定、可引用。</td></tr>
      <tr><td>SQL 生成</td><td>低 temperature + 强校验</td><td>不允许自由发挥。</td></tr>
      <tr><td>营销创意</td><td>中高 temperature</td><td>需要更多表达变化。</td></tr>
      <tr><td>代码生成</td><td>中低 temperature</td><td>兼顾稳定和解决思路。</td></tr>
    </tbody>
  </table>

  <h3>4. 幻觉：不是 bug，而是生成式模型的天然风险</h3>
  <p>模型倾向于生成“看起来合理”的内容。当上下文没有足够事实时，它仍可能补全答案。这就是幻觉的根源之一。</p>
  <div class="principle"><strong>企业应对：</strong>凡是涉及制度、金额、订单、客户、合同、库存、设备、人员等事实，必须让模型基于 RAG 或工具结果回答。</div>

  <h2 class="page-break">四、Prompt 工程：不是写作文，而是写接口协议</h2>
  <p>Prompt 在企业应用里更像“人与模型之间的接口协议”。一个好 Prompt 要定义角色、任务、上下文、约束、输出格式和失败策略。</p>
  <h3>企业 Prompt 模板</h3>
  ${codeBlock(`角色：你是企业内部知识库助手。
任务：回答员工关于制度、流程、项目资料的问题。
依据：只能使用【资料】中的内容。
约束：
1. 如果资料不足，回答“当前资料不足以判断”。
2. 不要编造制度编号、负责人、金额、日期。
3. 回答末尾必须列出引用来源。
输出格式：
- 结论
- 依据
- 建议动作
- 引用来源`)}
  <p>这种 Prompt 的价值在于把模型的自由发挥压进企业可控的边界里。它不是让模型“更聪明”，而是让模型“更守规矩”。</p>

  <h2>五、Spring AI：Java 开发者的主线框架</h2>
  <p>Spring AI 提供了面向 Spring 开发者的 ChatClient、Vector Store、Tool Calling、Advisor 等抽象。它的优势是贴近 Spring Boot 的工程习惯，可以比较自然地接入已有业务服务。</p>
  <h3>基础聊天接口</h3>
  ${codeBlock(code.chatClient)}
  <h3>SSE 流式输出</h3>
  ${codeBlock(code.streaming)}
  <p>流式输出在企业应用里很重要。用户等待 20 秒才看到完整答案，会感觉系统卡住；SSE 可以边生成边展示，体验接近 ChatGPT。</p>

  <h2 class="page-break">六、结构化输出：让 AI 从聊天变成系统组件</h2>
  <p>如果模型只返回自然语言，它更像聊天助手；如果能稳定返回结构化对象，它就可以进入业务流程。</p>
  <h3>示例：投诉风险分析</h3>
  ${codeBlock(code.structured)}
  <p>企业中常见结构化输出场景包括：风险等级、工单分类、合同条款抽取、客户意向识别、舆情分类、异常原因归类。</p>
  <div class="note">关键点：结构化输出后仍要做服务端校验。模型输出不应该直接写库或触发高风险动作。</div>

  <h2>七、Embedding 与 RAG：让模型使用企业私有知识</h2>
  <h3>1. Embedding 是什么</h3>
  <p>Embedding 会把文本变成向量。语义相近的文本，向量距离更近。这样用户问“报销多久到账”，系统可以找到“费用报销付款周期说明”这样的文档片段，而不要求关键词完全一致。</p>
  <h3>2. RAG 的完整链路</h3>
  <div class="flow">
    <div>文档上传</div><div>解析清洗</div><div>文本切分</div><div>向量化</div><div>相似检索</div><div>生成回答</div>
  </div>
  <h3>3. Java RAG 示例</h3>
  ${codeBlock(code.rag)}
  <p>RAG 的难点不在“能不能搜到”，而在“搜到的内容是否可靠、是否有权限、是否足够回答问题、是否能给出引用”。</p>

  <h2 class="page-break">八、Tool Calling：让模型调用 Java 业务能力</h2>
  <p>Tool Calling 的本质是：模型不直接访问系统，而是提出“我想调用哪个工具，参数是什么”。真正执行工具的是你的 Java 应用。</p>
  <div class="principle"><strong>安全边界：</strong>模型只能请求工具调用，不能绕过应用权限直接操作数据库、接口或文件系统。</div>
  <h3>执行流程</h3>
  <ol>
    <li>应用把工具名称、描述、参数 schema 发给模型。</li>
    <li>模型判断需要调用工具，并生成工具名和参数。</li>
    <li>Java 应用校验参数、权限和业务规则。</li>
    <li>Java 应用执行工具，并把结果返回给模型。</li>
    <li>模型基于工具结果生成最终回答。</li>
  </ol>
  <h3>订单查询工具示例</h3>
  ${codeBlock(code.tool)}

  <h2>九、数据库问答：最容易出价值，也最容易出事故</h2>
  <p>自然语言转 SQL 很适合企业内部数据分析，但它也是高风险场景。不能让模型自由生成 SQL 后直接执行。</p>
  <h3>SQL 安全校验示例</h3>
  ${codeBlock(code.sqlGuard)}
  <p>企业级数据库问答至少需要：只读账号、表白名单、字段白名单、分页限制、超时限制、结果脱敏、审计日志和人工审批策略。</p>

  <h2 class="page-break">十、Agent：不要迷信全自动，先做好可控流程</h2>
  <p>Agent 可以理解为“模型 + 工具 + 任务状态 + 循环控制”。它能规划步骤、调用工具、观察结果，再决定下一步。</p>
  <p>但企业系统里，完全开放的 Agent 风险很高。推荐从固定流程 Agent 开始。</p>
  <div class="flow">
    <div>识别意图</div><div>选择工具</div><div>执行工具</div><div>校验结果</div><div>生成结论</div><div>人工确认</div>
  </div>
  <h3>示例：高风险工单分析 Agent</h3>
  <ol>
    <li>识别用户要分析“本周高风险工单”。</li>
    <li>调用工单查询工具，限定时间范围和风险字段。</li>
    <li>调用知识库检索历史处置规则。</li>
    <li>生成风险分类、原因分析和处理建议。</li>
    <li>如果要发送通知或创建任务，必须人工确认。</li>
  </ol>

  <h2>十一、企业级应用广度：打开视野</h2>
  <table>
    <thead><tr><th style="width:16%">场景</th><th style="width:23%">技术组合</th><th>典型做法</th><th style="width:20%">业务价值</th></tr></thead>
    <tbody>${tableRows(enterpriseScenarios)}</tbody>
  </table>
  <p>你会发现，AI 应用的广度不是“换几个提示词”，而是和企业已有系统相连：CRM、ERP、OA、工单、知识库、BI、日志平台、代码仓库、合同系统、审批系统。</p>

  <h2 class="page-break">十二、12 周逐周深度课程：每周主题紧跟详细讲解</h2>
  <p>这一版把每周的学习重点和详细讲解放在一起。你不需要自己拼图，按周读下去，就能从“知道概念”推进到“能设计企业级 AI 系统”。</p>
  ${weeklyCourseSections()}

  <h2 class="page-break">十三、下一步怎么学</h2>
  <div class="two-col">
    <div class="card"><strong>先做一个聊天服务</strong>不要急着接知识库。先把模型调用、流式输出、错误处理和日志跑顺。</div>
    <div class="card"><strong>再做 RAG 知识库</strong>把文档处理、向量检索、引用来源和权限过滤做扎实。</div>
    <div class="card"><strong>然后做 Tool Calling</strong>让模型查订单、查工单、查库存，但所有工具都要有权限和参数校验。</div>
    <div class="card"><strong>最后做 Agent</strong>先做固定流程，再逐步增加自主规划能力。</div>
  </div>

  <h2 class="page-break">十四、GitHub 深度学习项目地图</h2>
  <p>下面这些项目建议分层学习。Java/Spring 主线项目用于真正写代码；平台类项目用于打开架构视野；Agent 运行时项目用于理解未来演进方向。</p>
  <div class="diagram">
    <div class="diagram-title">图 1：从开源项目到企业 AI 应用的迁移路径</div>
    <div class="path">
      <div><strong>跑通 API</strong>Chat / Stream / JSON</div>
      <div><strong>接入知识</strong>Embedding / RAG / 引用</div>
      <div><strong>调用业务</strong>Tool / MCP / 权限</div>
      <div><strong>平台治理</strong>评估 / 成本 / 观测</div>
      <div><strong>Agent 化</strong>流程 / 反思 / 审批</div>
    </div>
  </div>
  <table>
    <thead><tr><th style="width:18%">项目</th><th style="width:15%">定位</th><th>重点学习内容</th><th style="width:24%">建议作业</th></tr></thead>
    <tbody>${githubProjects.map(row => `<tr><td><a href="${row[1]}">${escapeHtml(row[0])}</a></td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td><td>${escapeHtml(row[4])}</td></tr>`).join("")}</tbody>
  </table>

  <h2>十五、怎样读这些 GitHub 项目</h2>
  <p>读开源项目不要从头到尾硬啃。建议按“入口、配置、核心抽象、业务链路、异常治理、测试样例”的顺序读。</p>
  <div class="diagram">
    <div class="diagram-title">图 2：源码阅读六步法</div>
    <div class="stack">
      <div class="box"><strong>入口</strong>Controller、Application、Sample Runner，找到一次请求从哪里进来。</div>
      <div class="arrow">></div>
      <div class="box"><strong>配置</strong>pom、application.yml、AutoConfiguration，确认模型、向量库、超时和密钥。</div>
      <div class="arrow">></div>
      <div class="box"><strong>核心抽象</strong>ChatClient、EmbeddingModel、VectorStore、Tool、Advisor、Memory。</div>
    </div>
    <div style="height:8px"></div>
    <div class="stack">
      <div class="box"><strong>业务链路</strong>普通聊天、RAG、Tool Calling、NL2SQL、Agent 循环。</div>
      <div class="arrow">></div>
      <div class="box"><strong>治理能力</strong>权限、限流、日志、成本、重试、fallback、评估、观测。</div>
      <div class="arrow">></div>
      <div class="box"><strong>测试复刻</strong>先跑官方示例，再替换成自己的业务数据。</div>
    </div>
  </div>
  <div class="principle"><strong>阅读原则：</strong>不要只看“模型怎么调用”，更要看“模型调用失败怎么办、结果怎么校验、权限怎么控制、成本怎么统计”。这些才是企业级项目的分水岭。</div>

  <h2 class="page-break">十六、企业级 AI 平台参考架构图</h2>
  <p>结合 Spring AI、MCP、RAG 平台和你已有的 HR/Chat Portal 项目，可以把企业 AI 应用抽象成下面的架构。</p>
  <div class="diagram">
    <div class="diagram-title">图 3：Java 企业级 AI 应用参考架构</div>
    <div class="layered">
      <div><strong>接入层</strong>Web / App / 企业微信 / 浏览器插件 / OpenAPI</div>
      <div><strong>应用层</strong>Chat、知识库问答、候选人分析、职位匹配、报告生成</div>
      <div><strong>编排层</strong>Prompt、ChatClient、Advisor、Memory、Agent Workflow</div>
      <div><strong>知识层</strong>文档解析、chunk、embedding、pgvector、rerank、引用</div>
      <div><strong>工具层</strong>Java Service、数据库只读工具、审批流、邮件、MCP Server</div>
      <div><strong>模型层</strong>OpenAI 兼容 API、DashScope、Ollama、本地 embedding</div>
      <div><strong>治理层</strong>租户、权限、审计、脱敏、限流、成本、评估、观测</div>
      <div><strong>数据层</strong>MySQL、PostgreSQL/pgvector、Redis、对象存储、日志</div>
      <div><strong>交付层</strong>Docker、CI/CD、灰度、告警、SLA、回滚</div>
    </div>
  </div>
  <p>你现在的项目已经具备这个架构的雏形：<code>hr-candidate-ai</code> 偏 HR 业务 AI，<code>chat-portal/ai-service</code> 偏 AI 网关、RAG、Agent 和工具生态。后续学习项目应该围绕这两条线补齐，而不是另起一个脱离业务的玩具系统。</p>

  <h2>十七、书籍与系统资料推荐</h2>
  <table>
    <thead><tr><th style="width:24%">资料</th><th style="width:18%">作者/来源</th><th>适合学习什么</th><th style="width:15%">定位</th></tr></thead>
    <tbody>${booksAndCourses.map(row => `<tr><td><a href="${row[2]}">${escapeHtml(row[0])}</a></td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[3])}</td><td>${escapeHtml(row[4])}</td></tr>`).join("")}</tbody>
  </table>
  <p>学习顺序建议：先用 Spring AI 官方文档和示例建立手感，再读 AI Engineering 建立工程判断，随后用 LLM Engineer's Handbook 补生产实践，最后用 Build a Large Language Model From Scratch 补 Transformer 底层原理。</p>

  <h2>十八、把资料转成你的实战路线</h2>
  <table>
    <thead><tr><th style="width:18%">阶段</th><th style="width:22%">参考项目</th><th>学习动作</th><th style="width:24%">验收标准</th></tr></thead>
    <tbody>${tableRows(studyPaths)}</tbody>
  </table>
  <div class="note">适合你的路线：以 JDK25 + Spring Boot 4 + Spring AI 2.0 为主线，优先把 <code>chat-portal/ai-service</code> 中的 RAG、Gateway、ReAct、ToolRegistry 读透，再把 <code>hr-candidate-ai</code> 中的候选人 embedding、职位匹配、语义搜索改造成一套可复用课程项目。</div>

  <h2 class="page-break">十九、进阶工程主题：从 Demo 到企业级</h2>
  <p>这一部分暂时不进入实战项目，而是先把企业级 AI 应用的关键工程问题讲清楚。后续统一设计实战项目时，这些内容会变成项目验收标准。</p>
  <table>
    <thead><tr><th style="width:18%">主题</th><th>学习重点</th><th>核心判断</th><th style="width:20%">关注指标</th></tr></thead>
    <tbody>${tableRows(advancedTopics)}</tbody>
  </table>

  <h2>二十、生产级 RAG 架构与检查清单</h2>
  <div class="diagram">
    <div class="diagram-title">图 4：生产级 RAG 闭环</div>
    <div class="path">
      <div><strong>知识接入</strong>文档、网页、数据库、业务对象</div>
      <div><strong>知识治理</strong>清洗、版本、权限、元数据</div>
      <div><strong>检索生成</strong>混合检索、rerank、引用回答</div>
      <div><strong>质量评估</strong>问题集、召回、正确性、拒答</div>
      <div><strong>反馈迭代</strong>用户反馈、日志回放、策略优化</div>
    </div>
  </div>
  <table>
    <thead><tr><th style="width:18%">环节</th><th>检查点</th></tr></thead>
    <tbody>${tableRows(ragChecklist)}</tbody>
  </table>
  <div class="principle"><strong>关键认知：</strong>生产级 RAG 的核心不是“向量库查一下”，而是知识治理、权限过滤、召回评估、引用可信和持续反馈。</div>

  <h2 class="page-break">二十一、Tool / MCP 安全设计</h2>
  <div class="diagram">
    <div class="diagram-title">图 5：工具调用安全边界</div>
    <div class="stack">
      <div class="box"><strong>模型</strong>判断是否需要工具，生成工具名和参数。</div>
      <div class="arrow">></div>
      <div class="box"><strong>应用网关</strong>校验用户、租户、参数、权限、风险等级。</div>
      <div class="arrow">></div>
      <div class="box"><strong>业务工具</strong>只读查询、审批流、邮件、文件、MCP Server。</div>
    </div>
  </div>
  <table>
    <thead><tr><th style="width:18%">设计项</th><th>检查点</th></tr></thead>
    <tbody>${tableRows(toolChecklist)}</tbody>
  </table>
  <p>工具调用要有“窄接口”意识：每个工具只做一件事，参数越少越好，返回内容越可控越好。越接近写库、发消息、调用外部系统，越要加入人工确认。</p>

  <h2>二十二、评估、观测与成本治理</h2>
  <table>
    <thead><tr><th style="width:20%">指标类别</th><th>建议跟踪指标</th></tr></thead>
    <tbody>${tableRows(evalMetrics)}</tbody>
  </table>
  <div class="diagram">
    <div class="diagram-title">图 6：AI 应用质量闭环</div>
    <div class="path">
      <div><strong>调用日志</strong>Prompt、上下文、模型、工具</div>
      <div><strong>质量评估</strong>正确性、引用、格式、拒答</div>
      <div><strong>成本分析</strong>token、缓存、模型路由</div>
      <div><strong>问题回放</strong>失败样本、用户反馈</div>
      <div><strong>策略优化</strong>Prompt、RAG、工具、模型</div>
    </div>
  </div>
  <p>AI 系统上线后，最怕“看起来能用，但没人知道哪里错、为什么错、成本为什么涨”。所以课程后续会把评估和观测作为和编码同等重要的能力。</p>

  <h2>二十三、企业 AI 架构模式库</h2>
  <table>
    <thead><tr><th style="width:22%">模式</th><th>说明</th><th style="width:24%">适用场景</th></tr></thead>
    <tbody>${tableRows(architecturePatterns)}</tbody>
  </table>
  <div class="note">实战项目后面统一考虑。本阶段先把这些模式吃透：以后不管做 HR AI、知识库、运维助手、数据问答，都会在这些模式里组合。</div>

  <h2 class="page-break">二十四、资料入口</h2>
  <ul>
    <li>Spring AI Reference：<a href="https://docs.spring.io/spring-ai/reference/">https://docs.spring.io/spring-ai/reference/</a></li>
    <li>Spring AI ChatClient：<a href="https://docs.spring.io/spring-ai/reference/api/chatclient.html">https://docs.spring.io/spring-ai/reference/api/chatclient.html</a></li>
    <li>Spring AI Tool Calling：<a href="https://docs.spring.io/spring-ai/reference/api/tools.html">https://docs.spring.io/spring-ai/reference/api/tools.html</a></li>
    <li>Spring AI GitHub：<a href="https://github.com/spring-projects/spring-ai">https://github.com/spring-projects/spring-ai</a></li>
    <li>Spring AI Examples：<a href="https://github.com/spring-projects/spring-ai-examples">https://github.com/spring-projects/spring-ai-examples</a></li>
    <li>Spring AI Alibaba：<a href="https://github.com/alibaba/spring-ai-alibaba">https://github.com/alibaba/spring-ai-alibaba</a></li>
    <li>Spring AI Alibaba Examples：<a href="https://github.com/spring-ai-alibaba/examples">https://github.com/spring-ai-alibaba/examples</a></li>
    <li>LangChain4j Documentation：<a href="https://docs.langchain4j.dev/">https://docs.langchain4j.dev/</a></li>
    <li>LangChain4j Examples：<a href="https://github.com/langchain4j/langchain4j-examples">https://github.com/langchain4j/langchain4j-examples</a></li>
    <li>MCP Java SDK：<a href="https://github.com/modelcontextprotocol/java-sdk">https://github.com/modelcontextprotocol/java-sdk</a></li>
    <li>OpenAI Java SDK：<a href="https://github.com/openai/openai-java">https://github.com/openai/openai-java</a></li>
    <li>OpenAI API Documentation：<a href="https://platform.openai.com/docs">https://platform.openai.com/docs</a></li>
    <li>OpenSquilla：<a href="https://github.com/opensquilla/opensquilla">https://github.com/opensquilla/opensquilla</a></li>
    <li>Dify：<a href="https://github.com/langgenius/dify">https://github.com/langgenius/dify</a></li>
    <li>RAGFlow：<a href="https://github.com/infiniflow/ragflow">https://github.com/infiniflow/ragflow</a></li>
  </ul>
</body>
</html>`;

const manifest = {
  title: "Java AI 应用开发课程 - Codex 版",
  generatedAt,
  version: "v6",
  maintenanceMode: "Append content to Markdown/HTML source, then regenerate the same PDF.",
  targetDirectory: "D:\\acme\\AI-Learning\\codex版",
  sourceReferences: [
    "https://docs.spring.io/spring-ai/reference/",
    "https://docs.spring.io/spring-ai/reference/api/chatclient.html",
    "https://docs.spring.io/spring-ai/reference/api/tools.html",
    "https://github.com/spring-projects/spring-ai",
    "https://github.com/spring-projects/spring-ai-examples",
    "https://github.com/alibaba/spring-ai-alibaba",
    "https://github.com/spring-ai-alibaba/examples",
    "https://docs.langchain4j.dev/",
    "https://github.com/langchain4j/langchain4j",
    "https://github.com/langchain4j/langchain4j-examples",
    "https://github.com/modelcontextprotocol/java-sdk",
    "https://github.com/openai/openai-java",
    "https://platform.openai.com/docs",
    "https://github.com/opensquilla/opensquilla",
    "https://github.com/langgenius/dify",
    "https://github.com/infiniflow/ragflow",
    "https://www.oreilly.com/library/view/ai-engineering/9781098166298/",
    "https://www.oreilly.com/library/view/designing-machine-learning-systems/9781098107956/",
    "https://www.packtpub.com/en-us/product/llm-engineers-handbook-9781836200079",
    "https://www.manning.com/books/build-a-large-language-model-from-scratch",
    "https://www.manning.com/books/spring-ai-in-action"
  ]
};

const mdPath = path.join(outDir, "Java_AI应用开发课程.md");
const htmlPath = path.join(outDir, "Java_AI应用开发课程.html");
const pdfPath = path.join(outDir, "Java_AI应用开发课程.pdf");
const manifestPath = path.join(outDir, "course-manifest.json");

fs.writeFileSync(mdPath, markdown, "utf8");
fs.writeFileSync(htmlPath, html, "utf8");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
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
    footerTemplate: `<div style="font-family: Microsoft YaHei, sans-serif; width: 100%; font-size: 9px; color: #789; padding: 0 14mm; display: flex; justify-content: space-between;"><span>Java AI 应用开发课程 - Codex 版</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "15mm", right: "14mm", bottom: "18mm", left: "14mm" }
  });
  await browser.close();
  console.log(JSON.stringify({ outDir, mdPath, htmlPath, pdfPath, manifestPath }, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
