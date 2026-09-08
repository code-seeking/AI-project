/** 书签条目 */
export interface Bookmark {
  id?: number
  keyword: string
  url: string
  description?: string
  tags?: string[]
  group_id?: number | null
  language?: string
  created_at?: string
  updated_at?: string
  createdAt?: string
}

/** 书签分组 */
export interface BookmarkGroup {
  id: number
  name: string
  description?: string
  bookmark_count?: number
  created_at?: string
}

/** 标签统计 */
export interface TagCount {
  tag: string
  count: number
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  type?: 'text' | 'bookmark_saved' | 'bookmark_opened' | 'bookmark_deleted' | 'list' | 'error' | 'help'
}

/** API 响应格式 */
export interface ApiResponse<T = unknown> {
  code: number
  data?: T
  message?: string
}

/** 已安装应用条目 */
export interface AppItem {
  name: string
  path: string
  type: 'app'
}

// ===== RAG 知识库 =====

export interface KnowledgeDoc {
  id: string
  title: string
  source: string
  contentLength: number
  chunkCount: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeChunk {
  id: string
  docId: string
  index: number
  text: string
  score?: number
}

export interface KnowledgeQueryResult {
  answer: string | null
  chunks: KnowledgeChunk[]
  totalChunks: number
}

// ===== 工作日志 =====

export interface WorkLog {
  id: string
  date: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  duration?: number
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface WorkLogStatsItem {
  date: string
  count: number
  totalMinutes: number
  hours: string
  categories: Record<string, number>
  items: WorkLog[]
}

export interface WorkLogStatsSummary {
  totalItems: number
  totalMinutes: number
  totalHours: string
  categoryDistribution: Record<string, number>
  avgDailyMinutes: number
}

export interface WorkLogStats {
  stats: WorkLogStatsItem[]
  summary: WorkLogStatsSummary
}

// ===== Multi-Agent 协作 =====

export interface Agent {
  id: string
  name: string
  description: string
  icon: string
  expertise: string[]
}

export interface AgentChatResult {
  agent: Agent
  reply: string
}

export interface AgentCollaboration {
  agent: Agent | null
  reply: string
}

export interface CollaborateResult {
  task: string
  collaborations: AgentCollaboration[]
}

// ===== 长期记忆 =====

export interface MemoryFact {
  id: string
  content: string
  category: string
  source: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MemoryInsights {
  totalFacts: number
  recentFactsCount: number
  categoryDistribution: Record<string, number>
  topTags: { tag: string; count: number }[]
  preferences: Record<string, any>
  suggestedNewCategories: string[]
}

// ===== 主动式 AI 助理 =====

export interface AssistantTrigger {
  id: string
  type: string
  name: string
  condition: string
  action: string
  schedule: string | null
  enabled: boolean
  lastTriggered: string | null
  createdAt: string
}

export interface AssistantSuggestion {
  id: string
  type: string
  title: string
  description: string
  source: string
  actionType?: string
  actionLabel?: string
  schedule?: string | null
}
