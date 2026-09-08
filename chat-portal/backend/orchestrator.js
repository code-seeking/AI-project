/**
 * Agent Orchestrator - ReAct 推理引擎
 * 实现 Thought -> Action -> Observation 自主循环
 * 支持 SSE 实时推送执行过程
 */
const { getToolDefinitions, executeTool } = require('./tool-registry')

const MAX_ROUNDS = 10
const ROUND_TIMEOUT = 30000

// 活跃任务（支持取消）
const activeTasks = new Map()

/**
 * 构建系统提示词（包含可用工具列表）
 */
function buildSystemPrompt() {
  const toolDefs = getToolDefinitions()
  const toolList = toolDefs.map(t => {
    const params = Object.entries(t.parameters || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
    return `- ${t.name}(${params}): ${t.description}`
  }).join('\n')

  return `你是一个自主任务执行 Agent。你的目标是通过调用工具来完成用户给定的任务。

## 可用工具
${toolList}

## 输出格式（严格遵循）
每一轮你必须输出以下 JSON 格式之一：

### 格式1: 调用工具
{"thought": "你的思考过程", "action": {"tool": "工具名", "params": {参数对象}}}

### 格式2: 任务完成
{"thought": "你的思考过程", "done": true, "summary": "任务完成总结"}

## 规则
1. 每次只能调用一个工具
2. 根据 Observation 结果决定下一步
3. 如果工具返回错误，尝试换一种方式
4. 任务完成后必须输出 done:true 和 summary
5. 不要编造工具不存在的功能
6. 回复使用中文
7. 只输出 JSON，不要输出其他内容`
}

/**
 * 解析 LLM 输出为结构化决策
 */
function parseDecision(text) {
  try {
    // 尝试直接解析
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return parsed
  } catch {
    // 尝试从文本中提取 JSON
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return null
  }
}

/**
 * 运行 Agent Orchestrator
 * @param {string} goal - 用户目标
 * @param {object} options - { callLLM, onEvent, taskId }
 * @returns {Promise<object>} - 执行结果
 */
async function runOrchestrator(goal, options = {}) {
  const { callLLM, onEvent, taskId } = options
  const id = taskId || Date.now().toString(36)

  if (!callLLM) {
    return { success: false, error: 'LLM 未配置', steps: [] }
  }

  const taskState = { cancelled: false }
  activeTasks.set(id, taskState)

  const steps = []
  const startTime = Date.now()
  let conversationHistory = []
  let finalSummary = ''
  let success = true

  const emit = (event) => {
    if (onEvent) onEvent(event)
  }

  emit({ type: 'start', goal, taskId: id, timestamp: Date.now() })

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      // 检查取消
      if (taskState.cancelled) {
        emit({ type: 'cancelled', round })
        return { success: false, error: '用户取消', steps, totalDuration: Date.now() - startTime }
      }

      // 构建消息
      const systemPrompt = buildSystemPrompt()
      let userMessage = ''

      if (round === 1) {
        userMessage = `任务目标: ${goal}\n\n请开始执行。`
      } else {
        // 后续轮次使用对话历史
        userMessage = null // 使用 conversationHistory
      }

      // 调用 LLM
      emit({ type: 'thinking', round, timestamp: Date.now() })

      let llmReply
      try {
        if (round === 1) {
          llmReply = await callLLMWithTimeout(callLLM, systemPrompt, userMessage)
        } else {
          // 多轮对话：拼接历史
          const historyText = conversationHistory.map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n\n')
          llmReply = await callLLMWithTimeout(callLLM, systemPrompt, `任务目标: ${goal}\n\n## 对话历史\n${historyText}\n\n请继续执行下一步。`)
        }
      } catch (e) {
        if (e.message === 'TIMEOUT') {
          emit({ type: 'error', round, error: 'LLM 响应超时' })
          steps.push({ round, type: 'error', error: 'LLM 响应超时' })
          break
        }
        throw e
      }

      if (!llmReply) {
        emit({ type: 'error', round, error: 'LLM 不可用' })
        steps.push({ round, type: 'error', error: 'LLM 不可用' })
        success = false
        break
      }

      // 解析决策
      const decision = parseDecision(llmReply)

      if (!decision) {
        // 解析失败，让 LLM 重试
        conversationHistory.push({ role: 'assistant', content: llmReply })
        conversationHistory.push({ role: 'user', content: '请严格按照 JSON 格式输出。格式: {"thought":"...", "action":{"tool":"...", "params":{...}}} 或 {"thought":"...", "done":true, "summary":"..."}' })
        steps.push({ round, type: 'parse_error', raw: llmReply.slice(0, 200) })
        emit({ type: 'parse_error', round, raw: llmReply.slice(0, 200) })
        continue
      }

      // 记录思考
      const thought = decision.thought || ''
      emit({ type: 'thought', round, thought, timestamp: Date.now() })
      steps.push({ round, type: 'thought', thought })

      // 检查是否完成
      if (decision.done) {
        finalSummary = decision.summary || '任务完成'
        emit({ type: 'done', round, summary: finalSummary, timestamp: Date.now() })
        steps.push({ round, type: 'done', summary: finalSummary })
        break
      }

      // 执行工具
      if (decision.action && decision.action.tool) {
        const { tool, params } = decision.action
        emit({ type: 'action', round, tool, params, timestamp: Date.now() })
        steps.push({ round, type: 'action', tool, params })

        let observation
        try {
          observation = await executeTool(tool, params || {})
        } catch (e) {
          observation = `工具执行错误: ${e.message}`
        }

        // 截断过长的观察结果
        if (observation && observation.length > 1500) {
          observation = observation.slice(0, 1500) + '\n...(结果已截断)'
        }

        emit({ type: 'observation', round, tool, observation, timestamp: Date.now() })
        steps.push({ round, type: 'observation', tool, observation })

        // 记录到对话历史
        conversationHistory.push({ role: 'assistant', content: JSON.stringify({ thought, action: { tool, params } }) })
        conversationHistory.push({ role: 'user', content: `Observation [${tool}]: ${observation}` })
      } else {
        // 无有效动作，提示 LLM
        conversationHistory.push({ role: 'assistant', content: llmReply })
        conversationHistory.push({ role: 'user', content: '请调用一个工具或标记任务完成。' })
      }

      // 最后一轮仍未完成
      if (round === MAX_ROUNDS) {
        finalSummary = '达到最大推理轮次，任务可能未完全完成。'
        success = false
        emit({ type: 'max_rounds', round })
      }
    }
  } catch (err) {
    success = false
    finalSummary = `执行异常: ${err.message}`
    emit({ type: 'error', error: err.message })
  } finally {
    activeTasks.delete(id)
  }

  const result = {
    success,
    taskId: id,
    goal,
    summary: finalSummary,
    steps,
    totalDuration: Date.now() - startTime,
    rounds: steps.filter(s => s.type === 'thought').length
  }

  emit({ type: 'complete', ...result })
  return result
}

/**
 * 带超时的 LLM 调用
 */
async function callLLMWithTimeout(callLLM, systemPrompt, userMessage) {
  return Promise.race([
    callLLM(systemPrompt, userMessage, { temperature: 0.3, maxTokens: 2048 }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ROUND_TIMEOUT))
  ])
}

/**
 * 取消任务
 */
function cancelTask(taskId) {
  const task = activeTasks.get(taskId)
  if (task) {
    task.cancelled = true
    return true
  }
  return false
}

/**
 * 获取活跃任务
 */
function getActiveTasks() {
  return Array.from(activeTasks.keys())
}

module.exports = {
  runOrchestrator,
  cancelTask,
  getActiveTasks
}
