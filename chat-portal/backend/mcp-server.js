/**
 * MCP Server - Model Context Protocol 服务端
 * 将 AI Portal 的工具暴露为 MCP 资源，供外部 MCP Client 连接
 * 传输层: HTTP SSE 模式
 */
const express = require('express')
const crypto = require('crypto')

let toolRegistry = null
let serverInfo = {
  name: 'ai-portal-mcp',
  version: '1.0.0',
  description: 'AI Portal MCP Server - 暴露 AI Portal 工具为 MCP 资源'
}

// 活跃的 SSE 连接
const sessions = new Map()

/** 初始化 MCP Server，注入工具注册表 */
function initMcpServer(registry) {
  toolRegistry = registry
}

/** 创建 MCP Server Express Router */
function createMcpRouter() {
  const router = express.Router()

  // MCP 初始化握手
  router.post('/initialize', (req, res) => {
    const { protocolVersion, capabilities, clientInfo } = req.body
    const sessionId = crypto.randomUUID()

    sessions.set(sessionId, {
      clientInfo,
      protocolVersion: protocolVersion || '2024-11-05',
      createdAt: Date.now()
    })

    res.json({
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true }
      },
      serverInfo,
      sessionId
    })
  })

  // 列出可用工具
  router.post('/tools/list', (req, res) => {
    if (!toolRegistry) return res.json({ tools: [] })

    const definitions = toolRegistry.getToolDefinitions()
    const tools = definitions.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: 'object',
        properties: buildJsonSchema(t.parameters),
        required: Object.entries(t.parameters || {})
          .filter(([, v]) => !String(v).endsWith('?'))
          .map(([k]) => k)
      }
    }))

    res.json({ tools })
  })

  // 调用工具
  router.post('/tools/call', async (req, res) => {
    const { name, arguments: args } = req.body

    if (!toolRegistry) {
      return res.json({
        content: [{ type: 'text', text: 'Error: Tool registry not available' }],
        isError: true
      })
    }

    try {
      const result = await toolRegistry.executeTool(name, args || {})
      res.json({
        content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
        isError: false
      })
    } catch (err) {
      res.json({
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      })
    }
  })

  // 列出资源
  router.post('/resources/list', (req, res) => {
    const resources = [
      {
        uri: 'portal://tools',
        name: '可用工具列表',
        description: 'AI Portal 所有已注册的工具',
        mimeType: 'application/json'
      },
      {
        uri: 'portal://status',
        name: '系统状态',
        description: 'AI Portal 当前运行状态',
        mimeType: 'application/json'
      }
    ]
    res.json({ resources })
  })

  // 读取资源
  router.post('/resources/read', (req, res) => {
    const { uri } = req.body

    if (uri === 'portal://tools') {
      const defs = toolRegistry ? toolRegistry.getToolDefinitions() : []
      res.json({
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(defs.map(d => ({ name: d.name, description: d.description })), null, 2)
        }]
      })
    } else if (uri === 'portal://status') {
      res.json({
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            status: 'running',
            tools: toolRegistry ? toolRegistry.getToolDefinitions().length : 0,
            sessions: sessions.size,
            uptime: process.uptime()
          }, null, 2)
        }]
      })
    } else {
      res.json({ contents: [], error: `Unknown resource: ${uri}` })
    }
  })

  // SSE 通知通道（用于 server-to-client 推送）
  router.get('/sse', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    })
    res.write(`data: ${JSON.stringify({ type: 'connected', server: serverInfo.name })}\n\n`)

    const keepAlive = setInterval(() => {
      res.write(`:ping\n\n`)
    }, 30000)

    req.on('close', () => clearInterval(keepAlive))
  })

  // 健康检查
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      server: serverInfo,
      tools: toolRegistry ? toolRegistry.getToolDefinitions().length : 0,
      sessions: sessions.size
    })
  })

  return router
}

/** 将简单参数定义转为 JSON Schema properties */
function buildJsonSchema(params) {
  if (!params) return {}
  const properties = {}
  for (const [key, type] of Object.entries(params)) {
    const cleanType = String(type).replace('?', '')
    const jsonType = cleanType === 'number' ? 'number'
      : cleanType === 'boolean' ? 'boolean'
      : cleanType === 'object' ? 'object'
      : cleanType === 'array' ? 'array'
      : 'string'
    properties[key] = { type: jsonType, description: key }
  }
  return properties
}

module.exports = { initMcpServer, createMcpRouter, serverInfo }
