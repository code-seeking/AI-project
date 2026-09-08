/**
 * Tool Registry - 工具注册表
 * 将 AI Portal 的所有能力统一注册为 Tool，供 Agent Orchestrator 调用
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')

// --- 通用工具函数 ---
function readJSON(file, def = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// --- 文件路径 ---
const WORKLOGS_FILE = path.join(DATA_DIR, 'worklogs.json')
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json')
const BOOKMARKS_FILE = path.join(DATA_DIR, 'bookmarks.json')
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json')
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json')
const DINGTALK_CONFIG_FILE = path.join(DATA_DIR, 'dingtalk-config.json')
const GIT_CONFIG_FILE = path.join(DATA_DIR, 'git-config.json')
const FS_CONFIG_FILE = path.join(DATA_DIR, 'fs-config.json')
const KNOWLEDGE_DIR = path.join(DATA_DIR, 'knowledge')
const DOCUMENTS_FILE = path.join(KNOWLEDGE_DIR, 'documents.json')

// --- 工具注册表 ---
const tools = new Map()

/**
 * 注册一个工具
 */
function registerTool(tool) {
  tools.set(tool.name, tool)
}

/**
 * 获取所有工具（供 LLM 选择）
 */
function getToolDefinitions() {
  return Array.from(tools.values()).map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters
  }))
}

/**
 * 执行指定工具
 */
async function executeTool(name, params, context = {}) {
  const tool = tools.get(name)
  if (!tool) throw new Error(`未知工具: ${name}`)
  return await tool.handler(params, context)
}

// ======================================================================
// 注册内置工具
// ======================================================================

// 需要延迟注入的依赖（由 server.js 注入）
let _callLLM = null
let _exec = null

function injectDependencies({ callLLM, exec }) {
  _callLLM = callLLM
  _exec = exec
}

// --- LLM 对话 ---
registerTool({
  name: 'llm_chat',
  description: '调用 AI 大模型进行对话，可用于生成文本、分析内容、翻译等',
  parameters: { prompt: 'string (必填，发送给AI的内容)', systemPrompt: 'string? (可选，系统角色设定)' },
  handler: async (params) => {
    if (!_callLLM) return '(LLM 未初始化)'
    const reply = await _callLLM(params.systemPrompt || '你是一个智能助手，请用中文回答。', params.prompt)
    return reply || '(LLM 不可用)'
  }
})

// --- 工作日志查询 ---
registerTool({
  name: 'worklog_query',
  description: '查询工作日志记录，可按日期范围和分类筛选',
  parameters: { date: 'string? (日期 YYYY-MM-DD，默认今天)', category: 'string? (分类筛选)' },
  handler: async (params) => {
    const logs = readJSON(WORKLOGS_FILE, [])
    const date = params.date || new Date().toISOString().slice(0, 10)
    let filtered = logs.filter(l => l.date === date)
    if (params.category) filtered = filtered.filter(l => l.category === params.category)
    if (filtered.length === 0) return `${date} 没有工作记录。`
    return filtered.map(l => `[${l.time || '--:--'}] ${l.content} (${l.category || '其他'})`).join('\n')
  }
})

// --- 工作日志添加 ---
registerTool({
  name: 'worklog_add',
  description: '添加一条工作日志记录',
  parameters: { content: 'string (工作内容)', category: 'string? (分类：开发/会议/文档/其他)' },
  handler: async (params) => {
    const logs = readJSON(WORKLOGS_FILE, [])
    const now = new Date()
    const entry = {
      id: genId(),
      content: params.content,
      category: params.category || '其他',
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      createdAt: now.toISOString()
    }
    logs.push(entry)
    writeJSON(WORKLOGS_FILE, logs)
    return `已记录: [${entry.time}] ${params.content} (${entry.category})`
  }
})

// --- 书签搜索 ---
registerTool({
  name: 'bookmark_search',
  description: '搜索书签，按关键词匹配标题和URL',
  parameters: { keyword: 'string (搜索关键词)' },
  handler: async (params) => {
    const bookmarks = readJSON(BOOKMARKS_FILE, [])
    const kw = (params.keyword || '').toLowerCase()
    const results = bookmarks.filter(b =>
      (b.keyword || '').toLowerCase().includes(kw) ||
      (b.url || '').toLowerCase().includes(kw)
    ).slice(0, 10)
    if (results.length === 0) return `未找到匹配 "${params.keyword}" 的书签。`
    return results.map(b => `- ${b.keyword}: ${b.url}`).join('\n')
  }
})

// --- 书签分类 ---
registerTool({
  name: 'bookmark_classify',
  description: '使用 AI 对未分类书签进行智能分类',
  parameters: {},
  handler: async (params, context) => {
    // 调用内部分类 API
    try {
      const resp = await fetch(`http://localhost:3001/api/classify/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await resp.json()
      return data.code === 200 ? '书签分类完成。' : `分类失败: ${data.message}`
    } catch (e) {
      return `分类服务不可用: ${e.message}`
    }
  }
})

// --- 知识库查询 ---
registerTool({
  name: 'knowledge_query',
  description: '在知识库中搜索相关文档片段',
  parameters: { query: 'string (查询内容)' },
  handler: async (params) => {
    try {
      const resp = await fetch(`http://localhost:3001/api/knowledge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: params.query })
      })
      const data = await resp.json()
      if (data.code === 200 && data.data?.length > 0) {
        return data.data.map(d => `[${d.title || '文档'}] ${d.content?.slice(0, 200)}`).join('\n---\n')
      }
      return '知识库中未找到相关内容。'
    } catch (e) {
      return `知识库查询失败: ${e.message}`
    }
  }
})

// --- 知识库添加 ---
registerTool({
  name: 'knowledge_add',
  description: '向知识库添加一条知识/笔记',
  parameters: { title: 'string (标题)', content: 'string (内容)', category: 'string? (分类)' },
  handler: async (params) => {
    const docs = readJSON(DOCUMENTS_FILE, [])
    const doc = {
      id: genId(),
      title: params.title,
      content: params.content,
      category: params.category || '通用',
      createdAt: new Date().toISOString()
    }
    docs.push(doc)
    writeJSON(DOCUMENTS_FILE, docs)
    return `已添加到知识库: [${params.title}]`
  }
})

// --- 钉钉发送 ---
registerTool({
  name: 'dingtalk_send',
  description: '发送钉钉群消息（需已配置 Webhook）',
  parameters: { message: 'string (消息内容)', title: 'string? (消息标题)' },
  handler: async (params) => {
    const config = readJSON(DINGTALK_CONFIG_FILE, {})
    if (!config.webhookUrl) return '钉钉未配置，请先在高阶能力-集成中配置 Webhook URL。'
    try {
      let url = config.webhookUrl
      if (config.secret) {
        const crypto = require('crypto')
        const timestamp = Date.now()
        const sign = crypto.createHmac('sha256', config.secret).update(`${timestamp}\n${config.secret}`).digest('base64')
        url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
      }
      const body = JSON.stringify({ msgtype: 'markdown', markdown: { title: params.title || '通知', text: params.message } })
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(10000) })
      const result = await resp.json()
      return result.errcode === 0 ? '钉钉消息发送成功。' : `钉钉发送失败: ${result.errmsg}`
    } catch (e) {
      return `钉钉发送异常: ${e.message}`
    }
  }
})

// --- Git 操作 ---
registerTool({
  name: 'git_exec',
  description: '执行 Git 命令 (status/log/pull/diff/branch)',
  parameters: { action: 'string (操作: status|log|pull|diff|branch)' },
  handler: async (params) => {
    const config = readJSON(GIT_CONFIG_FILE, {})
    if (!config.repoPath) return 'Git 未配置，请先设置仓库路径。'
    const commands = { status: 'git status --short', log: 'git log --oneline -10', pull: 'git pull', diff: 'git diff --stat', branch: 'git branch -a' }
    const cmd = commands[params.action]
    if (!cmd) return `不支持的 Git 操作: ${params.action}`
    return new Promise((resolve) => {
      _exec(cmd, { cwd: config.repoPath, timeout: 30000 }, (err, stdout, stderr) => {
        if (err) resolve(`Git 操作失败: ${stderr || err.message}`)
        else resolve(stdout || '(无输出)')
      })
    })
  }
})

// --- 文件系统读取 ---
registerTool({
  name: 'fs_read',
  description: '读取本地文件内容（需在允许目录内）',
  parameters: { file: 'string (文件完整路径)' },
  handler: async (params) => {
    const config = readJSON(FS_CONFIG_FILE, { allowedDirs: [] })
    const resolved = path.resolve(params.file)
    const allowed = config.allowedDirs.some(dir => resolved.startsWith(path.resolve(dir)))
    if (!allowed) return `路径不在允许范围内。允许的目录: ${config.allowedDirs.join(', ') || '(未配置)'}`
    try {
      const content = fs.readFileSync(resolved, 'utf-8')
      return content.slice(0, 2000) + (content.length > 2000 ? '\n...(已截断)' : '')
    } catch (e) {
      return `读取失败: ${e.message}`
    }
  }
})

// --- 文件系统写入 ---
registerTool({
  name: 'fs_write',
  description: '写入内容到本地文件（需在允许目录内）',
  parameters: { file: 'string (文件完整路径)', content: 'string (写入内容)' },
  handler: async (params) => {
    const config = readJSON(FS_CONFIG_FILE, { allowedDirs: [] })
    const resolved = path.resolve(params.file)
    const allowed = config.allowedDirs.some(dir => resolved.startsWith(path.resolve(dir)))
    if (!allowed) return `路径不在允许范围内。`
    try {
      const dir = path.dirname(resolved)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(resolved, params.content, 'utf-8')
      return `文件已写入: ${resolved}`
    } catch (e) {
      return `写入失败: ${e.message}`
    }
  }
})

// --- 文件搜索 ---
registerTool({
  name: 'fs_search',
  description: '在指定目录中搜索文件名',
  parameters: { dir: 'string (搜索目录)', keyword: 'string (文件名关键词)' },
  handler: async (params) => {
    const config = readJSON(FS_CONFIG_FILE, { allowedDirs: [] })
    const resolved = path.resolve(params.dir)
    const allowed = config.allowedDirs.some(dir => resolved.startsWith(path.resolve(dir)))
    if (!allowed) return `路径不在允许范围内。`
    const results = []
    function walk(d, depth) {
      if (depth > 4 || results.length >= 20) return
      try {
        const items = fs.readdirSync(d, { withFileTypes: true })
        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue
          if (item.name.toLowerCase().includes((params.keyword || '').toLowerCase())) {
            results.push(path.join(d, item.name))
          }
          if (item.isDirectory()) walk(path.join(d, item.name), depth + 1)
        }
      } catch {}
    }
    walk(resolved, 0)
    return results.length > 0 ? results.join('\n') : `未找到匹配 "${params.keyword}" 的文件。`
  }
})

// --- 记忆查询 ---
registerTool({
  name: 'memory_query',
  description: '查询已记住的用户偏好和事实',
  parameters: { keyword: 'string? (筛选关键词)' },
  handler: async (params) => {
    const memories = readJSON(MEMORY_FILE, [])
    let filtered = memories
    if (params.keyword) {
      const kw = params.keyword.toLowerCase()
      filtered = memories.filter(m => (m.content || '').toLowerCase().includes(kw))
    }
    if (filtered.length === 0) return '没有找到相关记忆。'
    return filtered.slice(0, 15).map(m => `- [${m.category}] ${m.content}`).join('\n')
  }
})

// --- 记忆添加 ---
registerTool({
  name: 'memory_add',
  description: '记住一条新的用户偏好或事实',
  parameters: { content: 'string (要记住的内容)', category: 'string? (分类: general/tech/work/tools/personal)' },
  handler: async (params) => {
    const memories = readJSON(MEMORY_FILE, [])
    memories.push({
      id: genId(),
      content: params.content,
      category: params.category || 'general',
      source: 'agent',
      createdAt: new Date().toISOString()
    })
    writeJSON(MEMORY_FILE, memories)
    return `已记住: ${params.content}`
  }
})

// --- 执行工作流 ---
registerTool({
  name: 'workflow_run',
  description: '执行指定的工作流',
  parameters: { workflowId: 'string (工作流ID)', input: 'string? (输入内容)' },
  handler: async (params) => {
    try {
      const resp = await fetch(`http://localhost:3001/api/workflows/${params.workflowId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: params.input || '' })
      })
      const data = await resp.json()
      if (data.code === 200) {
        return `工作流执行${data.data.success ? '成功' : '部分失败'}，耗时 ${data.data.totalDuration}ms`
      }
      return `工作流执行失败: ${data.message}`
    } catch (e) {
      return `工作流执行异常: ${e.message}`
    }
  }
})

// --- 发送通知 ---
registerTool({
  name: 'notify_send',
  description: '发送一条站内通知',
  parameters: { message: 'string (通知内容)', type: 'string? (类型: workflow/dingtalk/system)' },
  handler: async (params) => {
    const notifications = readJSON(NOTIFICATIONS_FILE, [])
    notifications.unshift({
      id: genId(),
      type: params.type || 'system',
      message: params.message,
      read: false,
      createdAt: new Date().toISOString()
    })
    writeJSON(NOTIFICATIONS_FILE, notifications)
    return `通知已发送: ${params.message.slice(0, 50)}`
  }
})

// --- 获取工作流列表 ---
registerTool({
  name: 'workflow_list',
  description: '获取所有已定义的工作流列表',
  parameters: {},
  handler: async () => {
    const workflows = readJSON(WORKFLOWS_FILE, [])
    if (workflows.length === 0) return '暂无工作流。'
    return workflows.map(w => `- [${w.id}] ${w.name} (${w.enabled ? '启用' : '停用'}) - ${w.description}`).join('\n')
  }
})

// ==================== 桌面自动化工具 ====================
const desktopAgent = require('./desktop-agent')

registerTool({
  name: 'desktop_screenshot',
  description: '截取当前屏幕，返回截图 base64',
  parameters: { target: 'string?' },
  handler: async (params) => {
    const result = await desktopAgent.takeScreenshot(params.target || 'fullscreen')
    if (!result.success) return `截屏失败: ${result.error}`
    return `截屏成功 (${result.screenSize.width}x${result.screenSize.height})，图片已捕获。`
  }
})

registerTool({
  name: 'desktop_click',
  description: '在屏幕指定坐标点击鼠标',
  parameters: { x: 'number', y: 'number', button: 'string?' },
  handler: async (params) => {
    const result = await desktopAgent.executeActions([{ type: 'click', x: params.x, y: params.y, button: params.button || 'left' }])
    return result.success ? `已点击 (${params.x}, ${params.y})` : `点击失败: ${JSON.stringify(result.results)}`
  }
})

registerTool({
  name: 'desktop_type',
  description: '在当前焦点位置输入文本',
  parameters: { text: 'string' },
  handler: async (params) => {
    const result = await desktopAgent.executeActions([{ type: 'type', text: params.text }])
    return result.success ? `已输入: "${params.text.slice(0, 30)}"` : `输入失败`
  }
})

registerTool({
  name: 'desktop_hotkey',
  description: '执行键盘快捷键，如 ctrl+s, alt+tab',
  parameters: { keys: 'string' },
  handler: async (params) => {
    const keys = params.keys.split('+').map(k => k.trim())
    const result = await desktopAgent.executeActions([{ type: 'hotkey', keys }])
    return result.success ? `已执行快捷键: ${params.keys}` : `快捷键执行失败`
  }
})

registerTool({
  name: 'desktop_find_element',
  description: '截屏并分析 UI 元素，找到指定目标的坐标',
  parameters: { instruction: 'string' },
  handler: async (params) => {
    const screenshot = await desktopAgent.takeScreenshot('fullscreen')
    if (!screenshot.success) return `截屏失败: ${screenshot.error}`
    const analysis = await desktopAgent.analyzeUI(screenshot.image, params.instruction, _callLLM)
    if (!analysis.success) return `UI 分析失败: ${analysis.error}`
    if (analysis.elements.length === 0) return '未找到匹配的 UI 元素'
    const el = analysis.elements[0]
    return `找到元素: ${el.label} (${el.type}) 坐标: (${el.bbox?.x}, ${el.bbox?.y}) 置信度: ${el.confidence}`
  }
})

module.exports = {
  registerTool,
  getToolDefinitions,
  executeTool,
  injectDependencies,
  tools
}
