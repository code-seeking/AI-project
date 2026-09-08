const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const rateLimit = require('express-rate-limit')

const DATA_DIR = path.join(__dirname, 'data')
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit.log')
const ENCRYPTED_CONFIG_FILE = path.join(DATA_DIR, 'encrypted-config.json')

// ── AES-256 加密 ──
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')

function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(encryptedText) {
  try {
    const parts = encryptedText.split(':')
    const iv = Buffer.from(parts.shift(), 'hex')
    const encrypted = parts.join(':')
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch { return null }
}

function saveEncryptedConfig(key, value) {
  let config = {}
  try {
    if (fs.existsSync(ENCRYPTED_CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(ENCRYPTED_CONFIG_FILE, 'utf8'))
    }
  } catch {}
  config[key] = encrypt(value)
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(ENCRYPTED_CONFIG_FILE, JSON.stringify(config, null, 2))
}

function getEncryptedConfig(key) {
  try {
    if (!fs.existsSync(ENCRYPTED_CONFIG_FILE)) return null
    const config = JSON.parse(fs.readFileSync(ENCRYPTED_CONFIG_FILE, 'utf8'))
    if (!config[key]) return null
    return decrypt(config[key])
  } catch { return null }
}

// ── 输入消毒 ──

function sanitizeInput(value) {
  if (typeof value === 'string') {
    // XSS 过滤
    return value
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }
  return value
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeObject)
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value)
    } else {
      result[key] = value
    }
  }
  return result
}

// 中间件：对所有用户输入进行消毒
function sanitizeMiddleware(req, res, next) {
  if (req.body) req.body = sanitizeObject(req.body)
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key])
      }
    }
  }
  if (req.params) {
    for (const key of Object.keys(req.params)) {
      req.params[key] = sanitizeInput(req.params[key])
    }
  }
  next()
}

// ── 速率限制 ──

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 100, // 最大 100 请求/分钟
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
})

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 登录端点 10 次/分钟
  message: { code: 429, message: '登录尝试过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
})

const desktopLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 桌面操控 30 次/分钟
  message: { code: 429, message: '操作过于频繁' },
  standardHeaders: true,
  legacyHeaders: false
})

// ── CSP 中间件 ──

function cspMiddleware(req, res, next) {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' ws: wss: https:; " +
    "frame-src 'none'; " +
    "object-src 'none'"
  )
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
}

// ── 审计日志 ──

function auditLog(action, userId, details = {}) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    userId: userId || 'anonymous',
    details: typeof details === 'object' ? JSON.stringify(details) : String(details),
    ip: details.ip || ''
  }
  const line = JSON.stringify(entry) + '\n'
  fs.appendFileSync(AUDIT_LOG_FILE, line, 'utf8')
}

function getAuditLogs(limit = 100) {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) return []
    const content = fs.readFileSync(AUDIT_LOG_FILE, 'utf8')
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.slice(-limit).map(line => {
      try { return JSON.parse(line) } catch { return { raw: line } }
    }).reverse()
  } catch { return [] }
}

// 审计日志中间件（记录敏感请求）
function auditMiddleware(actionName) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = function (body) {
      const userId = req.user?.id || req.body?.username || 'anonymous'
      auditLog(actionName, userId, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        statusCode: res.statusCode,
        summary: typeof body === 'object' ? (body.message || '') : ''
      })
      return originalJson(body)
    }
    next()
  }
}

module.exports = {
  sanitizeMiddleware,
  sanitizeInput,
  sanitizeObject,
  generalLimiter,
  authLimiter,
  desktopLimiter,
  cspMiddleware,
  auditLog,
  getAuditLogs,
  auditMiddleware,
  encrypt,
  decrypt,
  saveEncryptedConfig,
  getEncryptedConfig
}
