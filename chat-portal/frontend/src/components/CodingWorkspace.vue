<template>
  <div class="coding-workspace">
    <!-- 工具栏 -->
    <div class="coding-toolbar">
      <el-input v-model="rootPath" placeholder="输入项目根目录路径 (如 D:/my-project)" class="path-input" size="small" clearable>
        <template #prepend>项目路径</template>
        <template #append>
          <el-button @click="handleScan" :loading="scanning">扫描</el-button>
        </template>
      </el-input>
      <el-button-group style="margin-left: 8px">
        <el-button size="small" :type="activeTab === 'files' ? 'primary' : ''" @click="activeTab = 'files'">文件</el-button>
        <el-button size="small" :type="activeTab === 'generate' ? 'primary' : ''" @click="activeTab = 'generate'">AI生成</el-button>
        <el-button size="small" :type="activeTab === 'explain' ? 'primary' : ''" @click="activeTab = 'explain'">解释</el-button>
        <el-button size="small" :type="activeTab === 'refactor' ? 'primary' : ''" @click="activeTab = 'refactor'">重构</el-button>
        <el-button size="small" :type="activeTab === 'git' ? 'primary' : ''" @click="activeTab = 'git'">Git</el-button>
      </el-button-group>
    </div>

    <!-- 主区域 -->
    <div class="coding-main">
      <!-- 文件树侧栏 (文件Tab) -->
      <div v-if="activeTab === 'files'" class="coding-sidebar">
        <div class="sidebar-header">
          <span>{{ projectInfo?.rootPath ? projectInfo.rootPath.split('/').pop() || projectInfo.rootPath.split('\\').pop() : '项目文件' }}</span>
          <el-tag size="small" v-if="projectInfo?.techStack?.length">{{ projectInfo.techStack.join(', ') }}</el-tag>
        </div>
        <div class="file-tree">
          <div v-if="!projectInfo?.files?.length" class="empty-hint">点击"扫描"加载项目文件</div>
          <div v-for="file in projectInfo?.files || []" :key="file.path" class="file-item" :class="{ file: file.type === 'file', dir: file.type === 'dir' }" @click="file.type === 'file' && openFile(file)">
            <span class="file-icon">{{ file.type === 'dir' ? '📁' : '📄' }}</span>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size" v-if="file.size !== undefined">{{ (file.size / 1024).toFixed(1) }}KB</span>
          </div>
        </div>
      </div>

      <!-- 编辑区 (文件Tab) -->
      <div v-if="activeTab === 'files'" class="coding-editor">
        <div v-if="!currentFile" class="editor-placeholder">
          <el-empty description="选择文件查看内容或输入指令生成代码" />
        </div>
        <template v-else>
          <div class="editor-header">
            <span>{{ currentFile.path }}</span>
            <el-tag size="small">{{ currentFile.language }}</el-tag>
          </div>
          <div ref="editorContainer" class="editor-container"></div>
        </template>
      </div>

      <!-- AI 生成 Tab -->
      <div v-if="activeTab === 'generate'" class="coding-ai-panel">
        <div class="ai-input-area">
          <label class="ai-label">生成指令</label>
          <el-input v-model="generateInstruction" type="textarea" :rows="4" placeholder="例如: 添加一个用户登录功能，包含前端登录页面和后端接口" />
        </div>
        <div class="ai-input-area">
          <label class="ai-label">项目上下文 (可选)</label>
          <el-input v-model="generateContext" type="textarea" :rows="2" placeholder="描述项目技术栈、架构等上下文信息" />
        </div>
        <div class="ai-input-area">
          <label class="ai-label">关联文件</label>
          <el-select v-model="selectedFiles" multiple filterable placeholder="选择关联文件" style="width: 100%">
            <el-option v-for="f in projectInfo?.files?.filter(x => x.type === 'file') || []" :key="f.path" :label="f.path" :value="f.path" />
          </el-select>
        </div>
        <el-button type="primary" @click="handleGenerate" :loading="generating" style="width: 100%">
          {{ generating ? 'AI 生成中...' : '生成代码' }}
        </el-button>

        <!-- 生成结果 -->
        <div v-if="generateResult" class="generate-result">
          <div v-for="(edit, i) in generateResult.edits" :key="i" class="edit-card">
            <div class="edit-header">
              <span class="edit-file">{{ edit.filePath }}</span>
              <el-tag :type="edit.type === 'create' ? 'success' : edit.type === 'delete' ? 'danger' : 'warning'" size="small">
                {{ edit.type === 'create' ? '新建' : edit.type === 'delete' ? '删除' : '修改' }}
              </el-tag>
            </div>
            <div class="edit-explain">{{ edit.explanation }}</div>
            <div class="diff-area">
              <div v-if="edit.original" class="diff-original">
                <div class="diff-label">原代码</div>
                <pre><code>{{ edit.original }}</code></pre>
              </div>
              <div class="diff-generated">
                <div class="diff-label">新代码</div>
                <pre><code>{{ edit.generated }}</code></pre>
              </div>
            </div>
          </div>
          <el-alert v-if="generateResult.error" :title="generateResult.error" type="warning" show-icon :closable="false" />
        </div>
      </div>

      <!-- 解释 Tab -->
      <div v-if="activeTab === 'explain'" class="coding-ai-panel">
        <div class="ai-input-area">
          <label class="ai-label">代码</label>
          <el-input v-model="explainCode" type="textarea" :rows="8" placeholder="粘贴需要解释的代码" />
        </div>
        <div class="ai-input-area">
          <label class="ai-label">额外要求 (可选)</label>
          <el-input v-model="explainInstruction" placeholder="如: 重点解释性能瓶颈" />
        </div>
        <el-button type="primary" @click="handleExplain" :loading="explaining" style="width: 100%">
          {{ explaining ? '分析中...' : '解释代码' }}
        </el-button>
        <div v-if="explainResult" class="result-block">
          <div class="result-label">解释结果</div>
          <div class="result-content">{{ explainResult.explanation }}</div>
        </div>
      </div>

      <!-- 重构 Tab -->
      <div v-if="activeTab === 'refactor'" class="coding-ai-panel">
        <div class="ai-input-area">
          <label class="ai-label">代码</label>
          <el-input v-model="refactorCode" type="textarea" :rows="6" placeholder="粘贴需要重构的代码" />
        </div>
        <div class="ai-input-area">
          <label class="ai-label">重构要求</label>
          <el-input v-model="refactorInstruction" placeholder="如: 提取为函数 / 改用 async/await" />
        </div>
        <el-button type="primary" @click="handleRefactor" :loading="refactoring" style="width: 100%">
          {{ refactoring ? '重构中...' : '重构代码' }}
        </el-button>
        <div v-if="refactorResult" class="result-block">
          <div class="result-label">重构结果</div>
          <div class="diff-area">
            <div class="diff-original">
              <div class="diff-label">重构说明</div>
              <div class="result-content">{{ refactorResult.explanation }}</div>
            </div>
            <div class="diff-generated">
              <div class="diff-label">重构后代码</div>
              <pre><code>{{ refactorResult.refactored }}</code></pre>
            </div>
          </div>
          <div v-if="refactorResult.suggestions?.length" class="suggestions">
            <div class="result-label">优化建议</div>
            <ul>
              <li v-for="(s, i) in refactorResult.suggestions" :key="i">{{ s }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Git Tab -->
      <div v-if="activeTab === 'git'" class="coding-ai-panel">
        <div class="git-actions">
          <el-button @click="handleGitStatus" :loading="gitLoading">Git 状态</el-button>
          <el-button @click="handleGitDiff" :loading="gitLoading">查看 Diff</el-button>
          <el-button type="primary" @click="handleGitCommit" :loading="gitCommitting">
            {{ gitCommitting ? '提交中...' : 'AI 自动 Commit' }}
          </el-button>
          <el-button @click="handleGitLog" :loading="gitLoading">提交历史</el-button>
          <el-button @click="handleGitReview" :loading="gitReviewing">
            {{ gitReviewing ? '审查中...' : 'AI 代码审查' }}
          </el-button>
        </div>

        <div v-if="gitStatus" class="result-block">
          <div class="result-label">仓库状态</div>
          <div>分支: <el-tag size="small">{{ gitStatus.branch }}</el-tag></div>
          <div v-if="gitStatus.clean" style="color: #67c23a">工作区干净</div>
          <div v-else>
            <div v-for="(c, i) in gitStatus.changes" :key="i" class="change-item">
              <el-tag :type="c.type === '??' ? 'danger' : c.type === 'M' ? 'warning' : 'info'" size="mini">{{ c.type }}</el-tag>
              {{ c.file }}
            </div>
          </div>
        </div>

        <div v-if="gitDiff" class="result-block">
          <div class="result-label">Diff</div>
          <pre class="diff-pre"><code>{{ gitDiff.diff || gitDiff.stagedDiff || '无变更' }}</code></pre>
        </div>

        <div v-if="gitLog.length" class="result-block">
          <div class="result-label">提交历史 (最近 {{ gitLog.length }} 条)</div>
          <div v-for="(l, i) in gitLog" :key="i" class="commit-item">
            <el-tag size="mini">{{ l.hash }}</el-tag>
            <span class="commit-subject">{{ l.subject }}</span>
            <span class="commit-date">{{ l.date }}</span>
          </div>
        </div>

        <div v-if="gitReview" class="result-block">
          <div class="result-label">AI 代码审查</div>
          <div class="review-summary">{{ gitReview.summary }}</div>
          <div v-if="gitReview.issues?.length" class="review-issues">
            <div v-for="(issue, i) in gitReview.issues" :key="i" class="review-issue">
              <el-tag :type="issue.severity === 'critical' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'info'" size="mini">{{ issue.severity }}</el-tag>
              <span class="issue-file">{{ issue.file }}:{{ issue.line }}</span>
              <span class="issue-msg">{{ issue.message }}</span>
            </div>
          </div>
          <div v-if="gitReview.strengths?.length" class="review-strengths">
            <span v-for="(s, i) in gitReview.strengths" :key="i" class="strength-tag">{{ s }}</span>
          </div>
          <div class="review-recommendation">
            建议: <el-tag :type="gitReview.recommendation === 'approve' ? 'success' : 'danger'">{{ gitReview.recommendation === 'approve' ? '批准' : '需修改' }}</el-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import {
  codingScanProject, codingListFiles, codingReadFile, codingGenerateCode,
  codingExplainCode, codingRefactorCode,
  codingGitStatus, codingGitDiff, codingGitCommit, codingGitLog, codingGitReview
} from '@/api'
import { ElMessage } from 'element-plus'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { python } from '@codemirror/lang-python'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'

// 状态
const rootPath = ref('')
const activeTab = ref('files')
const scanning = ref(false)
const projectInfo = ref<{ files: any[]; deps: any; techStack: string[]; rootPath: string }>({ files: [], deps: {}, techStack: [], rootPath: '' })

// 文件
const currentFile = ref<{ path: string; content: string; language: string } | null>(null)
const editorContainer = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

// 生成
const generateInstruction = ref('')
const generateContext = ref('')
const selectedFiles = ref<string[]>([])
const generating = ref(false)
const generateResult = ref<{ edits: any[]; error?: string } | null>(null)

// 解释
const explainCode = ref('')
const explainInstruction = ref('')
const explaining = ref(false)
const explainResult = ref<{ explanation: string } | null>(null)

// 重构
const refactorCode = ref('')
const refactorInstruction = ref('')
const refactoring = ref(false)
const refactorResult = ref<{ refactored: string; explanation: string; suggestions: string[] } | null>(null)

// Git
const gitLoading = ref(false)
const gitCommitting = ref(false)
const gitReviewing = ref(false)
const gitStatus = ref<any>(null)
const gitDiff = ref<any>(null)
const gitLog = ref<any[]>([])
const gitReview = ref<any>(null)

// 编辑器语言映射
function getLangExtension(lang: string) {
  const map: Record<string, any> = {
    javascript, js: javascript, jsx: javascript,
    typescript: javascript, ts: javascript, tsx: javascript,
    html, vue: html,
    css, scss: css,
    json,
    markdown,
    sql,
    python, py: python,
    xml
  }
  return map[lang] || []
}

// 初始化编辑器
function initEditor(content: string, lang: string) {
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
  if (!editorContainer.value) return
  const langExt = getLangExtension(lang)
  const state = EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      langExt,
      oneDark,
      EditorView.editable.of(false),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' }
      })
    ]
  })
  editorView = new EditorView({ state, parent: editorContainer.value })
}

// 扫描项目
async function handleScan() {
  if (!rootPath.value) return
  scanning.value = true
  try {
    const res = await codingScanProject(rootPath.value)
    if (res.code === 200) projectInfo.value = res.data
  } finally {
    scanning.value = false
  }
}

// 打开文件
async function openFile(file: any) {
  const res = await codingReadFile(file.path)
  if (res.code === 200 && res.data) {
    currentFile.value = { path: file.path, content: res.data.content, language: res.data.language || file.language }
    await nextTick()
    initEditor(res.data.content, res.data.language)
  }
}

// AI 生成
async function handleGenerate() {
  if (!generateInstruction.value) return
  generating.value = true
  generateResult.value = null
  try {
    const files = selectedFiles.value.map(p => {
      const f = projectInfo.value.files.find(x => x.path === p)
      return { path: p, content: '' }
    })
    const res = await codingGenerateCode(generateInstruction.value, files, generateContext.value || undefined)
    if (res.code === 200) generateResult.value = res.data
  } finally {
    generating.value = false
  }
}

// 解释
async function handleExplain() {
  if (!explainCode.value) return
  explaining.value = true
  try {
    const res = await codingExplainCode(explainCode.value, undefined, explainInstruction.value || undefined)
    if (res.code === 200) explainResult.value = res.data
  } finally {
    explaining.value = false
  }
}

// 重构
async function handleRefactor() {
  if (!refactorCode.value) return
  refactoring.value = true
  try {
    const res = await codingRefactorCode(refactorCode.value, undefined, refactorInstruction.value || undefined)
    if (res.code === 200) refactorResult.value = res.data
  } finally {
    refactoring.value = false
  }
}

// Git
async function handleGitStatus() {
  if (!rootPath.value) return
  gitLoading.value = true
  try {
    const res = await codingGitStatus(rootPath.value)
    if (res.code === 200) gitStatus.value = res.data
  } finally {
    gitLoading.value = false
  }
}

async function handleGitDiff() {
  if (!rootPath.value) return
  gitLoading.value = true
  try {
    const res = await codingGitDiff(rootPath.value)
    if (res.code === 200) gitDiff.value = res.data
  } finally {
    gitLoading.value = false
  }
}

async function handleGitCommit() {
  if (!rootPath.value) return
  gitCommitting.value = true
  try {
    const res = await codingGitCommit(rootPath.value)
    if (res.code === 200) {
      ElMessage.success(res.data?.hash ? `提交成功: ${res.data.hash}` : (res.data?.error || '提交完成'))
      handleGitLog()
    }
  } finally {
    gitCommitting.value = false
  }
}

async function handleGitLog() {
  if (!rootPath.value) return
  gitLoading.value = true
  try {
    const res = await codingGitLog(rootPath.value, 10)
    if (res.code === 200) gitLog.value = res.data as any[]
  } finally {
    gitLoading.value = false
  }
}

async function handleGitReview() {
  if (!rootPath.value) return
  gitReviewing.value = true
  try {
    const res = await codingGitReview(rootPath.value)
    if (res.code === 200) gitReview.value = res.data
  } finally {
    gitReviewing.value = false
  }
}

onMounted(() => {
  // 尝试从 localStorage 恢复上次路径
  const saved = localStorage.getItem('coding_rootPath')
  if (saved) rootPath.value = saved
})
watch(rootPath, (v) => { if (v) localStorage.setItem('coding_rootPath', v) })
</script>

<style scoped>
.coding-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #d4d4d4;
}
.coding-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  gap: 8px;
  flex-shrink: 0;
}
.path-input {
  flex: 1;
  max-width: 500px;
}
.coding-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.coding-sidebar {
  width: 260px;
  border-right: 1px solid #3c3c3c;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  font-weight: 600;
  font-size: 13px;
}
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.file-item {
  display: flex;
  align-items: center;
  padding: 3px 12px;
  cursor: pointer;
  font-size: 13px;
  gap: 4px;
}
.file-item:hover { background: #2a2d2e; }
.file-item.file { color: #d4d4d4; }
.file-item.dir { color: #569cd6; font-weight: 500; }
.file-icon { font-size: 14px; width: 20px; text-align: center; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: #858585; font-size: 11px; }
.coding-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.editor-header {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
  font-size: 13px;
  gap: 8px;
  flex-shrink: 0;
}
.editor-container {
  flex: 1;
  overflow: hidden;
}
.coding-ai-panel {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  max-width: 900px;
}
.ai-input-area {
  margin-bottom: 12px;
}
.ai-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  color: #cccccc;
}
.empty-hint {
  padding: 20px;
  text-align: center;
  color: #858585;
  font-size: 13px;
}
.generate-result {
  margin-top: 16px;
}
.edit-card {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
}
.edit-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d2d;
  gap: 8px;
}
.edit-file { font-weight: 500; flex: 1; }
.edit-explain { padding: 8px 12px; font-size: 13px; color: #a0a0a0; }
.diff-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
}
.diff-label { font-size: 12px; color: #858585; margin-bottom: 4px; }
.diff-original pre, .diff-generated pre {
  background: #1e1e1e;
  padding: 8px 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
}
.diff-original { border-left: 3px solid #d73a49; }
.diff-generated { border-left: 3px solid #28a745; }
.result-block {
  margin-top: 16px;
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  padding: 12px;
}
.result-label {
  font-weight: 600;
  margin-bottom: 8px;
  color: #569cd6;
}
.result-content {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.6;
}
.suggestions ul { padding-left: 20px; }
.suggestions li { margin-bottom: 4px; font-size: 13px; }
.git-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.change-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 13px;
}
.diff-pre {
  background: #1e1e1e;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  max-height: 400px;
  overflow-y: auto;
}
.commit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
.commit-subject { flex: 1; }
.commit-date { color: #858585; font-size: 12px; }
.review-summary { margin-bottom: 12px; font-size: 13px; line-height: 1.6; }
.review-issue {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 0;
  font-size: 13px;
}
.issue-file { color: #569cd6; white-space: nowrap; }
.issue-msg { color: #d4d4d4; }
.review-strengths {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
}
.strength-tag {
  background: #1e3a2f;
  color: #7fdb9a;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.review-recommendation { margin-top: 8px; font-size: 13px; }
</style>
