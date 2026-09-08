/**
 * Plugin Store - 插件市场
 * 浏览/搜索插件、安装/评分/发布
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const STORE_FILE = path.join(DATA_DIR, 'plugin-store.json')
const INSTALLED_FILE = path.join(DATA_DIR, 'plugin-store-installed.json')
const REVIEWS_FILE = path.join(DATA_DIR, 'plugin-store-reviews.json')
const DEVELOPERS_FILE = path.join(DATA_DIR, 'plugin-store-developers.json')

// ===== 工具函数 =====
function readJSON(file, def = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}
function readJSONObj(file, def = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ===== 初始示例插件 =====
const SAMPLE_PLUGINS = [
  {
    id: 'markdown-editor',
    name: 'Markdown 编辑器增强',
    description: 'Markdown 实时预览、导出 PDF、语法检查',
    category: 'editor',
    author: 'AI Portal Team',
    version: '1.0.0',
    downloads: 128,
    rating: 4.5,
    icon: '📝',
    tags: ['markdown', 'editor', 'pdf'],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z'
  },
  {
    id: 'code-formatter',
    name: '代码格式化工具',
    description: '一键格式化 JS/TS/Python 代码，支持自定义规则',
    category: 'developer-tools',
    author: 'AI Portal Team',
    version: '2.1.0',
    downloads: 256,
    rating: 4.8,
    icon: '🔧',
    tags: ['formatter', 'code', 'prettier'],
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z'
  },
  {
    id: 'ai-translator',
    name: 'AI 智能翻译',
    description: '基于 AI 的全文翻译，支持 50+ 语言，保留格式',
    category: 'ai',
    author: 'AI Portal Team',
    version: '1.2.0',
    downloads: 512,
    rating: 4.6,
    icon: '🌐',
    tags: ['translate', 'ai', 'language'],
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z'
  },
  {
    id: 'todo-manager',
    name: 'Todo 看板',
    description: '看板式任务管理，支持拖拽、标签、截止日期',
    category: 'productivity',
    author: 'AI Portal Team',
    version: '1.0.0',
    downloads: 64,
    rating: 4.2,
    icon: '✅',
    tags: ['todo', 'kanban', 'productivity'],
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z'
  },
  {
    id: 'snippet-manager',
    name: '代码片段管理',
    description: '保存和管理常用的代码片段，支持分类和标签',
    category: 'developer-tools',
    author: 'AI Portal Team',
    version: '1.1.0',
    downloads: 192,
    rating: 4.4,
    icon: '📋',
    tags: ['snippet', 'code', 'clipboard'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z'
  },
  {
    id: 'data-visualizer',
    name: '数据可视化',
    description: '将数据转换为图表，支持柱状图、折线图、饼图',
    category: 'analytics',
    author: 'AI Portal Team',
    version: '1.3.0',
    downloads: 320,
    rating: 4.7,
    icon: '📊',
    tags: ['chart', 'visualization', 'data'],
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z'
  }
]

// ===== 16.2 插件市场 =====
function getStorePlugins(params = {}) {
  let plugins = readJSON(STORE_FILE, SAMPLE_PLUGINS)
  const { category, search, sort = 'downloads' } = params

  if (category && category !== 'all') {
    plugins = plugins.filter(p => p.category === category)
  }
  if (search) {
    const q = search.toLowerCase()
    plugins = plugins.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q))
    )
  }
  if (sort === 'downloads') plugins.sort((a, b) => b.downloads - a.downloads)
  else if (sort === 'rating') plugins.sort((a, b) => b.rating - a.rating)
  else if (sort === 'newest') plugins.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return plugins
}

function getStorePlugin(id) {
  const plugins = readJSON(STORE_FILE, SAMPLE_PLUGINS)
  const plugin = plugins.find(p => p.id === id)
  if (!plugin) return null

  // 获取评分详情
  const reviews = readJSON(REVIEWS_FILE, [])
  const pluginReviews = reviews.filter(r => r.pluginId === id)
  return { ...plugin, reviews: pluginReviews }
}

function installPlugin(id) {
  const plugins = readJSON(STORE_FILE, SAMPLE_PLUGINS)
  const plugin = plugins.find(p => p.id === id)
  if (!plugin) return { error: '插件不存在' }

  const installed = readJSON(INSTALLED_FILE, [])
  if (installed.find(i => i.id === id)) return { error: '已安装' }

  installed.push({
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    installedAt: new Date().toISOString(),
    enabled: true,
    config: {}
  })
  writeJSON(INSTALLED_FILE, installed)

  // 增加下载量
  if (plugins.find(p => p.id === id)) {
    plugin.downloads = (plugin.downloads || 0) + 1
    writeJSON(STORE_FILE, plugins)
  }

  return { success: true, name: plugin.name }
}

function uninstallPlugin(id) {
  let installed = readJSON(INSTALLED_FILE, [])
  installed = installed.filter(i => i.id !== id)
  writeJSON(INSTALLED_FILE, installed)
  return { success: true }
}

function getInstalledPlugins() {
  return readJSON(INSTALLED_FILE, [])
}

function togglePlugin(id, enabled) {
  const installed = readJSON(INSTALLED_FILE, [])
  const plugin = installed.find(i => i.id === id)
  if (!plugin) return { error: '未安装' }
  plugin.enabled = enabled
  writeJSON(INSTALLED_FILE, installed)
  return { success: true, enabled }
}

// ===== 16.2 评分/评论 =====
function ratePlugin(pluginId, userId, rating, review) {
  if (rating < 1 || rating > 5) return { error: '评分需在 1-5 之间' }

  const reviews = readJSON(REVIEWS_FILE, [])
  reviews.push({
    id: genId(),
    pluginId,
    userId,
    rating,
    review: review || '',
    createdAt: new Date().toISOString()
  })
  writeJSON(REVIEWS_FILE, reviews)

  // 更新平均评分
  const plugins = readJSON(STORE_FILE, SAMPLE_PLUGINS)
  const plugin = plugins.find(p => p.id === pluginId)
  if (plugin) {
    const pluginReviews = reviews.filter(r => r.pluginId === pluginId)
    plugin.rating = pluginReviews.reduce((sum, r) => sum + r.rating, 0) / pluginReviews.length
    writeJSON(STORE_FILE, plugins)
  }

  return { success: true }
}

// ===== 16.3 发布系统 =====
function registerDeveloper(userId, name, email) {
  const devs = readJSON(DEVELOPERS_FILE, [])
  if (devs.find(d => d.userId === userId)) return { error: '已注册为开发者' }

  devs.push({
    id: genId(),
    userId,
    name,
    email,
    pluginCount: 0,
    registeredAt: new Date().toISOString()
  })
  writeJSON(DEVELOPERS_FILE, devs)
  return { success: true }
}

function publishPlugin(data) {
  const { name, description, category, author, version, icon, tags, pluginZip } = data
  if (!name || !description) return { error: '名称和描述为必填项' }

  const plugins = readJSON(STORE_FILE, SAMPLE_PLUGINS)
  const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')

  if (plugins.find(p => p.id === id)) return { error: '插件 ID 已存在' }

  const newPlugin = {
    id,
    name,
    description,
    category: category || 'other',
    author: author || 'Anonymous',
    version: version || '1.0.0',
    downloads: 0,
    rating: 0,
    icon: icon || '📦',
    tags: tags || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  plugins.push(newPlugin)
  writeJSON(STORE_FILE, plugins)

  // 更新开发者统计
  if (author) {
    const devs = readJSON(DEVELOPERS_FILE, [])
    const dev = devs.find(d => d.userId === author || d.name === author)
    if (dev) dev.pluginCount = (dev.pluginCount || 0) + 1
    writeJSON(DEVELOPERS_FILE, devs)
  }

  return { success: true, id }
}

function updatePluginVersion(id, version, pluginZip) {
  const plugins = readJSON(STORE_FILE, SAMPLE_PLUGINS)
  const plugin = plugins.find(p => p.id === id)
  if (!plugin) return { error: '插件不存在' }

  plugin.version = version || plugin.version
  plugin.updatedAt = new Date().toISOString()
  writeJSON(STORE_FILE, plugins)
  return { success: true, version: plugin.version }
}

const CATEGORIES = [
  { id: 'ai', name: 'AI 工具' },
  { id: 'developer-tools', name: '开发者工具' },
  { id: 'editor', name: '编辑器增强' },
  { id: 'productivity', name: '生产力' },
  { id: 'analytics', name: '数据分析' },
  { id: 'integration', name: '集成' },
  { id: 'other', name: '其他' }
]

module.exports = {
  getStorePlugins,
  getStorePlugin,
  installPlugin,
  uninstallPlugin,
  getInstalledPlugins,
  togglePlugin,
  ratePlugin,
  registerDeveloper,
  publishPlugin,
  updatePluginVersion,
  CATEGORIES
}
