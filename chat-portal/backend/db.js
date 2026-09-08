/**
 * Chat Portal — PostgreSQL 数据库模块
 *
 * 连接管理 & 自动建表 & 迁移
 */
const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env') })

// ===== 数据库连接配置 =====
const DB_CONFIG = {
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'chat_portal',
  user:     process.env.PGUSER     || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
}

let pool = null

/** 初始化连接池 */
function getPool() {
  if (!pool) {
    pool = new Pool(DB_CONFIG)
    pool.on('error', err => {
      console.error('⚠️ PostgreSQL 连接池错误:', err.message)
    })
  }
  return pool
}

// ===== Schema SQL =====

const SCHEMA_SQL = `
-- 书签分组
CREATE TABLE IF NOT EXISTS bookmark_groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 书签（含标签数组、分组、多语言）
CREATE TABLE IF NOT EXISTS bookmarks (
  id          SERIAL PRIMARY KEY,
  keyword     VARCHAR(255) NOT NULL,
  url         TEXT NOT NULL,
  description TEXT DEFAULT '',
  tags        TEXT[] DEFAULT '{}',
  group_id    INTEGER REFERENCES bookmark_groups(id) ON DELETE SET NULL,
  language    VARCHAR(10) DEFAULT 'zh',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_keyword ON bookmarks(keyword);
CREATE INDEX IF NOT EXISTS idx_bookmarks_tags   ON bookmarks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_bookmarks_group  ON bookmarks(group_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_lang   ON bookmarks(language);

-- 导入导出日志
CREATE TABLE IF NOT EXISTS import_export_logs (
  id          SERIAL PRIMARY KEY,
  action      VARCHAR(10) NOT NULL CHECK (action IN ('import', 'export')),
  format      VARCHAR(10) NOT NULL CHECK (format IN ('json', 'csv')),
  count       INTEGER NOT NULL DEFAULT 0,
  file_path   TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`

/** 初始化数据库：创建表 */
async function initDatabase() {
  const p = getPool()
  try {
    await p.query(SCHEMA_SQL)
    console.log('✅ PostgreSQL 表结构已就绪')
    return true
  } catch (err) {
    console.error('❌ PostgreSQL 初始化失败:', err.message)
    console.error('   — 请确保 PostgreSQL 已启动，或运行 setup-postgres.ps1')
    return false
  }
}

/** 测试连接 */
async function testConnection() {
  try {
    const p = getPool()
    const res = await p.query('SELECT NOW() AS now')
    console.log('✅ PostgreSQL 连接成功:', res.rows[0].now)
    return true
  } catch (err) {
    console.error('⚠️ PostgreSQL 连接失败:', err.message)
    return false
  }
}

/** 关闭连接池 */
async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

// ===== 书签 CRUD =====

/** 查询书签（分页 + 搜索 + 标签 + 分组过滤） */
async function queryBookmarks({ page = 1, pageSize = 20, search, tag, groupId, language } = {}) {
  const p = getPool()
  const params = []
  const conditions = []
  let idx = 1

  if (search) {
    conditions.push(`(keyword ILIKE $${idx} OR url ILIKE $${idx} OR description ILIKE $${idx})`)
    params.push(`%${search}%`)
    idx++
  }
  if (tag) {
    conditions.push(`$${idx} = ANY(tags)`)
    params.push(tag)
    idx++
  }
  if (groupId) {
    conditions.push(`group_id = $${idx}`)
    params.push(parseInt(groupId))
    idx++
  }
  if (language) {
    conditions.push(`language = $${idx}`)
    params.push(language)
    idx++
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  const offset = (page - 1) * pageSize

  const countSql = `SELECT COUNT(*) AS total FROM bookmarks ${where}`
  const dataSql  = `SELECT * FROM bookmarks ${where} ORDER BY updated_at DESC, created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`

  const [countRes, dataRes] = await Promise.all([
    p.query(countSql, params),
    p.query(dataSql, [...params, pageSize, offset])
  ])

  return {
    total: parseInt(countRes.rows[0].total),
    page,
    pageSize,
    data: dataRes.rows
  }
}

/** 获取全部书签（无分页，用于导出等） */
async function getAllBookmarks() {
  const p = getPool()
  const res = await p.query('SELECT * FROM bookmarks ORDER BY updated_at DESC, created_at DESC')
  return res.rows
}

/** 根据 ID 获取书签 */
async function getBookmarkById(id) {
  const p = getPool()
  const res = await p.query('SELECT * FROM bookmarks WHERE id = $1', [id])
  return res.rows[0] || null
}

/** 添加书签 */
async function addBookmark({ keyword, url, description = '', tags = [], groupId = null, language = 'zh' }) {
  const p = getPool()
  const res = await p.query(
    `INSERT INTO bookmarks (keyword, url, description, tags, group_id, language)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [keyword, url, description, tags, groupId, language]
  )
  return res.rows[0]
}

/** 更新书签 */
async function updateBookmark(id, { keyword, url, description, tags, groupId, language }) {
  const p = getPool()
  const fields = []
  const params = []
  let idx = 1

  if (keyword !== undefined)     { fields.push(`keyword = $${idx}`);   params.push(keyword);    idx++ }
  if (url !== undefined)         { fields.push(`url = $${idx}`);       params.push(url);        idx++ }
  if (description !== undefined) { fields.push(`description = $${idx}`); params.push(description); idx++ }
  if (tags !== undefined)        { fields.push(`tags = $${idx}`);      params.push(tags);       idx++ }
  if (groupId !== undefined)     { fields.push(`group_id = $${idx}`);  params.push(groupId);    idx++ }
  if (language !== undefined)    { fields.push(`language = $${idx}`);  params.push(language);   idx++ }

  if (fields.length === 0) return null

  fields.push(`updated_at = NOW()`)
  params.push(id)

  const res = await p.query(
    `UPDATE bookmarks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  )
  return res.rows[0] || null
}

/** 删除书签 */
async function deleteBookmark(id) {
  const p = getPool()
  const res = await p.query('DELETE FROM bookmarks WHERE id = $1 RETURNING id', [id])
  return res.rowCount > 0
}

/** 批量删除书签 */
async function deleteBookmarks(ids) {
  const p = getPool()
  const res = await p.query('DELETE FROM bookmarks WHERE id = ANY($1::int[])', [ids])
  return res.rowCount
}

/** 清空全部书签 */
async function clearAllBookmarks() {
  const p = getPool()
  await p.query('DELETE FROM bookmarks')
}

// ===== 分组管理 =====

async function getGroups() {
  const p = getPool()
  const res = await p.query(`
    SELECT g.*, COUNT(b.id)::int AS bookmark_count
    FROM bookmark_groups g
    LEFT JOIN bookmarks b ON b.group_id = g.id
    GROUP BY g.id
    ORDER BY g.name
  `)
  return res.rows
}

async function addGroup(name, description = '') {
  const p = getPool()
  const res = await p.query(
    'INSERT INTO bookmark_groups (name, description) VALUES ($1, $2) RETURNING *',
    [name, description]
  )
  return res.rows[0]
}

async function deleteGroup(id) {
  const p = getPool()
  const res = await p.query('DELETE FROM bookmark_groups WHERE id = $1 RETURNING id', [id])
  return res.rowCount > 0
}

// ===== 标签管理 =====

async function getAllTags() {
  const p = getPool()
  const res = await p.query(`
    SELECT unnest(tags) AS tag, COUNT(*)::int AS count
    FROM bookmarks
    GROUP BY tag
    ORDER BY count DESC, tag
  `)
  return res.rows
}

// ===== 导入导出日志 =====

async function logImportExport(action, format, count, filePath = null) {
  const p = getPool()
  await p.query(
    'INSERT INTO import_export_logs (action, format, count, file_path) VALUES ($1, $2, $3, $4)',
    [action, format, count, filePath]
  )
}

// ===== AI 辅助 =====

/** 智能搜索（用远程 AI 解析意图后搜索） */
async function semanticSearch(query) {
  const p = getPool()
  // 先用 ILIKE 全字段搜索
  const res = await p.query(`
    SELECT * FROM bookmarks
    WHERE keyword ILIKE $1
       OR url ILIKE $1
       OR description ILIKE $1
       OR $1 = ANY(tags)
    ORDER BY
      CASE WHEN keyword ILIKE $1 THEN 0
           WHEN $1 = ANY(tags)    THEN 1
           ELSE 2 END,
      updated_at DESC
    LIMIT 30
  `, [`%${query}%`])
  return res.rows
}

module.exports = {
  initDatabase,
  testConnection,
  closePool,
  queryBookmarks,
  getAllBookmarks,
  getBookmarkById,
  addBookmark,
  updateBookmark,
  deleteBookmark,
  deleteBookmarks,
  clearAllBookmarks,
  getGroups,
  addGroup,
  deleteGroup,
  getAllTags,
  logImportExport,
  semanticSearch,
  // 暴露给迁移脚本
  SCHEMA_SQL,
  DB_CONFIG,
}
