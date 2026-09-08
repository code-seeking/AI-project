// Chat Portal 悬浮球 - Background Service Worker
// 管理扩展安装、打开 Chat Portal 等功能

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 首次安装时，打开 Chat Portal
    chrome.tabs.create({ url: 'http://localhost:5174' })
  }
  console.log('[ChatPortal] 扩展已安装/更新')
})

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'openChatPortal':
      chrome.tabs.create({ url: 'http://localhost:5174' })
      sendResponse({ success: true })
      break

    case 'openInChrome':
      // 通过后端打开 URL
      fetch('http://localhost:3001/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: message.url })
      })
        .then(r => r.json())
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ code: 500, message: err.message }))
      return true // 保持通道开放

    case 'openLocalFile':
      fetch('http://localhost:3001/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: message.path })
      })
        .then(r => r.json())
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ code: 500, message: err.message }))
      return true

    case 'getBookmarks':
      fetch('http://localhost:3001/api/bookmarks')
        .then(r => r.json())
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ code: 500, message: err.message, data: [] }))
      return true

    case 'searchApps':
      fetch('http://localhost:3001/api/apps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: message.keyword })
      })
        .then(r => r.json())
        .then(data => sendResponse(data))
        .catch(err => sendResponse({ code: 500, message: err.message, data: [] }))
      return true

    default:
      sendResponse({ code: 400, message: '未知操作' })
  }
})
