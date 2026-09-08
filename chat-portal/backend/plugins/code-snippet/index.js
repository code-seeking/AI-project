/**
 * 代码片段插件 - 管理和搜索代码片段
 */

function detectLanguage(code) {
  if (/^(import |export |const |let |var |function |=>)/.test(code.trim())) return 'javascript'
  if (/^(public |private |class |@Override|System\.out)/.test(code.trim())) return 'java'
  if (/^(def |import |print\(|class )/.test(code.trim())) return 'python'
  if (/^(package |func |type |struct )/.test(code.trim())) return 'go'
  if (/<[a-z]+[\s>]/.test(code.trim())) return 'html'
  if (/^[.#]?[\w-]+\s*\{/.test(code.trim())) return 'css'
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)/i.test(code.trim())) return 'sql'
  return 'text'
}

exports.snippet_add = async (params, context) => {
  const { title, code, language, tags } = params
  if (!title || !code) return { success: false, message: '标题和代码不能为空' }

  const snippets = context.storage.get('snippets') || []
  const snippet = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    title,
    code,
    language: language || detectLanguage(code),
    tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    lines: code.split('\n').length,
    chars: code.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  snippets.unshift(snippet)
  context.storage.set('snippets', snippets)

  return {
    success: true,
    message: `✅ 代码片段「${title}」已保存 (${snippet.language}, ${snippet.lines} 行)`,
    data: snippet
  }
}

exports.snippet_search = async (params, context) => {
  const { keyword, language } = params
  if (!keyword) return { success: false, message: '请输入搜索关键词' }

  const snippets = context.storage.get('snippets') || []
  const kw = keyword.toLowerCase()

  let results = snippets.filter(s =>
    s.title.toLowerCase().includes(kw) ||
    s.code.toLowerCase().includes(kw) ||
    s.tags.some(t => t.toLowerCase().includes(kw))
  )

  if (language) {
    results = results.filter(s => s.language === language)
  }

  return {
    success: true,
    data: {
      total: results.length,
      items: results.slice(0, 20).map(s => ({
        ...s,
        code: s.code.slice(0, 200) + (s.code.length > 200 ? '...' : '')
      }))
    }
  }
}

exports.snippet_list = async (params, context) => {
  const { language, limit } = params
  let snippets = context.storage.get('snippets') || []

  if (language) {
    snippets = snippets.filter(s => s.language === language)
  }

  // 统计语言分布
  const langStats = {}
  for (const s of snippets) {
    langStats[s.language] = (langStats[s.language] || 0) + 1
  }

  return {
    success: true,
    data: {
      total: snippets.length,
      languages: langStats,
      items: snippets.slice(0, limit || 20).map(s => ({
        id: s.id,
        title: s.title,
        language: s.language,
        tags: s.tags,
        lines: s.lines,
        createdAt: s.createdAt
      }))
    }
  }
}
