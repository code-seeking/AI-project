/**
 * MCP Client - Model Context Protocol 客户端
 * 连接外部 MCP Server（如 IDE、浏览器等），获取其工具能力
 */

const MCP_CONFIG_FILE = require('path').join(__dirname, 'data', 'mcp-servers.json')
const fs = require('fs')

// 已连接的外部 MCP Server
const connections = new Map() // id -> { config, status, tools, lastPing }

/** 读取 MCP Server 配置 */
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(MCP_CONFIG_FILE, 'utf-8'))
  } catch { return { servers: [] } }
}

/** 保存 MCP Server 配置 */
function saveConfig(config) {
  fs.mkdirSync(require('path').dirname(MCP_CONFIG_FILE), { recursive: true })
  fs.writeFileSync(MCP_CONFIG_FILE, JSON.stringify(config, null, 2))
}

/** 添加外部 MCP Server 配置 */
function addServer(serverConfig) {
  const config = readConfig()
  const id = serverConfig.id || `mcp-${Date.now().toString(36)}`
  const entry = {
    id,
    name: serverConfig.name || id,
    url: serverConfig.url, // HTTP SSE endpoint
    transport: serverConfig.transport || 'http', // http | stdio
    command: serverConfig.command, // for stdio transport
    args: serverConfig.args || [],
    enabled: serverConfig.enabled !== false,
    addedAt: Date.now()
  }
  config.servers.push(entry)
  saveConfig(config)
  return entry
}

/** 移除 MCP Server 配置 */
function removeServer(serverId) {
  const config = readConfig()
  config.servers = config.servers.filter(s => s.id !== serverId)
  saveConfig(config)
  connections.delete(serverId)
  return true
}

/** 列出所有配置的 MCP Server */
function listServers() {
  const config = readConfig()
  return config.servers.map(s => ({
    ...s,
    status: connections.has(s.id) ? connections.get(s.id).status : 'disconnected',
    tools: connections.has(s.id) ? connections.get(s.id).tools : []
  }))
}

/** 连接到外部 MCP Server (HTTP 模式) */
async function connectServer(serverId) {
  const config = readConfig()
  const server = config.servers.find(s => s.id === serverId)
  if (!server) throw new Error(`MCP Server 不存在: ${serverId}`)

  try {
    // 1. 初始化握手
    const initRes = await fetch(`${server.url}/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'ai-portal', version: '1.0.0' }
      })
    })
    const initData = await initRes.json()

    // 2. 获取工具列表
    const toolsRes = await fetch(`${server.url}/tools/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    const toolsData = await toolsRes.json()

    const conn = {
      config: server,
      status: 'connected',
      serverInfo: initData.serverInfo,
      tools: (toolsData.tools || []).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      })),
      connectedAt: Date.now(),
      lastPing: Date.now()
    }

    connections.set(serverId, conn)
    return conn
  } catch (err) {
    connections.set(serverId, { config: server, status: 'error', error: err.message, tools: [] })
    throw new Error(`连接失败: ${err.message}`)
  }
}

/** 断开 MCP Server 连接 */
function disconnectServer(serverId) {
  connections.delete(serverId)
  return true
}

/** 调用外部 MCP Server 的工具 */
async function callRemoteTool(serverId, toolName, args = {}) {
  const conn = connections.get(serverId)
  if (!conn || conn.status !== 'connected') {
    throw new Error(`MCP Server ${serverId} 未连接`)
  }

  const res = await fetch(`${conn.config.url}/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: toolName, arguments: args })
  })

  const data = await res.json()
  if (data.isError) {
    throw new Error(data.content?.[0]?.text || 'Remote tool execution failed')
  }
  return data.content?.[0]?.text || JSON.stringify(data)
}

/** 获取所有已连接服务器的工具（用于注入 tool-registry） */
function getRemoteToolDefinitions() {
  const defs = []
  for (const [id, conn] of connections) {
    if (conn.status !== 'connected') continue
    for (const tool of conn.tools) {
      defs.push({
        name: `mcp_${id}_${tool.name}`,
        description: `[MCP:${conn.config.name}] ${tool.description}`,
        parameters: extractParams(tool.inputSchema),
        handler: async (params) => {
          return await callRemoteTool(id, tool.name, params)
        }
      })
    }
  }
  return defs
}

/** 从 JSON Schema 提取简单参数定义 */
function extractParams(inputSchema) {
  if (!inputSchema || !inputSchema.properties) return {}
  const params = {}
  for (const [key, prop] of Object.entries(inputSchema.properties)) {
    const required = (inputSchema.required || []).includes(key)
    params[key] = `${prop.type || 'string'}${required ? '' : '?'}`
  }
  return params
}

module.exports = {
  addServer,
  removeServer,
  listServers,
  connectServer,
  disconnectServer,
  callRemoteTool,
  getRemoteToolDefinitions
}
