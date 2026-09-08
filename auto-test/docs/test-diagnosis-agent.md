# 自动化测试诊断与回归 Agent

## 已集成能力

脚本 scripts/test-diagnosis-agent.cjs 读取 Playwright JSON 结果，生成以下文件：

- test-results/agent-report.json
- test-results/agent-report.md
- agent-data/diagnosis-history.json

它会识别结果文件损坏、超时或异步轮询问题、前后端服务不可用、UI 定位器或页面渲染问题、API 契约问题和测试数据问题。

Agent 默认只读证据并生成建议，不修改业务代码、不自动提交、不自动弱化断言。历史库保留最近 200 条失败指纹；同一失败再次出现时，会在报告中标记出现次数和上次发生时间。

## 命令

只诊断最近一次 UI 报告：

    node scripts/test-diagnosis-agent.cjs test-results/ui-results.json

执行 UI 测试后诊断：

    npm run test:ui:diagnose

执行 API 测试后诊断：

    npm run test:api:diagnose

只读取默认结果文件：

    npm run agent:diagnose

## 工作流

    Playwright 测试
        -> JSON / JUnit / 截图 / Trace
        -> TestDiagnosisAgent
        -> 失败分类和证据摘要
        -> 修复建议和最小回归测试集
        -> 人工确认
        -> 手工或 CI 重跑

当前版本先使用确定性诊断规则，保证无 AI 密钥时也可运行。后续接入模型时，模型只负责补充根因摘要，不能绕过人工确认。
