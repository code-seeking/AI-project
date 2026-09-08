/**
 * 快捷翻译插件 - 中英互译
 */

// 常用词典（离线翻译降级）
const DICT = {
  'hello': '你好', 'world': '世界', 'thank': '谢谢', 'please': '请',
  'good': '好的', 'morning': '早上', 'night': '晚上', 'work': '工作',
  'code': '代码', 'function': '函数', 'variable': '变量', 'class': '类',
  'interface': '接口', 'component': '组件', 'database': '数据库',
  'server': '服务器', 'client': '客户端', 'request': '请求', 'response': '响应',
  '你好': 'hello', '世界': 'world', '谢谢': 'thank you', '请': 'please',
  '工作': 'work', '代码': 'code', '函数': 'function', '变量': 'variable',
  '组件': 'component', '数据库': 'database', '服务器': 'server'
}

function detectLanguage(text) {
  const chineseRatio = (text.match(/[\u4e00-\u9fff]/g) || []).length / text.length
  return chineseRatio > 0.3 ? 'zh' : 'en'
}

exports.translate = async (params, context) => {
  const { text, targetLang } = params
  if (!text) return { success: false, message: '请输入要翻译的文本' }

  const sourceLang = detectLanguage(text)
  const target = targetLang === 'auto' || !targetLang
    ? (sourceLang === 'zh' ? 'en' : 'zh')
    : targetLang

  // 尝试词典翻译
  const lowerText = text.toLowerCase().trim()
  let translation = DICT[lowerText] || DICT[text.trim()]

  // 如果词典没有，尝试使用 fetch 调用翻译API（如果配置了）
  if (!translation && context.config && context.config.apiKey) {
    try {
      const res = await fetch('https://api.example.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from: sourceLang, to: target, key: context.config.apiKey })
      })
      const data = await res.json()
      translation = data.result
    } catch (e) {
      // API 失败，使用模拟翻译
    }
  }

  // 降级：生成模拟翻译结果
  if (!translation) {
    translation = sourceLang === 'zh'
      ? `[Translation] ${text}`
      : `[翻译] ${text}`
  }

  // 记录翻译历史
  const history = context.storage.get('history') || []
  history.unshift({ text, translation, from: sourceLang, to: target, time: new Date().toISOString() })
  if (history.length > 50) history.length = 50
  context.storage.set('history', history)

  return {
    success: true,
    data: {
      original: text,
      translation,
      from: sourceLang === 'zh' ? '中文' : 'English',
      to: target === 'zh' ? '中文' : 'English',
      method: translation.startsWith('[') ? 'fallback' : 'dictionary'
    }
  }
}
