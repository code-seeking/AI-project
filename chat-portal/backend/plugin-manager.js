/**
 * Plugin Manager - 插件管理器
 * 负责插件的加载、卸载、启用/禁用、配置管理
 * 支持 MCP 协议适配
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const PLUGINS_DIR = path.join(__dirname, 'plugins')
const PLUGINS_STATE_FILE = path.join(__dirname, 'data', 'plugins-state.json')

// 插件运行时状态
let plugins = new Map() // id -> { manifest, instance, enabled, tools }

/** 读取插件状态持久化文件 */
function readState() {
  try {
    return JSON.parse(fs.readFileSync(PLUGINS_STATE_FILE, 'utf-8'))
  } catch { return {} }
}

/** 保存插件状态 */
function saveState() {
  const state = {}
  for (const [id, p] of plugins) {
    state[id] = { enabled: p.enabled, config: p.config || {} }
  }
  fs.mkdirSync(path.dirname(PLUGINS_STATE_FILE), { recursive: true })
  fs.writeFileSync(PLUGINS_STATE_FILE, JSON.stringify(state, null, 2))
}

/** 创建沙箱环境执行插件代码 */
function createSandbox(pluginId, permissions = []) {
  const sandbox = {
    console: {
      log: (...args) => console.log(`[Plugin:${pluginId}]`, ...args),
      error: (...args) => console.error(`[Plugin:${pluginId}]`, ...args),
      warn: (...args) => console.warn(`[Plugin:${pluginId}]`, ...args)
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Buffer,
    JSON,
    Math,
    Date,
    RegExp,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Promise,
    Error,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    encodeURIComponent,
    decodeURIComponent,
    parseInt,
    parseFloat,
    isNaN,
    isFinite
  }

  // 按权限注入能力
  if (permissions.includes('network')) {
    sandbox.fetch = global.fetch || (() => Promise.reject(new Error('fetch not available')))
  }
  if (permissions.includes('filesystem')) {
    sandbox.fs = {
      readFile: (p, enc) => fs.readFileSync(p, enc),
      writeFile: (p, data) => fs.writeFileSync(p, data),
      existsSync: (p) => fs.existsSync(p),
      readdirSync: (p) => fs.readdirSync(p)
    }
  }
  if (permissions.includes('storage')) {
    const storeFile = path.join(PLUGINS_DIR, pluginId, '.store.json')
    sandbox.storage = {
      get(key) {
        try {
          const data = JSON.parse(fs.readFileSync(storeFile, 'utf-8'))
          return key ? data[key] : data
        } catch { return key ? undefined : {} }
      },
      set(key, value) {
        let data = {}
        try { data = JSON.parse(fs.readFileSync(storeFile, 'utf-8')) } catch {}
        data[key] = value
        fs.writeFileSync(storeFile, JSON.stringify(data, null, 2))
      },
      delete(key) {
        let data = {}
        try { data = JSON.parse(fs.readFileSync(storeFile, 'utf-8')) } catch {}
        delete data[key]
        fs.writeFileSync(storeFile, JSON.stringify(data, null, 2))
      },
      list() {
        try { return Object.keys(JSON.parse(fs.readFileSync(storeFile, 'utf-8'))) } catch { return [] }
      }
    }
  }

  return sandbox
}

/** 加载单个插件 */
function loadPlugin(pluginId) {
  const pluginDir = path.join(PLUGINS_DIR, pluginId)
  const manifestPath = path.join(pluginDir, 'plugin.json')

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`插件 ${pluginId} 缺少 plugin.json 清单文件`)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

  // 验证 manifest 必填字段
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error(`插件 ${pluginId} 清单缺少必填字段 (id/name/version)`)
  }

  // 加载入口文件
  const entryFile = path.join(pluginDir, manifest.entry || 'index.js')
  if (!fs.existsSync(entryFile)) {
    throw new Error(`插件 ${pluginId} 入口文件不存在: ${manifest.entry || 'index.js'}`)
  }

  const code = fs.readFileSync(entryFile, 'utf-8')
  const permissions = manifest.permissions || []
  const sandbox = createSandbox(pluginId, permissions)

  // 在沙箱中执行插件代码
  const context = vm.createContext(sandbox)
  const script = new vm.Script(`
    (function(module, exports, require) {
      ${code}
    })
  `, { filename: entryFile })

  const moduleObj = { exports: {} }
  const pluginRequire = (mod) => {
    // 只允许加载白名单模块
    const allowed = ['path', 'crypto', 'url', 'querystring']
    if (allowed.includes(mod)) return require(mod)
    throw new Error(`插件 ${pluginId} 不允许加载模块: ${mod}`)
  }

  const factory = script.runInContext(context, { timeout: 5000 })
  factory(moduleObj, moduleObj.exports, pluginRequire)

  const instance = moduleObj.exports

  // 验证插件导出了必要的 handler
  if (manifest.tools && manifest.tools.length > 0) {
    for (const tool of manifest.tools) {
      if (typeof instance[tool.name] !== 'function' && typeof instance.handler !== 'function') {
        throw new Error(`插件 ${pluginId} 缺少工具处理函数: ${tool.name}`)
      }
    }
  }

  // 读取持久化状态
  const state = readState()
  const savedState = state[manifest.id] || {}

  const plugin = {
    manifest,
    instance,
    enabled: savedState.enabled !== false, // 默认启用
    config: savedState.config || {},
    loadedAt: Date.now()
  }

  plugins.set(manifest.id, plugin)
  return plugin
}

/** 扫描并加载所有插件 */
function loadAllPlugins() {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true })
    return
  }

  const dirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  const results = { loaded: [], failed: [] }

  for (const dir of dirs) {
    try {
      loadPlugin(dir)
      results.loaded.push(dir)
    } catch (err) {
      results.failed.push({ id: dir, error: err.message })
      console.error(`[PluginManager] 加载插件 ${dir} 失败:`, err.message)
    }
  }

  console.log(`[PluginManager] 已加载 ${results.loaded.length} 个插件, ${results.failed.length} 个失败`)
  return results
}

/** 卸载插件 */
function unloadPlugin(pluginId) {
  if (!plugins.has(pluginId)) return false
  plugins.delete(pluginId)
  saveState()
  return true
}

/** 启用插件 */
function enablePlugin(pluginId) {
  const p = plugins.get(pluginId)
  if (!p) return false
  p.enabled = true
  saveState()
  return true
}

/** 禁用插件 */
function disablePlugin(pluginId) {
  const p = plugins.get(pluginId)
  if (!p) return false
  p.enabled = false
  saveState()
  return true
}

/** 获取所有插件列表 */
function listPlugins() {
  const list = []
  for (const [id, p] of plugins) {
    list.push({
      id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description || '',
      enabled: p.enabled,
      tools: (p.manifest.tools || []).map(t => t.name),
      permissions: p.manifest.permissions || [],
      triggers: p.manifest.triggers || [],
      config: p.config,
      configSchema: p.manifest.configSchema || null,
      loadedAt: p.loadedAt
    })
  }
  return list
}

/** 获取单个插件详情 */
function getPlugin(pluginId) {
  const p = plugins.get(pluginId)
  if (!p) return null
  return {
    id: pluginId,
    manifest: p.manifest,
    enabled: p.enabled,
    config: p.config,
    loadedAt: p.loadedAt
  }
}

/** 更新插件配置 */
function updatePluginConfig(pluginId, config) {
  const p = plugins.get(pluginId)
  if (!p) return false
  p.config = { ...p.config, ...config }
  saveState()
  return true
}

/** 执行插件工具 */
async function executePluginTool(pluginId, toolName, params = {}) {
  const p = plugins.get(pluginId)
  if (!p) throw new Error(`插件 ${pluginId} 未加载`)
  if (!p.enabled) throw new Error(`插件 ${pluginId} 已禁用`)

  const handler = p.instance[toolName] || p.instance.handler
  if (typeof handler !== 'function') {
    throw new Error(`插件 ${pluginId} 没有工具: ${toolName}`)
  }

  // 注入上下文
  const context = {
    pluginId,
    config: p.config,
    storage: createSandbox(pluginId, ['storage']).storage
  }

  return await handler(params, context)
}

/** 获取所有已启用插件的工具定义（用于注入 tool-registry） */
function getPluginToolDefinitions() {
  const defs = []
  for (const [id, p] of plugins) {
    if (!p.enabled) continue
    for (const tool of (p.manifest.tools || [])) {
      defs.push({
        name: `plugin_${id}_${tool.name}`,
        description: `[插件:${p.manifest.name}] ${tool.description}`,
        parameters: tool.parameters || {},
        handler: async (params) => {
          return await executePluginTool(id, tool.name, params)
        }
      })
    }
  }
  return defs
}

/** 重新加载插件（热更新） */
function reloadPlugin(pluginId) {
  unloadPlugin(pluginId)
  return loadPlugin(pluginId)
}

/** 创建插件模板（插件开发模板生成器） */
function generatePluginTemplate(pluginId, name, description) {
  const pluginDir = path.join(PLUGINS_DIR, pluginId)
  if (fs.existsSync(pluginDir)) {
    throw new Error(`插件目录已存在: ${pluginId}`)
  }

  fs.mkdirSync(pluginDir, { recursive: true })

  const manifest = {
    id: pluginId,
    name: name || pluginId,
    version: '1.0.0',
    description: description || '',
    tools: [
      {
        name: 'main',
        description: `${name || pluginId} 主功能`,
        parameters: { input: 'string' }
      }
    ],
    triggers: [],
    permissions: ['storage'],
    entry: 'index.js',
    configSchema: {
      apiKey: { type: 'string', label: 'API Key', required: false }
    }
  }

  const indexJs = `/**
 * ${name || pluginId} - ${description || '插件描述'}
 */

// 主工具处理函数
exports.main = async (params, context) => {
  const { input } = params
  // TODO: 实现插件逻辑
  return {
    success: true,
    result: \`处理结果: \${input}\`
  }
}
`

  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2))
  fs.writeFileSync(path.join(pluginDir, 'index.js'), indexJs)

  return { id: pluginId, path: pluginDir }
}

module.exports = {
  loadAllPlugins,
  loadPlugin,
  unloadPlugin,
  enablePlugin,
  disablePlugin,
  listPlugins,
  getPlugin,
  updatePluginConfig,
  executePluginTool,
  getPluginToolDefinitions,
  reloadPlugin,
  generatePluginTemplate,
  PLUGINS_DIR
}
