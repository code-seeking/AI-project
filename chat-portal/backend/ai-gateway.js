/**
 * AI Gateway - 智能 AI 网关
 * 多模型路由、故障转移、成本追踪、Prompt 缓存
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const USAGE_FILE = path.join(DATA_DIR, 'ai-gateway-usage.json')
const CACHE_FILE = path.join(DATA_DIR, 'ai-gateway-cache.json')
const MODELS_FILE = path.join(DATA_DIR, 'ai-gateway-models.json')

// ===== 工具函数 =====
function readJSON(file, def = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ===== 14.1 模型配置 =====
const DEFAULT_MODELS = [
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    models: ['llama3', 'codellama', 'qwen2.5'],
    priority: 0,
    enabled: true,
    costPer1KTokens: 0,
    taskTypes: ['chat', 'code', 'explain', 'refactor', 'review'],
    status: 'unknown'
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini'],
    priority: 1,
    enabled: false,
    costPer1KTokens: 0.01,
    taskTypes: ['chat', 'code', 'explain'],
    status: 'unknown',
    apiKey: process.env.OPENAI_API_KEY || ''
  },
  {
    id: 'claude',
    name: 'Anthropic Claude 3.5',
    provider: 'claude',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus', 'claude-3-sonnet'],
    priority: 2,
    enabled: false,
    costPer1KTokens: 0.015,
    taskTypes: ['code', 'review', 'refactor'],
    status: 'unknown',
    apiKey: process.env.CLAUDE_API_KEY || ''
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-2.0-pro'],
    priority: 3,
    enabled: false,
    costPer1KTokens: 0.005,
    taskTypes: ['chat', 'explain'],
    status: 'unknown',
    apiKey: process.env.GEMINI_API_KEY || ''
  }
]

// 任务类型到模型偏好映射
const TASK_MODEL_MAP = {
  chat: ['ollama', 'openai', 'gemini'],
  code: ['ollama', 'claude', 'openai'],
  generate: ['ollama', 'claude', 'openai'],
  explain: ['ollama', 'openai', 'gemini'],
  refactor: ['ollama', 'claude', 'openai'],
  review: ['claude', 'ollama', 'openai']
}

// ===== 14.1 模型管理 =====
function getModels() {
  const custom = readJSON(MODELS_FILE, [])
  // 合并默认和自定义
  const merged = [...DEFAULT_MODELS]
  for (const c of custom) {
    const idx = merged.findIndex(m => m.id === c.id)
    if (idx >= 0) Object.assign(merged[idx], c)
    else merged.push(c)
  }
  return merged
}

function updateModel(id, config) {
  const models = readJSON(MODELS_FILE, [])
  const idx = models.findIndex(m => m.id === id)
  if (idx >= 0) Object.assign(models[idx], config)
  else models.push({ id, ...config })
  writeJSON(MODELS_FILE, models)
  return { success: true }
}

// ===== 14.1 健康检查 =====
async function checkModelHealth(model) {
  try {
    if (model.provider === 'ollama') {
      const res = await fetch(`${model.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return { status: 'online', latency: 0 }
      return { status: 'error', latency: 0 }
    }
    if (model.provider === 'openai') {
      if (!model.apiKey) return { status: 'no_key', latency: 0 }
      const res = await fetch(`${model.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${model.apiKey}` },
        signal: AbortSignal.timeout(5000)
      })
      return res.ok ? { status: 'online', latency: 0 } : { status: 'error', latency: 0 }
    }
    if (model.provider === 'claude') {
      if (!model.apiKey) return { status: 'no_key', latency: 0 }
      return { status: 'online', latency: 0 }
    }
    return { status: 'unknown', latency: 0 }
  } catch {
    return { status: 'offline', latency: 0 }
  }
}

async function checkAllModels() {
  const models = getModels()
  const results = await Promise.allSettled(models.filter(m => m.enabled).map(async m => {
    const health = await checkModelHealth(m)
    return { id: m.id, ...health }
  }))
  const statuses = {}
  for (const r of results) {
    if (r.status === 'fulfilled') statuses[r.value.id] = r.value.status
  }
  return statuses
}

// ===== 14.1 智能路由 =====
async function routeChat(messages, options = {}) {
  const { taskType = 'chat', preferredModel, temperature = 0.7, maxTokens = 2048 } = options
  const models = getModels().filter(m => m.enabled)
  if (models.length === 0) return { error: '没有可用的模型', content: '' }

  // 按偏好排序
  const preferredIds = preferredModel
    ? [preferredModel]
    : (TASK_MODEL_MAP[taskType] || TASK_MODEL_MAP.chat)

  const sorted = [...preferredIds, ...models.map(m => m.id)]
    .map(id => models.find(m => m.id === id))
    .filter(Boolean)
  const unique = [...new Map(sorted.map(m => [m.id, m])).values()]

  let lastError = ''
  for (const model of unique) {
    try {
      const result = await callModel(model, messages, { temperature, maxTokens })
      // 记录使用
      recordUsage({ model: model.id, taskType, tokens: result.tokens || 0, latency: result.latency || 0, success: true })
      return { content: result.content, model: model.id, tokens: result.tokens }
    } catch (err) {
      lastError = err.message
      recordUsage({ model: model.id, taskType, tokens: 0, latency: 0, success: false })
      console.warn(`[AIGateway] 模型 ${model.id} 失败: ${err.message}，尝试下一个...`)
    }
  }
  return { error: `所有模型均失败: ${lastError}`, content: '' }
}

async function callModel(model, messages, opts) {
  const start = Date.now()
  const { temperature, maxTokens } = opts

  if (model.provider === 'ollama') {
    const res = await fetch(`${model.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.models[0] || 'llama3',
        messages,
        stream: false,
        options: { temperature, num_predict: maxTokens }
      }),
      signal: AbortSignal.timeout(60000)
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}`)
    const data = await res.json()
    return { content: data.message?.content || '', tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0), latency: Date.now() - start }
  }

  if (model.provider === 'openai') {
    if (!model.apiKey) throw new Error('OpenAI API Key 未配置')
    const res = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${model.apiKey}` },
      body: JSON.stringify({ model: model.models[0] || 'gpt-4o', messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(60000)
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}`)
    const data = await res.json()
    return { content: data.choices?.[0]?.message?.content || '', tokens: data.usage?.total_tokens || 0, latency: Date.now() - start }
  }

  if (model.provider === 'claude') {
    if (!model.apiKey) throw new Error('Claude API Key 未配置')
    const systemMsg = messages.find(m => m.role === 'system')?.content || ''
    const userMsgs = messages.filter(m => m.role !== 'system')
    const res = await fetch(`${model.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': model.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: model.models[0] || 'claude-3-sonnet',
        max_tokens: maxTokens,
        system: systemMsg,
        messages: userMsgs
      }),
      signal: AbortSignal.timeout(60000)
    })
    if (!res.ok) throw new Error(`Claude ${res.status}`)
    const data = await res.json()
    return { content: data.content?.[0]?.text || '', tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0), latency: Date.now() - start }
  }

  throw new Error(`不支持的提供商: ${model.provider}`)
}

// ===== 14.1 通用生成 =====
async function generate(prompt, options = {}) {
  // 检查缓存
  const cacheKey = options.noCache ? null : hashPrompt(prompt)
  if (cacheKey) {
    const cached = getCached(cacheKey)
    if (cached) return { content: cached.content, model: 'cache', cached: true }
  }

  const result = await routeChat([{ role: 'user', content: prompt }], options)

  // 写入缓存
  if (cacheKey && result.content) {
    setCache(cacheKey, result.content)
  }

  return result
}

// ===== 14.2 成本与使用追踪 =====
function recordUsage(entry) {
  const usage = readJSON(USAGE_FILE, [])
  usage.push({
    ...entry,
    timestamp: new Date().toISOString()
  })
  // 保留最近 10000 条
  if (usage.length > 10000) usage.splice(0, usage.length - 10000)
  writeJSON(USAGE_FILE, usage)
}

function getUsage(period = 'day') {
  const usage = readJSON(USAGE_FILE, [])
  const now = new Date()
  let since = new Date(0)

  if (period === 'day') since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  else if (period === 'week') since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
  else if (period === 'month') since = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

  const filtered = usage.filter(u => new Date(u.timestamp) >= since)
  const byModel = {}
  for (const u of filtered) {
    if (!byModel[u.model]) byModel[u.model] = { calls: 0, successes: 0, failures: 0, totalTokens: 0, totalLatency: 0 }
    byModel[u.model].calls++
    if (u.success) byModel[u.model].successes++
    else byModel[u.model].failures++
    byModel[u.model].totalTokens += u.tokens || 0
    byModel[u.model].totalLatency += u.latency || 0
  }

  return {
    period,
    totalCalls: filtered.length,
    successRate: filtered.length > 0 ? (filtered.filter(u => u.success).length / filtered.length * 100).toFixed(1) + '%' : '0%',
    byModel,
    records: filtered.slice(-100).reverse()
  }
}

function getCosts() {
  const usage = readJSON(USAGE_FILE, [])
  const models = getModels()

  // 计算各模型成本
  const modelCostMap = {}
  for (const m of models) {
    modelCostMap[m.id] = m.costPer1KTokens || 0
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

  function calcCost(since) {
    const filtered = usage.filter(u => u.success && new Date(u.timestamp) >= since)
    let total = 0
    const byModel = {}
    for (const u of filtered) {
      const cost = ((u.tokens || 0) / 1000) * (modelCostMap[u.model] || 0)
      total += cost
      byModel[u.model] = (byModel[u.model] || 0) + cost
    }
    return { total: total.toFixed(4), byModel }
  }

  return {
    today: calcCost(today),
    week: calcCost(weekAgo),
    month: calcCost(monthAgo),
    total: calcCost(new Date(0)),
    models: modelCostMap
  }
}

// ===== 14.3 Prompt 缓存 =====
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟

function hashPrompt(prompt) {
  // 简单哈希：取前 100 字符的归一化
  const normalized = prompt.trim().toLowerCase().slice(0, 100)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return `cache_${hash}`
}

function getCached(key) {
  const cache = readJSON(CACHE_FILE, {})
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.time > CACHE_TTL) {
    delete cache[key]
    writeJSON(CACHE_FILE, cache)
    return null
  }
  return entry
}

function setCache(key, content) {
  const cache = readJSON(CACHE_FILE, {})
  cache[key] = { content, time: Date.now() }
  // 限制缓存大小
  const keys = Object.keys(cache)
  if (keys.length > 500) {
    delete cache[keys[0]]
  }
  writeJSON(CACHE_FILE, cache)
}

function clearCache() {
  writeJSON(CACHE_FILE, {})
  return { success: true }
}

// ===== Prompt 模板 =====
const PROMPT_TEMPLATES = {
  codeReview: `你是一个资深代码审查员。请审查以下代码变更。\n\n{{diff}}\n\n请从代码质量、安全性、性能、可维护性角度给出审查意见。`,
  codeExplain: `请解释以下 {{language}} 代码的功能和关键逻辑：\n\n\`\`\`{{language}}\n{{code}}\n\`\`\``,
  codeRefactor: `请重构以下 {{language}} 代码：\n\n\`\`\`{{language}}\n{{code}}\n\`\`\`\n\n要求：{{instruction}}`,
  commitMessage: `根据以下代码变更，生成一个简洁的 Git commit message。\n\n{{diff}}`
}

function applyTemplate(name, vars) {
  const template = PROMPT_TEMPLATES[name]
  if (!template) return ''
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

function getTemplates() {
  return Object.keys(PROMPT_TEMPLATES)
}

module.exports = {
  getModels,
  updateModel,
  checkAllModels,
  checkModelHealth,
  routeChat,
  generate,
  getUsage,
  getCosts,
  clearCache,
  applyTemplate,
  getTemplates
}
