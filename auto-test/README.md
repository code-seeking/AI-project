# Auto-Test — Playwright 全栈自动化测试框架

> 企业级 Playwright + TypeScript 测试工程化框架，开箱即用的 API 封装、类型定义和工具函数。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 这是什么？

一套**可复用的 Playwright 自动化测试框架**，提供完整的工程化基础设施：

- **API 客户端封装**：7 个模块的 API 调用层，开箱即用
- **TypeScript 类型定义**：完整的业务类型系统
- **测试工具函数**：断言增强、日志记录、轮询等待
- **测试数据工厂**：数据生成与清理工具
- **双配置支持**：UI 测试和 API 测试独立配置

将本框架复制到你的项目中，只需编写测试用例即可，基础设施已全部就绪。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Playwright | 1.60.0 | 测试框架（UI + API） |
| TypeScript | 5.x | 测试代码编写 |
| Node.js | 18+ | 运行环境 |

## 项目结构

```
auto-test/
├── playwright.config.ts          # API 测试配置
├── playwright.ui.config.ts       # UI 测试配置
├── tsconfig.json                 # TypeScript 配置
├── package.json                  # 依赖声明
├── wait-backend.ps1              # 等待后端服务就绪脚本
└── src/
    ├── api/                      # API 客户端封装（7 个模块）
    │   ├── api-client.ts         # 基础 HTTP 客户端
    │   ├── candidate.api.ts      # 候选人接口
    │   ├── position.api.ts       # 岗位接口
    │   ├── matching.api.ts       # 匹配接口
    │   ├── interview.api.ts      # 面试接口
    │   ├── report.api.ts         # 报告接口
    │   ├── chat.api.ts           # 聊天接口
    │   └── workflow.api.ts       # 工作流接口
    ├── types/                    # TypeScript 类型定义
    │   ├── api.types.ts          # 通用 API 类型
    │   ├── candidate.types.ts    # 候选人类型
    │   ├── position.types.ts     # 岗位类型
    │   ├── matching.types.ts     # 匹配类型
    │   ├── interview.types.ts    # 面试类型
    │   ├── report.types.ts       # 报告类型
    │   ├── chat.types.ts         # 聊天类型
    │   ├── workflow.types.ts     # 工作流类型
    │   └── index.ts              # 类型统一导出
    ├── fixtures/                 # 测试数据工具
    │   ├── test-data.factory.ts  # 测试数据工厂
    │   └── test-data.cleanup.ts  # 测试数据清理
    └── helpers/                  # 工具函数
        ├── assertions.ts         # 自定义断言
        ├── logger.ts             # 测试日志
        └── poller.ts             # 轮询等待
```

## 快速开始

```bash
# 安装依赖
npm install

# 编写你的测试用例（放在 tests/ 目录下）

# 运行 UI 测试
npx playwright test --config=playwright.ui.config.ts

# 运行 API 测试
npx playwright test

# 查看 HTML 报告
npx playwright show-report
```

## 核心模块说明

### API 客户端（src/api/）

每个业务模块都有独立的 API 封装，基于统一的 `api-client.ts`：

```typescript
import { candidateApi } from './src/api/candidate.api'

// 直接使用封装好的 API 方法
const candidates = await candidateApi.getList()
```

### 类型定义（src/types/）

完整的 TypeScript 类型系统，覆盖所有业务实体：

```typescript
import type { Candidate, Position, MatchingResult } from './src/types'
```

### 工具函数（src/helpers/）

- **assertions.ts**：自定义断言，简化常见验证逻辑
- **logger.ts**：结构化测试日志，便于调试
- **poller.ts**：智能轮询等待，处理异步操作

### 测试数据（src/fixtures/）

- **test-data.factory.ts**：工厂模式生成测试数据
- **test-data.cleanup.ts**：测试后自动清理数据

## 如何迁移到你的项目

1. 复制 `src/` 目录到你的项目
2. 复制 `playwright.config.ts` 和 `playwright.ui.config.ts`
3. 复制 `package.json` 中的依赖
4. 根据实际业务修改 `src/api/` 和 `src/types/`
5. 在 `tests/` 目录下编写你的测试用例

## 适合谁？

- 正在为 Vue 3 / Element Plus 项目搭建 E2E 测试框架
- 想用 Playwright 做 API 测试（不只是 UI）
- 需要 TypeScript 类型安全的测试代码
- 想要可复用的测试基础设施，快速启动新项目

## 技术关键词

`Playwright` `E2E Testing` `UI Automation` `API Testing` `TypeScript` `Vue 3` `Element Plus` `Test Framework` `CI/CD` `Test Engineering`

## License

MIT
