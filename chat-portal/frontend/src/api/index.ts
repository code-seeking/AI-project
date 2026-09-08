import { get, post, put, del } from './request'
import type { Bookmark, AppItem, BookmarkGroup, TagCount, PaginatedResponse, KnowledgeDoc, KnowledgeQueryResult, WorkLog, WorkLogStats, Agent, AgentChatResult, CollaborateResult, MemoryFact, MemoryInsights, AssistantTrigger, AssistantSuggestion } from '@/types'

// ===== 书签 API =====

/** 获取书签列表（分页+搜索+标签+分组） */
export function getBookmarks(params?: {
  page?: number
  pageSize?: number
  search?: string
  tag?: string
  group_id?: number
  language?: string
}) {
  return get<{ code: number; data: Bookmark[]; total: number; page: number; pageSize: number }>('/bookmarks', { params })
}

/** 添加书签（支持标签、分组、描述） */
export function addBookmark(keyword: string, url: string, opts?: {
  description?: string
  tags?: string[]
  group_id?: number | null
  language?: string
}) {
  return post<{ code: number; data: Bookmark; message: string }>('/bookmarks', { keyword, url, ...opts })
}

/** 更新书签 */
export function updateBookmark(id: number, data: Partial<Bookmark>) {
  return put<{ code: number; data: Bookmark; message: string }>(`/bookmarks/${id}`, data)
}

/** 删除书签（按 ID） */
export function deleteBookmarkById(id: number) {
  return del<{ code: number; message: string }>(`/bookmarks/${id}`)
}

/** 批量删除 */
export function batchDeleteBookmarks(ids: number[]) {
  return del<{ code: number; message: string }>('/bookmarks/batch', { data: { ids } })
}

/** 清空所有书签 */
export function clearAllBookmarks() {
  return del<{ code: number; message: string }>('/bookmarks')
}

/** 搜索书签 */
export function searchBookmarks(keyword: string) {
  return post<{ code: number; data: Bookmark[] }>('/bookmarks/search', { keyword })
}

/** 导出书签（JSON/CSV） */
export function exportBookmarks(format: 'json' | 'csv' = 'json') {
  // 直接获取下载链接
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  window.open(`${base}/bookmarks/export?format=${format}`, '_blank')
}

/** 导入书签 */
export function importBookmarks(data: Partial<Bookmark>[], format: 'json' | 'csv' = 'json') {
  return post<{ code: number; message: string; data: { count: number } }>('/bookmarks/import', { data, format })
}

// ===== 分组 API =====

export function getGroups() {
  return get<{ code: number; data: BookmarkGroup[] }>('/groups')
}

export function addGroup(name: string, description?: string) {
  return post<{ code: number; data: BookmarkGroup; message: string }>('/groups', { name, description })
}

export function deleteGroup(id: number) {
  return del<{ code: number; message: string }>(`/groups/${id}`)
}

// ===== 标签 API =====

export function getTags() {
  return get<{ code: number; data: TagCount[] }>('/tags')
}

// ===== 系统 API =====

export function getSystemStatus() {
  return get<{ code: number; data: { postgresql: boolean; storage: string; aiService: string } }>('/system/status')
}

// ===== 原有 API（保持兼容）=====

/** 在 Chrome 中打开 URL */
export function openUrlInChrome(url: string) {
  return post<{ code: number; message: string }>('/open', { url })
}

/** 打开本地文件/文件夹 */
export function openLocalFile(path: string) {
  return post<{ code: number; message: string }>('/open-file', { path })
}

/** 搜索已安装应用 */
export function searchApps(keyword: string) {
  return post<{ code: number; data: AppItem[] }>('/apps/search', { keyword })
}

/** 启动已安装应用（通过 .lnk 路径） */
export function openApp(appPath: string) {
  return post<{ code: number; message: string }>('/open-app', { path: appPath })
}

// ===== AI 分类 API =====

export interface AICategoryItem {
  keyword: string
  summary: string
}

export interface AICategoryGroup {
  name: string
  items: AICategoryItem[]
}

export interface AIClassifyResult {
  categories: AICategoryGroup[]
}

/** AI 智能分类书签 */
export function aiClassifyBookmarks() {
  return post<{ code: number; data: AIClassifyResult; message: string }>('/ai/classify-bookmarks')
}

/** AI 智能分类文件夹 */
export function aiClassifyFolder(folderPath: string, files: { name: string; path: string; ext: string }[]) {
  return post<{ code: number; data: any; message: string }>('/ai/classify-folder', { folderPath, files })
}

/** AI 意图解析 */
export function aiIntentParse(text: string) {
  return post<{ code: number; data: { text: string; isUrl: boolean; isFilePath: boolean; isSearch: boolean; aiSuggestion: string | null; confidence: string }; message?: string }>('/ai/intent-parse', { text })
}

/** AI 语义搜索 */
export function aiSemanticSearch(query: string) {
  return post<{ code: number; data: Bookmark[] }>('/ai/semantic-search', { query })
}

export interface DownloadResult {
  path: string
  type: 'file' | 'repo'
  owner?: string
  repo?: string
  branch?: string
}

/** 从 GitHub 下载代码 */
export function downloadFromGithub(url: string, targetPath?: string) {
  return post<{ code: number; data: DownloadResult; message: string }>('/download', { url, path: targetPath })
}

// ===== RAG 知识库 API =====

/** 上传文档到知识库 */
export function uploadKnowledgeDoc(title: string, content: string, source?: string) {
  return post<{ code: number; data: KnowledgeDoc; message: string }>('/knowledge/upload', { title, content, source })
}

/** 列出知识库文档 */
export function getKnowledgeDocs() {
  return get<{ code: number; data: KnowledgeDoc[] }>('/knowledge/documents')
}

/** 删除知识库文档 */
export function deleteKnowledgeDoc(id: string) {
  return del<{ code: number; message: string }>(`/knowledge/documents/${id}`)
}

/** 查询知识库（RAG） */
export function queryKnowledge(question: string) {
  return post<{ code: number; data: KnowledgeQueryResult; message: string }>('/knowledge/query', { question })
}

// ===== 工作日志 API =====

/** 添加工作日志 */
export function addWorkLog(data: {
  date: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  category?: string
  tags?: string[]
}) {
  return post<{ code: number; data: WorkLog; message: string }>('/work-logs', data)
}

/** 获取工作日志列表 */
export function getWorkLogs(params?: {
  date?: string
  search?: string
  category?: string
  page?: number
  pageSize?: number
}) {
  return get<{ code: number; data: WorkLog[]; total: number; page: number; pageSize: number }>('/work-logs', { params })
}

/** 获取所有日志日期 */
export function getWorkLogDates() {
  return get<{ code: number; data: string[] }>('/work-logs/dates')
}

/** 更新工作日志 */
export function updateWorkLog(id: string, data: Partial<WorkLog>) {
  return put<{ code: number; data: WorkLog; message: string }>(`/work-logs/${id}`, data)
}

/** 删除工作日志 */
export function deleteWorkLog(id: string) {
  return del<{ code: number; message: string }>(`/work-logs/${id}`)
}

/** 工作饱和度统计 */
export function getWorkLogStats(params?: {
  startDate?: string
  endDate?: string
  mode?: 'day' | 'week' | 'month'
}) {
  return get<{ code: number; data: WorkLogStats }>('/work-logs/stats', { params })
}

// ===== Multi-Agent 协作 API =====

export function getAgents() {
  return get<{ code: number; data: Agent[] }>('/agents')
}

export function agentChat(agentId: string, message: string) {
  return post<{ code: number; data: AgentChatResult }>('/agents/chat', { agentId, message })
}

export function agentCollaborate(task: string, agents?: string[]) {
  return post<{ code: number; data: CollaborateResult }>('/agents/collaborate', { task, agents })
}

// ===== 长期记忆 API =====

export function getMemoryFacts(params?: { category?: string; search?: string }) {
  return get<{ code: number; data: MemoryFact[] }>('/memory/facts', { params })
}

export function addMemoryFact(data: { content: string; category?: string; source?: string; tags?: string[] }) {
  return post<{ code: number; data: MemoryFact; message: string }>('/memory/facts', data)
}

export function deleteMemoryFact(id: string) {
  return del<{ code: number; message: string }>(`/memory/facts/${id}`)
}

export function getMemoryPreferences() {
  return get<{ code: number; data: Record<string, any> }>('/memory/preferences')
}

export function updateMemoryPreferences(data: Record<string, any>) {
  return put<{ code: number; message: string }>('/memory/preferences', data)
}

export function getMemoryInsights() {
  return get<{ code: number; data: MemoryInsights }>('/memory/insights')
}

// ===== 主动式 AI 助理 API =====

export function getAssistantTriggers() {
  return get<{ code: number; data: AssistantTrigger[] }>('/assistant/triggers')
}

export function addAssistantTrigger(data: {
  type: string
  name: string
  condition?: string
  action?: string
  schedule?: string
  enabled?: boolean
}) {
  return post<{ code: number; data: AssistantTrigger; message: string }>('/assistant/triggers', data)
}

export function updateAssistantTrigger(id: string, data: Partial<AssistantTrigger>) {
  return put<{ code: number; message: string }>(`/assistant/triggers/${id}`, data)
}

export function deleteAssistantTrigger(id: string) {
  return del<{ code: number; message: string }>(`/assistant/triggers/${id}`)
}

export function getAssistantSuggestions() {
  return get<{ code: number; data: AssistantSuggestion[] }>('/assistant/suggest')
}

export function autoSummary() {
  return post<{ code: number; data: { summary: string; details: string[]; total: number; categories: Record<string, string[]> } }>('/assistant/summary', {})
}

// ===== LLM 统一调用 =====
export function llmChat(message: string, systemPrompt?: string) {
  return post<{ code: number; data: string | null; source: string; message?: string }>('/llm/chat', { message, systemPrompt })
}

export function getLlmStatus() {
  return get<{ code: number; data: { available: boolean; model: string; baseUrl: string | null } }>('/llm/status')
}

// ===== 记忆自动提取 & 用户画像 =====
export function autoExtractMemory(conversation: { role: string; content: string }[]) {
  return post<{ code: number; message: string }>('/memory/auto-extract', { conversation })
}

export function getMemoryProfile() {
  return get<{ code: number; data: UserProfile }>('/memory/profile')
}

export interface UserProfile {
  totalMemories: number
  autoLearned: number
  manualAdded: number
  techStack: string[]
  categoryDistribution: Record<string, number>
  topTags: string[]
  preferences: Record<string, any>
  memberSince: string | null
  lastActive: string | null
}

// ===== 工作流自动化 =====
export interface WorkflowStep {
  type: 'llm' | 'api' | 'delay' | 'notify' | 'worklog_summary' | 'save_knowledge' | 'input' | 'condition'
  config?: Record<string, any>
  label?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: { type: string; cron?: string; condition?: string }
  steps: WorkflowStep[]
  createdAt: string
}

export interface WorkflowRunRecord {
  id: string
  workflowId: string
  workflowName: string
  success: boolean
  steps: { step: number; label: string; status: string; output?: string; error?: string; duration: number }[]
  totalDuration: number
  executedAt: string
}

export function getWorkflows() {
  return get<{ code: number; data: Workflow[] }>('/workflows')
}

export function createWorkflow(data: Partial<Workflow>) {
  return post<{ code: number; data: Workflow; message: string }>('/workflows', data)
}

export function updateWorkflow(id: string, data: Partial<Workflow>) {
  return put<{ code: number; data: Workflow; message: string }>(`/workflows/${id}`, data)
}

export function deleteWorkflow(id: string) {
  return del<{ code: number; message: string }>(`/workflows/${id}`)
}

export function runWorkflow(id: string, input?: string) {
  return post<{ code: number; data: WorkflowRunRecord; message: string }>(`/workflows/${id}/run`, { input })
}

export function getWorkflowHistory(limit = 20) {
  return get<{ code: number; data: WorkflowRunRecord[] }>(`/workflows/history?limit=${limit}`)
}

// ===== 钉钉集成 =====
export function getDingtalkConfig() {
  return get<{ code: number; data: { webhookUrl: string; secret: string; enabled: boolean; configured: boolean } }>('/integrations/dingtalk')
}

export function saveDingtalkConfig(data: { webhookUrl?: string; secret?: string; enabled?: boolean }) {
  return post<{ code: number; message: string }>('/integrations/dingtalk', data)
}

export function sendDingtalkMessage(data: { message?: string; title?: string; templateId?: string; data?: Record<string, string> }) {
  return post<{ code: number; message: string }>('/integrations/dingtalk/send', data)
}

export function getDingtalkTemplates() {
  return get<{ code: number; data: { id: string; name: string; type: string; content: string }[] }>('/integrations/dingtalk/templates')
}

export function saveDingtalkTemplate(data: { id?: string; name: string; type?: string; content: string }) {
  return post<{ code: number; message: string }>('/integrations/dingtalk/templates', data)
}

// ===== Git 集成 =====
export function getGitConfig() {
  return get<{ code: number; data: { repoPath: string; autoLog: boolean } }>('/integrations/git')
}

export function saveGitConfig(data: { repoPath?: string; autoLog?: boolean }) {
  return post<{ code: number; message: string }>('/integrations/git', data)
}

export function gitExec(action: string, message?: string) {
  return post<{ code: number; data?: { output: string; action?: string }; message?: string }>('/integrations/git/exec', { action, message })
}

export function gitDiffSummary() {
  return post<{ code: number; data?: { summary: string; raw?: string } }>('/integrations/git/diff-summary', {})
}

// ===== 通知中心 =====
export interface NotificationItem {
  id: string
  type: string
  message: string
  read: boolean
  createdAt: string
}

export function getNotifications(unreadOnly = false, limit = 50) {
  return get<{ code: number; data: NotificationItem[]; unread: number }>(`/notifications?unreadOnly=${unreadOnly}&limit=${limit}`)
}

export function markNotificationRead(id?: string, all?: boolean) {
  return post<{ code: number; message: string }>('/notifications/read', { id, all })
}

export function deleteNotification(id: string) {
  return del<{ code: number; message: string }>(`/notifications/${id}`)
}

export function clearNotifications() {
  return del<{ code: number; message: string }>('/notifications')
}

// ===== 文件系统 =====
export function getFsConfig() {
  return get<{ code: number; data: { allowedDirs: string[]; watchDir: string } }>('/integrations/fs')
}

export function saveFsConfig(data: { allowedDirs?: string[]; watchDir?: string }) {
  return post<{ code: number; message: string }>('/integrations/fs', data)
}

export function fsListDir(dir: string) {
  return get<{ code: number; data?: { path: string; items: { name: string; type: string; size: number; modified: string }[] }; message?: string }>(`/integrations/fs/list?dir=${encodeURIComponent(dir)}`)
}

export function fsReadFile(file: string) {
  return get<{ code: number; data: { path: string; content: string; size: number } }>(`/integrations/fs/read?file=${encodeURIComponent(file)}`)
}

export function fsWriteFile(file: string, content: string) {
  return post<{ code: number; message: string }>('/integrations/fs/write', { file, content })
}

export function fsSearch(dir: string, keyword: string) {
  return get<{ code: number; data: { name: string; path: string; type: string }[] }>(`/integrations/fs/search?dir=${encodeURIComponent(dir)}&keyword=${encodeURIComponent(keyword)}`)
}

// ===== Agent Orchestrator =====
export interface OrchestratorStep {
  round: number
  type: 'thought' | 'action' | 'observation' | 'done' | 'error' | 'parse_error'
  thought?: string
  tool?: string
  params?: Record<string, any>
  observation?: string
  summary?: string
  error?: string
  raw?: string
}

export interface OrchestratorResult {
  success: boolean
  taskId: string
  goal: string
  summary: string
  steps: OrchestratorStep[]
  totalDuration: number
  rounds: number
}

export function getOrchestratorTools() {
  return get<{ code: number; data: { name: string; description: string; parameters: Record<string, string> }[] }>('/orchestrator/tools')
}

export function runOrchestratorSync(goal: string) {
  return post<{ code: number; data: OrchestratorResult }>('/orchestrator/run-sync', { goal })
}

export function cancelOrchestratorTask(taskId: string) {
  return post<{ code: number; message: string }>('/orchestrator/cancel', { taskId })
}

/** SSE 流式执行 Agent 任务 */
export function runOrchestratorStream(goal: string, onEvent: (event: any) => void): AbortController {
  const controller = new AbortController()
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  fetch(`${base}/orchestrator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
    signal: controller.signal
  }).then(async (res) => {
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6))
            onEvent(event)
          } catch {}
        }
      }
    }
  }).catch(() => {})
  return controller
}

// ==================== 插件系统 API ====================
export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  tools: string[]
  permissions: string[]
  triggers: any[]
  config: Record<string, any>
  configSchema: Record<string, any> | null
  loadedAt: number
}

export function getPlugins() {
  return get<{ code: number; data: PluginInfo[] }>('/plugins')
}

export function getPluginDetail(id: string) {
  return get<{ code: number; data: any }>(`/plugins/${id}`)
}

export function enablePlugin(id: string) {
  return post<{ code: number; message: string }>(`/plugins/${id}/enable`)
}

export function disablePlugin(id: string) {
  return post<{ code: number; message: string }>(`/plugins/${id}/disable`)
}

export function reloadPlugin(id: string) {
  return post<{ code: number; message: string }>(`/plugins/${id}/reload`)
}

export function updatePluginConfig(id: string, config: Record<string, any>) {
  return post<{ code: number; message: string }>(`/plugins/${id}/config`, config)
}

export function executePluginTool(id: string, tool: string, params: Record<string, any> = {}) {
  return post<{ code: number; data: any; message?: string }>(`/plugins/${id}/execute`, { tool, params })
}

export function generatePluginTemplate(id: string, name: string, description: string) {
  return post<{ code: number; message: string; data?: any }>('/plugins/generate', { id, name, description })
}

// ==================== MCP API ====================
export interface McpServerInfo {
  id: string
  name: string
  url?: string
  transport: string
  enabled: boolean
  status: string
  tools: any[]
}

export function getMcpServers() {
  return get<{ code: number; data: McpServerInfo[] }>('/mcp/servers')
}

export function addMcpServer(data: { name: string; url: string; transport?: string }) {
  return post<{ code: number; message: string; data?: any }>('/mcp/servers', data)
}

export function removeMcpServer(id: string) {
  return del<{ code: number; message: string }>(`/mcp/servers/${id}`)
}

export function connectMcpServer(id: string) {
  return post<{ code: number; message: string; data?: any }>(`/mcp/servers/${id}/connect`)
}

export function disconnectMcpServer(id: string) {
  return post<{ code: number; message: string }>(`/mcp/servers/${id}/disconnect`)
}

export function getMcpHealth() {
  return get<{ code: number; data: any }>('/mcp/health')
}

// ==================== 多模态 API ====================
export function analyzeImage(image: string, prompt?: string) {
  return post<{ code: number; data: { success: boolean; analysis: string; degraded?: boolean } }>('/multimodal/analyze', { image, prompt })
}

export function extractFromImage(image: string, type: string = 'text') {
  return post<{ code: number; data: { success: boolean; analysis: string } }>('/multimodal/extract', { image, type })
}

export function imageToCode(image: string, language?: string) {
  return post<{ code: number; data: { success: boolean; analysis: string } }>('/multimodal/image-to-code', { image, language })
}

export function ttsRequest(text: string, voice?: string) {
  return post<{ code: number; data: any }>('/multimodal/tts', { text, voice })
}

// ==================== 数据智能 API ====================
export interface DashboardStats {
  today: { totalEvents: number; aiUsage: number; workflows: number; bookmarks: number }
  week: {
    totalEvents: number; aiUsage: number
    categoryBreakdown: Record<string, number>
    topTools: { name: string; count: number }[]
    hourlyActivity: number[]
    weekdayActivity: number[]
    knowledgeGrowth: Record<string, number>
  }
  streak: number
  peakHour: number
}

export function getDashboardStats() {
  return get<{ code: number; data: DashboardStats }>('/analytics/dashboard')
}

export function getKnowledgeGraph() {
  return get<{ code: number; data: { nodes: any[]; links: any[]; stats: any } }>('/analytics/knowledge-graph')
}

export function generateWeeklyReport() {
  return post<{ code: number; data: any }>('/analytics/weekly-report')
}

export function getAnalyticsReports(limit?: number) {
  return get<{ code: number; data: any[] }>('/analytics/reports', { params: { limit } })
}

export function trackEvent(category: string, action: string, meta?: Record<string, any>) {
  return post<{ code: number; message: string }>('/analytics/track', { category, action, meta })
}

// ==================== 桌面自动化 API ====================
export function desktopScreenshot(target?: string) {
  return post<{ code: number; data: { success: boolean; image?: string; timestamp?: string; screenSize?: { width: number; height: number }; error?: string } }>('/desktop/screenshot', { target })
}

export function desktopAnalyzeUI(image: string, instruction?: string) {
  return post<{ code: number; data: { success: boolean; elements: any[]; raw?: string } }>('/desktop/analyze-ui', { image, instruction })
}

export function desktopExecute(actions: any[], confirmed?: boolean) {
  return post<{ code: number; data?: any; message?: string; needConfirm?: boolean }>('/desktop/execute', { actions, confirmed })
}

export function desktopHistory(limit?: number) {
  return get<{ code: number; data: any[] }>('/desktop/history', { params: { limit } })
}

export function desktopStatus() {
  return get<{ code: number; data: { available: boolean; platform: string; historyCount: number; message: string } }>('/desktop/status')
}

// ===== Auth 认证 API =====

export function authRegister(username: string, password: string, role?: string) {
  return post<{ code: number; data?: any; message: string }>('/auth/register', { username, password, role })
}

export function authLogin(username: string, password: string) {
  return post<{ code: number; data?: { token: string; refreshToken: string; user: { id: string; username: string; role: string } }; message: string }>('/auth/login', { username, password })
}

export function authRefresh(refreshToken: string) {
  return post<{ code: number; data?: { token: string }; message: string }>('/auth/refresh', { refreshToken })
}

export function authMe() {
  return get<{ code: number; data: { id: string; username: string; role: string } }>('/auth/me')
}

export function authGetUsers() {
  return get<{ code: number; data: Array<{ id: string; username: string; role: string; createdAt: string; lastLogin: string }> }>('/auth/users')
}

export function authUpdateUserRole(userId: string, role: string) {
  return put<{ code: number; message: string }>(`/auth/users/${userId}/role`, { role })
}

export function authDeleteUser(userId: string) {
  return del<{ code: number; message: string }>(`/auth/users/${userId}`)
}

// ===== Team Workspace API =====

export function teamGetKnowledge() {
  return get<{ code: number; data: Array<{ id: string; title: string; content: string; tags: string[]; authorName: string; createdAt: string; updatedAt: string }> }>('/team/knowledge')
}

export function teamAddKnowledge(title: string, content: string, tags?: string[]) {
  return post<{ code: number; data?: any; message: string }>('/team/knowledge', { title, content, tags })
}

export function teamUpdateKnowledge(id: string, data: { title?: string; content?: string; tags?: string[] }) {
  return put<{ code: number; data?: any; message: string }>(`/team/knowledge/${id}`, data)
}

export function teamDeleteKnowledge(id: string) {
  return del<{ code: number; message: string }>(`/team/knowledge/${id}`)
}

export function teamGetWorkflows() {
  return get<{ code: number; data: Array<{ id: string; name: string; description: string; steps: any[]; authorName: string; tags: string[]; createdAt: string; useCount: number }> }>('/team/workflows')
}

export function teamAddWorkflow(name: string, description: string, steps?: any[], tags?: string[]) {
  return post<{ code: number; data?: any; message: string }>('/team/workflows', { name, description, steps, tags })
}

export function teamDeleteWorkflow(id: string) {
  return del<{ code: number; message: string }>(`/team/workflows/${id}`)
}

export function teamGetTasks() {
  return get<{ code: number; data: Array<{ id: string; title: string; description: string; status: string; assigneeName: string; creatorName: string; priority: string; createdAt: string; updatedAt: string; completedAt: string | null }> }>('/team/tasks')
}

export function teamCreateTask(title: string, opts?: { description?: string; assigneeId?: string; assigneeName?: string; priority?: string }) {
  return post<{ code: number; data?: any; message: string }>('/team/tasks', { title, ...opts })
}

export function teamUpdateTask(id: string, updates: { title?: string; description?: string; status?: string; assigneeId?: string; assigneeName?: string; priority?: string }) {
  return put<{ code: number; data?: any; message: string }>(`/team/tasks/${id}`, updates)
}

export function teamDeleteTask(id: string) {
  return del<{ code: number; message: string }>(`/team/tasks/${id}`)
}

export function teamGetComments(taskId: string) {
  return get<{ code: number; data: Array<{ id: string; taskId: string; content: string; authorName: string; createdAt: string }> }>(`/team/tasks/${taskId}/comments`)
}

export function teamAddComment(taskId: string, content: string) {
  return post<{ code: number; data?: any; message: string }>(`/team/tasks/${taskId}/comments`, { content })
}

export function teamDeleteComment(commentId: string) {
  return del<{ code: number; message: string }>(`/team/comments/${commentId}`)
}

// ===== Agent Memory API =====

export function agentGetExperiences(limit?: number) {
  return get<{ code: number; data: Array<{ id: string; goal: string; outcome: string; lesson: string; duration: number; timestamp: string; success: boolean }> }>('/agent/experiences', { params: { limit } })
}

export function agentAddExperience(data: { goal: string; steps?: any[]; outcome?: string; lesson?: string; duration?: number }) {
  return post<{ code: number; data?: any; message: string }>('/agent/experiences', data)
}

export function agentGetExperienceStats() {
  return get<{ code: number; data: { total: number; success: number; failure: number; successRate: string; lessons: string[]; topGoals: Array<{ goal: string; count: number; successCount: number }> } }>('/agent/experiences/stats')
}

export function agentFindSimilarExperiences(goal: string, threshold?: number, maxResults?: number) {
  return post<{ code: number; data: Array<{ experience: any; similarity: number }> }>('/agent/experiences/similar', { goal, threshold, maxResults })
}

export function agentGetSkills() {
  return get<{ code: number; data: Array<{ id: string; name: string; description: string; toolSequence: any[]; trigger: string; useCount: number; confidence: number; createdAt: string; autoGenerated?: boolean }> }>('/agent/skills')
}

export function agentAddSkill(data: { name: string; description?: string; toolSequence?: any[]; trigger?: string }) {
  return post<{ code: number; data?: any; message: string }>('/agent/skills', data)
}

export function agentUpdateSkill(id: string, data: any) {
  return put<{ code: number; data?: any; message: string }>(`/agent/skills/${id}`, data)
}

export function agentDeleteSkill(id: string) {
  return del<{ code: number; message: string }>(`/agent/skills/${id}`)
}

export function agentGetSuggestions(limit?: number) {
  return get<{ code: number; data: Array<{ id: string; type: string; title: string; description: string; confidence: number; relatedGoal: string; timestamp: string; read: boolean; applied: boolean }> }>('/agent/suggestions', { params: { limit } })
}

export function agentAddSuggestion(data: { type?: string; title: string; description?: string; confidence?: number; relatedGoal?: string }) {
  return post<{ code: number; data?: any; message: string }>('/agent/suggestions', data)
}

export function agentMarkSuggestionRead(id: string) {
  return put<{ code: number; message: string }>(`/agent/suggestions/${id}/read`)
}

export function agentMarkSuggestionApplied(id: string) {
  return put<{ code: number; message: string }>(`/agent/suggestions/${id}/apply`)
}

export function agentDeleteSuggestion(id: string) {
  return del<{ code: number; message: string }>(`/agent/suggestions/${id}`)
}

export function agentDetectAnomalies() {
  return get<{ code: number; data: Array<{ type: string; title: string; description: string; confidence: number }> }>('/agent/anomalies')
}

// ===== W13: AI 编码工作区 =====

export function codingScanProject(rootPath: string) {
  return post<{ code: number; data: { files: any[]; deps: any; techStack: string[]; rootPath: string } }>('/coding/scan', { rootPath })
}

export function codingListFiles(rootPath: string, relativePath?: string) {
  return post<{ code: number; data: { entries: any[]; rootPath: string; currentPath: string } }>('/coding/files', { rootPath, relativePath })
}

export function codingReadFile(filePath: string, startLine?: number, endLine?: number) {
  return post<{ code: number; data: { content: string; totalLines: number; language: string } }>('/coding/read', { filePath, startLine, endLine })
}

export function codingGetContext(rootPath: string, filePath?: string) {
  return post<{ code: number; data: { relatedFiles: any[]; references: string[]; relativePath: string } }>('/coding/context', { rootPath, filePath })
}

export function codingGenerateCode(instruction: string, files?: Array<{ path: string; content: string }>, projectContext?: string) {
  return post<{ code: number; data: { edits: Array<{ filePath: string; type: string; original: string; generated: string; explanation: string }>; raw?: string; error?: string } }>('/coding/generate', { instruction, files, projectContext })
}

export function codingExplainCode(code: string, language?: string, instruction?: string) {
  return post<{ code: number; data: { explanation: string } }>('/coding/explain', { code, language, instruction })
}

export function codingRefactorCode(code: string, language?: string, instruction?: string) {
  return post<{ code: number; data: { refactored: string; explanation: string; suggestions: string[] } }>('/coding/refactor', { code, language, instruction })
}

export function codingGitStatus(rootPath: string) {
  return post<{ code: number; data: { branch: string; changes: Array<{ type: string; file: string }>; hasChanges: boolean; clean: boolean } }>('/coding/git/status', { rootPath })
}

export function codingGitDiff(rootPath: string, filePath?: string) {
  return post<{ code: number; data: { diff: string; stagedDiff: string } }>('/coding/git/diff', { rootPath, filePath })
}

export function codingGitCommit(rootPath: string, message?: string) {
  return post<{ code: number; data: { success?: boolean; hash?: string; error?: string; commitInfo?: any } }>('/coding/git/commit', { rootPath, message })
}

export function codingGitLog(rootPath: string, maxCount?: number) {
  return post<{ code: number; data: Array<{ hash: string; subject: string; date: string; author: string }> }>('/coding/git/log', { rootPath, maxCount })
}

export function codingGitReview(rootPath: string) {
  return post<{ code: number; data: { summary: string; issues: Array<{ severity: string; file: string; line: number; message: string; suggestion: string }>; strengths: string[]; recommendation: string } }>('/coding/git/review', { rootPath })
}

// ===== W14: AI 网关 =====

export function aiChat(messages: Array<{ role: string; content: string }>, model?: string, options?: any) {
  return post<{ code: number; data: { content: string; model: string; tokens: number; error?: string } }>('/ai/chat', { messages, model, options })
}

export function aiGenerate(prompt: string, options?: { taskType?: string; preferredModel?: string; noCache?: boolean; temperature?: number; maxTokens?: number }) {
  return post<{ code: number; data: { content: string; model: string; cached?: boolean; error?: string } }>('/ai/generate', { prompt, ...options })
}

export function aiGetModels() {
  return get<{ code: number; data: Array<{ id: string; name: string; provider: string; models: string[]; enabled: boolean; status: string; costPer1KTokens: number; taskTypes: string[] }> }>('/ai/models')
}

export function aiUpdateModel(id: string, config: any) {
  return put<{ code: number; data: any }>(`/ai/models/${id}`, config)
}

export function aiCheckStatus() {
  return get<{ code: number; data: Record<string, string> }>('/ai/status')
}

export function aiGetUsage(period?: string) {
  return get<{ code: number; data: { period: string; totalCalls: number; successRate: string; byModel: Record<string, { calls: number; successes: number; failures: number; totalTokens: number; totalLatency: number }>; records: any[] } }>('/ai/usage', { params: { period } })
}

export function aiGetCosts() {
  return get<{ code: number; data: { today: any; week: any; month: any; total: any; models: Record<string, number> } }>('/ai/costs')
}

export function aiClearCache() {
  return post<{ code: number; data: any }>('/ai/cache/clear')
}

export function aiGetTemplates() {
  return get<{ code: number; data: string[] }>('/ai/templates')
}

// ===== W15: Agent Mesh =====

export function meshCreateAgent(role: string, goal?: string, tools?: string[]) {
  return post<{ code: number; data: { agentId: string; role: string; status: string } }>('/mesh/create', { role, goal, tools })
}

export function meshRunAgent(agentId: string, task: string) {
  return post<{ code: number; data: { reply?: string; error?: string } }>('/mesh/run', { agentId, task })
}

export function meshCollaborate(agents: Array<{ role: string; goal: string }>, task: string, workflow?: string) {
  return post<{ code: number; data: { agents: Array<{ id: string; role: string; status: string }>; results: Array<{ agentId: string; role: string; reply?: string; error?: string }> } }>('/mesh/collaborate', { agents, task, workflow })
}

export function meshListAgents() {
  return get<{ code: number; data: Array<{ id: string; role: string; goal: string; status: string; createdAt: string }> }>('/mesh/agents')
}

export function meshGetAgent(id: string) {
  return get<{ code: number; data: any }>(`/mesh/agents/${id}`)
}

export function meshDestroyAgent(id: string) {
  return del<{ code: number; data: any }>(`/mesh/agents/${id}`)
}

export function meshSendMessage(from: string, to: string, type: string, payload: any) {
  return post<{ code: number; data: any }>('/mesh/message', { from, to, type, payload })
}

export function meshGetMessages(agentId: string, unread?: boolean) {
  return get<{ code: number; data: any[] }>(`/mesh/messages/${agentId}`, { params: { unread: unread ? 'true' : undefined } })
}

export function meshGetApprovals(agentId?: string) {
  return get<{ code: number; data: Array<{ id: string; agentId: string; context: string; status: string; createdAt: string }> }>('/mesh/approvals', { params: { agentId } })
}

export function meshResolveApproval(id: string, decision: string, modifiedValue?: string) {
  return post<{ code: number; data: any }>(`/mesh/approvals/${id}/resolve`, { decision, modifiedValue })
}

export function meshGetApprovalHistory() {
  return get<{ code: number; data: any[] }>('/mesh/approvals/history')
}

export function meshCleanup() {
  return post<{ code: number; data: any }>('/mesh/cleanup')
}

// ===== W16: 插件市场 & 浏览器扩展 =====

export function storeGetPlugins(params?: { category?: string; search?: string; sort?: string }) {
  return get<{ code: number; data: Array<{ id: string; name: string; description: string; category: string; author: string; version: string; downloads: number; rating: number; icon: string; tags: string[] }> }>('/store/plugins', { params })
}

export function storeGetPlugin(id: string) {
  return get<{ code: number; data: any }>(`/store/plugins/${id}`)
}

export function storeInstallPlugin(id: string) {
  return post<{ code: number; data: { success?: boolean; error?: string; name?: string } }>(`/store/plugins/${id}/install`)
}

export function storeRatePlugin(id: string, rating: number, review?: string) {
  return post<{ code: number; data: any }>(`/store/plugins/${id}/rate`, { userId: 'local', rating, review })
}

export function storeGetInstalled() {
  return get<{ code: number; data: Array<{ id: string; name: string; version: string; enabled: boolean; installedAt: string }> }>('/store/installed')
}

export function storeTogglePlugin(id: string, enabled: boolean) {
  return put<{ code: number; data: any }>(`/store/installed/${id}/toggle`, { enabled })
}

export function storeUninstallPlugin(id: string) {
  return del<{ code: number; data: any }>(`/store/installed/${id}`)
}

export function storePublishPlugin(data: { name: string; description: string; category?: string; author?: string; version?: string; icon?: string; tags?: string[] }) {
  return post<{ code: number; data: any }>('/store/publish', data)
}

export function storeRegisterDeveloper(userId: string, name: string, email: string) {
  return post<{ code: number; data: any }>('/store/developer/register', { userId, name, email })
}

export function storeGetCategories() {
  return get<{ code: number; data: Array<{ id: string; name: string }> }>('/store/categories')
}

export function extensionExtract(url: string, content: string) {
  return post<{ code: number; data: { title: string; content: string; url: string } }>('/extension/extract', { url, content })
}

export function extensionAnalyze(action: string, selection?: string, pageContent?: string) {
  return post<{ code: number; data: { content: string; model: string } }>('/extension/analyze', { action, selection, pageContent })
}
