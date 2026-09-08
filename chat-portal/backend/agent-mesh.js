/**
 * Agent Mesh - 动态 Agent 编排
 * Agent 工厂、Agent 间通信、Human-in-the-Loop、Agent Swarm
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const AGENTS_FILE = path.join(DATA_DIR, 'mesh-agents.json')
const COMMUNICATION_FILE = path.join(DATA_DIR, 'mesh-communications.json')

// ===== 工具函数 =====
function readJSON(file, def = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ===== 15.1 Agent 工厂 =====
// 角色模板
const ROLE_TEMPLATES = {
  analyst: {
    role: 'analyst',
    goal: '分析问题并提供见解',
    expertise: ['数据分析', '需求分析', '代码分析', '文本分析'],
    temperature: 0.3,
    constraints: ['仅进行分析，不执行操作']
  },
  coder: {
    role: 'coder',
    goal: '编写和修改代码',
    expertise: ['编码', '调试', '代码审查', '重构'],
    temperature: 0.2,
    constraints: ['生成代码需提供解释']
  },
  reviewer: {
    role: 'reviewer',
    goal: '审查代码和工作成果',
    expertise: ['代码审查', '质量保证', '安全审计'],
    temperature: 0.3,
    constraints: ['指出所有问题和改进建议']
  },
  planner: {
    role: 'planner',
    goal: '制定计划和分解任务',
    expertise: ['任务分解', '规划', '排期'],
    temperature: 0.4,
    constraints: ['输出结构化计划']
  },
  tester: {
    role: 'tester',
    goal: '编写测试用例和执行测试',
    expertise: ['测试', 'QA', '自动化测试'],
    temperature: 0.2,
    constraints: ['确保测试覆盖率和边界情况']
  },
  researcher: {
    role: 'researcher',
    goal: '研究技术方案和收集信息',
    expertise: ['调研', '文档分析', '技术评估'],
    temperature: 0.5,
    constraints: ['提供信息来源和引用']
  }
}

/** 创建 Agent 实例 */
function createAgent(params) {
  const { role, goal, tools = [], parentId = null } = params
  const template = ROLE_TEMPLATES[role] || {
    role: 'assistant',
    goal: goal || '辅助完成任务',
    expertise: ['通用'],
    temperature: 0.4,
    constraints: []
  }

  const agent = {
    id: genId(),
    role: params.role || template.role,
    goal: goal || template.goal,
    expertise: params.expertise || template.expertise,
    temperature: params.temperature ?? template.temperature,
    constraints: params.constraints || template.constraints,
    tools,
    parentId,
    children: [],
    status: 'idle', // idle | running | waiting | done | error | cancelled
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    currentTask: null,
    result: null,
    error: null,
    conversation: []
  }

  // 持久化
  const agents = readJSON(AGENTS_FILE, [])
  agents.push(agent)
  writeJSON(AGENTS_FILE, agents)

  return agent
}

/** 获取 Agent */
function getAgent(agentId) {
  const agents = readJSON(AGENTS_FILE, [])
  return agents.find(a => a.id === agentId) || null
}

/** 更新 Agent */
function updateAgent(agentId, updates) {
  const agents = readJSON(AGENTS_FILE, [])
  const idx = agents.findIndex(a => a.id === agentId)
  if (idx < 0) return null
  agents[idx] = { ...agents[idx], ...updates }
  writeJSON(AGENTS_FILE, agents)
  return agents[idx]
}

/** 删除 Agent */
function destroyAgent(agentId) {
  let agents = readJSON(AGENTS_FILE, [])
  agents = agents.filter(a => a.id !== agentId)
  writeJSON(AGENTS_FILE, agents)
  return { success: true }
}

/** 列出所有 Agent */
function listAgents() {
  return readJSON(AGENTS_FILE, [])
}

/** 清理已完成/失败的 Agent（30 分钟以上） */
function cleanupAgents(maxAgeMs = 30 * 60 * 1000) {
  const agents = readJSON(AGENTS_FILE, [])
  const now = Date.now()
  const filtered = agents.filter(a => {
    if (a.status === 'done' || a.status === 'error' || a.status === 'cancelled') {
      const completed = new Date(a.completedAt || a.createdAt).getTime()
      return (now - completed) < maxAgeMs
    }
    return true
  })
  writeJSON(AGENTS_FILE, filtered)
  return { removed: agents.length - filtered.length }
}

// ===== 15.1 Agent 执行 =====
// 简单的 LLM 调用
async function callAgentLLM(agent, task, aiServiceUrl) {
  const systemPrompt = `你是 ${agent.role} 角色。
目标: ${agent.goal}
专长: ${agent.expertise.join(', ')}
约束: ${agent.constraints.join(', ') || '无'}
${agent.tools.length ? `可用工具: ${agent.tools.join(', ')}` : ''}

请根据你的角色和目标完成以下任务。请用中文回复。`

  const url = aiServiceUrl || process.env.AI_SERVICE_URL || 'http://localhost:8081'
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...agent.conversation.slice(-10),
          { role: 'user', content: task }
        ],
        temperature: agent.temperature,
        stream: false
      }),
      signal: AbortSignal.timeout(120000)
    })
    if (!res.ok) throw new Error(`AI service ${res.status}`)
    const data = await res.json()
    return data.reply || data.content || data.message || ''
  } catch (err) {
    // 降级到 Ollama
    try {
      const res2 = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          messages: [
            { role: 'system', content: systemPrompt },
            ...agent.conversation.slice(-10),
            { role: 'user', content: task }
          ],
          stream: false,
          options: { temperature: agent.temperature }
        }),
        signal: AbortSignal.timeout(120000)
      })
      if (!res2.ok) throw new Error(`Ollama ${res2.status}`)
      const data2 = await res2.json()
      return data2.message?.content || ''
    } catch (err2) {
      throw new Error(`Agent LLM 调用失败: ${err2.message}`)
    }
  }
}

/** 运行 Agent */
async function runAgent(agentId, task, options = {}) {
  const agent = getAgent(agentId)
  if (!agent) return { error: `Agent ${agentId} 不存在` }

  updateAgent(agentId, { status: 'running', startedAt: new Date().toISOString(), currentTask: task })

  try {
    const reply = await callAgentLLM(agent, task, options.aiServiceUrl)
    const conversation = [...(agent.conversation || []), { role: 'user', content: task }, { role: 'assistant', content: reply }]
    const result = { reply, conversationLength: conversation.length }

    updateAgent(agentId, {
      status: 'done',
      completedAt: new Date().toISOString(),
      result: result,
      conversation
    })

    return result
  } catch (err) {
    updateAgent(agentId, { status: 'error', error: err.message, completedAt: new Date().toISOString() })
    return { error: err.message }
  }
}

// ===== 15.2 Agent 间通信 =====
function sendMessage(fromId, toId, type, payload) {
  const msg = {
    id: genId(),
    from: fromId,
    to: toId,
    type, // request | response | broadcast
    payload,
    timestamp: new Date().toISOString(),
    read: false
  }

  const comms = readJSON(COMMUNICATION_FILE, [])
  comms.push(msg)
  if (comms.length > 1000) comms.splice(0, comms.length - 1000)
  writeJSON(COMMUNICATION_FILE, comms)

  return msg
}

function getMessages(agentId, unreadOnly = false) {
  const comms = readJSON(COMMUNICATION_FILE, [])
  let msgs = comms.filter(m => m.to === agentId || m.from === agentId || m.type === 'broadcast')
  if (unreadOnly) msgs = msgs.filter(m => !m.read)
  return msgs
}

function markMessageRead(msgId) {
  const comms = readJSON(COMMUNICATION_FILE, [])
  const msg = comms.find(m => m.id === msgId)
  if (msg) msg.read = true
  writeJSON(COMMUNICATION_FILE, comms)
  return { success: true }
}

// ===== 15.2 协作模式 =====
async function collaborate(config, options = {}) {
  const { agents: agentConfigs = [], task, workflow = 'sequential' } = config
  if (agentConfigs.length === 0) return { error: '至少需要一个 Agent' }
  if (!task) return { error: 'task 为必填项' }

  // 创建所有 Agent
  const createdAgents = agentConfigs.map(cfg => createAgent(cfg))
  const results = []

  if (workflow === 'sequential') {
    // 顺序执行：上一个的输出作为下一个的上下文
    let context = task
    for (const agent of createdAgents) {
      const enrichedTask = results.length > 0
        ? `${context}\n\n上一步结果:\n${results[results.length - 1].reply}`
        : context
      const result = await runAgent(agent.id, enrichedTask, options)
      results.push({ agentId: agent.id, role: agent.role, ...result })
      // 发送消息
      if (results.length > 1) {
        sendMessage(agent.id, createdAgents[results.length - 2]?.id, 'response', result)
      }
    }
  } else if (workflow === 'parallel') {
    // 并行执行
    const promises = createdAgents.map(agent => runAgent(agent.id, task, options))
    const outputs = await Promise.allSettled(promises)
    for (let i = 0; i < createdAgents.length; i++) {
      const output = outputs[i]
      results.push({
        agentId: createdAgents[i].id,
        role: createdAgents[i].role,
        ...(output.status === 'fulfilled' ? output.value : { error: output.reason?.message || '执行失败' })
      })
    }
  } else if (workflow === 'swarm') {
    // Swarm: 管理者 + 工作者
    const manager = createdAgents[0]
    const workers = createdAgents.slice(1)

    // 管理者分解任务
    const planTask = `请将以下任务分解为 ${workers.length} 个子任务，每个子任务不超过 200 字。\n\n任务: ${task}\n\n工作者角色: ${workers.map(w => `${w.role}: ${w.goal}`).join(', ')}\n\n请为每个工作者分配一个子任务。输出格式：每个工作者一行 "${workers.map(w => w.id).join('|')}" 对应的子任务。`
    const planResult = await runAgent(manager.id, planTask, options)

    // 分配子任务给工作者
    const workerPromises = workers.map((worker, i) => {
      const subtask = `子任务 (来自管理者 ${manager.role}):\n${planResult.reply || '请完成你的角色职责'}\n\n主任务: ${task}`
      return runAgent(worker.id, subtask, options)
    })

    const workerResults = await Promise.allSettled(workerPromises)
    for (let i = 0; i < workers.length; i++) {
      const wr = workerResults[i]
      results.push({
        agentId: workers[i].id,
        role: workers[i].role,
        ...(wr.status === 'fulfilled' ? wr.value : { error: wr.reason?.message || '执行失败' })
      })
      sendMessage(workers[i].id, manager.id, 'response', wr.status === 'fulfilled' ? wr.value : { error: wr.reason?.message })
    }
  }

  return { agents: createdAgents.map(a => ({ id: a.id, role: a.role, status: a.status })), results }
}

// ===== 15.3 Human-in-the-Loop =====
const HITL_FILE = path.join(DATA_DIR, 'mesh-hitl.json')

function createApprovalPoint(agentId, context, options = []) {
  const approvals = readJSON(HITL_FILE, [])
  const point = {
    id: genId(),
    agentId,
    context,
    options: options.length > 0 ? options : [{ label: '批准', action: 'approve' }, { label: '拒绝', action: 'reject' }, { label: '修改', action: 'modify' }],
    status: 'pending', // pending | approved | rejected | modified
    decision: null,
    modifiedValue: null,
    createdAt: new Date().toISOString(),
    decidedAt: null
  }
  approvals.push(point)
  writeJSON(HITL_FILE, approvals)
  return point
}

function getPendingApprovals(agentId) {
  const approvals = readJSON(HITL_FILE, [])
  return approvals.filter(a => a.status === 'pending' && (!agentId || a.agentId === agentId))
}

function resolveApproval(approvalId, decision, modifiedValue) {
  const approvals = readJSON(HITL_FILE, [])
  const point = approvals.find(a => a.id === approvalId)
  if (!point) return { error: '审批点不存在' }
  if (point.status !== 'pending') return { error: '已处理' }

  point.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'modified'
  point.decision = decision
  point.modifiedValue = modifiedValue || null
  point.decidedAt = new Date().toISOString()
  writeJSON(HITL_FILE, approvals)
  return point
}

function getApprovalHistory(limit = 50) {
  const approvals = readJSON(HITL_FILE, [])
  return approvals.slice(-limit).reverse()
}

module.exports = {
  createAgent,
  getAgent,
  updateAgent,
  destroyAgent,
  listAgents,
  cleanupAgents,
  runAgent,
  sendMessage,
  getMessages,
  markMessageRead,
  collaborate,
  createApprovalPoint,
  getPendingApprovals,
  resolveApproval,
  getApprovalHistory,
  ROLE_TEMPLATES
}
