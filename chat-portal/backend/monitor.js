const fs = require('fs')
const path = require('path')
const os = require('os')

const DATA_DIR = path.join(__dirname, 'data')
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json')
const ERROR_LOG_FILE = path.join(DATA_DIR, 'error.log')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJSON(file, def = []) {
  ensureDir()
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}

function writeJSON(file, data) {
  ensureDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// ── API 性能监控 ──

const responseTimes = []

function recordResponseTime(path, durationMs, statusCode) {
  responseTimes.push({ path, duration: durationMs, statusCode, timestamp: Date.now() })
  // 只保留最近 1000 条
  if (responseTimes.length > 1000) responseTimes.splice(0, responseTimes.length - 1000)
}

function getPerformanceStats() {
  if (responseTimes.length === 0) return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 }

  const sorted = [...responseTimes].sort((a, b) => a.duration - b.duration)
  const len = sorted.length
  const p50 = sorted[Math.floor(len * 0.5)].duration
  const p95 = sorted[Math.floor(len * 0.95)].duration
  const p99 = sorted[Math.floor(len * 0.99)].duration
  const avg = sorted.reduce((s, r) => s + r.duration, 0) / len

  return {
    p50: Math.round(p50),
    p95: Math.round(p95),
    p99: Math.round(p99),
    avg: Math.round(avg),
    count: len,
    byPath: aggregateByPath(sorted)
  }
}

function aggregateByPath(times) {
  const grouped = {}
  for (const t of times) {
    if (!grouped[t.path]) grouped[t.path] = { count: 0, total: 0, max: 0 }
    grouped[t.path].count++
    grouped[t.path].total += t.duration
    grouped[t.path].max = Math.max(grouped[t.path].max, t.duration)
  }
  return Object.entries(grouped).map(([path, data]) => ({
    path,
    count: data.count,
    avg: Math.round(data.total / data.count),
    max: data.max
  })).sort((a, b) => b.count - a.count).slice(0, 20)
}

// 性能监控中间件
function performanceMiddleware(req, res, next) {
  const start = Date.now()
  const originalEnd = res.end.bind(res)
  res.end = function (...args) {
    const duration = Date.now() - start
    recordResponseTime(req.path, duration, res.statusCode)
    return originalEnd(...args)
  }
  next()
}

// ── 错误追踪 ──

function logError(error, context = {}) {
  ensureDir()
  const entry = {
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    stack: error?.stack || '',
    context: typeof context === 'object' ? JSON.stringify(context) : String(context)
  }
  const line = JSON.stringify(entry) + '\n'
  fs.appendFileSync(ERROR_LOG_FILE, line, 'utf8')
}

function getErrorLogs(limit = 50) {
  try {
    if (!fs.existsSync(ERROR_LOG_FILE)) return []
    const content = fs.readFileSync(ERROR_LOG_FILE, 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.slice(-limit).map(line => {
      try { return JSON.parse(line) } catch { return { raw: line } }
    }).reverse()
  } catch { return [] }
}

// 全局错误处理中间件
function errorHandler(err, req, res, next) {
  logError(err, { path: req.path, method: req.method, ip: req.ip })
  res.status(500).json({ code: 500, message: '服务器内部错误' })
}

// ── 使用统计 ──

function trackUsage(event, userId = 'anonymous', metadata = {}) {
  const metrics = readJSON(METRICS_FILE)
  // 日统计
  const today = new Date().toISOString().slice(0, 10)
  let dayStat = metrics.find(m => m.date === today)
  if (!dayStat) {
    dayStat = { date: today, events: {}, apiCalls: 0, activeUsers: new Set() }
    metrics.push(dayStat)
    // 保留 90 天
    if (metrics.length > 90) metrics.splice(0, metrics.length - 90)
  }
  dayStat.events[event] = (dayStat.events[event] || 0) + 1
  dayStat.apiCalls++
  if (userId !== 'anonymous') dayStat.activeUsers.add(userId)
  writeJSON(METRICS_FILE, metrics.map(m => ({
    ...m,
    activeUsers: m.activeUsers instanceof Set ? Array.from(m.activeUsers) : m.activeUsers
  })))
}

function getUsageStats(days = 30) {
  const metrics = readJSON(METRICS_FILE)
  const recent = metrics.slice(-days)

  const totalApiCalls = recent.reduce((s, m) => s + m.apiCalls, 0)
  const dau = recent.map(m => ({
    date: m.date,
    dau: Array.isArray(m.activeUsers) ? m.activeUsers.length : 0,
    apiCalls: m.apiCalls,
    topEvents: Object.entries(m.events)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }))

  return {
    days: recent.length,
    totalApiCalls,
    dailyAverage: recent.length > 0 ? Math.round(totalApiCalls / recent.length) : 0,
    dau
  }
}

// ── 健康检查 ──

function getHealth() {
  const pkg = require('./package.json')
  return {
    version: pkg.version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.cpus().length,
    platform: process.platform,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  }
}

module.exports = {
  performanceMiddleware,
  getPerformanceStats,
  logError,
  getErrorLogs,
  errorHandler,
  trackUsage,
  getUsageStats,
  getHealth
}
