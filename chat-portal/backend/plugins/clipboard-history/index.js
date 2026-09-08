/**
 * 剪贴板历史插件 - 记录和管理复制内容
 */

exports.clipboard_add = async (params, context) => {
  const { content, type } = params
  if (!content) return { success: false, message: '内容不能为空' }

  const maxItems = (context.config && context.config.maxItems) || 100
  const items = context.storage.get('items') || []

  // 检测内容类型
  const detectedType = type || detectType(content)

  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    content: content.slice(0, 5000), // 限制长度
    type: detectedType,
    length: content.length,
    preview: content.slice(0, 100),
    createdAt: new Date().toISOString()
  }

  items.unshift(item)
  // 限制最大数量
  if (items.length > maxItems) items.length = maxItems
  context.storage.set('items', items)

  return {
    success: true,
    message: `已保存 (${detectedType}, ${content.length} 字符)`,
    data: item
  }
}

exports.clipboard_search = async (params, context) => {
  const { keyword, limit } = params
  if (!keyword) return { success: false, message: '请输入搜索关键词' }

  const items = context.storage.get('items') || []
  const kw = keyword.toLowerCase()
  const results = items
    .filter(item => item.content.toLowerCase().includes(kw))
    .slice(0, limit || 10)

  return {
    success: true,
    data: { total: results.length, items: results }
  }
}

exports.clipboard_list = async (params, context) => {
  const limit = params.limit || 20
  const items = context.storage.get('items') || []

  return {
    success: true,
    data: {
      total: items.length,
      items: items.slice(0, limit)
    }
  }
}

function detectType(content) {
  if (/^https?:\/\//.test(content.trim())) return 'url'
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(content.trim())) return 'email'
  if (/^(function|const|let|var|import|export|class|def |public |private )/.test(content.trim())) return 'code'
  if (/^\{[\s\S]*\}$/.test(content.trim()) || /^\[[\s\S]*\]$/.test(content.trim())) return 'json'
  if (content.length > 200) return 'text-long'
  return 'text'
}
