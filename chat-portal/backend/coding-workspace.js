/**
 * Coding Workspace - AI 编码工作区
 * 项目上下文引擎、AI 代码生成、Diff 预览、Git 集成
 */
const fs = require('fs')
const path = require('path')
const { execSync, exec } = require('child_process')

const DATA_DIR = path.join(__dirname, 'data')

// ===== 工具函数 =====
function readJSON(file, def = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return def }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ===== 语言 / 技术栈检测 =====
const TECH_STACK_SIGNATURES = {
  node: ['package.json', 'node_modules'],
  react: ['package.json', 'src/App.js', 'src/App.tsx', 'vite.config.ts', 'vite.config.js'],
  vue: ['package.json', 'src/App.vue', 'vue.config.js'],
  java: ['pom.xml', 'build.gradle', 'src/main/java'],
  python: ['requirements.txt', 'setup.py', 'Pipfile', 'pyproject.toml'],
  go: ['go.mod', 'main.go'],
  rust: ['Cargo.toml'],
  docker: ['Dockerfile', 'docker-compose.yml'],
  dotnet: ['*.csproj', '*.sln'],
  php: ['composer.json', 'index.php']
}

const LANGUAGE_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  vue: 'html', py: 'python', java: 'java', go: 'go', rs: 'rust',
  css: 'css', scss: 'scss', html: 'html', json: 'json', xml: 'xml',
  md: 'markdown', yml: 'yaml', yaml: 'yaml', sh: 'bash', bash: 'bash',
  ps1: 'powershell', sql: 'sql', dockerfile: 'dockerfile'
}

/** 检测文件语言 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const base = path.basename(filePath).toLowerCase()
  if (base === 'dockerfile') return 'dockerfile'
  if (base === 'makefile') return 'makefile'
  return LANGUAGE_MAP[ext] || ext
}

/** 读取文件内容，支持行范围 */
function readFileContent(filePath, startLine, endLine) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { error: '文件不存在', content: null }
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  if (startLine !== undefined) {
    const sliced = lines.slice(startLine - 1, endLine || undefined)
    return { content: sliced.join('\n'), totalLines: lines.length, language: detectLanguage(filePath) }
  }
  return { content, totalLines: lines.length, language: detectLanguage(filePath) }
}

// ===== 13.1 项目扫描 =====
const IGNORED_DIRS = new Set(['node_modules', '.git', '.qoder', 'dist', 'build', 'target', '.next', '.nuxt', '__pycache__', '.idea', '.vscode', 'logs', 'coverage'])
const IGNORED_FILES = new Set(['package-lock.json', 'yarn.lock', '.DS_Store', 'Thumbs.db'])

/**
 * 扫描项目结构
 */
function scanProject(rootPath) {
  if (!rootPath || !fs.existsSync(rootPath)) {
    return { error: '项目路径不存在', files: [], deps: {}, techStack: [] }
  }

  const files = []
  let fileCount = 0

  function walk(dir, depth = 0) {
    if (depth > 6 || fileCount > 2000) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch { return }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        files.push({ path: relPath, type: 'dir', name: entry.name })
        walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        if (IGNORED_FILES.has(entry.name)) continue
        fileCount++
        files.push({
          path: relPath,
          type: 'file',
          name: entry.name,
          ext: path.extname(entry.name).slice(1),
          size: fs.statSync(fullPath).size,
          language: detectLanguage(fullPath)
        })
      }
    }
  }

  walk(rootPath)

  // 提取依赖
  const deps = extractDependencies(rootPath)

  // 检测技术栈
  const techStack = detectTechStack(rootPath, files)

  return { files, deps, techStack, rootPath }
}

/** 提取依赖信息 */
function extractDependencies(rootPath) {
  const result = {}
  const pkgPath = path.join(rootPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      result.node = {
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
        scripts: pkg.scripts || {}
      }
    } catch {}
  }
  const pomPath = path.join(rootPath, 'pom.xml')
  if (fs.existsSync(pomPath)) {
    result.java = { buildTool: 'maven' }
  }
  const gradlePath = path.join(rootPath, 'build.gradle')
  if (fs.existsSync(gradlePath)) {
    result.java = { buildTool: 'gradle' }
  }
  return result
}

/** 检测技术栈 */
function detectTechStack(rootPath, files) {
  const stacks = []
  const fileSet = new Set(files.map(f => f.path))
  for (const [stack, signatures] of Object.entries(TECH_STACK_SIGNATURES)) {
    if (signatures.some(sig => {
      if (sig.includes('*')) {
        const pattern = sig.replace(/\*/g, '')
        return [...fileSet].some(f => f.endsWith(pattern))
      }
      return fileSet.has(sig) || fs.existsSync(path.join(rootPath, sig))
    })) {
      stacks.push(stack)
    }
  }
  return stacks
}

// ===== 13.1 文件浏览 =====

/**
 * 列出目录文件
 */
function listFiles(rootPath, relativePath = '') {
  const targetPath = path.join(rootPath, relativePath)
  if (!fs.existsSync(targetPath)) {
    return { error: '路径不存在', entries: [] }
  }
  try {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true })
    const result = entries
      .filter(e => !IGNORED_DIRS.has(e.name) && !IGNORED_FILES.has(e.name) && !e.name.startsWith('.'))
      .map(e => {
        const fullPath = path.join(targetPath, e.name)
        const relPath = relativePath ? `${relativePath}/${e.name}` : e.name
        return {
          name: e.name,
          path: relPath,
          type: e.isDirectory() ? 'dir' : 'file',
          size: e.isFile() ? fs.statSync(fullPath).size : undefined,
          language: e.isFile() ? detectLanguage(fullPath) : undefined
        }
      })
    return { entries: result, rootPath, currentPath: relativePath }
  } catch (err) {
    return { error: err.message, entries: [] }
  }
}

// ===== 13.2 AI 代码生成 =====

/**
 * 调用 LLM 进行代码生成
 */
async function callLLM(prompt, aiServiceUrl) {
  const url = aiServiceUrl || process.env.AI_SERVICE_URL || 'http://localhost:8081'
  try {
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    })
    if (!res.ok) throw new Error(`AI service returned ${res.status}`)
    const data = await res.json()
    return data.reply || data.content || data.message || ''
  } catch (err) {
    // 降级: 直接调用 Ollama
    try {
      const res2 = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'codellama',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.3 }
        }),
        signal: AbortSignal.timeout(60000)
      })
      if (!res2.ok) throw new Error(`Ollama returned ${res2.status}`)
      const data2 = await res2.json()
      return data2.message?.content || ''
    } catch (err2) {
      throw new Error(`LLM 调用失败: ${err2.message}`)
    }
  }
}

/**
 * 生成代码
 * @param {object} params - { instruction, files: [{ path, content }], projectContext, aiServiceUrl }
 */
async function generateCode(params) {
  const { instruction, files = [], projectContext = '', aiServiceUrl } = params

  const fileContext = files.map(f =>
    `文件: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``
  ).join('\n\n')

  const prompt = `你是一个资深全栈工程师。请根据以下指令修改/生成代码。

## 项目上下文
${projectContext || '无'}

## 当前文件
${fileContext || '新项目'}

## 指令
${instruction}

## 输出格式（严格遵循 JSON）
请输出一个 JSON 数组，每个元素代表一个文件的操作：
[
  {
    "filePath": "文件路径（相对于项目根目录）",
    "type": "create | modify | delete",
    "original": "原代码（新文件填空字符串）",
    "generated": "生成的新代码",
    "explanation": "修改说明"
  }
]

注意：
1. 只输出 JSON 数组，不要输出其他内容
2. 对于 modify 操作，original 必须包含被修改部分的原代码
3. 所有文件路径使用正斜杠 /
4. 如果不需要修改文件，输出空数组 []`

  const result = await callLLM(prompt, aiServiceUrl)

  // 解析 JSON
  try {
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const edits = JSON.parse(cleaned)
    return { edits: Array.isArray(edits) ? edits : [] }
  } catch {
    // 尝试从文本中提取 JSON 数组
    const match = result.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (match) {
      try {
        const edits = JSON.parse(match[0])
        return { edits: Array.isArray(edits) ? edits : [] }
      } catch {}
    }
    return { edits: [], raw: result, error: '无法解析 AI 输出' }
  }
}

/**
 * 解释代码
 */
async function explainCode(params) {
  const { code, language = '', instruction, aiServiceUrl } = params

  const prompt = `请解释以下${language}代码：

\`\`\`${language}
${code}
\`\`\`

${instruction ? `额外要求：${instruction}` : '请解释这段代码的功能、输入输出和关键逻辑。'}

请用中文回复，格式简洁清晰。如有优化建议也请一并提出。`

  const result = await callLLM(prompt, aiServiceUrl)
  return { explanation: result }
}

/**
 * 重构代码
 */
async function refactorCode(params) {
  const { code, language = '', instruction, aiServiceUrl } = params

  const prompt = `请重构以下${language}代码：

\`\`\`${language}
${code}
\`\`\`

重构要求：${instruction || '提高代码质量和可读性'}

## 输出格式（严格遵循 JSON）
{
  "refactored": "重构后的完整代码",
  "explanation": "重构说明（每项改动和理由）",
  "suggestions": ["建议1", "建议2"]
}

注意：只输出 JSON，不要输出其他内容。refactored 字段必须包含完整的新代码。`

  const result = await callLLM(prompt, aiServiceUrl)

  try {
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      refactored: parsed.refactored || '',
      explanation: parsed.explanation || '',
      suggestions: parsed.suggestions || []
    }
  } catch {
    return { refactored: '', explanation: result, suggestions: [] }
  }
}

// ===== 13.3 Git 集成 =====

/**
 * Git 操作封装
 */
const git = {
  /** 检查 git 是否可用 */
  isAvailable(rootPath) {
    try {
      execSync('git --version', { stdio: 'pipe' })
      return fs.existsSync(path.join(rootPath, '.git'))
    } catch { return false }
  },

  /** 获取仓库状态 */
  status(rootPath) {
    try {
      const status = execSync('git status --porcelain', { cwd: rootPath, encoding: 'utf-8', stdio: 'pipe' })
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootPath, encoding: 'utf-8', stdio: 'pipe' }).trim()
      const lines = status.split('\n').filter(Boolean)
      const changes = lines.map(line => ({
        type: line.slice(0, 2).trim(),
        file: line.slice(3).trim()
      }))
      return { branch, changes, hasChanges: changes.length > 0, clean: changes.length === 0 }
    } catch (err) {
      return { error: err.message, changes: [], hasChanges: false, clean: false }
    }
  },

  /** 获取 diff */
  diff(rootPath, filePath) {
    try {
      const cmd = filePath
        ? `git diff --unified=5 "${filePath.replace(/\\/g, '/')}"`
        : 'git diff --unified=5'
      const diff = execSync(cmd, { cwd: rootPath, encoding: 'utf-8', stdio: 'pipe' })
      const stagedDiff = execSync('git diff --cached --unified=5', { cwd: rootPath, encoding: 'utf-8', stdio: 'pipe' })
      return { diff, stagedDiff }
    } catch (err) {
      return { error: err.message, diff: '', stagedDiff: '' }
    }
  },

  /** AI 生成 commit message */
  async generateCommitMessage(rootPath, aiServiceUrl) {
    const { diff } = this.diff(rootPath)
    if (!diff) return { message: '无变更', changes: [] }

    const prompt = `根据以下代码变更，生成一个简洁的 Git commit message。

\`\`\`diff
${diff.slice(0, 3000)}
\`\`\`

## 输出格式（JSON）
{
  "type": "feat | fix | refactor | docs | chore | test | style",
  "scope": "影响范围",
  "subject": "简洁的标题（50字以内）",
  "body": "详细说明（可选）",
  "changes": ["变更点1", "变更点2"]
}`

    const result = await callLLM(prompt, aiServiceUrl)
    try {
      const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return JSON.parse(cleaned)
    } catch {
      return { type: 'chore', subject: result.slice(0, 50), changes: [] }
    }
  },

  /** 执行 commit */
  commit(rootPath, message) {
    if (!message) return { error: 'commit message 不能为空' }
    try {
      execSync('git add -A', { cwd: rootPath, stdio: 'pipe' })
      const escaped = message.replace(/"/g, '\\"')
      execSync(`git commit -m "${escaped}"`, { cwd: rootPath, stdio: 'pipe' })
      const hash = execSync('git rev-parse --short HEAD', { cwd: rootPath, encoding: 'utf-8', stdio: 'pipe' }).trim()
      return { success: true, hash, message }
    } catch (err) {
      return { error: err.message }
    }
  },

  /** 获取提交历史 */
  log(rootPath, maxCount = 10) {
    try {
      const log = execSync(
        `git log --oneline --max-count=${maxCount} --pretty=format:"%h|%s|%ar|%an"`,
        { cwd: rootPath, encoding: 'utf-8', stdio: 'pipe' }
      )
      return log.split('\n').filter(Boolean).map(line => {
        const [hash, subject, date, author] = line.split('|')
        return { hash, subject, date, author }
      })
    } catch (err) {
      return { error: err.message }
    }
  },

  /** AI 代码审查 */
  async review(rootPath, aiServiceUrl) {
    const { diff } = this.diff(rootPath)
    const { branch } = this.status(rootPath)
    if (!diff) return { error: '无变更可审查' }

    const prompt = `你是一个资深代码审查员。请审查以下代码变更。

分支: ${branch}

\`\`\`diff
${diff.slice(0, 5000)}
\`\`\`

## 输出格式（JSON）
{
  "summary": "总体评价",
  "issues": [
    { "severity": "critical | warning | suggestion", "file": "文件名", "line": 1, "message": "问题描述", "suggestion": "修改建议" }
  ],
  "strengths": ["优点1", "优点2"],
  "recommendation": "approve | changes_requested"
}`

    const result = await callLLM(prompt, aiServiceUrl)
    try {
      const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return JSON.parse(cleaned)
    } catch {
      return { summary: result, issues: [], strengths: [], recommendation: 'changes_requested' }
    }
  }
}

// ===== 上下文关联分析 =====
function getProjectContext(rootPath, filePath) {
  if (!fs.existsSync(rootPath)) return { error: '项目路径不存在' }

  const relativePath = filePath ? path.relative(rootPath, filePath).replace(/\\/g, '/') : ''
  const ext = filePath ? path.extname(filePath).slice(1).toLowerCase() : ''

  // 查找同级文件和导入关系
  const related = []
  if (filePath) {
    const dir = path.dirname(filePath)
    try {
      const entries = fs.readdirSync(dir)
      for (const e of entries) {
        const full = path.join(dir, e)
        if (full !== filePath && fs.statSync(full).isFile()) {
          related.push({
            path: path.relative(rootPath, full).replace(/\\/g, '/'),
            name: e
          })
        }
      }
    } catch {}
  }

  // 搜索项目中引用该文件的 imports
  const references = []
  if (filePath) {
    const baseName = path.basename(filePath, path.extname(filePath))
    try {
      function searchRefs(dir, depth = 0) {
        if (depth > 3) return
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          if (e.isDirectory()) {
            if (!IGNORED_DIRS.has(e.name)) searchRefs(full, depth + 1)
          } else if (e.isFile()) {
            const content = fs.readFileSync(full, 'utf-8').slice(0, 2000)
            if (content.includes(baseName) || content.includes(`./${baseName}`) || content.includes(`'./${baseName}'`) || content.includes(`"./${baseName}"`)) {
              references.push(path.relative(rootPath, full).replace(/\\/g, '/'))
            }
          }
        }
      }
      searchRefs(rootPath)
    } catch {}
  }

  return { relatedFiles: related.slice(0, 20), references: references.slice(0, 20), relativePath }
}

module.exports = {
  scanProject,
  listFiles,
  readFile: readFileContent,
  generateCode,
  explainCode,
  refactorCode,
  git,
  getProjectContext,
  detectLanguage,
  detectTechStack
}
