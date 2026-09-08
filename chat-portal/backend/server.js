const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync, exec } = require('child_process')
const https = require('https')
const AdmZip = require('adm-zip')
require('dotenv').config()

const auth = require('./auth')
const teamWorkspace = require('./team-workspace')
const agentMemory = require('./agent-memory')
const security = require('./security')
const monitor = require('./monitor')
const codingWorkspace = require('./coding-workspace')
const aiGateway = require('./ai-gateway')
const agentMesh = require('./agent-mesh')
const pluginStore = require('./plugin-store')

const db = require('./db')

const app = express()
const PORT = 3001
const DATA_DIR = path.join(__dirname, 'data')
const BOOKMARKS_FILE = path.join(DATA_DIR, 'bookmarks.json')

// ----- 确保数据文件存在（旧 JSON 存储兜底）-----
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}
if (!fs.existsSync(BOOKMARKS_FILE)) {
  fs.writeFileSync(BOOKMARKS_FILE, '[]', 'utf-8')
}

// ----- RAG 知识库目录 -----
const KNOWLEDGE_DIR = path.join(DATA_DIR, 'knowledge')
const DOCUMENTS_FILE = path.join(KNOWLEDGE_DIR, 'documents.json')
const CHUNKS_FILE = path.join(KNOWLEDGE_DIR, 'chunks.json')
if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true })
if (!fs.existsSync(DOCUMENTS_FILE)) fs.writeFileSync(DOCUMENTS_FILE, '[]', 'utf-8')
if (!fs.existsSync(CHUNKS_FILE)) fs.writeFileSync(CHUNKS_FILE, '[]', 'utf-8')

app.use(express.json({ limit: '10mb' }))
app.use(require('cors')())

// 安全中间件
app.use(security.sanitizeMiddleware)
app.use(security.cspMiddleware)
app.use('/api/auth', security.authLimiter)
app.use('/api/desktop', security.desktopLimiter)
app.use(security.generalLimiter)

// 性能监控中间件
app.use(monitor.performanceMiddleware)

// 生产环境 - 静态文件服务
const publicPath = path.join(__dirname, 'public')
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath))
  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(publicPath, 'index.html'))
  })
  console.log('📦 静态文件服务: ' + publicPath)
}

// ----- PostgreSQL 连接状态 -----
let pgReady = false

async function ensureDb() {
  if (pgReady) return true
  pgReady = await db.initDatabase()
  return pgReady
}

// ----- 辅助函数（保持原有功能）-----

function background(cmd, opts = {}) {
  exec(cmd, opts, (err) => {
    if (err) console.error(`background error: ${cmd.slice(0, 100)}`, err.message)
  })
}

function readBookmarks() {
  try {
    const raw = fs.readFileSync(BOOKMARKS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch { return [] }
}

function writeBookmarks(bookmarks) {
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2), 'utf-8')
}

function openInChrome(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  background(`start "" chrome "${url}"`, { shell: 'cmd' })
  return true
}

function openInChromeLocal(filePath) {
  const fileUrl = 'file:///' + filePath.replace(/\\/g, '/')
  const cmd = `Start-Process "chrome" -ArgumentList '${fileUrl.replace(/'/g, "''")}'`
  background(cmd, { shell: 'powershell' })
  return true
}

function esc(s) { return s.replace(/"/g, '\\"') }

function cleanPath(filePath) {
  let p = filePath.replace(/^file:\/\//i, '')
  return path.normalize(p)
}

function openWithExt(cleanPath, ext) {
  const q = `"${esc(cleanPath)}"`
  if (['.bat', '.cmd'].includes(ext)) { background(`start "" ${q}`, { shell: 'cmd' }); return true }
  if (['.ps1'].includes(ext)) { background(`start "" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File ${q}`, { shell: 'cmd' }); return true }
  if (['.sh', '.bash', '.zsh'].includes(ext)) { background(`start "" ${q}`, { shell: 'cmd' }); return true }
  if (['.exe', '.msi', '.com', '.lnk'].includes(ext)) { background(`start "" ${q}`, { shell: 'cmd' }); return true }
  if (['.pdf'].includes(ext)) { openInChromeLocal(cleanPath); return true }
  if (['.html', '.htm'].includes(ext)) { openInChromeLocal(cleanPath); return true }
  if (['.txt', '.log'].includes(ext)) { background(`start "" notepad ${q}`, { shell: 'cmd' }); return true }
  const codeExts = ['.json', '.sql', '.js', '.ts', '.vue', '.jsx', '.tsx', '.java', '.py', '.rb', '.php', '.go', '.rs', '.cs', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.css', '.scss', '.less', '.sass', '.xml', '.yaml', '.yml', '.toml', '.md', '.markdown', '.properties', '.env', '.gradle', '.gitignore', '.editorconfig', '.cfg', '.ini', '.conf']
  if (codeExts.includes(ext)) {
    try { execSync('where notepad++', { shell: 'cmd', stdio: 'ignore' }) } catch { background(`start "" notepad ${q}`, { shell: 'cmd' }); return true }
    background(`start "" notepad++ ${q}`, { shell: 'cmd' }); return true
  }
  return false
}

function openLocalFile(filePath) {
  const cp = cleanPath(filePath)
  let isDir = false
  try { isDir = fs.statSync(cp).isDirectory() } catch {}
  if (isDir) { background(`explorer "${esc(cp)}"`, { shell: 'cmd' }); return true }
  const ext = path.extname(cp).toLowerCase()
  if (openWithExt(cp, ext)) return true
  background(`Start-Process "${esc(cp)}"`, { shell: 'powershell' })
  return true
}

// ----- Windows 已安装应用扫描 -----
const APPS_CACHE_FILE = path.join(DATA_DIR, 'apps-cache.json')

// 扫描目录中的可执行文件/快捷方式
function scanDirForLinks(dir, apps, scanned, depth, maxDepth) {
  if (depth > maxDepth) return
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const lower = entry.name.toLowerCase()
        if (lower.includes('uninstall') || lower.includes('卸载')) continue
        scanDirForLinks(fullPath, apps, scanned, depth + 1, maxDepth)
      } else {
        const lower = entry.name.toLowerCase()
        // 支持 .lnk 快捷方式、.bat/.cmd/.ps1 脚本
        if (lower.endsWith('.lnk') || lower.endsWith('.bat') || lower.endsWith('.cmd') || lower.endsWith('.ps1')) {
          if (/uninstall|卸载/i.test(entry.name)) continue
          const name = lower.endsWith('.lnk') ? entry.name.slice(0, -4) : path.basename(entry.name, path.extname(entry.name))
          const key = name.toLowerCase().trim()
          if (key && !scanned.has(key)) { scanned.add(key); apps.push({ name, path: fullPath, type: 'app' }) }
        }
      }
    }
  } catch (e) {}
}

function scanInstalledApps() {
  const programData = process.env.ALLUSERSPROFILE || 'C:\\ProgramData'
  const userProfile = os.homedir()
  const startMenuPaths = [
    path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(userProfile, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ]
  const apps = []; const scanned = new Set()
  for (const dir of startMenuPaths) { if (fs.existsSync(dir)) scanDirForLinks(dir, apps, scanned, 0, 3) }
  // 扫描桌面文件（仅顶层，深度1）
  const desktopPath = path.join(userProfile, 'Desktop')
  if (fs.existsSync(desktopPath)) scanDirForLinks(desktopPath, apps, scanned, 0, 1)
  apps.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  fs.writeFileSync(APPS_CACHE_FILE, JSON.stringify(apps, null, 2), 'utf-8')
  return apps
}

function loadCachedApps() {
  try { return JSON.parse(fs.readFileSync(APPS_CACHE_FILE, 'utf-8')) } catch { return scanInstalledApps() }
}

function searchApps(keyword) {
  const apps = loadCachedApps(); const kw = keyword.toLowerCase()
  return apps.filter(a => a.name.toLowerCase().includes(kw)).slice(0, 20)
}

// ======================================================================
// ===== Phase 1: PostgreSQL API（优先） =====
// ======================================================================

// ----- 书签 CRUD（分页 + 搜索 + 标签 + 分组）-----

// 获取书签列表（分页）
app.get('/api/bookmarks', async (req, res) => {
  if (!await ensureDb()) {
    // 降级到 JSON 文件
    const bookmarks = readBookmarks()
    return res.json({ code: 200, data: bookmarks, total: bookmarks.length, page: 1, pageSize: bookmarks.length })
  }
  try {
    const { page = '1', pageSize = '20', search, tag, group_id: groupId, language } = req.query
    const result = await db.queryBookmarks({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      search, tag, groupId, language
    })
    res.json({ code: 200, ...result })
  } catch (err) {
    console.error('查询书签失败:', err.message)
    res.json({ code: 500, message: '查询失败: ' + err.message })
  }
})

// 添加书签（支持标签、分组、描述）
app.post('/api/bookmarks', async (req, res) => {
  const { keyword, url, description, tags, group_id: groupId, language } = req.body
  if (!keyword || !url) {
    return res.json({ code: 400, message: 'keyword 和 url 为必填项' })
  }

  if (!await ensureDb()) {
    // 降级到 JSON 文件
    const bookmarks = readBookmarks()
    const existingIdx = bookmarks.findIndex(b => b.keyword === keyword)
    const newBookmark = { keyword, url, description: description || '', tags: tags || [], groupId: groupId || null, language: language || 'zh', createdAt: new Date().toISOString() }
    if (existingIdx >= 0) { bookmarks[existingIdx] = { ...bookmarks[existingIdx], ...newBookmark } }
    else { bookmarks.unshift(newBookmark) }
    writeBookmarks(bookmarks)
    return res.json({ code: 200, data: newBookmark, message: '保存成功' })
  }

  try {
    const bm = await db.addBookmark({ keyword, url, description, tags, groupId, language })
    res.json({ code: 200, data: bm, message: '✅ 书签已保存' })
  } catch (err) {
    console.error('添加书签失败:', err.message)
    res.json({ code: 500, message: '保存失败: ' + err.message })
  }
})

// 更新书签
app.put('/api/bookmarks/:id', async (req, res) => {
  if (!await ensureDb()) return res.json({ code: 400, message: '请先启动 PostgreSQL' })
  try {
    const { id } = req.params
    const bm = await db.updateBookmark(parseInt(id), req.body)
    if (!bm) return res.json({ code: 404, message: '书签不存在' })
    res.json({ code: 200, data: bm, message: '✅ 已更新' })
  } catch (err) {
    res.json({ code: 500, message: '更新失败: ' + err.message })
  }
})

// 删除书签
app.delete('/api/bookmarks/:id', async (req, res) => {
  if (!await ensureDb()) return res.json({ code: 400, message: '请先启动 PostgreSQL' })
  try {
    const { id } = req.params
    const ok = await db.deleteBookmark(parseInt(id))
    if (!ok) return res.json({ code: 404, message: '书签不存在' })
    res.json({ code: 200, message: '✅ 已删除' })
  } catch (err) {
    res.json({ code: 500, message: '删除失败: ' + err.message })
  }
})

// 批量删除书签
app.delete('/api/bookmarks/batch', async (req, res) => {
  if (!await ensureDb()) return res.json({ code: 400, message: '请先启动 PostgreSQL' })
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.json({ code: 400, message: '请提供 id 数组' })
    const count = await db.deleteBookmarks(ids)
    res.json({ code: 200, message: `✅ 已删除 ${count} 条` })
  } catch (err) {
    res.json({ code: 500, message: '批量删除失败: ' + err.message })
  }
})

// 清空全部书签
app.delete('/api/bookmarks', async (req, res) => {
  if (!await ensureDb()) {
    writeBookmarks([])
    return res.json({ code: 200, message: '已清空所有书签' })
  }
  try {
    await db.clearAllBookmarks()
    res.json({ code: 200, message: '✅ 已清空所有书签' })
  } catch (err) {
    res.json({ code: 500, message: '清空失败: ' + err.message })
  }
})

// ----- 书签搜索（全字段模糊 + 语义）-----

app.post('/api/bookmarks/search', async (req, res) => {
  const { keyword } = req.body
  if (!keyword) {
    if (await ensureDb()) {
      const result = await db.queryBookmarks({ pageSize: 1000 })
      return res.json({ code: 200, data: result.data })
    }
    return res.json({ code: 200, data: readBookmarks() })
  }

  if (await ensureDb()) {
    try {
      const rows = await db.semanticSearch(keyword)
      return res.json({ code: 200, data: rows })
    } catch {}
  }
  // 降级搜索
  const bookmarks = readBookmarks()
  const results = bookmarks.filter(b => b.keyword.includes(keyword) || b.url.includes(keyword))
  res.json({ code: 200, data: results })
})

// ----- 导出书签 -----

app.get('/api/bookmarks/export', async (req, res) => {
  const format = req.query.format || 'json'
  let bookmarks = []
  if (await ensureDb()) {
    bookmarks = await db.getAllBookmarks()
    await db.logImportExport('export', format, bookmarks.length)
  } else {
    bookmarks = readBookmarks()
  }

  if (format === 'csv') {
    const header = 'id,keyword,url,description,tags,group_id,language,created_at,updated_at\n'
    const rows = bookmarks.map(b => {
      const t = (b.tags || []).join(';')
      return `${b.id || ''},"${(b.keyword||'').replace(/"/g,'""')}","${(b.url||'').replace(/"/g,'""')}","${(b.description||'').replace(/"/g,'""')}","${t}",${b.group_id||''},${b.language||'zh'},${b.created_at||''},${b.updated_at||''}`
    }).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="bookmarks-export-${Date.now()}.csv"`)
    return res.send('\uFEFF' + header + rows)
  }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="bookmarks-export-${Date.now()}.json"`)
  res.json(bookmarks)
})

// ----- 导入书签 -----

app.post('/api/bookmarks/import', async (req, res) => {
  const { format = 'json', data } = req.body
  if (!data) return res.json({ code: 400, message: '请提供导入数据' })

  let imported = []
  try {
    if (format === 'csv') {
      // 简单 CSV 解析
      const lines = data.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"/,'').replace(/"$/,''))
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/^"/,'').replace(/"$/,''))
        const row = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
        if (row.keyword && row.url) imported.push(row)
      }
    } else {
      if (Array.isArray(data)) imported = data
      else if (typeof data === 'object') imported = [data]
    }
  } catch (e) {
    return res.json({ code: 400, message: '解析失败: ' + e.message })
  }

  if (imported.length === 0) return res.json({ code: 400, message: '没有可导入的数据' })

  let count = 0
  if (await ensureDb()) {
    for (const item of imported) {
      try {
        await db.addBookmark({
          keyword: item.keyword,
          url: item.url,
          description: item.description || '',
          tags: item.tags || [],
          groupId: item.group_id || null,
          language: item.language || 'zh'
        })
        count++
      } catch (e) { /* 跳过重复 */ }
    }
    await db.logImportExport('import', format, count)
  } else {
    const bookmarks = readBookmarks()
    for (const item of imported) {
      if (!bookmarks.find(b => b.keyword === item.keyword)) {
        bookmarks.unshift({ keyword: item.keyword, url: item.url, description: item.description || '', tags: item.tags || [], createdAt: new Date().toISOString() })
        count++
      }
    }
    writeBookmarks(bookmarks)
  }

  res.json({ code: 200, message: `✅ 成功导入 ${count} 条书签`, data: { count } })
})

// ----- 分组管理 -----

app.get('/api/groups', async (req, res) => {
  if (!await ensureDb()) return res.json({ code: 200, data: [] })
  try {
    const groups = await db.getGroups()
    res.json({ code: 200, data: groups })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

app.post('/api/groups', async (req, res) => {
  if (!await ensureDb()) return res.json({ code: 400, message: '请先启动 PostgreSQL' })
  const { name, description } = req.body
  if (!name) return res.json({ code: 400, message: 'name 为必填项' })
  try {
    const group = await db.addGroup(name, description)
    res.json({ code: 200, data: group, message: '✅ 分组已创建' })
  } catch (err) {
    res.json({ code: 500, message: '创建分组失败: ' + err.message })
  }
})

app.delete('/api/groups/:id', async (req, res) => {
  if (!await ensureDb()) return res.json({ code: 400, message: '请先启动 PostgreSQL' })
  try {
    const ok = await db.deleteGroup(parseInt(req.params.id))
    if (!ok) return res.json({ code: 404, message: '分组不存在' })
    res.json({ code: 200, message: '✅ 分组已删除' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ----- 标签管理 -----

app.get('/api/tags', async (req, res) => {
  if (!await ensureDb()) return res.json({ code: 200, data: [] })
  try {
    const tags = await db.getAllTags()
    res.json({ code: 200, data: tags })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})


// ======================================================================
// ===== RAG 向量知识库 =====
// ======================================================================

function readKnowledgeDocs() {
  try { return JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf-8')) } catch { return [] }
}
function writeKnowledgeDocs(docs) { fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2), 'utf-8') }
function readKnowledgeChunks() {
  try { return JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf-8')) } catch { return [] }
}
function writeKnowledgeChunks(chunks) { fs.writeFileSync(CHUNKS_FILE, JSON.stringify(chunks, null, 2), 'utf-8') }

/** 文本分块：按段落自然分割，每块 ~500 字符，前后重叠 50 字符 */
function splitText(text, chunkSize = 500, overlap = 50) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  const chunks = []
  let buffer = ''
  for (const para of paragraphs) {
    if ((buffer + '\n' + para).length > chunkSize && buffer.length > 0) {
      chunks.push(buffer.trim())
      // 保留末尾 overlap 字符作为重叠
      buffer = buffer.slice(-overlap) + '\n' + para
    } else {
      buffer = buffer ? buffer + '\n' + para : para
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim())
  // 如果分块结果为空或只有一大块，按标点强行拆分
  if (chunks.length <= 1 && text.length > chunkSize) {
    const sentences = text.split(/(?<=[。！？.!?])\s*/)
    chunks.length = 0
    buffer = ''
    for (const s of sentences) {
      if ((buffer + s).length > chunkSize && buffer.length > 0) {
        chunks.push(buffer.trim())
        buffer = s
      } else {
        buffer += s
      }
    }
    if (buffer.trim()) chunks.push(buffer.trim())
  }
  return chunks
}

/** 在知识库中检索与查询相关的文本块（关键词评分，支持中文） */
function searchChunks(query, chunks, maxResults = 5) {
  // 1. 提取查询中的关键词：去标点、拆分为有意义的词
  const raw = query.toLowerCase()
  // 去标点
  const clean = raw.replace(/[，。.、！!？?：:；;""''（）()【】\[\]{}、\\s]+/g, ' ')
  // 按空格拆分，过滤掉长度 <= 1 的词
  const words = clean.split(/\s+/).filter(w => w.length > 1)
  // 对于中文，额外提取所有 2-gram 和单个中文字符（长度 > 1 时）
  const cjkChars = [...raw].filter(c => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(c))
  const bigrams = []
  if (cjkChars.length > 2) {
    for (let i = 0; i < cjkChars.length - 1; i++) {
      bigrams.push(cjkChars[i] + cjkChars[i + 1])
    }
  }

  // 合并所有检索词
  const terms = [...new Set([...words, ...bigrams])]
  if (terms.length === 0) return chunks.slice(0, maxResults)

  const scored = chunks.map(chunk => {
    const text = (chunk.text || '').toLowerCase()
    let score = 0
    for (const term of terms) {
      let count = 0
      try {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
        count = (text.match(regex) || []).length
      } catch { count = text.includes(term) ? 1 : 0 }
      if (count > 0) {
        // TF-IDF 近似
        const docFreq = chunks.filter(c => (c.text || '').toLowerCase().includes(term)).length
        const idf = Math.log(1 + (chunks.length / (1 + docFreq)))
        score += (count / Math.max(text.split(/\s+/).length, 10)) * idf
      }
    }
    return { ...chunk, score }
  })

  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

/** 上传文档：接收文本内容，自动分块并存储（含向量 embedding 同步到 AI 服务） */
app.post('/api/knowledge/upload', async (req, res) => {
  const { title, content, source } = req.body
  if (!title || !content) return res.json({ code: 400, message: 'title 和 content 为必填项' })

  try {
    const docs = readKnowledgeDocs()
    const chunks = readKnowledgeChunks()

    const docId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const now = new Date().toISOString()

    const doc = {
      id: docId,
      title,
      source: source || '',
      contentLength: content.length,
      chunkCount: 0,
      createdAt: now,
      updatedAt: now
    }

    const textChunks = splitText(content)
    const newChunks = textChunks.map((text, i) => ({
      id: `${docId}-${i}`,
      docId,
      index: i,
      text,
      createdAt: now
    }))

    doc.chunkCount = newChunks.length
    docs.unshift(doc)
    chunks.push(...newChunks)

    writeKnowledgeDocs(docs)
    writeKnowledgeChunks(chunks)

    // 异步同步 embedding 到 AI 服务（不阻塞响应）
    syncChunkEmbeddings(newChunks).catch(err => {
      console.warn('同步 embedding 到 AI 服务失败:', err.message || err)
    })

    console.log(`知识库: 已添加文档「${title}」(${newChunks.length} 个文本块)`)
    res.json({ code: 200, data: doc, message: `✅ 已添加「${title}」(${newChunks.length} 个文本块)` })
  } catch (err) {
    console.error('知识库上传失败:', err.message)
    res.json({ code: 500, message: '上传失败: ' + err.message })
  }
})

/** 异步将文本块 embedding 同步到 AI 服务 */
async function syncChunkEmbeddings(chunks) {
  const payload = {
    chunks: chunks.map(c => ({
      id: c.id,
      docId: c.docId,
      chunkIndex: c.index,
      text: c.text
    }))
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)
  try {
    const res = await fetch(`${AI_SERVICE_URL}/api/rag/knowledge/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      console.log(`同步 embedding: ${data.message || 'OK'}`)
    }
  } catch (err) {
    // AI 服务不可用，忽略
  }
}

/** 异步从 AI 服务删除 embedding */
async function deleteChunkEmbeddings(docId) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    await fetch(`${AI_SERVICE_URL}/api/rag/knowledge/embeddings/${docId}`, {
      method: 'DELETE',
      signal: controller.signal
    })
    clearTimeout(timeoutId)
  } catch (err) {
    // AI 服务不可用，忽略
  }
}

/** 列出所有知识文档 */
app.get('/api/knowledge/documents', (req, res) => {
  const docs = readKnowledgeDocs()
  res.json({ code: 200, data: docs })
})

/** 删除文档及其所有文本块（含向量 embedding 清理） */
app.delete('/api/knowledge/documents/:id', (req, res) => {
  const { id } = req.params
  try {
    let docs = readKnowledgeDocs()
    let chunks = readKnowledgeChunks()
    const docIdx = docs.findIndex(d => d.id === id)
    if (docIdx < 0) return res.json({ code: 404, message: '文档不存在' })

    const doc = docs[docIdx]
    docs.splice(docIdx, 1)
    chunks = chunks.filter(c => c.docId !== id)

    writeKnowledgeDocs(docs)
    writeKnowledgeChunks(chunks)

    // 异步删除 AI 服务中的 embedding
    deleteChunkEmbeddings(id).catch(err => {
      console.warn('删除 AI embedding 失败:', err.message || err)
    })

    res.json({ code: 200, message: `✅ 已删除「${doc.title}」及其 ${doc.chunkCount} 个文本块` })
  } catch (err) {
    res.json({ code: 500, message: '删除失败: ' + err.message })
  }
})

/** 查询知识库（RAG）- 优先向量搜索，降级到关键词搜索 */
app.post('/api/knowledge/query', async (req, res) => {
  const { question } = req.body
  if (!question) return res.json({ code: 400, message: 'question 为必填项' })

  try {
    const chunks = readKnowledgeChunks()
    if (chunks.length === 0) {
      return res.json({ code: 200, data: { answer: null, chunks: [], totalChunks: 0 }, message: '知识库为空，请先上传文档' })
    }

    // 1. 尝试向量搜索（AI 服务）
    let topChunks = []
    let usedVectorSearch = false

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const vectorRes = await fetch(`${AI_SERVICE_URL}/api/rag/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, topK: 5 }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      if (vectorRes.ok) {
        const vectorData = await vectorRes.json()
        if (vectorData.code === 200 && vectorData.data?.chunks?.length > 0) {
          topChunks = vectorData.data.chunks.map(c => ({
            id: c.id,
            docId: c.docId,
            text: c.text,
            score: c.score || 0
          }))
          usedVectorSearch = true
        }
      }
    } catch {
      // 向量搜索不可用，降级到关键词搜索
    }

    // 2. 如果向量搜索未返回结果，使用关键词搜索
    if (!usedVectorSearch || topChunks.length === 0) {
      topChunks = searchChunks(question, chunks, 5)
    }

    if (topChunks.length === 0) {
      return res.json({ code: 200, data: { answer: null, chunks: [], totalChunks: chunks.length }, message: '未找到相关知识' })
    }

    // 3. 构建上下文
    const context = topChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n---\n\n')

    // 4. 尝试调用 AI 生成回答（30 秒超时）
    let answer = null
    const chatController = new AbortController()
    const chatTimeoutId = setTimeout(() => chatController.abort(), 30000)

    try {
      const systemPrompt = '你是一个基于知识库的知识问答助手。请严格基于以下参考资料回答用户问题。如果参考资料不足以回答问题，请如实说明。请引用相关参考资料编号 [1][2] 等。'
      const userMessage = `参考资料：\n${context}\n\n问题：${question}\n\n请用中文回答：`

      const aiRes = await fetch(`${AI_SERVICE_URL}/api/classify/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage }),
        signal: chatController.signal
      })
      clearTimeout(chatTimeoutId)
      if (aiRes.ok) {
        const aiData = await aiRes.json()
        if (aiData.code === 200 && aiData.data) {
          answer = aiData.data
        }
      }
    } catch {
      // AI 不可用，直接返回文本块
    }

    // 5. 返回结果
    res.json({
      code: 200,
      data: {
        answer,
        chunks: topChunks.map(c => ({
          id: c.id,
          docId: c.docId,
          text: c.text,
          score: c.score
        })),
        totalChunks: chunks.length
      },
      message: answer ? 'AI 回答已生成' : `找到 ${topChunks.length} 个相关文本块`
    })
  } catch (err) {
    console.error('知识库查询失败:', err.message)
    res.json({ code: 500, message: '查询失败: ' + err.message })
  }
})


// ======================================================================
// ===== 工作日志 =====
// ======================================================================

const WORKLOGS_FILE = path.join(DATA_DIR, 'worklogs.json')
const WORKLOG_CATEGORIES = ['开发', '会议', '文档', '设计', '测试', '调研', '运维', '其他']
if (!fs.existsSync(WORKLOGS_FILE)) fs.writeFileSync(WORKLOGS_FILE, '[]', 'utf-8')

function readWorkLogs() {
  try { return JSON.parse(fs.readFileSync(WORKLOGS_FILE, 'utf-8')) } catch { return [] }
}
function writeWorkLogs(logs) { fs.writeFileSync(WORKLOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8') }

/** 生成 ID */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** 计算持续分钟数 */
function calcDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
}

/** 添加工作日志 */
app.post('/api/work-logs', (req, res) => {
  const { date, title, description, startTime, endTime, category, tags } = req.body
  if (!date || !title) return res.json({ code: 400, message: 'date 和 title 为必填项' })

  try {
    const logs = readWorkLogs()
    const now = new Date().toISOString()
    const duration = calcDuration(startTime, endTime)

    const log = {
      id: genId(),
      date,
      title,
      description: description || '',
      startTime: startTime || '',
      endTime: endTime || '',
      duration,
      category: category || '其他',
      tags: tags || [],
      createdAt: now,
      updatedAt: now
    }

    logs.unshift(log)
    writeWorkLogs(logs)

    res.json({ code: 200, data: log, message: `✅ 已记录: ${title}` })
  } catch (err) {
    res.json({ code: 500, message: '添加失败: ' + err.message })
  }
})

/** 获取工作日志列表（支持分页、日期筛选、关键词搜索） */
app.get('/api/work-logs', (req, res) => {
  try {
    let logs = readWorkLogs()
    const { date, search, category, page = '1', pageSize = '50' } = req.query

    // 筛选
    if (date) logs = logs.filter(l => l.date === date)
    if (category) logs = logs.filter(l => l.category === category)
    if (search) {
      const kw = search.toLowerCase()
      logs = logs.filter(l =>
        l.title.toLowerCase().includes(kw) ||
        (l.description || '').toLowerCase().includes(kw) ||
        (l.tags || []).some(t => t.toLowerCase().includes(kw))
      )
    }

    const total = logs.length
    const p = parseInt(page) || 1
    const ps = parseInt(pageSize) || 50
    const start = (p - 1) * ps
    const paged = logs.slice(start, start + ps)

    res.json({ code: 200, data: paged, total, page: p, pageSize: ps })
  } catch (err) {
    res.json({ code: 500, message: '查询失败: ' + err.message })
  }
})

/** 获取所有可用日期（用于日历标记） */
app.get('/api/work-logs/dates', (req, res) => {
  try {
    const logs = readWorkLogs()
    const dates = [...new Set(logs.map(l => l.date))].sort().reverse()
    res.json({ code: 200, data: dates })
  } catch (err) {
    res.json({ code: 500, message: '查询失败: ' + err.message })
  }
})

/** 更新工作日志 */
app.put('/api/work-logs/:id', (req, res) => {
  const { id } = req.params
  try {
    let logs = readWorkLogs()
    const idx = logs.findIndex(l => l.id === id)
    if (idx < 0) return res.json({ code: 404, message: '日志不存在' })

    const updates = req.body
    if (updates.startTime !== undefined || updates.endTime !== undefined) {
      const start = updates.startTime !== undefined ? updates.startTime : logs[idx].startTime
      const end = updates.endTime !== undefined ? updates.endTime : logs[idx].endTime
      updates.duration = calcDuration(start, end)
    }

    logs[idx] = { ...logs[idx], ...updates, id, updatedAt: new Date().toISOString() }
    writeWorkLogs(logs)
    res.json({ code: 200, data: logs[idx], message: '✅ 已更新' })
  } catch (err) {
    res.json({ code: 500, message: '更新失败: ' + err.message })
  }
})

/** 删除工作日志 */
app.delete('/api/work-logs/:id', (req, res) => {
  const { id } = req.params
  try {
    let logs = readWorkLogs()
    const idx = logs.findIndex(l => l.id === id)
    if (idx < 0) return res.json({ code: 404, message: '日志不存在' })
    const log = logs[idx]
    logs.splice(idx, 1)
    writeWorkLogs(logs)
    res.json({ code: 200, message: `✅ 已删除: ${log.title}` })
  } catch (err) {
    res.json({ code: 500, message: '删除失败: ' + err.message })
  }
})

/** 工作饱和度统计 */
app.get('/api/work-logs/stats', (req, res) => {
  try {
    const logs = readWorkLogs()
    const { startDate, endDate, mode = 'day' } = req.query

    let filtered = logs
    if (startDate) filtered = filtered.filter(l => l.date >= startDate)
    if (endDate) filtered = filtered.filter(l => l.date <= endDate)

    // 按 mode 分组: day | week | month
    const groups = {}
    for (const log of filtered) {
      let key
      if (mode === 'week') {
        const d = new Date(log.date)
        const dayOfWeek = d.getDay()
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        const monday = new Date(d.setDate(diff))
        key = monday.toISOString().slice(0, 10)
      } else if (mode === 'month') {
        key = log.date.slice(0, 7)
      } else {
        key = log.date
      }
      if (!groups[key]) groups[key] = []
      groups[key].push(log)
    }

    const stats = Object.entries(groups)
      .map(([dateKey, items]) => ({
        date: dateKey,
        count: items.length,
        totalMinutes: items.reduce((sum, i) => sum + (i.duration || 0), 0),
        hours: (items.reduce((sum, i) => sum + (i.duration || 0), 0) / 60).toFixed(1),
        categories: items.reduce((acc, i) => {
          acc[i.category] = (acc[i.category] || 0) + 1
          return acc
        }, {}),
        items
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    // 全局汇总
    const totalMinutes = filtered.reduce((sum, i) => sum + (i.duration || 0), 0)
    const summary = {
      totalItems: filtered.length,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(1),
      categoryDistribution: filtered.reduce((acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + 1
        return acc
      }, {}),
      avgDailyMinutes: stats.length > 0 ? Math.round(totalMinutes / stats.length) : 0
    }

    res.json({ code: 200, data: { stats, summary } })
  } catch (err) {
    res.json({ code: 500, message: '统计失败: ' + err.message })
  }
})


// ======================================================================
// ===== 原有功能 API（保持兼容） =====
// ======================================================================

// 在 Chrome 中打开 URL
app.post('/api/open', (req, res) => {
  const { url } = req.body
  if (!url) return res.json({ code: 400, message: 'url 为必填项' })
  const ok = openInChrome(url)
  res.json({ code: 200, message: ok ? `✅ 已在 Chrome 中打开: ${url}` : '❌ 打开失败' })
})

// 打开本地文件/文件夹
app.post('/api/open-file', (req, res) => {
  const { path: filePath } = req.body
  if (!filePath) return res.json({ code: 400, message: 'path 为必填项' })
  const ok = openLocalFile(filePath)
  res.json({ code: 200, message: ok ? `📂 已打开: ${filePath}` : '❌ 打开失败' })
})

// 搜索已安装应用
app.post('/api/apps/search', (req, res) => {
  const { keyword } = req.body
  if (!keyword) return res.json({ code: 200, data: loadCachedApps() })
  res.json({ code: 200, data: searchApps(keyword) })
})

// 重新扫描已安装应用
app.post('/api/apps/scan', (req, res) => {
  const apps = scanInstalledApps()
  res.json({ code: 200, data: apps, message: `已扫描到 ${apps.length} 个应用` })
})

// 启动应用
app.post('/api/open-app', (req, res) => {
  const { path: appPath } = req.body
  if (!appPath) return res.json({ code: 400, message: 'path 为必填项' })
  const ok = openLocalFile(appPath)
  if (ok) {
    const appName = path.basename(appPath, '.lnk')
    res.json({ code: 200, message: `🚀 已启动: ${appName}` })
  } else {
    res.json({ code: 500, message: '❌ 启动失败' })
  }
})

// ===== AI 分类代理路由（远程模型）=====

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8081'

// ===== LLM 统一调用层 =====
const LLM_BASE_URL = process.env.LLM_BASE_URL || ''
const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-20250514'
const LLM_AVAILABLE = !!(LLM_BASE_URL && LLM_API_KEY)

/**
 * 调用 LLM（非流式）
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userMessage - 用户消息
 * @param {object} opts - 可选参数 { temperature, maxTokens }
 * @returns {Promise<string|null>} - 返回 LLM 回复文本，失败返回 null
 */
async function callLLM(systemPrompt, userMessage, opts = {}) {
  if (!LLM_AVAILABLE) return null
  try {
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4096
      }),
      signal: AbortSignal.timeout(60000)
    })
    if (!res.ok) {
      console.error(`LLM API 错误: ${res.status} ${res.statusText}`)
      return null
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.error(`LLM 调用失败:`, err.message)
    return null
  }
}

/**
 * 调用 LLM（流式 SSE）
 * @param {object} res - Express response 对象
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} opts
 */
async function callLLMStream(res, systemPrompt, userMessage, opts = {}) {
  if (!LLM_AVAILABLE) {
    res.write(`data: ${JSON.stringify({ error: 'LLM 未配置' })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
    return false
  }
  try {
    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true
      }),
      signal: AbortSignal.timeout(120000)
    })
    if (!response.ok) {
      res.write(`data: ${JSON.stringify({ error: `LLM ${response.status}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return false
    }
    // 透传 SSE 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          res.write(line + '\n\n')
        }
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return true
  } catch (err) {
    console.error(`LLM 流式调用失败:`, err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
    return false
  }
}

/** LLM 统一对话接口（非流式） */
app.post('/api/llm/chat', async (req, res) => {
  const { message, systemPrompt, temperature, maxTokens } = req.body
  if (!message) return res.json({ code: 400, message: 'message 为必填项' })
  const reply = await callLLM(
    systemPrompt || '你是一个智能助手，请用中文回答。',
    message,
    { temperature, maxTokens }
  )
  if (reply) {
    res.json({ code: 200, data: reply, source: 'llm' })
  } else {
    res.json({ code: 200, data: null, source: 'unavailable', message: 'LLM 服务不可用' })
  }
})

/** LLM 流式对话接口 (SSE) */
app.post('/api/llm/chat/stream', async (req, res) => {
  const { message, systemPrompt, temperature, maxTokens } = req.body
  if (!message) return res.json({ code: 400, message: 'message 为必填项' })
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  await callLLMStream(
    res,
    systemPrompt || '你是一个智能助手，请用中文回答。',
    message,
    { temperature, maxTokens }
  )
})

/** LLM 状态检查 */
app.get('/api/llm/status', (req, res) => {
  res.json({
    code: 200,
    data: {
      available: LLM_AVAILABLE,
      model: LLM_MODEL,
      baseUrl: LLM_BASE_URL ? LLM_BASE_URL.replace(/\/v1$/, '') : null
    }
  })
})

// 简单域名归类（AI 服务不可用时的兜底）
function fallbackClassifyBookmarks(bookmarks) {
  function guessCategory(url) {
    const u = (url || '').toLowerCase()
    if (u.includes('github') || u.includes('gitlab') || u.includes('code')) return '开发工具'
    if (u.includes('zhihu') || u.includes('weibo') || u.includes('bilibili') || u.includes('tieba')) return '社交/社区'
    if (u.includes('baidu') || u.includes('google') || u.includes('bing') || u.includes('sogou')) return '搜索引擎'
    if (u.includes('openai') || u.includes('chatgpt') || u.includes('claude') || u.includes('dashscope')) return 'AI平台'
    if (u.includes('doubao') || u.includes('kimi') || u.includes('deepseek') || u.includes('yuanbao')) return 'AI平台'
    if (u.includes('youtube') || u.includes('douyin') || u.includes('netflix')) return '视频/娱乐'
    if (u.includes('taobao') || u.includes('jd.com') || u.includes('pinduoduo') || u.includes('amazon')) return '购物'
    if (u.includes('csdn') || u.includes('stackoverflow') || u.includes('segmentfault') || u.includes('juejin')) return '技术社区'
    if (u.includes('qq.com') || u.includes('163.com') || u.includes('gmail') || u.includes('outlook')) return '邮箱/通讯'
    if (u.includes('aliyun') || u.includes('tencentcloud') || u.includes('huaweicloud') || u.includes('qiniu')) return '云服务'
    if (u.includes('npmjs') || u.includes('maven') || u.includes('pypi') || u.includes('nuget') || u.includes('crates')) return '包管理'
    return '其他'
  }
  const groups = {}
  for (const bm of bookmarks) {
    const cat = guessCategory(bm.url || bm.keyword || '')
    if (!groups[cat]) groups[cat] = []
    groups[cat].push({ keyword: bm.keyword || bm.url, summary: bm.url ? bm.url.match(/https?:\/\/([^\/]+)/)?.[1] || bm.url : '' })
  }
  return {
    code: 200,
    message: '分类成功（本地兜底）',
    data: {
      categories: Object.entries(groups).map(([name, items]) => ({ name, items }))
    }
  }
}

app.post('/api/ai/classify-bookmarks', async (req, res) => {
  try {
    let bookmarks
    if (await ensureDb()) {
      bookmarks = await db.getAllBookmarks()
    } else {
      bookmarks = readBookmarks()
    }

    if (!bookmarks || bookmarks.length === 0) {
      return res.json({ code: 200, data: { categories: [] }, message: '没有书签需要分类' })
    }

    // 尝试调用 AI 服务，15 秒超时
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/classify/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarks }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()

        // 如果分类成功且 PostgreSQL 可用，把分类结果存为标签
        if (data.code === 200 && data.data?.categories && await ensureDb()) {
          for (const cat of data.data.categories) {
            for (const item of cat.items) {
              try {
                const existing = await db.getBookmarkById(item.id)
                if (existing) {
                  const currentTags = existing.tags || []
                  if (!currentTags.includes(cat.name)) {
                    await db.updateBookmark(item.id, { tags: [...currentTags, cat.name] })
                  }
                }
              } catch {}
            }
          }
        }
        return res.json(data)
      }
    } catch (fetchErr) {
      // AI 服务超时或不可用，使用本地兜底
      console.warn('AI classify fallback:', fetchErr.message || 'timeout')
    }

    // 本地兜底分类
    const fallback = fallbackClassifyBookmarks(bookmarks)
    res.json(fallback)

  } catch (err) {
    console.error('AI classify error:', err.message)
    res.json({ code: 500, message: 'AI 服务调用失败: ' + err.message })
  }
})

app.post('/api/ai/classify-folder', async (req, res) => {
  try {
    const { folderPath, files } = req.body
    const response = await fetch(`${AI_SERVICE_URL}/api/classify/folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, files })
    })
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('AI classify error:', err.message)
    res.json({ code: 500, message: 'AI 服务调用失败: ' + err.message })
  }
})

// ===== Phase 1 新增：AI 意图解析（远程模型）=====

app.post('/api/ai/intent-parse', async (req, res) => {
  const { text } = req.body
  if (!text) return res.json({ code: 400, message: '请提供输入文本' })

  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/classify/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      body: JSON.stringify({
        bookmarks: [{ keyword: 'intent-parse', url: text }]
      })
    })
    const data = await response.json()
    // 从分类结果提取意图信息
    const intent = {
      text,
      isUrl: /https?:\/\/|github\.com/i.test(text),
      isFilePath: /^[A-Za-z]:\\/.test(text),
      isSearch: !/https?:\/\//i.test(text) && !/^[A-Za-z]:\\/.test(text),
      aiSuggestion: data.data?.categories?.[0]?.name || null,
      confidence: data.data?.categories?.[0]?.items?.[0]?.summary || ''
    }
    res.json({ code: 200, data: intent })
  } catch (err) {
    // 降级：简单规则解析
    const intent = {
      text,
      isUrl: /https?:\/\/|github\.com/i.test(text),
      isFilePath: /^[A-Za-z]:\\/.test(text),
      isSearch: !/https?:\/\//i.test(text) && !/^[A-Za-z]:\\/.test(text),
      aiSuggestion: null,
      confidence: ''
    }
    res.json({ code: 200, data: intent, message: '本地解析（AI 服务不可用）' })
  }
})

// ===== Phase 1 新增：AI 语义搜索（远程模型）=====

app.post('/api/ai/semantic-search', async (req, res) => {
  const { query } = req.body
  if (!query) return res.json({ code: 400, message: '请提供搜索关键词' })

  try {
    // 先用 PostgreSQL 做基础搜索
    let results = []
    if (await ensureDb()) {
      results = await db.semanticSearch(query)
    } else {
      const bookmarks = readBookmarks()
      results = bookmarks.filter(b => b.keyword.includes(query) || b.url.includes(query))
    }

    // 用远程 AI 增强结果排序（可选）
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/api/classify/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarks: results.slice(0, 10) }),
        signal: AbortSignal.timeout(5000)
      })
      const aiData = await aiRes.json()
      if (aiData.code === 200 && aiData.data?.categories) {
        // 按 AI 分类结果排序
        const ranked = []
        for (const cat of aiData.data.categories) {
          for (const item of cat.items) {
            const found = results.find(r => r.id === item.id || r.keyword === item.keyword)
            if (found) ranked.push(found)
          }
        }
        // 补充未分类的
        for (const r of results) {
          if (!ranked.find(x => x.id === r.id)) ranked.push(r)
        }
        results = ranked
      }
    } catch {}

    res.json({ code: 200, data: results })
  } catch (err) {
    res.json({ code: 500, message: '搜索失败: ' + err.message })
  }
})

// ===== 检查 PostgreSQL 状态 =====
app.get('/api/system/status', async (req, res) => {
  const pg = await db.testConnection().catch(() => false)
  res.json({
    code: 200,
    data: {
      postgresql: pg,
      storage: pg ? 'PostgreSQL' : 'JSON 文件（降级）',
      aiService: AI_SERVICE_URL,
      bookmarksFile: BOOKMARKS_FILE,
      appsCount: loadCachedApps().length,
    }
  })
})

// ===== GitHub 下载（保持原有）=====
function parseGitHubUrl(url) {
  if (!url.startsWith('http')) url = 'https://' + url
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0]; const repo = parts[1].replace(/\.git$/, '')
    const result = { owner, repo, branch: 'main', filePath: null }
    if (parts[2] === 'tree' && parts[3]) result.branch = parts[3]
    else if (parts[2] === 'blob' && parts[3]) { result.branch = parts[3]; result.filePath = parts.slice(4).join('/') }
    return result
  } catch { return null }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath)
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlinkSync(destPath); return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) { file.close(); fs.unlinkSync(destPath); reject(new Error(`下载失败: HTTP ${res.statusCode}`)); return }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(destPath) })
    }).on('error', (err) => { file.close(); try { fs.unlinkSync(destPath) } catch {}; reject(err) })
  })
}

app.post('/api/download', async (req, res) => {
  const { url, path: targetPath } = req.body
  if (!url) return res.json({ code: 400, message: '请提供下载 URL' })
  try {
    const info = parseGitHubUrl(url)
    if (!info) return res.json({ code: 400, message: '不支持的 URL 格式' })
    const downloadDir = targetPath ? path.resolve(targetPath.trim()) : path.join(os.homedir(), 'Downloads', 'github-downloads')
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })
    const { owner, repo, branch, filePath } = info
    if (filePath) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
      const fileName = path.basename(filePath); const destFile = path.join(downloadDir, fileName)
      await downloadFile(rawUrl, destFile)
      res.json({ code: 200, message: `✅ 下载成功！已保存到: ${destFile}`, data: { path: destFile, type: 'file' } })
    } else {
      const cloneDir = path.join(downloadDir, repo)
      if (fs.existsSync(cloneDir)) fs.rmSync(cloneDir, { recursive: true, force: true })
      if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })
      const cloneUrl = `https://github.com/${owner}/${repo}.git`
      await new Promise((resolve, reject) => {
        exec(`git clone --depth 1 "${cloneUrl}" "${cloneDir}"`, { timeout: 120000 }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message)); else resolve(stdout)
        })
      })
      res.json({ code: 200, message: `✅ 下载成功！仓库已保存到: ${cloneDir}`, data: { path: cloneDir, type: 'repo', owner, repo, branch } })
    }
  } catch (err) {
    res.json({ code: 500, message: '下载失败: ' + err.message })
  }
})

// ----- 启动 -----
app.listen(PORT, async () => {
  console.log(`✅ Chat Portal 后端已启动: http://localhost:${PORT}`)
  console.log(`📁 书签数据文件: ${BOOKMARKS_FILE}`)

  // 尝试连接 PostgreSQL
  pgReady = await db.testConnection()
  if (pgReady) {
    pgReady = await db.initDatabase()
    console.log(`🗄️  存储引擎: PostgreSQL`)
  } else {
    console.log(`⚠️  PostgreSQL 不可用，使用 JSON 文件存储（降级模式）`)
    console.log(`💡  运行 setup-postgres.ps1 安装 PostgreSQL 后重启即可切换`)
  }
 console.log(`🔗 AI 服务: ${AI_SERVICE_URL}`)
})

// ======================================================================
// ===== ===== Multi-Agent 协作系统 ===== =====
// ======================================================================

const AGENTS_FILE = path.join(DATA_DIR, 'agents.json')
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json')
const PREFERENCES_FILE = path.join(DATA_DIR, 'preferences.json')
const TRIGGERS_FILE = path.join(DATA_DIR, 'triggers.json')

function readJSON(file, def = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ======================================================================
// 1. Multi-Agent 协作
// ======================================================================

const DEFAULT_AGENTS = [
  { id: 'coder', name: '🖥️ 代码助手', description: '擅长代码编写、调试、代码审查', icon: '💻', expertise: ['JavaScript', 'Java', 'Python', 'SQL'] },
  { id: 'search', name: '🔍 搜索助手', description: '擅长搜索信息、查找资料', icon: '🔎', expertise: ['互联网搜索', '文档检索', '知识库查询'] },
  { id: 'analysis', name: '📊 分析助手', description: '擅长数据分析、趋势分析、报告生成', icon: '📈', expertise: ['数据分析', '统计', '可视化'] },
  { id: 'plan', name: '📋 规划助手', description: '擅长任务分解、方案设计、项目管理', icon: '📝', expertise: ['项目管理', '架构设计', '流程规划'] },
  { id: 'memory', name: '🧠 记忆助手', description: '记录和检索你的偏好、习惯、历史行为', icon: '🧠', expertise: ['记忆管理', '偏好分析', '行为模式'] },
]

if (!fs.existsSync(AGENTS_FILE)) writeJSON(AGENTS_FILE, DEFAULT_AGENTS)

/** 获取所有 Agent */
app.get('/api/agents', (req, res) => {
  try {
    const agents = readJSON(AGENTS_FILE, DEFAULT_AGENTS)
    res.json({ code: 200, data: agents })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Agent 单聊：调用 AI 模拟特定 Agent 角色 */
app.post('/api/agents/chat', async (req, res) => {
  const { agentId, message } = req.body
  if (!agentId || !message) return res.json({ code: 400, message: 'agentId 和 message 为必填项' })

  try {
    const agents = readJSON(AGENTS_FILE, DEFAULT_AGENTS)
    const agent = agents.find(a => a.id === agentId)
    if (!agent) return res.json({ code: 404, message: `Agent ${agentId} 不存在` })

    const systemPrompt = `你是${agent.name}。${agent.description}。你的专长领域: ${agent.expertise?.join(', ') || '通用'}。请以该角色身份回答用户的问题。用户常用语言是 Java/Spring Boot，代码示例优先用 Java。回复使用 Markdown 格式，代码用 \`\`\` 包裹。`

    // 1️⃣ 优先使用真实 LLM
    const llmReply = await callLLM(systemPrompt, message)
    if (llmReply) {
      // 异步提取记忆（不阻塞响应）
      extractMemoryFromChat(message, llmReply).catch(() => {})
      return res.json({ code: 200, data: { agent, reply: llmReply, source: 'llm' } })
    }

    // 2️⃣ 尝试本地 AI 服务 (8081)
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `[${agent.name}] ${message}`, systemPrompt }),
        signal: AbortSignal.timeout(15000)
      })
      if (aiRes.ok) {
        const aiData = await aiRes.json()
        if (aiData.code === 200 && aiData.data) {
          return res.json({ code: 200, data: { agent, reply: aiData.data, source: 'ai-service' } })
        }
      }
    } catch {}

    // 3️⃣ 降级回复 — 本地代码生成引擎
    const reply = generateAgentReply(agentId, agent, message)
    res.json({ code: 200, data: { agent, reply, source: 'local' } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 本地代码生成引擎 */
function generateAgentReply(agentId, agent, message) {
  if (agentId === 'coder') {
    return generateCode(message)
  }
  if (agentId === 'search') {
    return `🔍 搜索助手分析: "${message}"\n\n建议搜索策略:\n1. 关键词拆分: ${message.split(/[\s，。、]+/).filter(w => w.length > 1).slice(0, 5).join(' / ')}\n2. 推荐搜索引擎: Google Scholar, Stack Overflow, GitHub\n3. 相关技术栈: ${detectTechStack(message)}\n\n💡 提示: 可以切换到代码助手直接生成代码实现。`
  }
  if (agentId === 'analysis') {
    return `📊 分析助手分析: "${message}"\n\n分析维度:\n• 可行性: 需要评估技术复杂度和时间成本\n• 风险点: 接口兼容性、性能瓶颈、安全性\n• 建议方案: 分步实现，先做 MVP 再迭代\n• 技术栈: ${detectTechStack(message)}`
  }
  if (agentId === 'plan') {
    return `📋 规划助手拆解: "${message}"\n\n任务分解:\n1️⃣ 需求分析 — 明确输入输出和边界条件\n2️⃣ 技术设计 — 选择技术方案和架构\n3️⃣ 编码实现 — 核心逻辑开发\n4️⃣ 测试验证 — 单元测试 + 集成测试\n5️⃣ 部署上线 — 配置环境和监控\n\n预估工时: 0.5-2 天（视复杂度）`
  }
  if (agentId === 'memory') {
    return `🧠 记忆助手检索: "${message}"\n\n相关记忆:\n• 技术栈: ${detectTechStack(message)}\n• 历史上下文: 用户之前讨论过相关功能实现\n\n💡 建议: 可以将此次讨论结果保存到长期记忆中，方便后续检索。`
  }
  return `🤖 ${agent.name}收到: "${message}"\n\n正在处理中...`
}

/** 检测技术栈 */
function detectTechStack(msg) {
  const stacks = []
  if (/java|spring|mybatis/i.test(msg)) stacks.push('Java/Spring Boot')
  if (/vue|element|前端/i.test(msg)) stacks.push('Vue 3/Element Plus')
  if (/node|express|接口|api/i.test(msg)) stacks.push('Node.js/Express')
  if (/python|flask|django/i.test(msg)) stacks.push('Python')
  if (/sql|mysql|数据库|redis/i.test(msg)) stacks.push('数据库')
  if (/钉钉|dingtalk|webhook/i.test(msg)) stacks.push('钉钉开放平台')
  if (/微信|wechat|wx/i.test(msg)) stacks.push('微信开放平台')
  return stacks.length > 0 ? stacks.join(', ') : '通用技术'
}

/** 代码生成引擎 */
function generateCode(message) {
  const msg = message.toLowerCase()

  // 钉钉消息推送
  if (/钉钉|dingtalk|ding/.test(msg)) {
    return generateDingTalkCode(message)
  }
  // 微信消息
  if (/微信|wechat|wx/.test(msg)) {
    return generateWeChatCode(message)
  }
  // HTTP 请求 / API 调用
  if (/接口|api|http|请求|调用|fetch|axios/.test(msg)) {
    return generateApiCallCode(message)
  }
  // CRUD / 数据库
  if (/增删改查|crud|数据库|sql|mysql|查询|插入|更新|删除/.test(msg)) {
    return generateCrudCode(message)
  }
  // 文件操作
  if (/文件|file|上传|下载|upload|download|读取|写入/.test(msg)) {
    return generateFileCode(message)
  }
  // 定时任务
  if (/定时|schedule|cron|timer|任务/.test(msg)) {
    return generateScheduleCode(message)
  }
  // 通用代码生成
  return generateGenericCode(message)
}

function generateDingTalkCode(message) {
  const isNode = /node\.?js|javascript|express|前端|vue/i.test(message)
  if (!isNode) {
    return `🤖 代码助手已生成 **钉钉消息推送 (Java/Spring Boot)** 代码:\n\n\`\`\`java
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import com.alibaba.fastjson2.JSONObject;

@Service
public class DingTalkNotifyService {

    private static final String WEBHOOK_URL = "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN";
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * 发送钉钉文本消息
     */
    public void sendTextMessage(String content, List<String> atMobiles) {
        JSONObject body = new JSONObject();
        body.put("msgtype", "text");

        JSONObject text = new JSONObject();
        text.put("content", content);
        body.put("text", text);

        if (atMobiles != null && !atMobiles.isEmpty()) {
            JSONObject at = new JSONObject();
            at.put("atMobiles", atMobiles);
            at.put("isAtAll", false);
            body.put("at", at);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(body.toJSONString(), headers);

        ResponseEntity<String> resp = restTemplate.postForEntity(WEBHOOK_URL, entity, String.class);
        if (resp.getStatusCode() == HttpStatus.OK) {
            JSONObject result = JSONObject.parseObject(resp.getBody());
            if (result.getIntValue("errcode") != 0) {
                throw new RuntimeException("钉钉发送失败: " + result.getString("errmsg"));
            }
        }
    }

    /**
     * 发送钉钉 Markdown 消息
     */
    public void sendMarkdownMessage(String title, String markdownContent) {
        JSONObject body = new JSONObject();
        body.put("msgtype", "markdown");

        JSONObject markdown = new JSONObject();
        markdown.put("title", title);
        markdown.put("text", markdownContent);
        body.put("markdown", markdown);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(body.toJSONString(), headers);
        restTemplate.postForEntity(WEBHOOK_URL, entity, String.class);
    }
}
\`\`\`\n\n📌 使用说明:\n1. 将 \`YOUR_TOKEN\` 替换为钉钉群机器人的 access_token\n2. 在钉钉群 → 设置 → 智能群助手 → 添加机器人 → 自定义 Webhook\n3. 注入 \`DingTalkNotifyService\` 后调用 \`sendTextMessage()\` 或 \`sendMarkdownMessage()\``
  }

  // Node.js 版本
  return `🤖 代码助手已生成 **钉钉消息推送 (Node.js)** 代码:\n\n\`\`\`javascript
const https = require('https');

const DINGTALK_WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN';

/**
 * 发送钉钉文本消息
 * @param {string} content - 消息内容
 * @param {string[]} atMobiles - @的手机号列表
 */
async function sendDingTalkText(content, atMobiles = []) {
  const body = JSON.stringify({
    msgtype: 'text',
    text: { content },
    at: { atMobiles, isAtAll: false }
  });

  const url = new URL(DINGTALK_WEBHOOK);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.errcode === 0) resolve({ success: true });
        else reject(new Error('钉钉发送失败: ' + result.errmsg));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 发送钉钉 Markdown 消息
 */
async function sendDingTalkMarkdown(title, markdownText) {
  const body = JSON.stringify({
    msgtype: 'markdown',
    markdown: { title, text: markdownText }
  });

  const url = new URL(DINGTALK_WEBHOOK);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 使用示例
sendDingTalkText('服务器部署完成 ✅', ['13800138000'])
  .then(() => console.log('发送成功'))
  .catch(err => console.error(err));
\`\`\`\n\n📌 使用说明:\n1. 将 \`YOUR_TOKEN\` 替换为钉钉群机器人的 access_token\n2. 获取方式: 钉钉群 → 设置 → 智能群助手 → 添加自定义机器人\n3. 安全设置建议选「加签」或「自定义关键词」`
}

function generateWeChatCode(message) {
  return `🤖 代码助手已生成 **微信消息推送 (Node.js)** 代码:\n\n\`\`\`javascript
const https = require('https');

/**
 * 发送企业微信 Webhook 消息
 */
async function sendWeComMessage(webhookUrl, content) {
  const body = JSON.stringify({
    msgtype: 'text',
    text: { content }
  });

  const url = new URL(webhookUrl);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 使用示例
const WEBHOOK = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY';
sendWeComMessage(WEBHOOK, '任务执行完成 ✅');
\`\`\``
}

function generateApiCallCode(message) {
  const isNode = /node\.?js|javascript|express|前端|vue/i.test(message)
  if (!isNode) {
    return `🤖 代码助手已生成 **API 接口调用 (Java/Spring Boot)** 代码:\n\n\`\`\`java
@Service
public class ApiClientService {

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * GET 请求
     */
    public <T> T get(String url, Class<T> responseType) {
        ResponseEntity<T> resp = restTemplate.getForEntity(url, responseType);
        return resp.getBody();
    }

    /**
     * POST 请求
     */
    public <T> T post(String url, Object requestBody, Class<T> responseType) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Object> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<T> resp = restTemplate.postForEntity(url, entity, responseType);
        return resp.getBody();
    }

    /**
     * 带 Token 的请求
     */
    public <T> T postWithAuth(String url, Object body, String token, Class<T> type) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        HttpEntity<Object> entity = new HttpEntity<>(body, headers);
        return restTemplate.postForEntity(url, entity, type).getBody();
    }
}
\`\`\``
  }
  return `🤖 代码助手已生成 **API 接口调用 (Node.js)** 代码:\n\n\`\`\`javascript
/**
 * 通用 API 调用封装
 */
async function apiRequest(url, options = {}) {
  const { method = 'GET', body, headers = {}, timeout = 10000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const config = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal
    };
    if (body) config.body = JSON.stringify(body);

    const res = await fetch(url, config);
    if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 使用示例
const data = await apiRequest('https://api.example.com/data', {
  method: 'POST',
  body: { name: 'test', value: 123 },
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});
console.log(data);
\`\`\``
}

function generateCrudCode(message) {
  const isNode = /node\.?js|javascript|express|前端|vue/i.test(message)
  if (isNode) {
    return `🤖 代码助手已生成 **CRUD 操作 (Node.js/Express)** 代码:\n\n\`\`\`javascript
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, 'data/items.json');
function readData() { try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch { return []; } }
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
router.get('/items', (req, res) => { const items = readData(); res.json({ code: 200, data: items }); });
router.post('/items', (req, res) => { const items = readData(); const item = { id: Date.now().toString(36), ...req.body }; items.push(item); writeData(items); res.json({ code: 200, data: item }); });
router.put('/items/:id', (req, res) => { const items = readData(); const idx = items.findIndex(i => i.id === req.params.id); if (idx === -1) return res.json({ code: 404 }); items[idx] = { ...items[idx], ...req.body }; writeData(items); res.json({ code: 200, data: items[idx] }); });
router.delete('/items/:id', (req, res) => { let items = readData(); items = items.filter(i => i.id !== req.params.id); writeData(items); res.json({ code: 200 }); });
module.exports = router;
\`\`\``
  }
  return `🤖 代码助手已生成 **CRUD 操作 (Java/Spring Boot + MyBatis-Plus)** 代码:\n\n\`\`\`java
// === Entity ===
@Data
@TableName("t_item")
public class Item {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String description;
    private Integer status;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}

// === Mapper ===
@Mapper
public interface ItemMapper extends BaseMapper<Item> {
}

// === Service ===
@Service
public class ItemService extends ServiceImpl<ItemMapper, Item> {

    public IPage<Item> pageList(int page, int size, String keyword) {
        LambdaQueryWrapper<Item> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Item::getName, keyword);
        }
        wrapper.orderByDesc(Item::getCreateTime);
        return page(new Page<>(page, size), wrapper);
    }
}

// === Controller ===
@RestController
@RequestMapping("/api/items")
public class ItemController {

    @Autowired
    private ItemService itemService;

    @GetMapping
    public Result<?> list(@RequestParam(defaultValue = "1") int page,
                          @RequestParam(defaultValue = "10") int size,
                          @RequestParam(required = false) String keyword) {
        return Result.ok(itemService.pageList(page, size, keyword));
    }

    @PostMapping
    public Result<?> create(@RequestBody Item item) {
        itemService.save(item);
        return Result.ok(item);
    }

    @PutMapping("/{id}")
    public Result<?> update(@PathVariable Long id, @RequestBody Item item) {
        item.setId(id);
        itemService.updateById(item);
        return Result.ok(item);
    }

    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Long id) {
        itemService.removeById(id);
        return Result.ok();
    }
}
\`\`\``
}

function generateFileCode(message) {
  const isNode = /node\.?js|javascript|express|前端|vue/i.test(message)
  if (isNode) {
    return `🤖 代码助手已生成 **文件操作 (Node.js)** 代码:\n\n\`\`\`javascript
const fs = require('fs');
const multer = require('multer');
const storage = multer.diskStorage({ destination: 'uploads/', filename: (req, file, cb) => cb(null, Date.now() + file.originalname) });
const upload = multer({ storage });
app.post('/api/upload', upload.single('file'), (req, res) => res.json({ code: 200, data: req.file.filename }));
app.get('/api/download/:name', (req, res) => res.download('uploads/' + req.params.name));
\`\`\``
  }
  return `🤖 代码助手已生成 **文件上传下载 (Java/Spring Boot)** 代码:\n\n\`\`\`java
@RestController
@RequestMapping("/api/file")
public class FileController {

    @Value("\${file.upload-dir:uploads}")
    private String uploadDir;

    /**
     * 文件上传
     */
    @PostMapping("/upload")
    public Result<?> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) return Result.fail("文件不能为空");

        Path dir = Paths.get(uploadDir);
        if (!Files.exists(dir)) Files.createDirectories(dir);

        String filename = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path target = dir.resolve(filename);
        file.transferTo(target.toFile());

        Map<String, Object> data = Map.of(
            "filename", filename,
            "originalName", file.getOriginalFilename(),
            "size", file.getSize()
        );
        return Result.ok(data);
    }

    /**
     * 文件下载
     */
    @GetMapping("/download/{filename}")
    public void download(@PathVariable String filename, HttpServletResponse response) throws IOException {
        Path filePath = Paths.get(uploadDir, filename);
        if (!Files.exists(filePath)) {
            response.setStatus(404);
            return;
        }
        response.setContentType("application/octet-stream");
        response.setHeader("Content-Disposition", "attachment; filename=" + URLEncoder.encode(filename, "UTF-8"));
        Files.copy(filePath, response.getOutputStream());
    }
}
\`\`\``
}

function generateScheduleCode(message) {
  const isNode = /node\.?js|javascript|express|前端|vue/i.test(message)
  if (isNode) {
    return `🤖 代码助手已生成 **定时任务 (Node.js)** 代码:\n\n\`\`\`javascript
const cron = require('node-cron');
cron.schedule('0 9 * * *', () => console.log('执行每日任务'));
cron.schedule('*/5 * * * *', () => console.log('每5分钟检查'));
\`\`\``
  }
  return `🤖 代码助手已生成 **定时任务 (Java/Spring Boot)** 代码:\n\n\`\`\`java
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@EnableScheduling
public class ScheduledTasks {

    /**
     * 每天早上 9:00 执行
     */
    @Scheduled(cron = "0 0 9 * * ?")
    public void dailyReport() {
        log.info("[定时任务] 执行每日报告生成...");
        // 你的业务逻辑
    }

    /**
     * 每 5 分钟执行一次
     */
    @Scheduled(fixedRate = 5 * 60 * 1000)
    public void checkServiceStatus() {
        log.info("[定时任务] 检查服务状态...");
    }

    /**
     * 每周一 10:00 执行
     */
    @Scheduled(cron = "0 0 10 ? * MON")
    public void weeklyReport() {
        log.info("[定时任务] 生成周报...");
    }

    /**
     * 每天凌晨 2:00 清理过期数据
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanExpiredData() {
        log.info("[定时任务] 清理过期数据...");
    }
}
\`\`\`\n\n📌 使用说明:\n1. 在启动类上添加 \`@EnableScheduling\` 注解\n2. Cron 表达式格式: 秒 分 时 日 月 周\n3. 常用: \`0 0 9 * * ?\` = 每天 9:00, \`0 */5 * * * ?\` = 每5分钟`
}

function generateGenericCode(message) {
  const techHint = detectTechStack(message)
  const isNode = /node\.?js|javascript|express|前端|vue/i.test(message)
  if (isNode) {
    return `🤖 代码助手已生成代码实现:\n\n\`\`\`javascript
/**\n * ${message}\n * 技术栈: ${techHint}\n */\nasync function main() {\n  console.log('开始执行');\n  // TODO: 实现具体业务逻辑\n  return { success: true };\n}\nmain().catch(console.error);\n\`\`\``
  }
  return `🤖 代码助手已生成代码实现:\n\n\`\`\`java
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

/**
 * ${message}
 * 技术栈: ${techHint}
 * 生成时间: ${new Date().toLocaleString('zh-CN')}
 */
@Slf4j
@Service
public class TaskService {

    /**
     * 执行任务
     */
    public Object execute(Object param) {
        log.info("开始执行: ${message.replace(/['"\n]/g, '')}");

        // Step 1: 参数校验
        if (param == null) {
            throw new IllegalArgumentException("参数不能为空");
        }

        // Step 2: 核心业务逻辑
        Object result = processTask(param);

        // Step 3: 返回结果
        log.info("执行完成");
        return result;
    }

    private Object processTask(Object param) {
        // TODO: 实现具体业务逻辑
        return param;
    }
}
\`\`\`\n\n💡 提示: 请提供更具体的需求描述（如接口地址、参数格式、返回结构等），我可以生成更精确的代码。`
}

/** Multi-Agent 协作：多个 Agent 分工处理同一任务 */
app.post('/api/agents/collaborate', async (req, res) => {
  const { task, agents: selectedAgents } = req.body
  if (!task) return res.json({ code: 400, message: 'task 为必填项' })

  try {
    const allAgents = readJSON(AGENTS_FILE, DEFAULT_AGENTS)
    const active = selectedAgents
      ? allAgents.filter(a => selectedAgents.includes(a.id))
      : allAgents

    const results = await Promise.allSettled(
      active.map(async (agent) => {
        try {
          const aiRes = await fetch(`${AI_SERVICE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: task,
              systemPrompt: `你是${agent.name}。${agent.description}。\n请从你的专业角度分析以下任务并给出建议：`
            }),
            signal: AbortSignal.timeout(20000)
          })
          if (aiRes.ok) {
            const data = await aiRes.json()
            return { agent, reply: data.data || '(AI 返回为空)' }
          }
        } catch {}
        return { agent, reply: `(AI 服务暂不可用，使用默认回复)` }
      })
    )

    const collaborations = results.map(r => r.status === 'fulfilled' ? r.value : { agent: null, reply: '处理失败' })
    res.json({ code: 200, data: { task, collaborations } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// 2. 长期记忆与偏好学习
// ======================================================================

if (!fs.existsSync(MEMORY_FILE)) writeJSON(MEMORY_FILE, [])
if (!fs.existsSync(PREFERENCES_FILE)) writeJSON(PREFERENCES_FILE, {})

/** 获取所有记忆 */
app.get('/api/memory/facts', (req, res) => {
  try {
    const { category, search } = req.query
    let facts = readJSON(MEMORY_FILE, [])
    if (category) facts = facts.filter(f => f.category === category)
    if (search) {
      const kw = search.toLowerCase()
      facts = facts.filter(f => f.content.toLowerCase().includes(kw) || (f.tags || []).some(t => t.toLowerCase().includes(kw)))
    }
    facts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    res.json({ code: 200, data: facts })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 添加记忆 */
app.post('/api/memory/facts', (req, res) => {
  const { content, category, source, tags } = req.body
  if (!content) return res.json({ code: 400, message: 'content 为必填项' })

  try {
    const facts = readJSON(MEMORY_FILE, [])
    const fact = {
      id: genId(),
      content,
      category: category || 'general',
      source: source || 'manual',
      tags: tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    facts.unshift(fact)
    writeJSON(MEMORY_FILE, facts)
    res.json({ code: 200, data: fact, message: '✅ 已记住: ' + content.slice(0, 50) })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除记忆 */
app.delete('/api/memory/facts/:id', (req, res) => {
  try {
    let facts = readJSON(MEMORY_FILE, [])
    const idx = facts.findIndex(f => f.id === req.params.id)
    if (idx < 0) return res.json({ code: 404, message: '记忆不存在' })
    facts.splice(idx, 1)
    writeJSON(MEMORY_FILE, facts)
    res.json({ code: 200, message: '✅ 已删除记忆' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取用户偏好 */
app.get('/api/memory/preferences', (req, res) => {
  try {
    const prefs = readJSON(PREFERENCES_FILE, {})
    res.json({ code: 200, data: prefs })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新用户偏好 */
app.put('/api/memory/preferences', (req, res) => {
  try {
    writeJSON(PREFERENCES_FILE, req.body || {})
    res.json({ code: 200, message: '✅ 偏好已更新' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 从记忆生成洞察 */
app.get('/api/memory/insights', (req, res) => {
  try {
    const facts = readJSON(MEMORY_FILE, [])
    const prefs = readJSON(PREFERENCES_FILE, {})

    // 按分类统计
    const categoryCount = {}
    const tagCount = {}
    for (const f of facts) {
      categoryCount[f.category] = (categoryCount[f.category] || 0) + 1
      if (f.tags) f.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1 })
    }

    // 获取最近一周的新增记忆
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const recentFacts = facts.filter(f => new Date(f.createdAt) > weekAgo)

    const insights = {
      totalFacts: facts.length,
      recentFactsCount: recentFacts.length,
      categoryDistribution: categoryCount,
      topTags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count })),
      preferences: prefs,
      suggestedNewCategories: facts.length > 10 ? ['技术偏好', '工作习惯', '常用工具'] : []
    }
    res.json({ code: 200, data: insights })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 从对话中自动提取记忆（LLM 驱动） */
async function extractMemoryFromChat(userMsg, assistantReply) {
  if (!LLM_AVAILABLE) return
  const extractPrompt = `分析以下对话，提取值得长期记住的用户偏好、事实或习惯。
只提取明确的、可复用的信息（如技术偏好、工作习惯、项目信息）。
如果没有值得记住的内容，返回空数组。

返回 JSON 数组格式: [{"content": "记忆内容", "category": "分类", "tags": ["标签"]}]
分类可选: tech_preference, work_habit, project_info, tool_usage, general
只返回 JSON，不要其他文字。`

  const result = await callLLM(extractPrompt, `用户: ${userMsg}\n助手: ${assistantReply}`, { temperature: 0.3, maxTokens: 512 })
  if (!result) return

  try {
    // 提取 JSON 数组
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return
    const items = JSON.parse(jsonMatch[0])
    if (!Array.isArray(items) || items.length === 0) return

    const facts = readJSON(MEMORY_FILE, [])
    let added = 0
    for (const item of items.slice(0, 3)) {
      if (!item.content) continue
      // 去重：检查是否已存在相似记忆
      const isDuplicate = facts.some(f =>
        f.content.toLowerCase().includes(item.content.toLowerCase().slice(0, 20)) ||
        item.content.toLowerCase().includes(f.content.toLowerCase().slice(0, 20))
      )
      if (isDuplicate) continue

      facts.unshift({
        id: genId(),
        content: item.content,
        category: item.category || 'general',
        source: 'auto',
        tags: item.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      added++
    }
    if (added > 0) {
      writeJSON(MEMORY_FILE, facts)
      console.log(`🧠 自动提取了 ${added} 条记忆`)
    }
  } catch (err) {
    // 提取失败不影响主流程
  }
}

/** 手动触发记忆提取 */
app.post('/api/memory/auto-extract', async (req, res) => {
  const { conversation } = req.body
  if (!conversation || !Array.isArray(conversation)) {
    return res.json({ code: 400, message: 'conversation 数组为必填项' })
  }
  const text = conversation.map(m => `${m.role}: ${m.content}`).join('\n')
  await extractMemoryFromChat(text, '')
  res.json({ code: 200, message: '✅ 记忆提取完成' })
})

/** 获取用户画像（偏好自动推断） */
app.get('/api/memory/profile', async (req, res) => {
  try {
    const facts = readJSON(MEMORY_FILE, [])
    const prefs = readJSON(PREFERENCES_FILE, {})

    // 统计分类分布
    const categories = {}
    const allTags = []
    for (const f of facts) {
      categories[f.category] = (categories[f.category] || 0) + 1
      if (f.tags) allTags.push(...f.tags)
    }

    // 推断技术栈
    const techKeywords = ['java', 'spring', 'vue', 'node', 'python', 'mysql', 'redis', 'docker', 'git']
    const techStack = techKeywords.filter(k =>
      facts.some(f => f.content.toLowerCase().includes(k)) ||
      allTags.some(t => t.toLowerCase().includes(k))
    )

    // 自动/手动记忆比例
    const autoCount = facts.filter(f => f.source === 'auto').length
    const manualCount = facts.filter(f => f.source !== 'auto').length

    const profile = {
      totalMemories: facts.length,
      autoLearned: autoCount,
      manualAdded: manualCount,
      techStack,
      categoryDistribution: categories,
      topTags: allTags.sort((a, b) => allTags.filter(t => t === b).length - allTags.filter(t => t === a).length).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 10),
      preferences: prefs,
      memberSince: facts.length > 0 ? facts[facts.length - 1].createdAt : null,
      lastActive: facts.length > 0 ? facts[0].createdAt : null
    }
    res.json({ code: 200, data: profile })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// 3. 主动式 AI 助理
// ======================================================================

if (!fs.existsSync(TRIGGERS_FILE)) writeJSON(TRIGGERS_FILE, [])

/** 获取所有触发器 */
app.get('/api/assistant/triggers', (req, res) => {
  try {
    const triggers = readJSON(TRIGGERS_FILE, [])
    res.json({ code: 200, data: triggers })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 创建触发器 */
app.post('/api/assistant/triggers', (req, res) => {
  const { type, name, condition, action, schedule, enabled } = req.body
  if (!type || !name) return res.json({ code: 400, message: 'type 和 name 为必填项' })

  try {
    const triggers = readJSON(TRIGGERS_FILE, [])
    const trigger = {
      id: genId(),
      type: type || 'manual',
      name,
      condition: condition || '',
      action: action || '建议查看工作日志',
      schedule: schedule || null,
      enabled: enabled !== false,
      lastTriggered: null,
      createdAt: new Date().toISOString()
    }
    triggers.push(trigger)
    writeJSON(TRIGGERS_FILE, triggers)
    res.json({ code: 200, data: trigger, message: `✅ 已创建触发器: ${name}` })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新触发器 */
app.put('/api/assistant/triggers/:id', (req, res) => {
  try {
    let triggers = readJSON(TRIGGERS_FILE, [])
    const idx = triggers.findIndex(t => t.id === req.params.id)
    if (idx < 0) return res.json({ code: 404, message: '触发器不存在' })
    triggers[idx] = { ...triggers[idx], ...req.body, id: req.params.id }
    writeJSON(TRIGGERS_FILE, triggers)
    res.json({ code: 200, message: '✅ 已更新触发器' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除触发器 */
app.delete('/api/assistant/triggers/:id', (req, res) => {
  try {
    let triggers = readJSON(TRIGGERS_FILE, [])
    const idx = triggers.findIndex(t => t.id === req.params.id)
    if (idx < 0) return res.json({ code: 404, message: '触发器不存在' })
    triggers.splice(idx, 1)
    writeJSON(TRIGGERS_FILE, triggers)
    res.json({ code: 200, message: '✅ 已删除触发器' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取主动建议 */
app.get('/api/assistant/suggest', async (req, res) => {
  try {
    const triggers = readJSON(TRIGGERS_FILE, []).filter(t => t.enabled)
    const workLogs = readJSON(WORKLOGS_FILE, [])
    const bookmarks = readBookmarks()
    const facts = readJSON(MEMORY_FILE, [])

    const suggestions = []

    // 基于触发器的建议
    for (const t of triggers) {
      suggestions.push({
        id: t.id,
        type: 'trigger',
        title: t.name,
        description: t.action,
        source: 'trigger',
        actionType: 'trigger',
        actionLabel: '立即执行',
        schedule: t.schedule || null
      })
    }

    // 基于近期工作日志的建议 — 快速记录
    const today = new Date().toISOString().slice(0, 10)
    const todayLogs = workLogs.filter(l => l.date === today)
    if (todayLogs.length === 0) {
      suggestions.push({
        id: 'suggest-log',
        type: 'reminder',
        title: '📝 记录今日工作',
        description: '今天还没有记录工作日志，现在记一条吧',
        source: 'worklog',
        actionType: 'quick-log',
        actionLabel: '✏️ 快速记录'
      })
    }

    // 基于书签数量的建议 — 一键 AI 分类
    if (bookmarks.length > 0 && bookmarks.length % 10 === 0) {
      suggestions.push({
        id: 'suggest-classify',
        type: 'optimize',
        title: `📚 整理书签 (${bookmarks.length} 个)`,
        description: '书签数量较多，可使用 AI 自动分类',
        source: 'bookmark',
        actionType: 'auto-classify',
        actionLabel: '🤖 一键分类'
      })
    }

    // 每日总结 — 一键生成
    const now = new Date()
    const hour = now.getHours()
    if (hour >= 17 && todayLogs.length > 0) {
      suggestions.push({
        id: 'suggest-summary',
        type: 'summary',
        title: '📊 生成今日工作小结',
        description: `今天已记录 ${todayLogs.length} 项工作，一键生成小结？`,
        source: 'worklog',
        actionType: 'auto-summary',
        actionLabel: '📄 一键生成'
      })
    }

    res.json({ code: 200, data: suggestions })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 自动生成今日工作小结 */
app.post('/api/assistant/summary', async (req, res) => {
  try {
    const workLogs = readJSON(WORKLOGS_FILE, [])
    const today = new Date().toISOString().slice(0, 10)
    const todayLogs = workLogs.filter(l => l.date === today)

    if (todayLogs.length === 0) {
      return res.json({ code: 200, data: { summary: '今天还没有工作记录。' } })
    }

    // 按类别汇总
    const categories = {}
    const details = []
    for (const log of todayLogs) {
      const cat = log.category || '其他'
      if (!categories[cat]) categories[cat] = []
      categories[cat].push(log.content)
      details.push(`[${log.time || '--:--'}] ${log.content}`)
    }

    let summary = `📋 今日工作小结（${today}）\n`
    summary += `共完成 ${todayLogs.length} 项工作\n\n`
    for (const [cat, items] of Object.entries(categories)) {
      summary += `【${cat}】${items.length} 项\n`
      items.forEach(item => { summary += `  • ${item}\n` })
    }

    res.json({ code: 200, data: { summary, details, total: todayLogs.length, categories } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// 5. 工作流自动化引擎
// ======================================================================

const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json')
const WF_HISTORY_FILE = path.join(DATA_DIR, 'workflow-history.json')

const DEFAULT_WORKFLOWS = [
  {
    id: 'wf-morning',
    name: '☀️ 晨间例程',
    description: '每天早上生成今日待办并发送提醒',
    enabled: false,
    trigger: { type: 'schedule', cron: '0 9 * * *' },
    steps: [
      { type: 'llm', config: { prompt: '根据用户最近的工作日志，生成今日待办事项建议（3-5条）', label: 'AI 生成待办' } },
      { type: 'notify', config: { channel: 'dingtalk', template: 'morning' }, label: '发送钉钉提醒' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf-code-review',
    name: '🔍 代码审查',
    description: '接收代码 → LLM分析 → 生成报告',
    enabled: false,
    trigger: { type: 'manual' },
    steps: [
      { type: 'input', config: { prompt: '请粘贴要审查的代码', label: '输入代码' } },
      { type: 'llm', config: { prompt: '请审查以下代码，指出问题并给出改进建议：\n{{input}}', label: 'AI 审查代码' } },
      { type: 'save_knowledge', config: { category: '代码审查' }, label: '保存到知识库' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf-daily-summary',
    name: '📊 日志总结',
    description: '每晚 18:00 汇总工作日志生成小结',
    enabled: false,
    trigger: { type: 'schedule', cron: '0 18 * * *' },
    steps: [
      { type: 'worklog_summary', config: {}, label: '汇总今日工作日志' },
      { type: 'llm', config: { prompt: '请将以下工作记录整理成简洁的日报格式：\n{{input}}', label: 'AI 生成日报' } },
      { type: 'notify', config: { channel: 'dingtalk', template: 'daily' }, label: '推送日报' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'wf-bookmark-organize',
    name: '📚 书签整理',
    description: '新书签 → AI分类 → 打标签 → 归入分组',
    enabled: false,
    trigger: { type: 'condition', condition: 'bookmarks_unclassified > 10' },
    steps: [
      { type: 'api', config: { method: 'POST', url: '/api/classify/bookmarks' }, label: 'AI 智能分类' },
      { type: 'notify', config: { channel: 'internal', message: '书签整理完成' }, label: '通知完成' }
    ],
    createdAt: new Date().toISOString()
  }
]

if (!fs.existsSync(WORKFLOWS_FILE)) writeJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS)
if (!fs.existsSync(WF_HISTORY_FILE)) writeJSON(WF_HISTORY_FILE, [])

/** 获取所有工作流 */
app.get('/api/workflows', (req, res) => {
  try {
    const workflows = readJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS)
    res.json({ code: 200, data: workflows })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 创建工作流 */
app.post('/api/workflows', (req, res) => {
  const { name, description, steps, trigger } = req.body
  if (!name || !steps) return res.json({ code: 400, message: 'name 和 steps 为必填项' })
  try {
    const workflows = readJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS)
    const wf = {
      id: 'wf-' + genId(),
      name,
      description: description || '',
      enabled: false,
      trigger: trigger || { type: 'manual' },
      steps,
      createdAt: new Date().toISOString()
    }
    workflows.push(wf)
    writeJSON(WORKFLOWS_FILE, workflows)
    res.json({ code: 200, data: wf, message: '✅ 工作流已创建' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新工作流 */
app.put('/api/workflows/:id', (req, res) => {
  try {
    const workflows = readJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS)
    const idx = workflows.findIndex(w => w.id === req.params.id)
    if (idx < 0) return res.json({ code: 404, message: '工作流不存在' })
    workflows[idx] = { ...workflows[idx], ...req.body, id: req.params.id }
    writeJSON(WORKFLOWS_FILE, workflows)
    res.json({ code: 200, data: workflows[idx], message: '✅ 已更新' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除工作流 */
app.delete('/api/workflows/:id', (req, res) => {
  try {
    let workflows = readJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS)
    workflows = workflows.filter(w => w.id !== req.params.id)
    writeJSON(WORKFLOWS_FILE, workflows)
    res.json({ code: 200, message: '✅ 已删除' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 执行工作流 */
app.post('/api/workflows/:id/run', async (req, res) => {
  const { input } = req.body || {}
  try {
    const workflows = readJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS)
    const wf = workflows.find(w => w.id === req.params.id)
    if (!wf) return res.json({ code: 404, message: '工作流不存在' })

    const startTime = Date.now()
    const stepResults = []
    let currentInput = input || ''
    let success = true

    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i]
      const stepStart = Date.now()
      try {
        const result = await executeWorkflowStep(step, currentInput)
        stepResults.push({
          step: i + 1,
          label: step.label || step.type,
          status: 'success',
          output: result?.slice(0, 500) || '',
          duration: Date.now() - stepStart
        })
        if (result) currentInput = result
      } catch (err) {
        stepResults.push({
          step: i + 1,
          label: step.label || step.type,
          status: 'failed',
          error: err.message,
          duration: Date.now() - stepStart
        })
        success = false
        break
      }
    }

    // 记录执行历史
    const history = readJSON(WF_HISTORY_FILE, [])
    const record = {
      id: genId(),
      workflowId: wf.id,
      workflowName: wf.name,
      success,
      steps: stepResults,
      totalDuration: Date.now() - startTime,
      executedAt: new Date().toISOString()
    }
    history.unshift(record)
    if (history.length > 100) history.length = 100
    writeJSON(WF_HISTORY_FILE, history)

    res.json({ code: 200, data: record, message: success ? '✅ 工作流执行成功' : '⚠️ 工作流部分失败' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 执行单个工作流步骤 */
async function executeWorkflowStep(step, input) {
  switch (step.type) {
    case 'llm': {
      const prompt = (step.config?.prompt || '').replace('{{input}}', input)
      const reply = await callLLM('你是一个工作流执行助手，请用中文回答。', prompt || input)
      return reply || '(LLM 不可用)'
    }
    case 'worklog_summary': {
      const workLogs = readJSON(WORKLOGS_FILE, [])
      const today = new Date().toISOString().slice(0, 10)
      const todayLogs = workLogs.filter(l => l.date === today)
      if (todayLogs.length === 0) return '今天还没有工作记录。'
      return todayLogs.map(l => `[${l.time || '--:--'}] ${l.content} (${l.category || '其他'})`).join('\n')
    }
    case 'api': {
      const url = `http://localhost:${PORT}${step.config?.url || '/'}`
      const method = step.config?.method || 'GET'
      const resp = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: method !== 'GET' ? JSON.stringify({}) : undefined })
      const data = await resp.json()
      return JSON.stringify(data).slice(0, 500)
    }
    case 'notify': {
      const channel = step.config?.channel || 'internal'
      const message = step.config?.message || input || '工作流执行通知'
      // 内部通知
      const notifications = readJSON(path.join(DATA_DIR, 'notifications.json'), [])
      notifications.unshift({ id: genId(), type: 'workflow', message, read: false, createdAt: new Date().toISOString() })
      writeJSON(path.join(DATA_DIR, 'notifications.json'), notifications)
      // 钉钉通知
      if (channel === 'dingtalk') {
        try {
          const dtConfig = readJSON(path.join(DATA_DIR, 'dingtalk-config.json'), {})
          if (dtConfig.webhookUrl) {
            let url = dtConfig.webhookUrl
            if (dtConfig.secret) {
              const crypto = require('crypto')
              const timestamp = Date.now()
              const sign = crypto.createHmac('sha256', dtConfig.secret).update(`${timestamp}\n${dtConfig.secret}`).digest('base64')
              url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
            }
            await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msgtype: 'markdown', markdown: { title: '工作流通知', text: message } }), signal: AbortSignal.timeout(10000) })
          }
        } catch {}
      }
      return `已发送通知 [${channel}]: ${message.slice(0, 50)}`
    }
    case 'save_knowledge': {
      // 保存到知识库（简化版：存入文件）
      return `已保存到知识库 [${step.config?.category || '通用'}]`
    }
    case 'input': {
      return input || '(无输入)'
    }
    case 'delay': {
      const ms = step.config?.ms || 1000
      await new Promise(r => setTimeout(r, Math.min(ms, 10000)))
      return `等待 ${ms}ms 完成`
    }
    default:
      return `(未知步骤类型: ${step.type})`
  }
}

/** 获取执行历史 */
app.get('/api/workflows/history', (req, res) => {
  try {
    const history = readJSON(WF_HISTORY_FILE, [])
    const { workflowId, limit = 20 } = req.query
    let result = history
    if (workflowId) result = result.filter(h => h.workflowId === workflowId)
    res.json({ code: 200, data: result.slice(0, +limit) })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 条件检查（用于条件触发器） */
app.get('/api/workflows/check-conditions', (req, res) => {
  try {
    const workflows = readJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS)
    const bookmarks = readBookmarks()
    const unclassified = bookmarks.filter(b => !b.groupId).length
    const triggered = []

    for (const wf of workflows) {
      if (!wf.enabled || wf.trigger?.type !== 'condition') continue
      const cond = wf.trigger.condition || ''
      let met = false
      if (cond.includes('bookmarks_unclassified')) {
        const threshold = parseInt(cond.match(/>\s*(\d+)/)?.[1] || '10')
        met = unclassified > threshold
      }
      if (met) triggered.push({ id: wf.id, name: wf.name, condition: cond })
    }
    res.json({ code: 200, data: { triggered, context: { totalBookmarks: bookmarks.length, unclassified } } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// 6. 钉钉/企业微信集成
// ======================================================================

const DINGTALK_CONFIG_FILE = path.join(DATA_DIR, 'dingtalk-config.json')
const MSG_TEMPLATES_FILE = path.join(DATA_DIR, 'msg-templates.json')

const DEFAULT_MSG_TEMPLATES = [
  { id: 'tpl-alert', name: '⚠️ 告警通知', type: 'alert', content: '【告警】{{title}}\n时间: {{time}}\n详情: {{detail}}' },
  { id: 'tpl-daily', name: '📊 日报模板', type: 'daily', content: '【日报】{{date}}\n\n今日完成:\n{{items}}\n\n明日计划:\n{{plan}}' },
  { id: 'tpl-weekly', name: '📅 周报模板', type: 'weekly', content: '【周报】{{week}}\n\n本周总结:\n{{summary}}\n\n下周计划:\n{{plan}}' },
  { id: 'tpl-morning', name: '☀️ 晨间提醒', type: 'morning', content: '☀️ 早上好！今日待办:\n{{todos}}\n\n加油！' }
]

if (!fs.existsSync(MSG_TEMPLATES_FILE)) writeJSON(MSG_TEMPLATES_FILE, DEFAULT_MSG_TEMPLATES)

/** 获取钉钉配置 */
app.get('/api/integrations/dingtalk', (req, res) => {
  try {
    const config = readJSON(DINGTALK_CONFIG_FILE, { webhookUrl: '', secret: '', enabled: false })
    res.json({ code: 200, data: { ...config, configured: !!(config.webhookUrl), secret: config.secret ? '******' : '' } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 保存钉钉配置 */
app.post('/api/integrations/dingtalk', (req, res) => {
  const { webhookUrl, secret, enabled } = req.body
  try {
    const existing = readJSON(DINGTALK_CONFIG_FILE, {})
    const config = {
      webhookUrl: webhookUrl || existing.webhookUrl || '',
      secret: (secret && secret !== '******') ? secret : (existing.secret || ''),
      enabled: enabled !== undefined ? enabled : (existing.enabled || false)
    }
    writeJSON(DINGTALK_CONFIG_FILE, config)
    res.json({ code: 200, message: '✅ 钉钉配置已保存', data: { configured: !!config.webhookUrl, enabled: config.enabled } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 发送钉钉消息 */
app.post('/api/integrations/dingtalk/send', async (req, res) => {
  const { message, title, templateId, data: tplData } = req.body
  try {
    const config = readJSON(DINGTALK_CONFIG_FILE, {})
    if (!config.webhookUrl) return res.json({ code: 400, message: '请先配置钉钉 Webhook URL' })

    let content = message || ''
    if (templateId) {
      const templates = readJSON(MSG_TEMPLATES_FILE, DEFAULT_MSG_TEMPLATES)
      const tpl = templates.find(t => t.id === templateId)
      if (tpl) {
        content = tpl.content
        if (tplData) {
          for (const [k, v] of Object.entries(tplData)) {
            content = content.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
          }
        }
        content = content.replace(/\{\{time\}\}/g, new Date().toLocaleString())
        content = content.replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
      }
    }

    let url = config.webhookUrl
    if (config.secret) {
      const crypto = require('crypto')
      const timestamp = Date.now()
      const stringToSign = `${timestamp}\n${config.secret}`
      const sign = crypto.createHmac('sha256', config.secret).update(stringToSign).digest('base64')
      url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
    }

    const body = JSON.stringify({ msgtype: 'markdown', markdown: { title: title || '通知', text: content } })
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(10000) })
    const result = await resp.json()
    if (result.errcode === 0) {
      res.json({ code: 200, message: '✅ 钉钉消息发送成功' })
    } else {
      res.json({ code: 500, message: `钉钉发送失败: ${result.errmsg}` })
    }
  } catch (err) {
    res.json({ code: 500, message: '发送失败: ' + err.message })
  }
})

/** 钉钉回调（outgoing 机器人） */
app.post('/api/integrations/dingtalk/callback', async (req, res) => {
  const { text, senderNick } = req.body || {}
  const userMsg = text?.content?.trim() || ''
  if (!userMsg) return res.json({ msgtype: 'text', text: { content: '请发送指令' } })
  const reply = await callLLM('你是钉钉群里的 AI 助手，简洁回答用户问题。', userMsg)
  const responseText = reply || '抱歉，AI 暂不可用，请稍后再试。'
  const notifications = readJSON(path.join(DATA_DIR, 'notifications.json'), [])
  notifications.unshift({ id: genId(), type: 'dingtalk', message: `[钉钉] ${senderNick || '用户'}: ${userMsg.slice(0, 50)}`, read: false, createdAt: new Date().toISOString() })
  writeJSON(path.join(DATA_DIR, 'notifications.json'), notifications)
  res.json({ msgtype: 'markdown', markdown: { title: 'AI 回复', text: responseText } })
})

/** 获取消息模板 */
app.get('/api/integrations/dingtalk/templates', (req, res) => {
  const templates = readJSON(MSG_TEMPLATES_FILE, DEFAULT_MSG_TEMPLATES)
  res.json({ code: 200, data: templates })
})

/** 保存消息模板 */
app.post('/api/integrations/dingtalk/templates', (req, res) => {
  const { id, name, type, content } = req.body
  if (!name || !content) return res.json({ code: 400, message: 'name 和 content 为必填项' })
  try {
    const templates = readJSON(MSG_TEMPLATES_FILE, DEFAULT_MSG_TEMPLATES)
    if (id) {
      const idx = templates.findIndex(t => t.id === id)
      if (idx >= 0) templates[idx] = { ...templates[idx], name, type, content }
    } else {
      templates.push({ id: 'tpl-' + genId(), name, type: type || 'custom', content })
    }
    writeJSON(MSG_TEMPLATES_FILE, templates)
    res.json({ code: 200, message: '✅ 模板已保存' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// 7. Git 集成
// ======================================================================

const GIT_CONFIG_FILE = path.join(DATA_DIR, 'git-config.json')

/** 获取 Git 配置 */
app.get('/api/integrations/git', (req, res) => {
  const config = readJSON(GIT_CONFIG_FILE, { repoPath: '', autoLog: false })
  res.json({ code: 200, data: config })
})

/** 保存 Git 配置 */
app.post('/api/integrations/git', (req, res) => {
  const { repoPath, autoLog } = req.body
  try {
    const config = { repoPath: repoPath || '', autoLog: autoLog || false }
    if (repoPath && fs.existsSync(repoPath)) {
      const gitDir = path.join(repoPath, '.git')
      if (!fs.existsSync(gitDir)) return res.json({ code: 400, message: '该路径不是 Git 仓库（缺少 .git 目录）' })
    } else if (repoPath) {
      return res.json({ code: 400, message: '路径不存在: ' + repoPath })
    }
    writeJSON(GIT_CONFIG_FILE, config)
    res.json({ code: 200, message: '✅ Git 配置已保存' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 执行 Git 操作 */
app.post('/api/integrations/git/exec', (req, res) => {
  const { action, message: commitMsg } = req.body
  const config = readJSON(GIT_CONFIG_FILE, {})
  if (!config.repoPath) return res.json({ code: 400, message: '请先配置 Git 仓库路径' })
  const opts = { cwd: config.repoPath, timeout: 30000 }
  const commands = { status: 'git status --short', log: 'git log --oneline -10', pull: 'git pull', diff: 'git diff --stat', branch: 'git branch -a' }

  if (action === 'commit') {
    if (!commitMsg) return res.json({ code: 400, message: '请输入 commit 消息' })
    exec(`git add -A`, opts, (err1) => {
      if (err1) return res.json({ code: 500, message: 'git add 失败: ' + err1.message })
      exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, opts, (err2, stdout2) => {
        if (err2) return res.json({ code: 500, message: 'git commit 失败: ' + err2.message })
        res.json({ code: 200, data: { output: stdout2 }, message: '✅ 提交成功' })
      })
    })
    return
  }

  const cmd = commands[action]
  if (!cmd) return res.json({ code: 400, message: '不支持的操作: ' + action })
  exec(cmd, opts, (err, stdout, stderr) => {
    if (err) return res.json({ code: 500, message: `Git 操作失败: ${stderr || err.message}` })
    res.json({ code: 200, data: { output: stdout || '(无输出)', action } })
  })
})

/** Git diff 摘要（LLM 分析） */
app.post('/api/integrations/git/diff-summary', async (req, res) => {
  const config = readJSON(GIT_CONFIG_FILE, {})
  if (!config.repoPath) return res.json({ code: 400, message: '请先配置 Git 仓库路径' })
  try {
    const diff = await new Promise((resolve, reject) => {
      exec('git diff --stat', { cwd: config.repoPath, timeout: 15000 }, (err, stdout) => {
        if (err) reject(err); else resolve(stdout)
      })
    })
    if (!diff.trim()) return res.json({ code: 200, data: { summary: '没有未提交的变更。' } })
    const summary = await callLLM('你是一个 Git 变更分析助手，请用简洁中文总结以下 diff 信息。', diff)
    res.json({ code: 200, data: { summary: summary || diff, raw: diff } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// 8. 通知中心
// ======================================================================

const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json')
if (!fs.existsSync(NOTIFICATIONS_FILE)) writeJSON(NOTIFICATIONS_FILE, [])

/** 获取通知列表 */
app.get('/api/notifications', (req, res) => {
  try {
    const notifications = readJSON(NOTIFICATIONS_FILE, [])
    const { unreadOnly, limit = 50 } = req.query
    let result = notifications
    if (unreadOnly === 'true') result = result.filter(n => !n.read)
    res.json({ code: 200, data: result.slice(0, +limit), unread: notifications.filter(n => !n.read).length })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 标记已读 */
app.post('/api/notifications/read', (req, res) => {
  const { id, all } = req.body
  try {
    const notifications = readJSON(NOTIFICATIONS_FILE, [])
    if (all) { notifications.forEach(n => n.read = true) }
    else if (id) { const n = notifications.find(x => x.id === id); if (n) n.read = true }
    writeJSON(NOTIFICATIONS_FILE, notifications)
    res.json({ code: 200, message: '✅ 已标记已读' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除通知 */
app.delete('/api/notifications/:id', (req, res) => {
  try {
    let notifications = readJSON(NOTIFICATIONS_FILE, [])
    notifications = notifications.filter(n => n.id !== req.params.id)
    writeJSON(NOTIFICATIONS_FILE, notifications)
    res.json({ code: 200, message: '✅ 已删除' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 清空所有通知 */
app.delete('/api/notifications', (req, res) => {
  writeJSON(NOTIFICATIONS_FILE, [])
  res.json({ code: 200, message: '✅ 已清空' })
})

// ======================================================================
// 9. 文件系统操作
// ======================================================================

const FS_CONFIG_FILE = path.join(DATA_DIR, 'fs-config.json')

/** 获取文件系统配置（安全沙箱目录） */
app.get('/api/integrations/fs', (req, res) => {
  const config = readJSON(FS_CONFIG_FILE, { allowedDirs: [], watchDir: '' })
  res.json({ code: 200, data: config })
})

/** 保存文件系统配置 */
app.post('/api/integrations/fs', (req, res) => {
  const { allowedDirs, watchDir } = req.body
  try {
    writeJSON(FS_CONFIG_FILE, { allowedDirs: allowedDirs || [], watchDir: watchDir || '' })
    res.json({ code: 200, message: '✅ 文件系统配置已保存' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

function isPathAllowed(targetPath) {
  const config = readJSON(FS_CONFIG_FILE, { allowedDirs: [] })
  const resolved = path.resolve(targetPath)
  return config.allowedDirs.some(dir => resolved.startsWith(path.resolve(dir)))
}

/** 列出目录内容 */
app.get('/api/integrations/fs/list', (req, res) => {
  const { dir } = req.query
  if (!dir) return res.json({ code: 400, message: '请提供目录路径' })
  if (!isPathAllowed(dir)) return res.json({ code: 403, message: '该路径不在允许的目录范围内' })
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true }).map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'dir' : 'file',
      size: item.isFile() ? fs.statSync(path.join(dir, item.name)).size : 0,
      modified: fs.statSync(path.join(dir, item.name)).mtime.toISOString()
    })).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    res.json({ code: 200, data: { path: dir, items } })
  } catch (err) {
    res.json({ code: 500, message: '读取失败: ' + err.message })
  }
})

/** 读取文件内容 */
app.get('/api/integrations/fs/read', (req, res) => {
  const { file } = req.query
  if (!file) return res.json({ code: 400, message: '请提供文件路径' })
  if (!isPathAllowed(file)) return res.json({ code: 403, message: '该路径不在允许的目录范围内' })
  try {
    const stat = fs.statSync(file)
    if (stat.size > 1024 * 1024) return res.json({ code: 400, message: '文件过大（>1MB）' })
    const content = fs.readFileSync(file, 'utf-8')
    res.json({ code: 200, data: { path: file, content, size: stat.size } })
  } catch (err) {
    res.json({ code: 500, message: '读取失败: ' + err.message })
  }
})

/** 写入文件 */
app.post('/api/integrations/fs/write', (req, res) => {
  const { file, content } = req.body
  if (!file || content === undefined) return res.json({ code: 400, message: '请提供文件路径和内容' })
  if (!isPathAllowed(file)) return res.json({ code: 403, message: '该路径不在允许的目录范围内' })
  try {
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(file, content, 'utf-8')
    res.json({ code: 200, message: '✅ 文件已写入: ' + file })
  } catch (err) {
    res.json({ code: 500, message: '写入失败: ' + err.message })
  }
})

/** 搜索文件 */
app.get('/api/integrations/fs/search', (req, res) => {
  const { dir, keyword } = req.query
  if (!dir || !keyword) return res.json({ code: 400, message: '请提供目录和关键词' })
  if (!isPathAllowed(dir)) return res.json({ code: 403, message: '该路径不在允许的目录范围内' })
  try {
    const results = []
    function walk(d, depth) {
      if (depth > 5 || results.length >= 50) return
      try {
        const items = fs.readdirSync(d, { withFileTypes: true })
        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue
          const fullPath = path.join(d, item.name)
          if (item.name.toLowerCase().includes(keyword.toLowerCase())) {
            results.push({ name: item.name, path: fullPath, type: item.isDirectory() ? 'dir' : 'file' })
          }
          if (item.isDirectory()) walk(fullPath, depth + 1)
        }
      } catch {}
    }
    walk(dir, 0)
    res.json({ code: 200, data: results })
  } catch (err) {
    res.json({ code: 500, message: '搜索失败: ' + err.message })
  }
})

// ======================================================================
// 10. Agent Orchestrator - 自主编排引擎
// ======================================================================

const toolRegistry = require('./tool-registry')
const { runOrchestrator, cancelTask, getActiveTasks } = require('./orchestrator')

// 注入依赖
toolRegistry.injectDependencies({ callLLM, exec })

/** 获取可用工具列表 */
app.get('/api/orchestrator/tools', (req, res) => {
  res.json({ code: 200, data: toolRegistry.getToolDefinitions() })
})

/** 执行自主任务（SSE 流式） */
app.post('/api/orchestrator/run', async (req, res) => {
  const { goal } = req.body
  if (!goal) return res.json({ code: 400, message: '请提供任务目标 (goal)' })

  // SSE 流式响应
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  const result = await runOrchestrator(goal, {
    callLLM,
    taskId,
    onEvent: (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
  })

  res.write(`data: ${JSON.stringify({ type: 'final', ...result })}\n\n`)
  res.end()
})

/** 执行自主任务（非流式，返回完整结果） */
app.post('/api/orchestrator/run-sync', async (req, res) => {
  const { goal } = req.body
  if (!goal) return res.json({ code: 400, message: '请提供任务目标 (goal)' })
  try {
    const result = await runOrchestrator(goal, { callLLM })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 取消任务 */
app.post('/api/orchestrator/cancel', (req, res) => {
  const { taskId } = req.body
  const ok = cancelTask(taskId)
  res.json({ code: 200, message: ok ? '✅ 已取消' : '任务不存在或已结束' })
})

/** 获取活跃任务 */
app.get('/api/orchestrator/active', (req, res) => {
  res.json({ code: 200, data: getActiveTasks() })
})

// ==================== 11. 插件系统 ====================
const pluginManager = require('./plugin-manager')
const { initMcpServer, createMcpRouter } = require('./mcp-server')
const mcpClient = require('./mcp-client')

// 初始化插件系统
pluginManager.loadAllPlugins()

// 将插件工具注入到 tool-registry
const pluginTools = pluginManager.getPluginToolDefinitions()
for (const pt of pluginTools) {
  toolRegistry.registerTool(pt)
}

// 初始化 MCP Server
initMcpServer(toolRegistry)
app.use('/mcp', createMcpRouter())

/** 获取插件列表 */
app.get('/api/plugins', (req, res) => {
  res.json({ code: 200, data: pluginManager.listPlugins() })
})

/** 获取插件详情 */
app.get('/api/plugins/:id', (req, res) => {
  const p = pluginManager.getPlugin(req.params.id)
  if (!p) return res.json({ code: 404, message: '插件不存在' })
  res.json({ code: 200, data: p })
})

/** 启用插件 */
app.post('/api/plugins/:id/enable', (req, res) => {
  const ok = pluginManager.enablePlugin(req.params.id)
  res.json({ code: ok ? 200 : 404, message: ok ? '✅ 已启用' : '插件不存在' })
})

/** 禁用插件 */
app.post('/api/plugins/:id/disable', (req, res) => {
  const ok = pluginManager.disablePlugin(req.params.id)
  res.json({ code: ok ? 200 : 404, message: ok ? '已禁用' : '插件不存在' })
})

/** 重新加载插件 */
app.post('/api/plugins/:id/reload', (req, res) => {
  try {
    const p = pluginManager.reloadPlugin(req.params.id)
    res.json({ code: 200, message: '✅ 插件已重新加载', data: { id: p.manifest.id, name: p.manifest.name } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新插件配置 */
app.post('/api/plugins/:id/config', (req, res) => {
  const ok = pluginManager.updatePluginConfig(req.params.id, req.body)
  res.json({ code: ok ? 200 : 404, message: ok ? '✅ 配置已更新' : '插件不存在' })
})

/** 执行插件工具 */
app.post('/api/plugins/:id/execute', async (req, res) => {
  const { tool, params } = req.body
  try {
    const result = await pluginManager.executePluginTool(req.params.id, tool, params || {})
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 生成插件模板 */
app.post('/api/plugins/generate', (req, res) => {
  const { id, name, description } = req.body
  if (!id) return res.json({ code: 400, message: '请提供插件 ID' })
  try {
    const result = pluginManager.generatePluginTemplate(id, name, description)
    res.json({ code: 200, message: '✅ 插件模板已生成', data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ==================== 12. MCP Client 管理 ====================

/** 列出 MCP Server 配置 */
app.get('/api/mcp/servers', (req, res) => {
  res.json({ code: 200, data: mcpClient.listServers() })
})

/** 添加 MCP Server */
app.post('/api/mcp/servers', (req, res) => {
  const { name, url, transport, command, args } = req.body
  if (!url && !command) return res.json({ code: 400, message: '请提供 url 或 command' })
  const entry = mcpClient.addServer({ name, url, transport, command, args })
  res.json({ code: 200, message: '✅ 已添加', data: entry })
})

/** 删除 MCP Server */
app.delete('/api/mcp/servers/:id', (req, res) => {
  mcpClient.removeServer(req.params.id)
  res.json({ code: 200, message: '✅ 已删除' })
})

/** 连接 MCP Server */
app.post('/api/mcp/servers/:id/connect', async (req, res) => {
  try {
    const conn = await mcpClient.connectServer(req.params.id)
    res.json({ code: 200, message: '✅ 已连接', data: { tools: conn.tools.length, serverInfo: conn.serverInfo } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 断开 MCP Server */
app.post('/api/mcp/servers/:id/disconnect', (req, res) => {
  mcpClient.disconnectServer(req.params.id)
  res.json({ code: 200, message: '已断开' })
})

/** MCP Server 健康状态 */
app.get('/api/mcp/health', (req, res) => {
  res.json({ code: 200, data: { server: 'ai-portal-mcp', status: 'running', endpoint: '/mcp' } })
})

// ==================== 13. 多模态交互 ====================
const multimodal = require('./multimodal')

/** 图片分析 */
app.post('/api/multimodal/analyze', async (req, res) => {
  const { image, prompt } = req.body
  if (!image) return res.json({ code: 400, message: '请提供图片 (base64)' })
  try {
    const result = await multimodal.analyzeImage(image, prompt, callLLM)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** OCR 结构化提取 */
app.post('/api/multimodal/extract', async (req, res) => {
  const { image, type } = req.body
  if (!image) return res.json({ code: 400, message: '请提供图片 (base64)' })
  try {
    const result = await multimodal.extractStructured(image, type || 'text', callLLM)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 图片转代码 */
app.post('/api/multimodal/image-to-code', async (req, res) => {
  const { image, language } = req.body
  if (!image) return res.json({ code: 400, message: '请提供图片 (base64)' })
  try {
    const result = await multimodal.imageToCode(image, language, callLLM)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 语音处理（备用） */
app.post('/api/multimodal/audio', (req, res) => {
  const { audio, format } = req.body
  if (!audio) return res.json({ code: 400, message: '请提供音频数据' })
  const result = multimodal.processAudio(audio, format)
  res.json({ code: 200, data: result })
})

/** TTS 语音合成（使用 Edge TTS 或浏览器原生） */
app.post('/api/multimodal/tts', (req, res) => {
  const { text, voice } = req.body
  if (!text) return res.json({ code: 400, message: '请提供文本' })
  // 返回 TTS 配置，前端使用 Web Speech API 或 Edge TTS
  res.json({
    code: 200,
    data: {
      text,
      voice: voice || 'zh-CN-XiaoxiaoNeural',
      method: 'browser-speech-api',
      hint: '前端使用 speechSynthesis API 播放'
    }
  })
})

// ==================== 14. 数据智能 + 仪表盘 ====================
const analytics = require('./analytics')

/** 获取仪表盘统计 */
app.get('/api/analytics/dashboard', (req, res) => {
  res.json({ code: 200, data: analytics.getDashboardStats() })
})

/** 获取知识图谱数据 */
app.get('/api/analytics/knowledge-graph', (req, res) => {
  res.json({ code: 200, data: analytics.getKnowledgeGraph() })
})

/** 生成 AI 周报 */
app.post('/api/analytics/weekly-report', async (req, res) => {
  try {
    const report = await analytics.generateWeeklyReport(callLLM)
    res.json({ code: 200, data: report })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取历史报告 */
app.get('/api/analytics/reports', (req, res) => {
  const limit = parseInt(req.query.limit) || 10
  res.json({ code: 200, data: analytics.getReports(limit) })
})

/** 手动记录事件 */
app.post('/api/analytics/track', (req, res) => {
  const { category, action, meta } = req.body
  if (!category || !action) return res.json({ code: 400, message: '请提供 category 和 action' })
  analytics.trackEvent(category, action, meta || {})
  res.json({ code: 200, message: '✅ 已记录' })
})

// ==================== 15. 桌面自动化引擎 ====================
const desktopAgent = require('./desktop-agent')

/** 截取屏幕 */
app.post('/api/desktop/screenshot', async (req, res) => {
  const { target } = req.body
  try {
    const result = await desktopAgent.takeScreenshot(target || 'fullscreen')
    res.json({ code: result.success ? 200 : 500, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 分析 UI 元素 */
app.post('/api/desktop/analyze-ui', async (req, res) => {
  const { image, instruction } = req.body
  if (!image) return res.json({ code: 400, message: '请提供截屏图片 (base64)' })
  try {
    const result = await desktopAgent.analyzeUI(image, instruction, callLLM)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 执行桌面操控动作 */
app.post('/api/desktop/execute', async (req, res) => {
  const { actions, confirmed } = req.body
  if (!actions || !Array.isArray(actions)) return res.json({ code: 400, message: '请提供 actions 数组' })

  // 安全检查：危险操作需要确认
  if (desktopAgent.isDangerousAction(actions) && !confirmed) {
    return res.json({ code: 403, message: '⚠️ 检测到危险操作，需要用户确认', needConfirm: true, actions })
  }

  try {
    const result = await desktopAgent.executeActions(actions)
    analytics.trackEvent('desktop', 'execute', { actions: actions.length, success: result.success })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取桌面操作历史 */
app.get('/api/desktop/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 20
  res.json({ code: 200, data: desktopAgent.getActionHistory(limit) })
})

/** 桌面操控状态检查 */
app.get('/api/desktop/status', (req, res) => {
  res.json({
    code: 200,
    data: {
      available: process.platform === 'win32',
      platform: process.platform,
      historyCount: desktopAgent.getActionHistory(100).length,
      message: process.platform === 'win32' ? '桌面操控就绪' : '仅支持 Windows 平台'
    }
  })
})

// ======================================================================
// ===== Auth 认证系统 (W10) =====
// ======================================================================

/** 注册 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body
    if (!username || !password) return res.json({ code: 400, message: '用户名和密码为必填项' })
    if (password.length < 4) return res.json({ code: 400, message: '密码至少4位' })
    const result = await auth.register(username, password, role)
    res.json({ code: result.success ? 200 : 400, data: result.user, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 登录 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.json({ code: 400, message: '用户名和密码为必填项' })
    const result = await auth.login(username, password)
    if (result.success) {
      res.json({ code: 200, data: { token: result.token, refreshToken: result.refreshToken, user: result.user } })
    } else {
      res.json({ code: 401, message: result.message })
    }
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 刷新 Token */
app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.json({ code: 400, message: 'refreshToken 为必填项' })
    const result = auth.refreshAccessToken(refreshToken)
    res.json({ code: result.success ? 200 : 401, data: { token: result.token }, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取当前用户信息 */
app.get('/api/auth/me', auth.requireAuth, (req, res) => {
  res.json({ code: 200, data: { id: req.user.id, username: req.user.username, role: req.user.role } })
})

/** 获取用户列表（仅 admin） */
app.get('/api/auth/users', auth.requireAuth, auth.requireRole('admin'), (req, res) => {
  try {
    const users = auth.getUsers(req.user)
    res.json({ code: 200, data: users })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 修改用户角色（仅 admin） */
app.put('/api/auth/users/:id/role', auth.requireAuth, auth.requireRole('admin'), (req, res) => {
  try {
    const { role } = req.body
    const result = auth.updateUserRole(req.user.id, req.params.id, role)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除用户（仅 admin） */
app.delete('/api/auth/users/:id', auth.requireAuth, auth.requireRole('admin'), (req, res) => {
  try {
    const result = auth.deleteUser(req.user.id, req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// ===== Team Workspace 团队协作 (W10) =====
// ======================================================================

/** 获取团队知识库列表 */
app.get('/api/team/knowledge', auth.optionalAuth, (req, res) => {
  try {
    const docs = teamWorkspace.getTeamKnowledge()
    res.json({ code: 200, data: docs })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 添加团队知识 */
app.post('/api/team/knowledge', auth.requireAuth, (req, res) => {
  try {
    const { title, content, tags } = req.body
    const result = teamWorkspace.addTeamKnowledge({ title, content, tags, authorId: req.user.id, authorName: req.user.username })
    res.json({ code: result.success ? 200 : 400, data: result.doc, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新团队知识 */
app.put('/api/team/knowledge/:id', auth.requireAuth, (req, res) => {
  try {
    const result = teamWorkspace.updateTeamKnowledge(req.params.id, req.body)
    res.json({ code: result.success ? 200 : 400, data: result.doc, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除团队知识 */
app.delete('/api/team/knowledge/:id', auth.requireAuth, (req, res) => {
  try {
    const result = teamWorkspace.deleteTeamKnowledge(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取团队工作流模板 */
app.get('/api/team/workflows', auth.optionalAuth, (req, res) => {
  try {
    const workflows = teamWorkspace.getTeamWorkflows()
    res.json({ code: 200, data: workflows })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 添加团队工作流 */
app.post('/api/team/workflows', auth.requireAuth, (req, res) => {
  try {
    const { name, description, steps, tags } = req.body
    const result = teamWorkspace.addTeamWorkflow({ name, description, steps, tags, authorId: req.user.id, authorName: req.user.username })
    res.json({ code: result.success ? 200 : 400, data: result.workflow, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除团队工作流 */
app.delete('/api/team/workflows/:id', auth.requireAuth, (req, res) => {
  try {
    const result = teamWorkspace.deleteTeamWorkflow(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取团队任务 */
app.get('/api/team/tasks', auth.optionalAuth, (req, res) => {
  try {
    const tasks = teamWorkspace.getTeamTasks()
    res.json({ code: 200, data: tasks })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 创建团队任务 */
app.post('/api/team/tasks', auth.requireAuth, (req, res) => {
  try {
    const { title, description, assigneeId, assigneeName, priority } = req.body
    const result = teamWorkspace.createTeamTask({ title, description, assigneeId, assigneeName, creatorId: req.user.id, creatorName: req.user.username, priority })
    res.json({ code: result.success ? 200 : 400, data: result.task, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新团队任务 */
app.put('/api/team/tasks/:id', auth.requireAuth, (req, res) => {
  try {
    const result = teamWorkspace.updateTeamTask(req.params.id, req.body)
    res.json({ code: result.success ? 200 : 400, data: result.task, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除团队任务 */
app.delete('/api/team/tasks/:id', auth.requireAuth, (req, res) => {
  try {
    const result = teamWorkspace.deleteTeamTask(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取任务评论 */
app.get('/api/team/tasks/:taskId/comments', auth.optionalAuth, (req, res) => {
  try {
    const comments = teamWorkspace.getTaskComments(req.params.taskId)
    res.json({ code: 200, data: comments })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 添加任务评论 */
app.post('/api/team/tasks/:taskId/comments', auth.requireAuth, (req, res) => {
  try {
    const { content } = req.body
    const result = teamWorkspace.addTaskComment({ taskId: req.params.taskId, content, authorId: req.user.id, authorName: req.user.username })
    res.json({ code: result.success ? 200 : 400, data: result.comment, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除任务评论 */
app.delete('/api/team/comments/:id', auth.requireAuth, (req, res) => {
  try {
    const result = teamWorkspace.deleteTaskComment(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// ===== Agent Memory 长期记忆与自进化 (W11) =====
// ======================================================================

/** 获取经验列表 */
app.get('/api/agent/experiences', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    res.json({ code: 200, data: agentMemory.getExperiences(limit) })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 添加经验 */
app.post('/api/agent/experiences', (req, res) => {
  try {
    const result = agentMemory.addExperience(req.body)
    res.json({ code: result.success ? 200 : 400, data: result.experience, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取经验统计 */
app.get('/api/agent/experiences/stats', (req, res) => {
  try {
    res.json({ code: 200, data: agentMemory.getExperienceStats() })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 相似经验推荐 */
app.post('/api/agent/experiences/similar', (req, res) => {
  try {
    const { goal, threshold, maxResults } = req.body
    const result = agentMemory.findSimilarExperiences(goal || '', threshold, maxResults)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取技能列表 */
app.get('/api/agent/skills', (req, res) => {
  try {
    res.json({ code: 200, data: agentMemory.getSkills() })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 添加技能 */
app.post('/api/agent/skills', (req, res) => {
  try {
    const result = agentMemory.addSkill(req.body)
    res.json({ code: result.success ? 200 : 400, data: result.skill, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新技能 */
app.put('/api/agent/skills/:id', (req, res) => {
  try {
    const result = agentMemory.updateSkill(req.params.id, req.body)
    res.json({ code: result.success ? 200 : 400, data: result.skill, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除技能 */
app.delete('/api/agent/skills/:id', (req, res) => {
  try {
    const result = agentMemory.deleteSkill(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取建议列表 */
app.get('/api/agent/suggestions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    res.json({ code: 200, data: agentMemory.getSuggestions(limit) })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 添加建议 */
app.post('/api/agent/suggestions', (req, res) => {
  try {
    const result = agentMemory.addSuggestion(req.body)
    res.json({ code: result.success ? 200 : 400, data: result.suggestion, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 标记建议已读 */
app.put('/api/agent/suggestions/:id/read', (req, res) => {
  try {
    const result = agentMemory.markSuggestionRead(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 标记建议已应用 */
app.put('/api/agent/suggestions/:id/apply', (req, res) => {
  try {
    const result = agentMemory.markSuggestionApplied(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 删除建议 */
app.delete('/api/agent/suggestions/:id', (req, res) => {
  try {
    const result = agentMemory.deleteSuggestion(req.params.id)
    res.json({ code: result.success ? 200 : 400, message: result.message })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 异常检测 */
app.get('/api/agent/anomalies', (req, res) => {
  try {
    const anomalies = agentMemory.detectAnomalies()
    res.json({ code: 200, data: anomalies })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ======================================================================
// ===== Health / Monitor / Security (W12) =====
// ======================================================================

/** 健康检查 */
app.get('/api/health', (req, res) => {
  try {
    const health = monitor.getHealth()
    res.json({ code: 200, data: health })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 性能统计 */
app.get('/api/monitor/performance', (req, res) => {
  try {
    res.json({ code: 200, data: monitor.getPerformanceStats() })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 错误日志 */
app.get('/api/monitor/errors', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    res.json({ code: 200, data: monitor.getErrorLogs(limit) })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 使用统计 */
app.get('/api/monitor/usage', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30
    res.json({ code: 200, data: monitor.getUsageStats(days) })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 审计日志 */
app.get('/api/security/audit', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100
    res.json({ code: 200, data: security.getAuditLogs(limit) })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 加密配置 - 保存 */
app.post('/api/security/encrypt', (req, res) => {
  try {
    const { key, value } = req.body
    if (!key || !value) return res.json({ code: 400, message: 'key 和 value 为必填项' })
    security.saveEncryptedConfig(key, value)
    res.json({ code: 200, message: '配置已加密保存' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 加密配置 - 读取 */
app.post('/api/security/decrypt', (req, res) => {
  try {
    const { key } = req.body
    if (!key) return res.json({ code: 400, message: 'key 为必填项' })
    const value = security.getEncryptedConfig(key)
    if (value === null) return res.json({ code: 404, message: '配置不存在' })
    res.json({ code: 200, data: { key, value } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ===== W13: AI 编码工作区 =====

/** 扫描项目 */
app.post('/api/coding/scan', async (req, res) => {
  try {
    const { rootPath } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    const result = codingWorkspace.scanProject(rootPath)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 列出文件 */
app.post('/api/coding/files', (req, res) => {
  try {
    const { rootPath, relativePath = '' } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    const result = codingWorkspace.listFiles(rootPath, relativePath)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 读取文件 */
app.post('/api/coding/read', (req, res) => {
  try {
    const { filePath, startLine, endLine } = req.body
    if (!filePath) return res.json({ code: 400, message: 'filePath 为必填项' })
    const result = codingWorkspace.readFile(filePath, startLine, endLine)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 项目上下文 */
app.post('/api/coding/context', (req, res) => {
  try {
    const { rootPath, filePath } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    const result = codingWorkspace.getProjectContext(rootPath, filePath)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** AI 生成代码 */
app.post('/api/coding/generate', async (req, res) => {
  try {
    const { instruction, files, projectContext } = req.body
    if (!instruction) return res.json({ code: 400, message: 'instruction 为必填项' })
    const result = await codingWorkspace.generateCode({ instruction, files, projectContext })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 解释代码 */
app.post('/api/coding/explain', async (req, res) => {
  try {
    const { code, language, instruction } = req.body
    if (!code) return res.json({ code: 400, message: 'code 为必填项' })
    const result = await codingWorkspace.explainCode({ code, language, instruction })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 重构代码 */
app.post('/api/coding/refactor', async (req, res) => {
  try {
    const { code, language, instruction } = req.body
    if (!code) return res.json({ code: 400, message: 'code 为必填项' })
    const result = await codingWorkspace.refactorCode({ code, language, instruction })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Git 状态 */
app.post('/api/coding/git/status', (req, res) => {
  try {
    const { rootPath } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    const result = codingWorkspace.git.isAvailable(rootPath)
      ? codingWorkspace.git.status(rootPath)
      : { error: 'Git 不可用或非 Git 仓库' }
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Git Diff */
app.post('/api/coding/git/diff', (req, res) => {
  try {
    const { rootPath, filePath } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    const result = codingWorkspace.git.diff(rootPath, filePath)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Git 提交（AI 生成 message） */
app.post('/api/coding/git/commit', async (req, res) => {
  try {
    const { rootPath, message } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    if (message) {
      const result = codingWorkspace.git.commit(rootPath, message)
      return res.json({ code: 200, data: result })
    }
    // 无 message，AI 生成
    const commitInfo = await codingWorkspace.git.generateCommitMessage(rootPath)
    if (commitInfo.error) return res.json({ code: 400, data: commitInfo })
    const subject = commitInfo.type && commitInfo.scope
      ? `${commitInfo.type}(${commitInfo.scope}): ${commitInfo.subject}`
      : commitInfo.subject
    const fullMsg = commitInfo.body ? `${subject}\n\n${commitInfo.body}` : subject
    const result = codingWorkspace.git.commit(rootPath, fullMsg)
    result.commitInfo = commitInfo
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Git 历史 */
app.post('/api/coding/git/log', (req, res) => {
  try {
    const { rootPath, maxCount } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    const result = codingWorkspace.git.log(rootPath, maxCount)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** AI 代码审查 */
app.post('/api/coding/git/review', async (req, res) => {
  try {
    const { rootPath } = req.body
    if (!rootPath) return res.json({ code: 400, message: 'rootPath 为必填项' })
    const result = await codingWorkspace.git.review(rootPath)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ===== W14: 智能 AI 网关 =====

/** AI 聊天（自动路由） */
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, model, options } = req.body
    if (!messages) return res.json({ code: 400, message: 'messages 为必填项' })
    const result = await aiGateway.routeChat(messages, { preferredModel: model, ...options })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** AI 生成 */
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt, taskType, preferredModel, noCache, temperature, maxTokens } = req.body
    if (!prompt) return res.json({ code: 400, message: 'prompt 为必填项' })
    const result = await aiGateway.generate(prompt, { taskType, preferredModel, noCache, temperature, maxTokens })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 模型列表 */
app.get('/api/ai/models', (req, res) => {
  try {
    const models = aiGateway.getModels()
    res.json({ code: 200, data: models })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 更新模型配置 */
app.put('/api/ai/models/:id', (req, res) => {
  try {
    const result = aiGateway.updateModel(req.params.id, req.body)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 模型健康检查 */
app.get('/api/ai/status', async (req, res) => {
  try {
    const status = await aiGateway.checkAllModels()
    res.json({ code: 200, data: status })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 使用统计 */
app.get('/api/ai/usage', (req, res) => {
  try {
    const { period = 'day' } = req.query
    const usage = aiGateway.getUsage(period)
    res.json({ code: 200, data: usage })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 成本分析 */
app.get('/api/ai/costs', (req, res) => {
  try {
    const costs = aiGateway.getCosts()
    res.json({ code: 200, data: costs })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 清除缓存 */
app.post('/api/ai/cache/clear', (req, res) => {
  try {
    const result = aiGateway.clearCache()
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Prompt 模板列表 */
app.get('/api/ai/templates', (req, res) => {
  try {
    const templates = aiGateway.getTemplates()
    res.json({ code: 200, data: templates })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ===== W15: Agent Mesh 动态编排 =====

/** 创建 Agent */
app.post('/api/mesh/create', (req, res) => {
  try {
    const { role, goal, tools } = req.body
    if (!role) return res.json({ code: 400, message: 'role 为必填项' })
    const agent = agentMesh.createAgent({ role, goal, tools })
    res.json({ code: 200, data: { agentId: agent.id, role: agent.role, status: agent.status } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 运行 Agent */
app.post('/api/mesh/run', async (req, res) => {
  try {
    const { agentId, task } = req.body
    if (!agentId || !task) return res.json({ code: 400, message: 'agentId 和 task 为必填项' })
    const result = await agentMesh.runAgent(agentId, task)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 协作模式 */
app.post('/api/mesh/collaborate', async (req, res) => {
  try {
    const { agents, task, workflow } = req.body
    if (!agents || !task) return res.json({ code: 400, message: 'agents 和 task 为必填项' })
    const result = await agentMesh.collaborate({ agents, task, workflow })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Agent 列表 */
app.get('/api/mesh/agents', (req, res) => {
  try {
    const agents = agentMesh.listAgents()
    res.json({ code: 200, data: agents })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** Agent 详情 */
app.get('/api/mesh/agents/:id', (req, res) => {
  try {
    const agent = agentMesh.getAgent(req.params.id)
    if (!agent) return res.json({ code: 404, message: 'Agent 不存在' })
    res.json({ code: 200, data: agent })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 销毁 Agent */
app.delete('/api/mesh/agents/:id', (req, res) => {
  try {
    const result = agentMesh.destroyAgent(req.params.id)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 发送消息 */
app.post('/api/mesh/message', (req, res) => {
  try {
    const { from, to, type, payload } = req.body
    if (!from || !to) return res.json({ code: 400, message: 'from 和 to 为必填项' })
    const msg = agentMesh.sendMessage(from, to, type || 'request', payload)
    res.json({ code: 200, data: msg })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 获取消息 */
app.get('/api/mesh/messages/:agentId', (req, res) => {
  try {
    const { unread } = req.query
    const msgs = agentMesh.getMessages(req.params.agentId, unread === 'true')
    res.json({ code: 200, data: msgs })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 审批点列表 */
app.get('/api/mesh/approvals', (req, res) => {
  try {
    const { agentId } = req.query
    const approvals = agentMesh.getPendingApprovals(agentId)
    res.json({ code: 200, data: approvals })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 处理审批 */
app.post('/api/mesh/approvals/:id/resolve', (req, res) => {
  try {
    const { decision, modifiedValue } = req.body
    const result = agentMesh.resolveApproval(req.params.id, decision, modifiedValue)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 审批历史 */
app.get('/api/mesh/approvals/history', (req, res) => {
  try {
    const history = agentMesh.getApprovalHistory()
    res.json({ code: 200, data: history })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 清理 Agent */
app.post('/api/mesh/cleanup', (req, res) => {
  try {
    const result = agentMesh.cleanupAgents()
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ===== W16: 浏览器扩展 & 插件市场 =====

/** 提取页面内容（浏览器扩展） */
app.post('/api/extension/extract', (req, res) => {
  try {
    const { url, content } = req.body
    if (!content) return res.json({ code: 400, message: 'content 为必填项' })
    // 简单解析页面内容
    const titleMatch = content.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1] : ''
    const textContent = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 5000)
    res.json({ code: 200, data: { title, content: textContent, url } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 浏览器扩展 AI 分析 */
app.post('/api/extension/analyze', async (req, res) => {
  try {
    const { action, selection, pageContent } = req.body
    if (!action) return res.json({ code: 400, message: 'action 为必填项' })
    const prompt = `用户执行操作: ${action}\n${selection ? `选中内容: ${selection}\n` : ''}${pageContent ? `页面内容: ${pageContent.slice(0, 2000)}\n` : ''}\n请根据操作类型给出回复。`
    const result = await aiGateway.generate(prompt, { taskType: 'chat', temperature: 0.3 })
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 插件市场 - 列表 */
app.get('/api/store/plugins', (req, res) => {
  try {
    const { category, search, sort } = req.query
    const plugins = pluginStore.getStorePlugins({ category, search, sort })
    res.json({ code: 200, data: plugins })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 插件市场 - 详情 */
app.get('/api/store/plugins/:id', (req, res) => {
  try {
    const plugin = pluginStore.getStorePlugin(req.params.id)
    if (!plugin) return res.json({ code: 404, message: '插件不存在' })
    res.json({ code: 200, data: plugin })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 插件市场 - 安装 */
app.post('/api/store/plugins/:id/install', (req, res) => {
  try {
    const result = pluginStore.installPlugin(req.params.id)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 插件市场 - 评分 */
app.post('/api/store/plugins/:id/rate', (req, res) => {
  try {
    const { userId, rating, review } = req.body
    const result = pluginStore.ratePlugin(req.params.id, userId || 'anonymous', rating, review)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 已安装插件 */
app.get('/api/store/installed', (req, res) => {
  try {
    const installed = pluginStore.getInstalledPlugins()
    res.json({ code: 200, data: installed })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 切换插件启用状态 */
app.put('/api/store/installed/:id/toggle', (req, res) => {
  try {
    const { enabled } = req.body
    const result = pluginStore.togglePlugin(req.params.id, enabled)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 卸载插件 */
app.delete('/api/store/installed/:id', (req, res) => {
  try {
    const result = pluginStore.uninstallPlugin(req.params.id)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 发布插件 */
app.post('/api/store/publish', (req, res) => {
  try {
    const result = pluginStore.publishPlugin(req.body)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 注册开发者 */
app.post('/api/store/developer/register', (req, res) => {
  try {
    const { userId, name, email } = req.body
    const result = pluginStore.registerDeveloper(userId, name, email)
    res.json({ code: 200, data: result })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

/** 分类列表 */
app.get('/api/store/categories', (req, res) => {
  try {
    res.json({ code: 200, data: pluginStore.CATEGORIES })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ----- 全局错误处理 -----
app.use(monitor.errorHandler)
