# Chat Portal — AI 驱动的全栈个人效率门户

> Vue 3 + Node.js + Chrome 扩展，集成 AI 助手、代码生成、书签管理、工作日志、Agent 协作、MCP 协议的个人效率平台。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 这是什么？

Chat Portal 是一个**全栈 AI 效率平台**，不只是聊天机器人——它把 AI 能力嵌入到日常工作流的每个环节：

- **AI 助手**：主动推送建议，且每条建议都能**一键执行**（不只是文字）
- **代码生成引擎**：根据关键词自动生成 Java/Spring Boot 代码模板（CRUD、钉钉推送、定时任务等）
- **书签管理**：AI 自动分类整理浏览器书签
- **工作日志**：记录每日工作，AI 自动生成小结
- **Agent 协作网络**：多 Agent 分工（搜索、分析、规划、记忆、编码）
- **Chrome 扩展**：悬浮球形式，在任何网页上快速访问
- **MCP 协议支持**：通过 Model Context Protocol 连接外部工具

## 技术架构

```
chat-portal/
├── frontend/          # Vue 3 + Vite + Element Plus 前端 (端口 5174)
│   └── src/
│       ├── App.vue              # 主组件（4000+ 行，含全部高阶功能）
│       ├── api/                 # API 调用层（1000+ 行）
│       ├── components/          # 功能组件
│       │   ├── AIGatewayPanel.vue    # AI 网关面板
│       │   ├── AgentMeshPanel.vue    # Agent 协作网络
│       │   ├── CodingWorkspace.vue   # 代码工作空间
│       │   ├── PluginStore.vue       # 插件商店
│       │   ├── TeamSpace.vue         # 团队协作
│       │   └── LoginView.vue         # 登录页
│       ├── stores/              # Pinia 状态管理
│       └── types/               # TypeScript 类型定义
├── backend/           # Node.js Express 后端 (端口 3001)
│   ├── server.js              # 主服务（含代码生成引擎）
│   ├── ai-gateway.js          # AI 网关（多模型路由）
│   ├── agent-mesh.js          # Agent 协作网络
│   ├── agent-memory.js        # Agent 记忆系统
│   ├── coding-workspace.js    # 代码工作空间服务
│   ├── desktop-agent.js       # 桌面 Agent
│   ├── mcp-client.js          # MCP 客户端
│   ├── mcp-server.js          # MCP 服务端
│   ├── monitor.js             # 系统监控
│   ├── multimodal.js          # 多模态处理
│   ├── analytics.js           # 数据分析
│   ├── auth.js                # 认证授权
│   └── db.js                  # 数据库层
└── chrome-extension/  # Chrome 浏览器扩展 (Manifest V3)
    ├── manifest.json
    ├── background.js          # Service Worker
    └── content.js             # 内容脚本（悬浮球 UI）
```

## 核心功能

### 1. AI 助手 — 从"被动建议"到"一键执行"

传统 AI 助手只告诉你"建议做 XX"，Chat Portal 的每条建议都附带**可执行操作**：

| 建议类型 | 一键操作 |
|---------|---------|
| 📝 记录工作 | 内嵌输入框 + 分类选择 + 一键记录 |
| 📚 整理书签 | AI 自动分类，一键整理 |
| 📊 生成小结 | 自动汇总今日工作日志 |
| ⏰ 定时触发器 | 支持定时/条件/手动三种触发 |

### 2. 代码生成引擎

无需 AI 服务也能本地生成可用代码（Java 优先）：

| 关键词 | 生成内容 |
|--------|---------|
| 钉钉/dingtalk | 钉钉 Webhook 推送（Java RestTemplate） |
| 微信/wechat | 企业微信消息推送 |
| CRUD/增删改查 | Spring Boot + MyBatis-Plus 全套 |
| 文件/上传/下载 | MultipartFile 上传 + 下载 |
| 定时/cron | @Scheduled 定时任务 |
| API/接口 | 通用 REST API 调用封装 |

### 3. Agent 协作网络

多个专业 Agent 分工协作：
- **搜索 Agent**：信息检索与汇总
- **分析 Agent**：数据分析与洞察
- **规划 Agent**：任务拆解与排期
- **记忆 Agent**：上下文持久化
- **编码 Agent**：代码生成与调试

### 4. MCP 协议支持

通过 Model Context Protocol 标准化连接外部系统：
- MCP Client：调用外部 MCP 工具
- MCP Server：将自身能力暴露为 MCP 服务

### 5. Chrome 扩展

Manifest V3 浏览器扩展，在所有网页上显示悬浮球：
- 快速访问书签
- 一键记录当前页面
- 无需切换标签页

## 快速开始

```bash
# 后端
cd backend
npm install
node server.js    # 启动在 :3001

# 前端
cd frontend
npm install
npm run dev       # 启动在 :5174

# Chrome 扩展
# Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序 → 选择 chrome-extension/ 目录
```

## 设计亮点

- **降级策略**：AI 服务不可用时，本地代码生成引擎 + JSON 文件存储自动接管
- **Java 优先**：代码生成默认输出 Java/Spring Boot 代码
- **一键执行**：所有 AI 建议必须附带可执行操作
- **触发器系统**：定时/条件/手动三种触发模式
- **MCP 双向**：既是 MCP Client 也是 MCP Server

## 适合谁？

- 想学习 Vue 3 + Node.js 全栈开发
- 对 AI Agent 架构设计感兴趣
- 想了解 MCP（Model Context Protocol）的实际应用
- 需要一个 AI 驱动的个人效率工具
- 想参考 Chrome 扩展开发（Manifest V3）

## 技术关键词

`Vue 3` `Node.js` `Express` `TypeScript` `Element Plus` `AI Assistant` `Code Generation` `Chrome Extension` `MCP` `Agent` `Bookmark Manager` `Full-Stack` `Productivity`

## License

MIT
