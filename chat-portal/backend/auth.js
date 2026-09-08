const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const DATA_DIR = path.join(__dirname, 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json')
const JWT_SECRET = process.env.JWT_SECRET || 'chat-portal-secret-key-2026'
const JWT_EXPIRES = '24h'
const REFRESH_EXPIRES = '7d'

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

// ── 用户管理 ──

async function register(username, password, role = 'member') {
  const users = readJSON(USERS_FILE)
  if (users.find(u => u.username === username)) {
    return { success: false, message: '用户名已存在' }
  }
  const roles = ['admin', 'member', 'viewer']
  if (!roles.includes(role)) role = 'member'

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    username,
    password: hashedPassword,
    role,
    createdAt: new Date().toISOString(),
    lastLogin: null
  }
  users.push(user)
  writeJSON(USERS_FILE, users)
  return { success: true, user: { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt } }
}

async function login(username, password) {
  const users = readJSON(USERS_FILE)
  const user = users.find(u => u.username === username)
  if (!user) return { success: false, message: '用户名或密码错误' }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return { success: false, message: '用户名或密码错误' }

  user.lastLogin = new Date().toISOString()
  writeJSON(USERS_FILE, users)

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
  const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET + '_refresh', { expiresIn: REFRESH_EXPIRES })

  // 存储 refresh token
  const tokens = readJSON(TOKENS_FILE)
  tokens.push({ userId: user.id, refreshToken, createdAt: new Date().toISOString() })
  writeJSON(TOKENS_FILE, tokens)

  return {
    success: true,
    token,
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role }
  }
}

function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET + '_refresh')
    const tokens = readJSON(TOKENS_FILE)
    const stored = tokens.find(t => t.refreshToken === refreshToken && t.userId === decoded.id)
    if (!stored) return { success: false, message: 'Refresh token 无效' }

    const users = readJSON(USERS_FILE)
    const user = users.find(u => u.id === decoded.id)
    if (!user) return { success: false, message: '用户不存在' }

    const newToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    return { success: true, token: newToken }
  } catch (e) {
    return { success: false, message: 'Refresh token 已过期' }
  }
}

// ── 中间件 ──

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (e) {
    return res.status(401).json({ code: 401, message: 'Token 无效或已过期' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, message: '未登录' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '权限不足' })
    }
    next()
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice(7), JWT_SECRET)
    } catch {}
  }
  next()
}

// ── 用户管理 API ──

function getUsers(reqUser) {
  const users = readJSON(USERS_FILE)
  return users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin
  }))
}

function updateUserRole(adminId, targetUserId, newRole) {
  const users = readJSON(USERS_FILE)
  const admin = users.find(u => u.id === adminId)
  if (!admin || admin.role !== 'admin') return { success: false, message: '仅管理员可修改角色' }

  const roles = ['admin', 'member', 'viewer']
  if (!roles.includes(newRole)) return { success: false, message: '无效的角色' }

  const target = users.find(u => u.id === targetUserId)
  if (!target) return { success: false, message: '用户不存在' }

  target.role = newRole
  writeJSON(USERS_FILE, users)
  return { success: true }
}

function deleteUser(adminId, targetUserId) {
  let users = readJSON(USERS_FILE)
  const admin = users.find(u => u.id === adminId)
  if (!admin || admin.role !== 'admin') return { success: false, message: '仅管理员可删除用户' }
  if (adminId === targetUserId) return { success: false, message: '不能删除自己' }

  users = users.filter(u => u.id !== targetUserId)
  writeJSON(USERS_FILE, users)
  return { success: true }
}

module.exports = {
  register,
  login,
  refreshAccessToken,
  requireAuth,
  requireRole,
  optionalAuth,
  getUsers,
  updateUserRole,
  deleteUser,
  JWT_SECRET
}
