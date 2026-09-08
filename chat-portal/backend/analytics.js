/**
 * Analytics Engine - 行为追踪 + 数据智能
 * 自动采集用户行为，生成仪表盘数据和 AI 洞察
 */
const fs = require('fs')
const path = require('path')

const EVENTS_FILE = path.join(__dirname, 'data', 'analytics-events.json')
const REPORTS_FILE = path.join(__dirname, 'data', 'analytics-reports.json')

/** 读取事件数据 */
function readEvents() {
  try { return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8')) } catch { return [] }
}

/** 保存事件 */
function saveEvents(events) {
  fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true })
  // 只保留最近 2000 条
  const trimmed = events.slice(-2000)
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(trimmed, null, 2))
}

/** 记录行为事件 */
function trackEvent(category, action, meta = {}) {
  const events = readEvents()
  events.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    category, // bookmark, chat, workflow, codegen, knowledge, plugin, orchestrator
    action,
    meta,
    timestamp: new Date().toISOString(),
    hour: new Date().getHours(),
    weekday: new Date().getDay()
  })
  saveEvents(events)
}

/** 获取仪表盘统计数据 */
function getDashboardStats() {
  const events = readEvents()
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now - 7 * 86400000).toISOString()

  const todayEvents = events.filter(e => e.timestamp.slice(0, 10) === todayStr)
  const weekEvents = events.filter(e => e.timestamp >= weekAgo)

  // 各类别统计
  const categoryCount = {}
  for (const e of weekEvents) {
    categoryCount[e.category] = (categoryCount[e.category] || 0) + 1
  }

  // 每小时活跃分布（热力图数据）
  const hourlyActivity = Array(24).fill(0)
  for (const e of todayEvents) {
    hourlyActivity[e.hour]++
  }

  // 每周每天分布
  const weekdayActivity = Array(7).fill(0)
  for (const e of weekEvents) {
    weekdayActivity[e.weekday]++
  }

  // 工具使用 Top5
  const toolUsage = {}
  for (const e of weekEvents.filter(e => e.category === 'orchestrator' || e.category === 'plugin')) {
    const tool = e.meta?.tool || e.action
    toolUsage[tool] = (toolUsage[tool] || 0) + 1
  }
  const topTools = Object.entries(toolUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // AI 使用次数
  const aiUsage = weekEvents.filter(e => e.category === 'chat' || e.category === 'orchestrator').length

  // 知识增长（按天）
  const knowledgeGrowth = {}
  for (const e of events.filter(e => e.category === 'knowledge')) {
    const day = e.timestamp.slice(0, 10)
    knowledgeGrowth[day] = (knowledgeGrowth[day] || 0) + 1
  }

  return {
    today: {
      totalEvents: todayEvents.length,
      aiUsage: todayEvents.filter(e => e.category === 'chat' || e.category === 'orchestrator').length,
      workflows: todayEvents.filter(e => e.category === 'workflow').length,
      bookmarks: todayEvents.filter(e => e.category === 'bookmark').length
    },
    week: {
      totalEvents: weekEvents.length,
      aiUsage,
      categoryBreakdown: categoryCount,
      topTools,
      hourlyActivity,
      weekdayActivity,
      knowledgeGrowth
    },
    streak: calculateStreak(events),
    peakHour: hourlyActivity.indexOf(Math.max(...hourlyActivity))
  }
}

/** 计算连续活跃天数 */
function calculateStreak(events) {
  const days = [...new Set(events.map(e => e.timestamp.slice(0, 10)))].sort().reverse()
  let streak = 0
  let checkDate = new Date()
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10)
    if (days.includes(dateStr)) {
      streak++
      checkDate = new Date(checkDate - 86400000)
    } else if (i === 0) {
      checkDate = new Date(checkDate - 86400000)
    } else break
  }
  return streak
}

/** 获取知识图谱数据 */
function getKnowledgeGraph() {
  // 从知识库文档和记忆中构建关系图
  let documents = []
  let memories = []
  try { documents = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'knowledge', 'documents.json'), 'utf-8')) } catch {}
  try { memories = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'memory.json'), 'utf-8')) } catch {}

  const nodes = []
  const links = []

  // 文档节点
  for (const doc of documents) {
    nodes.push({
      id: `doc_${doc.id}`,
      label: (doc.title || doc.filename || 'document').slice(0, 20),
      type: 'document',
      size: Math.min(20, 8 + (doc.chunks || 0))
    })
  }

  // 记忆节点
  const facts = memories.facts || memories
  if (Array.isArray(facts)) {
    for (const fact of facts.slice(0, 30)) {
      const content = typeof fact === 'string' ? fact : (fact.content || fact.text || '')
      nodes.push({
        id: `mem_${nodes.length}`,
        label: content.slice(0, 15),
        type: 'memory',
        size: 6
      })
    }
  }

  // 技能节点（从代码生成记录推断）
  const events = readEvents()
  const codeEvents = events.filter(e => e.category === 'codegen')
  const langs = {}
  for (const e of codeEvents) {
    const lang = e.meta?.language || 'unknown'
    langs[lang] = (langs[lang] || 0) + 1
  }
  for (const [lang, count] of Object.entries(langs)) {
    nodes.push({ id: `skill_${lang}`, label: lang, type: 'skill', size: 6 + count * 2 })
  }

  // 构建链接（基于共现关系）
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < Math.min(i + 3, nodes.length); j++) {
      if (nodes[i].type !== nodes[j].type || Math.random() > 0.5) {
        links.push({ source: nodes[i].id, target: nodes[j].id, strength: 0.3 + Math.random() * 0.7 })
      }
    }
  }

  return { nodes, links, stats: { totalNodes: nodes.length, totalLinks: links.length } }
}

/** 生成 AI 周报 */
async function generateWeeklyReport(callLLM) {
  const stats = getDashboardStats()
  const events = readEvents()
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const weekEvents = events.filter(e => e.timestamp >= weekAgo)

  const summary = {
    period: `${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)} ~ ${new Date().toISOString().slice(0, 10)}`,
    totalActivities: weekEvents.length,
    aiInteractions: stats.week.aiUsage,
    topCategories: Object.entries(stats.week.categoryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3),
    topTools: stats.week.topTools,
    peakHour: stats.peakHour,
    streak: stats.streak
  }

  let aiInsight = ''
  try {
    aiInsight = await callLLM([
      { role: 'system', content: '你是一个效率分析助手。根据用户的一周活动数据，给出简洁的洞察和建议（3-5条）。用中文回复，语气友好专业。' },
      { role: 'user', content: `用户本周活动数据：\n${JSON.stringify(summary, null, 2)}\n\n请给出效率洞察和改进建议。` }
    ])
  } catch {
    aiInsight = `本周共 ${summary.totalActivities} 次活动，AI 交互 ${summary.aiInteractions} 次。 peak 时段在 ${summary.peakHour}:00。继续保持！`
  }

  const report = {
    id: Date.now().toString(36),
    type: 'weekly',
    generatedAt: new Date().toISOString(),
    summary,
    aiInsight,
    recommendations: generateRecommendations(stats)
  }

  // 保存报告
  let reports = []
  try { reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8')) } catch {}
  reports.unshift(report)
  if (reports.length > 20) reports.length = 20
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2))

  return report
}

/** 生成建议 */
function generateRecommendations(stats) {
  const recs = []
  if (stats.week.aiUsage > 50) recs.push('💡 AI 使用频率较高，建议创建常用工作流减少重复操作')
  if (stats.peakHour >= 22 || stats.peakHour <= 5) recs.push('🌙 检测到深夜活跃，注意休息节奏')
  if (stats.streak >= 7) recs.push(`🔥 已连续活跃 ${stats.streak} 天，保持良好习惯！`)
  if (stats.week.categoryBreakdown['workflow'] < 3) recs.push('⚙️ 工作流使用较少，建议将重复任务自动化')
  if (stats.week.topTools.length > 0) recs.push(`🛠️ 最常用工具: ${stats.week.topTools[0].name}，可考虑为其创建快捷方式`)
  if (recs.length === 0) recs.push('✅ 本周活动均衡，继续保持！')
  return recs
}

/** 获取历史报告 */
function getReports(limit = 10) {
  try {
    const reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'))
    return reports.slice(0, limit)
  } catch { return [] }
}

module.exports = {
  trackEvent,
  getDashboardStats,
  getKnowledgeGraph,
  generateWeeklyReport,
  getReports
}
