const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, 'data')
const EXPERIENCES_FILE = path.join(DATA_DIR, 'agent-experiences.json')
const SKILLS_FILE = path.join(DATA_DIR, 'agent-skills.json')
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'agent-suggestions.json')

function ensureDataFile(file, defaultData = []) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultData, null, 2))
}

function readJSON(file) {
  ensureDataFile(file)
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

function writeJSON(file, data) {
  ensureDataFile(file)
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// ── 任务经验库 ──

function getExperiences(limit = 50) {
  const exps = readJSON(EXPERIENCES_FILE)
  return exps.slice(-limit).reverse()
}

function addExperience({ goal, steps, outcome, lesson, duration, userId }) {
  if (!goal) return { success: false, message: 'goal 为必填项' }
  const exps = readJSON(EXPERIENCES_FILE)
  const exp = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    goal,
    steps: Array.isArray(steps) ? steps : [],
    outcome: outcome || 'unknown',
    lesson: lesson || '',
    duration: duration || 0,
    userId: userId || '',
    timestamp: new Date().toISOString(),
    success: outcome === 'success'
  }
  exps.push(exp)
  // 最多保留 500 条
  if (exps.length > 500) exps.splice(0, exps.length - 500)
  writeJSON(EXPERIENCES_FILE, exps)
  return { success: true, experience: exp }
}

function getExperienceStats() {
  const exps = readJSON(EXPERIENCES_FILE)
  const total = exps.length
  const success = exps.filter(e => e.success).length
  const failure = total - success
  const lessons = exps.filter(e => e.lesson).map(e => e.lesson)
  // 按目标聚类
  const goalGroups = new Map()
  for (const e of exps) {
    const key = e.goal.slice(0, 30)
    if (!goalGroups.has(key)) goalGroups.set(key, { goal: e.goal, count: 0, successCount: 0 })
    const g = goalGroups.get(key)
    g.count++
    if (e.success) g.successCount++
  }
  const topGoals = Array.from(goalGroups.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return { total, success, failure, successRate: total > 0 ? (success / total * 100).toFixed(1) + '%' : '0%', lessons: lessons.slice(-10), topGoals }
}

// ── 策略推荐 ──

function findSimilarExperiences(goal, threshold = 0.3, maxResults = 3) {
  const exps = readJSON(EXPERIENCES_FILE)
  if (exps.length === 0) return []

  // 简单关键词匹配相似度（无向量数据库时使用）
  const goalTokens = goal.toLowerCase().split(/\s+/).filter(Boolean)
  const scored = exps.map(exp => {
    const expTokens = (exp.goal + ' ' + (exp.lesson || '')).toLowerCase().split(/\s+/).filter(Boolean)
    if (expTokens.length === 0) return { exp, score: 0 }
    const intersection = goalTokens.filter(t => expTokens.includes(t)).length
    const union = new Set([...goalTokens, ...expTokens]).size
    const score = union > 0 ? intersection / union : 0
    return { exp, score }
  })

  return scored
    .filter(s => s.score >= threshold && s.exp.success)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => ({ experience: s.exp, similarity: s.score }))
}

// ── 技能管理 ──

function getSkills() {
  return readJSON(SKILLS_FILE)
}

function addSkill({ name, description, toolSequence, trigger, userId }) {
  if (!name) return { success: false, message: '名称为必填项' }
  const skills = readJSON(SKILLS_FILE)
  // 检查重名
  if (skills.find(s => s.name === name)) return { success: false, message: '技能已存在' }
  const skill = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    description: description || '',
    toolSequence: Array.isArray(toolSequence) ? toolSequence : [],
    trigger: trigger || '',
    userId: userId || '',
    createdAt: new Date().toISOString(),
    useCount: 0,
    confidence: 0.5
  }
  skills.push(skill)
  writeJSON(SKILLS_FILE, skills)
  return { success: true, skill }
}

function updateSkill(id, updates) {
  const skills = readJSON(SKILLS_FILE)
  const skill = skills.find(s => s.id === id)
  if (!skill) return { success: false, message: '技能不存在' }
  const allowed = ['description', 'toolSequence', 'trigger', 'name', 'confidence']
  for (const key of allowed) {
    if (updates[key] !== undefined) skill[key] = updates[key]
  }
  skill.useCount = (skill.useCount || 0) + 1
  writeJSON(SKILLS_FILE, skills)
  return { success: true, skill }
}

function deleteSkill(id) {
  let skills = readJSON(SKILLS_FILE)
  const idx = skills.findIndex(s => s.id === id)
  if (idx === -1) return { success: false, message: '技能不存在' }
  skills.splice(idx, 1)
  writeJSON(SKILLS_FILE, skills)
  return { success: true }
}

function learnFromExperience(experience) {
  if (!experience || !experience.steps || experience.steps.length < 2) return null
  if (experience.outcome !== 'success') return null

  const steps = experience.steps
  // 提取工具调用序列
  const toolCalls = steps
    .filter(s => s.type === 'tool_call' || s.tool)
    .map(s => ({ tool: s.tool || s.name, args: s.args || s.input }))
  if (toolCalls.length < 2) return null

  // 自动生成技能
  const skillName = 'Auto: ' + experience.goal.slice(0, 40)
  const existingSkills = readJSON(SKILLS_FILE)
  if (existingSkills.find(s => s.name === skillName)) return null

  const skill = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: skillName,
    description: '从任务自动习得: ' + experience.goal.slice(0, 100),
    toolSequence: toolCalls,
    trigger: experience.goal.slice(0, 60),
    userId: experience.userId || '',
    createdAt: new Date().toISOString(),
    useCount: 0,
    confidence: 0.3,
    autoGenerated: true
  }
  existingSkills.push(skill)
  writeJSON(SKILLS_FILE, existingSkills)
  return skill
}

// ── 预测性建议 ──

function getSuggestions(limit = 10) {
  const sugs = readJSON(SUGGESTIONS_FILE)
  return sugs.slice(-limit).reverse()
}

function addSuggestion({ type, title, description, confidence, relatedGoal }) {
  if (!title) return { success: false, message: '标题为必填项' }
  const sugs = readJSON(SUGGESTIONS_FILE)
  const sug = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    type: type || 'insight', // insight, anomaly, optimization, prediction
    title,
    description: description || '',
    confidence: confidence || 0.5,
    relatedGoal: relatedGoal || '',
    timestamp: new Date().toISOString(),
    read: false,
    applied: false
  }
  sugs.push(sug)
  if (sugs.length > 200) sugs.splice(0, sugs.length - 200)
  writeJSON(SUGGESTIONS_FILE, sugs)
  return { success: true, suggestion: sug }
}

function markSuggestionRead(id) {
  const sugs = readJSON(SUGGESTIONS_FILE)
  const sug = sugs.find(s => s.id === id)
  if (!sug) return { success: false, message: '建议不存在' }
  sug.read = true
  writeJSON(SUGGESTIONS_FILE, sugs)
  return { success: true }
}

function markSuggestionApplied(id) {
  const sugs = readJSON(SUGGESTIONS_FILE)
  const sug = sugs.find(s => s.id === id)
  if (!sug) return { success: false, message: '建议不存在' }
  sug.applied = true
  sug.read = true
  writeJSON(SUGGESTIONS_FILE, sugs)
  return { success: true }
}

function deleteSuggestion(id) {
  let sugs = readJSON(SUGGESTIONS_FILE)
  const idx = sugs.findIndex(s => s.id === id)
  if (idx === -1) return { success: false, message: '建议不存在' }
  sugs.splice(idx, 1)
  writeJSON(SUGGESTIONS_FILE, sugs)
  return { success: true }
}

// ── 异常检测 ──

function detectAnomalies() {
  const exps = readJSON(EXPERIENCES_FILE)
  const anomalies = []

  // 检测重复失败
  const recentFailures = exps.filter(e => !e.success).slice(-10)
  if (recentFailures.length >= 5) {
    const failureRate = recentFailures.length / Math.min(exps.length, 10)
    if (failureRate > 0.5) {
      anomalies.push({
        type: 'anomaly',
        title: '高失败率告警',
        description: `最近 ${Math.min(exps.length, 10)} 次任务中失败 ${recentFailures.length} 次，成功率为 ${((1 - failureRate) * 100).toFixed(0)}%`,
        confidence: 0.7
      })
    }
  }

  // 检测长时间任务
  const longTasks = exps.filter(e => e.duration > 300000) // > 5分钟
  if (longTasks.length >= 3) {
    anomalies.push({
      type: 'optimization',
      title: '检测到长时间任务',
      description: `有 ${longTasks.length} 个任务执行超过 5 分钟，建议检查工作流效率`,
      confidence: 0.6
    })
  }

  return anomalies
}

module.exports = {
  getExperiences, addExperience, getExperienceStats,
  findSimilarExperiences,
  getSkills, addSkill, updateSkill, deleteSkill, learnFromExperience,
  getSuggestions, addSuggestion, markSuggestionRead, markSuggestionApplied, deleteSuggestion,
  detectAnomalies
}
