/**
 * AI Portal Browser Extension - Background Script
 * 处理上下文菜单、侧栏管理、消息路由
 */

const API_BASE = 'http://localhost:3001'

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  // 创建上下文菜单
  chrome.contextMenus.create({
    id: 'ai-explain',
    title: 'AI 解释此文本',
    contexts: ['selection']
  })
  chrome.contextMenus.create({
    id: 'ai-translate',
    title: 'AI 翻译选中文本',
    contexts: ['selection']
  })
  chrome.contextMenus.create({
    id: 'ai-summarize',
    title: 'AI 总结页面',
    contexts: ['page']
  })
  chrome.contextMenus.create({
    id: 'ai-analyze-page',
    title: 'AI 分析页面内容',
    contexts: ['page']
  })
  chrome.contextMenus.create({
    id: 'separator-1',
    type: 'separator',
    contexts: ['selection', 'page']
  })
  chrome.contextMenus.create({
    id: 'ai-open-portal',
    title: '打开 AI Portal',
    contexts: ['action']
  })
})

// 处理上下文菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const tabId = tab?.id
  if (!tabId) return

  switch (info.menuItemId) {
    case 'ai-explain':
      if (info.selectionText) {
        await sendToSidePanel({
          action: 'ai-query',
          type: 'explain',
          text: info.selectionText
        })
        chrome.sidePanel.open({ windowId: tab.windowId })
      }
      break

    case 'ai-translate':
      if (info.selectionText) {
        await sendToSidePanel({
          action: 'ai-query',
          type: 'translate',
          text: info.selectionText
        })
        chrome.sidePanel.open({ windowId: tab.windowId })
      }
      break

    case 'ai-summarize':
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const article = document.querySelector('article') || document.querySelector('main') || document.body
            return article?.innerText?.slice(0, 5000) || document.body?.innerText?.slice(0, 5000) || ''
          }
        })
        const content = result?.result || ''
        await sendToSidePanel({
          action: 'ai-query',
          type: 'summarize',
          text: content,
          title: tab.title
        })
        chrome.sidePanel.open({ windowId: tab.windowId })
      } catch (err) {
        console.error('Failed to extract page for summarization:', err)
      }
      break

    case 'ai-analyze-page':
      chrome.tabs.sendMessage(tabId, { action: 'extract-content' }, async (response) => {
        if (response?.content) {
          await sendToSidePanel({
            action: 'ai-query',
            type: 'analyze',
            text: response.content.slice(0, 3000),
            title: tab.title,
            url: tab.url
          })
          chrome.sidePanel.open({ windowId: tab.windowId })
        }
      })
      break

    case 'ai-open-portal':
      chrome.tabs.create({ url: 'http://localhost:3001' })
      break
  }
})

// 监听来自 content script 和 side panel 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract-page-content') {
    // content script 返回页面内容
    sendResponse({ received: true })
  }

  if (message.action === 'query-ai') {
    // 查询 AI 服务
    fetch(`${API_BASE}/api/extension/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: message.type,
        selection: message.text,
        pageContent: message.pageContent
      })
    })
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(err => sendResponse({ error: err.message }))
    return true // 保持通道开放
  }

  if (message.action === 'get-page-info') {
    sendResponse({ title: sender.tab?.title, url: sender.tab?.url })
  }
})

// 辅助: 发送消息到 side panel
async function sendToSidePanel(data) {
  try {
    const views = await chrome.runtime.getContexts?.({ contextTypes: ['SIDE_PANEL'] })
    if (views?.length) {
      chrome.runtime.sendMessage(data)
    }
  } catch {
    // side panel 可能尚未打开
  }
}

// 快捷键
chrome.commands.onCommand.addListener((command) => {
  if (command === '_execute_action') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.windowId) {
        chrome.sidePanel.open({ windowId: tabs[0].windowId })
      }
    })
  }
})
