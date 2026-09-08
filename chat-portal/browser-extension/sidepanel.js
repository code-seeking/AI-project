/**
 * AI Portal Browser Extension - Side Panel Script
 * 侧栏聊天界面交互
 */

const API_BASE = 'http://localhost:3001'
const chatArea = document.getElementById('chatArea')
const inputEl = document.getElementById('input')
const sendBtn = document.getElementById('sendBtn')
const statusEl = document.getElementById('status')

let loading = false

// 检查后端连接
async function checkConnection() {
  try {
    const res = await fetch(`${API_BASE}/api/health`)
    if (res.ok) {
      statusEl.textContent = '已连接'
      statusEl.className = 'status online'
    } else {
      statusEl.textContent = '服务异常'
      statusEl.className = 'status'
    }
  } catch {
    statusEl.textContent = '未连接 (需启动后端)'
    statusEl.className = 'status'
  }
}
checkConnection()

// 发送消息
async function sendMessage(text, type) {
  if (loading || !text.trim()) return

  addMessage(text, 'user')
  showLoading()

  try {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '你是一个浏览器助手，请简洁地回答问题。' },
          { role: 'user', content: type ? `[${type}] ${text}` : text }
        ]
      })
    })
    const data = await res.json()
    hideLoading()
    if (data.code === 200 && data.data?.content) {
      addMessage(data.data.content, 'assistant')
    } else {
      addMessage('抱歉，请求失败，请检查后端服务。', 'assistant')
    }
  } catch (err) {
    hideLoading()
    addMessage(`错误: ${err.message}`, 'assistant')
  }
}

// 添加消息
function addMessage(text, role, type) {
  const msg = document.createElement('div')
  msg.className = `message ${role}`
  if (type) {
    const badge = document.createElement('div')
    badge.className = 'type-badge'
    badge.textContent = typeLabels[type] || type
    msg.appendChild(badge)
  }
  const textEl = document.createElement('div')
  textEl.textContent = text
  msg.appendChild(textEl)
  chatArea.appendChild(msg)
  chatArea.scrollTop = chatArea.scrollHeight
}

const typeLabels = {
  explain: '解释',
  translate: '翻译',
  summarize: '总结',
  analyze: '分析',
  improve: '改进写作'
}

// 加载动画
function showLoading() {
  loading = true
  sendBtn.disabled = true
  const div = document.createElement('div')
  div.className = 'message assistant'
  div.id = 'loadingMsg'
  div.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>'
  chatArea.appendChild(div)
  chatArea.scrollTop = chatArea.scrollHeight
}

function hideLoading() {
  loading = false
  sendBtn.disabled = false
  const el = document.getElementById('loadingMsg')
  if (el) el.remove()
}

// 事件绑定
sendBtn.addEventListener('click', () => {
  const text = inputEl.value.trim()
  if (text) {
    sendMessage(text)
    inputEl.value = ''
  }
})

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendBtn.click()
  }
})

// 自动调整输入框高度
inputEl.addEventListener('input', () => {
  inputEl.style.height = '40px'
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px'
})

// 快速操作按钮
document.querySelectorAll('.quick-action').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action

    // 尝试获取当前页面选中的文本
    try {
      const [tab] = await chrome.tabs?.query({ active: true, currentWindow: true }) || []
      if (tab?.id) {
        const [result] = await chrome.scripting?.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString() || ''
        }) || []
        const selection = result?.result || ''

        if (selection) {
          sendMessage(selection, action)
        } else {
          // 没有选中文本，使用页面内容
          const [content] = await chrome.scripting?.executeScript({
            target: { tabId: tab.id },
            func: () => document.body?.innerText?.slice(0, 2000) || ''
          }) || []
          if (content?.result) {
            sendMessage(content.result, action)
          } else {
            inputEl.placeholder = `请输入要${typeLabels[action] || action}的文本...`
            inputEl.focus()
          }
        }
      }
    } catch {
      // 非扩展环境（开发测试）
      inputEl.placeholder = `请输入要${typeLabels[action] || action}的文本...`
      inputEl.focus()
    }
  })
})

// 监听来自 background 的消息
chrome.runtime?.onMessage?.addListener((message) => {
  if (message.action === 'ai-query' && message.text) {
    sendMessage(message.text, message.type)
  }
})
