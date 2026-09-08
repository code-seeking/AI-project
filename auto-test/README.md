# Auto-Test — Playwright 全栈自动化测试套件

> 54 个 UI 测试 + 44 个 API 测试，100% 通过率。企业级 Playwright 测试工程实践参考。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 这是什么？

一套**生产级的 Playwright 自动化测试套件**，覆盖 HR 候选人 AI 管理系统的完整前端页面和后端 API。

如果你正在寻找以下场景的参考实现，这个项目值得参考：
- 如何用 Playwright 做**大规模 UI 自动化测试**（54 个用例）
- 如何用 Playwright 做**API 接口测试**（44 个用例）
- 如何组织测试目录结构、配置多浏览器、生成截图证据和 HTML 报告

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Playwright | 1.60.0 | 测试框架（UI + API） |
| TypeScript | 5.x | 测试代码编写 |
| Node.js | 18+ | 运行环境 |

**被测系统：**

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite + Element Plus + TypeScript |
| 后端 | Spring Boot 3 + MyBatis-Plus |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis |

## 测试覆盖

### UI 页面测试（54 个用例）

| 测试文件 | 页面 | 用例数 |
|----------|------|--------|
| `candidate-ui.spec.ts` | 人才库列表页 | 11 |
| `candidate-detail.spec.ts` | 候选人详情页 | 13 |
| `analysis-report.spec.ts` | 智能分析报告页 | 8 |
| `daily-report.spec.ts` | 每日洞察报告页 | 14 |
| `dashboard.spec.ts` | 全景数据驾驶舱 | 8 |

### API 接口测试（44 个用例）

| 测试文件 | 接口模块 | 用例数 |
|----------|---------|--------|
| `candidate.spec.ts` | 候选人 CRUD | 185 行 |
| `position.spec.ts` | 岗位管理 | 111 行 |
| `matching.spec.ts` | 人岗匹配 | 182 行 |
| `interview.spec.ts` | 面试管理 | 177 行 |
| `report.spec.ts` | 报告生成 | 133 行 |
| `chat.spec.ts` | AI 对话 | 66 行 |
| `workflow.spec.ts` | 工作流 | 100 行 |

## 项目结构

```
auto-test/
├── playwright.config.ts          # API 测试配置
├── playwright.ui.config.ts       # UI 测试配置
├── package.json                  # 依赖声明
├── 自动化测试说明.md              # 完整操作手册（650+ 行）
├── tests/
│   ├── ui/                       # UI 页面测试（5 个 spec）
│   │   ├── candidate-ui.spec.ts
│   │   ├── candidate-detail.spec.ts
│   │   ├── analysis-report.spec.ts
│   │   ├── daily-report.spec.ts
│   │   └── dashboard.spec.ts
│   ├── candidate.spec.ts         # API 测试
│   ├── position.spec.ts
│   ├── matching.spec.ts
│   ├── interview.spec.ts
│   ├── report.spec.ts
│   ├── chat.spec.ts
│   └── workflow.spec.ts
└── test-results/
    ├── test-report.html          # 专业测试报告
    ├── ui-results.json           # JSON 格式结果
    ├── ui-report/                # Playwright HTML 交互式报告
    └── ui-screenshots/           # 84 张截图证据
```

## 快速开始

```bash
# 安装依赖
npm install

# 运行 UI 测试
npx playwright test --config=playwright.ui.config.ts

# 运行 API 测试
npx playwright test

# 查看 HTML 报告
npx playwright show-report test-results/ui-report
```

## 亮点特性

- **双配置分离**：UI 测试和 API 测试使用独立配置文件，互不干扰
- **截图证据**：每个测试步骤自动截图，共 84 张截图作为测试证据
- **HTML 交互式报告**：Playwright 原生报告 + 自定义报告双输出
- **完整操作手册**：650+ 行中文文档，覆盖环境搭建、用例设计、报告查看、FAQ
- **Page Object 模式**：UI 测试采用 POM 设计模式，可维护性强
- **迁移指南**：包含"如何迁移到新项目"章节，方便复用

## 适合谁？

- 正在为 Vue 3 / Element Plus 项目编写 E2E 测试
- 想用 Playwright 做 API 测试（不只是 UI）
- 需要企业级测试工程化参考（目录结构、报告、截图）
- 想了解如何组织 100+ 个测试用例的项目

## 技术关键词

`Playwright` `E2E Testing` `UI Automation` `API Testing` `TypeScript` `Vue 3` `Element Plus` `Test Automation` `CI/CD` `Screenshot Evidence` `HTML Report`

## License

MIT
