/**
 * AI Portal Browser Extension - Content Script
 * DOM 内容提取、页面交互、消息通信
 */

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'extract-content':
      sendResponse({ content: extractPageContent() })
      break

    case 'get-selection':
      sendResponse({ text: window.getSelection()?.toString() || '' })
      break

    case 'highlight-element':
      highlightElement(message.selector)
      sendResponse({ done: true })
      break
  }
  return true
})

// 提取页面结构化内容
function extractPageContent() {
  // 尝试获取文章内容
  const article = document.querySelector('article') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('main')

  if (article) {
    return stripHtml(article.innerHTML)
  }

  // 获取标题
  const title = document.title

  // 获取正文（去除导航、侧栏、页脚）
  const main = document.querySelector('#content') ||
    document.querySelector('.content') ||
    document.querySelector('.post-content') ||
    document.querySelector('.article-content') ||
    document.body

  if (main) {
    // 移除不需要的元素
    const clone = main.cloneNode(true)
    const removeSelectors = ['nav', 'header', 'footer', '.sidebar', '.advertisement', '.menu', '.comments', '.related-posts']
    removeSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove())
    })
    return stripHtml(clone.innerHTML)
  }

  return stripHtml(document.body.innerHTML)
}

// 移除 HTML 标签
function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

// 高亮元素
function highlightElement(selector) {
  const el = document.querySelector(selector)
  if (!el) return
  el.style.outline = '3px solid #ff6b6b'
  el.style.outlineOffset = '2px'
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    el.style.outline = ''
    el.style.outlineOffset = ''
  }, 3000)
}

// 自动提取并发送页面信息给 background（页面加载完成后）
setTimeout(() => {
  chrome.runtime.sendMessage({
    action: 'page-loaded',
    title: document.title,
    url: window.location.href,
    contentLength: document.body?.innerText?.length || 0
  })
}, 1000)
