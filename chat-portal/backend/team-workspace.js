const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, 'data')
const TEAM_KNOWLEDGE_FILE = path.join(DATA_DIR, 'team-knowledge.json')
const TEAM_WORKFLOWS_FILE = path.join(DATA_DIR, 'team-workflows.json')
const TEAM_TASKS_FILE = path.join(DATA_DIR, 'team-tasks.json')
const TEAM_PLUGINS_FILE = path.join(DATA_DIR, 'team-plugins.json')
const TEAM_COMMENTS_FILE = path.join(DATA_DIR, 'team-comments.json')

function ensureDataFile(file, defaultData = []) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultData, null, 2))
}

function readJSON(file) {
  ensureDataFile(file)
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return [] }
}

function writeJSON(file, data) {
  ensureDataFile(file)
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

// ── 团队知识库 ──

function getTeamKnowledge() {
  return readJSON(TEAM_KNOWLEDGE_FILE)
}

function addTeamKnowledge({ title, content, tags = [], authorId, authorName }) {
  if (!title || !content) return { success: false, message: '标题和内容为必填项' }
  const docs = readJSON(TEAM_KNOWLEDGE_FILE)
  const doc = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title,
    content,
    tags: Array.isArray(tags) ? tags : [],
    authorId: authorId || '',
    authorName: authorName || 'Anonymous',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  docs.push(doc)
  writeJSON(TEAM_KNOWLEDGE_FILE, docs)
  return { success: true, doc }
}

function updateTeamKnowledge(id, { title, content, tags }) {
  const docs = readJSON(TEAM_KNOWLEDGE_FILE)
  const doc = docs.find(d => d.id === id)
  if (!doc) return { success: false, message: '文档不存在' }
  if (title !== undefined) doc.title = title
  if (content !== undefined) doc.content = content
  if (tags !== undefined) doc.tags = Array.isArray(tags) ? tags : doc.tags
  doc.updatedAt = new Date().toISOString()
  writeJSON(TEAM_KNOWLEDGE_FILE, docs)
  return { success: true, doc }
}

function deleteTeamKnowledge(id) {
  let docs = readJSON(TEAM_KNOWLEDGE_FILE)
  const idx = docs.findIndex(d => d.id === id)
  if (idx === -1) return { success: false, message: '文档不存在' }
  docs.splice(idx, 1)
  writeJSON(TEAM_KNOWLEDGE_FILE, docs)
  return { success: true }
}

// ── 团队工作流模板 ──

function getTeamWorkflows() {
  return readJSON(TEAM_WORKFLOWS_FILE)
}

function addTeamWorkflow({ name, description, steps = [], authorId, authorName, tags = [] }) {
  if (!name) return { success: false, message: '名称为必填项' }
  const workflows = readJSON(TEAM_WORKFLOWS_FILE)
  const wf = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    description: description || '',
    steps: Array.isArray(steps) ? steps : [],
    authorId: authorId || '',
    authorName: authorName || 'Anonymous',
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    useCount: 0
  }
  workflows.push(wf)
  writeJSON(TEAM_WORKFLOWS_FILE, workflows)
  return { success: true, workflow: wf }
}

function deleteTeamWorkflow(id) {
  let workflows = readJSON(TEAM_WORKFLOWS_FILE)
  const idx = workflows.findIndex(w => w.id === id)
  if (idx === -1) return { success: false, message: '工作流不存在' }
  workflows.splice(idx, 1)
  writeJSON(TEAM_WORKFLOWS_FILE, workflows)
  return { success: true }
}

// ── 任务协作 ──

function getTeamTasks() {
  return readJSON(TEAM_TASKS_FILE)
}

function createTeamTask({ title, description, assigneeId, assigneeName, creatorId, creatorName, priority = 'medium' }) {
  if (!title) return { success: false, message: '标题为必填项' }
  const priorities = ['low', 'medium', 'high', 'urgent']
  if (!priorities.includes(priority)) priority = 'medium'

  const tasks = readJSON(TEAM_TASKS_FILE)
  const task = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title,
    description: description || '',
    status: 'pending', // pending, in_progress, review, done, cancelled
    assigneeId: assigneeId || '',
    assigneeName: assigneeName || '',
    creatorId: creatorId || '',
    creatorName: creatorName || '',
    priority,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null
  }
  tasks.push(task)
  writeJSON(TEAM_TASKS_FILE, tasks)
  return { success: true, task }
}

function updateTeamTask(id, updates) {
  const tasks = readJSON(TEAM_TASKS_FILE)
  const task = tasks.find(t => t.id === id)
  if (!task) return { success: false, message: '任务不存在' }

  const allowedFields = ['title', 'description', 'status', 'assigneeId', 'assigneeName', 'priority']
  for (const key of allowedFields) {
    if (updates[key] !== undefined) task[key] = updates[key]
  }
  task.updatedAt = new Date().toISOString()
  if (updates.status === 'done' && !task.completedAt) {
    task.completedAt = new Date().toISOString()
  }
  writeJSON(TEAM_TASKS_FILE, tasks)
  return { success: true, task }
}

function deleteTeamTask(id) {
  let tasks = readJSON(TEAM_TASKS_FILE)
  const idx = tasks.findIndex(t => t.id === id)
  if (idx === -1) return { success: false, message: '任务不存在' }
  tasks.splice(idx, 1)
  writeJSON(TEAM_TASKS_FILE, tasks)
  return { success: true }
}

// ── 评论/反馈 ──

function getTaskComments(taskId) {
  const comments = readJSON(TEAM_COMMENTS_FILE)
  return comments.filter(c => c.taskId === taskId)
}

function addTaskComment({ taskId, content, authorId, authorName }) {
  if (!taskId || !content) return { success: false, message: '参数不完整' }
  const comments = readJSON(TEAM_COMMENTS_FILE)
  const comment = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    taskId,
    content,
    authorId: authorId || '',
    authorName: authorName || 'Anonymous',
    createdAt: new Date().toISOString()
  }
  comments.push(comment)
  writeJSON(TEAM_COMMENTS_FILE, comments)
  return { success: true, comment }
}

function deleteTaskComment(commentId) {
  let comments = readJSON(TEAM_COMMENTS_FILE)
  const idx = comments.findIndex(c => c.id === commentId)
  if (idx === -1) return { success: false, message: '评论不存在' }
  comments.splice(idx, 1)
  writeJSON(TEAM_COMMENTS_FILE, comments)
  return { success: true }
}

module.exports = {
  getTeamKnowledge, addTeamKnowledge, updateTeamKnowledge, deleteTeamKnowledge,
  getTeamWorkflows, addTeamWorkflow, deleteTeamWorkflow,
  getTeamTasks, createTeamTask, updateTeamTask, deleteTeamTask,
  getTaskComments, addTaskComment, deleteTaskComment
}
