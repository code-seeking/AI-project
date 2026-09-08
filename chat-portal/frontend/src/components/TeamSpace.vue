<template>
  <div class="team-space">
    <!-- 团队知识库 -->
    <div class="adv-section">
      <div class="section-bar">
        <h4 class="adv-section-title">📚 团队知识库</h4>
        <el-button size="small" type="primary" @click="showAddKnowledge = true" :disabled="!isLoggedIn">添加</el-button>
      </div>
      <div v-if="knowledgeDocs.length === 0" class="adv-empty">暂无团队知识文档</div>
      <div v-for="doc in knowledgeDocs" :key="doc.id" class="team-card">
        <div class="team-card-header">
          <span class="team-card-title">{{ doc.title }}</span>
          <span class="team-card-author">{{ doc.authorName }}</span>
        </div>
        <div class="team-card-body">{{ doc.content.slice(0, 120) }}{{ doc.content.length > 120 ? '...' : '' }}</div>
        <div class="team-card-footer">
          <span class="team-card-date">{{ doc.createdAt?.slice(0, 10) }}</span>
          <div class="team-card-actions">
            <el-button v-if="isLoggedIn" size="small" text type="primary" @click="editKnowledge(doc)">编辑</el-button>
            <el-button v-if="isAdmin" size="small" text type="danger" @click="handleDeleteKnowledge(doc.id)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 团队任务看板 -->
    <div class="adv-section">
      <div class="section-bar">
        <h4 class="adv-section-title">📋 任务看板</h4>
        <el-button size="small" type="primary" @click="showAddTask = true" :disabled="!isLoggedIn">创建任务</el-button>
      </div>
      <div v-if="tasks.length === 0" class="adv-empty">暂无团队任务</div>
      <div class="task-board">
        <div v-for="task in tasks" :key="task.id" class="task-card" :class="'task-' + task.priority">
          <div class="task-card-top">
            <span class="task-priority-badge" :class="'priority-' + task.priority">{{ task.priority }}</span>
            <span class="task-status-badge" :class="'status-' + task.status">{{ statusLabel(task.status) }}</span>
          </div>
          <div class="task-card-title">{{ task.title }}</div>
          <div v-if="task.description" class="task-card-desc">{{ task.description.slice(0, 60) }}{{ task.description.length > 60 ? '...' : '' }}</div>
          <div class="task-card-footer">
            <span>👤 {{ task.assigneeName || '未分配' }}</span>
            <span>📅 {{ task.createdAt?.slice(0, 10) }}</span>
          </div>
          <div class="task-card-actions" v-if="isLoggedIn">
            <el-select v-model="task.status" size="small" @change="handleUpdateTaskStatus(task)" style="width:110px">
              <el-option label="待办" value="pending" />
              <el-option label="进行中" value="in_progress" />
              <el-option label="审核" value="review" />
              <el-option label="已完成" value="done" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-button v-if="isAdmin" size="small" text type="danger" @click="handleDeleteTask(task.id)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加知识对话框 -->
    <el-dialog v-model="showAddKnowledge" title="添加知识" width="500px" append-to-body>
      <el-input v-model="knowledgeForm.title" placeholder="标题" size="small" style="margin-bottom:10px" />
      <el-input v-model="knowledgeForm.content" type="textarea" :rows="6" placeholder="内容..." size="small" />
      <template #footer>
        <el-button @click="showAddKnowledge = false">取消</el-button>
        <el-button type="primary" @click="handleAddKnowledge" :loading="knowledgeSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建任务对话框 -->
    <el-dialog v-model="showAddTask" title="创建任务" width="500px" append-to-body>
      <el-input v-model="taskForm.title" placeholder="任务标题" size="small" style="margin-bottom:10px" />
      <el-input v-model="taskForm.description" type="textarea" :rows="3" placeholder="描述（可选）" size="small" style="margin-bottom:10px" />
      <el-select v-model="taskForm.priority" placeholder="优先级" size="small" style="width:100%;margin-bottom:10px">
        <el-option label="低" value="low" />
        <el-option label="中" value="medium" />
        <el-option label="高" value="high" />
        <el-option label="紧急" value="urgent" />
      </el-select>
      <el-input v-model="taskForm.assigneeName" placeholder="负责人（可选）" size="small" />
      <template #footer>
        <el-button @click="showAddTask = false">取消</el-button>
        <el-button type="primary" @click="handleCreateTask" :loading="taskSaving">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { teamGetKnowledge, teamAddKnowledge, teamDeleteKnowledge, teamGetTasks, teamCreateTask, teamUpdateTask, teamDeleteTask } from '@/api'

const props = defineProps<{ isLoggedIn: boolean; isAdmin: boolean }>()

const knowledgeDocs = ref<any[]>([])
const tasks = ref<any[]>([])
const showAddKnowledge = ref(false)
const showAddTask = ref(false)
const knowledgeSaving = ref(false)
const taskSaving = ref(false)
const knowledgeForm = ref({ title: '', content: '' })
const taskForm = ref({ title: '', description: '', priority: 'medium', assigneeName: '' })

onMounted(() => { loadData() })

async function loadData() {
  try {
    const [kRes, tRes] = await Promise.all([teamGetKnowledge(), teamGetTasks()])
    if (kRes.code === 200) knowledgeDocs.value = kRes.data || []
    if (tRes.code === 200) tasks.value = tRes.data || []
  } catch {}
}

function statusLabel(s: string) {
  const map: any = { pending: '待办', in_progress: '进行中', review: '审核', done: '已完成', cancelled: '已取消' }
  return map[s] || s
}

async function handleAddKnowledge() {
  if (!knowledgeForm.value.title || !knowledgeForm.value.content) {
    ElMessage.warning('标题和内容为必填项'); return
  }
  knowledgeSaving.value = true
  try {
    const res = await teamAddKnowledge(knowledgeForm.value.title, knowledgeForm.value.content)
    if (res.code === 200) {
      ElMessage.success('添加成功')
      showAddKnowledge.value = false
      knowledgeForm.value = { title: '', content: '' }
      loadData()
    } else { ElMessage.error(res.message) }
  } catch { ElMessage.error('添加失败') }
  finally { knowledgeSaving.value = false }
}

function editKnowledge(doc: any) {
  knowledgeForm.value = { title: doc.title, content: doc.content }
  showAddKnowledge.value = true
}

async function handleDeleteKnowledge(id: string) {
  try {
    const res = await teamDeleteKnowledge(id)
    if (res.code === 200) { ElMessage.success('已删除'); loadData() }
    else { ElMessage.error(res.message) }
  } catch { ElMessage.error('删除失败') }
}

async function handleCreateTask() {
  if (!taskForm.value.title) { ElMessage.warning('请输入任务标题'); return }
  taskSaving.value = true
  try {
    const res = await teamCreateTask(taskForm.value.title, {
      description: taskForm.value.description,
      priority: taskForm.value.priority,
      assigneeName: taskForm.value.assigneeName
    })
    if (res.code === 200) {
      ElMessage.success('创建成功')
      showAddTask.value = false
      taskForm.value = { title: '', description: '', priority: 'medium', assigneeName: '' }
      loadData()
    } else { ElMessage.error(res.message) }
  } catch { ElMessage.error('创建失败') }
  finally { taskSaving.value = false }
}

async function handleUpdateTaskStatus(task: any) {
  try {
    await teamUpdateTask(task.id, { status: task.status })
    ElMessage.success('状态已更新')
  } catch { ElMessage.error('更新失败') }
}

async function handleDeleteTask(id: string) {
  try {
    const res = await teamDeleteTask(id)
    if (res.code === 200) { ElMessage.success('已删除'); loadData() }
    else { ElMessage.error(res.message) }
  } catch { ElMessage.error('删除失败') }
}
</script>

<style scoped>
.team-space { display: flex; flex-direction: column; gap: 16px; }
.team-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
.team-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.team-card-title { font-size: 14px; font-weight: 500; color: #e2e8f0; }
.team-card-author { font-size: 11px; color: #64748b; }
.team-card-body { font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 8px; }
.team-card-footer { display: flex; justify-content: space-between; align-items: center; }
.team-card-date { font-size: 11px; color: #475569; }
.team-card-actions { display: flex; gap: 4px; }

.task-board { display: flex; flex-direction: column; gap: 8px; }
.task-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px; }
.task-card.task-urgent { border-left: 3px solid #ef4444; }
.task-card.task-high { border-left: 3px solid #f59e0b; }
.task-card.task-medium { border-left: 3px solid #4fc3f7; }
.task-card.task-low { border-left: 3px solid #64748b; }
.task-card-top { display: flex; gap: 6px; margin-bottom: 6px; }
.task-priority-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; }
.priority-urgent { background: rgba(239,68,68,0.15); color: #ef4444; }
.priority-high { background: rgba(245,158,11,0.15); color: #f59e0b; }
.priority-medium { background: rgba(79,195,247,0.15); color: #4fc3f7; }
.priority-low { background: rgba(100,116,139,0.15); color: #94a3b8; }
.task-status-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; }
.status-pending { background: rgba(100,116,139,0.15); color: #94a3b8; }
.status-in_progress { background: rgba(79,195,247,0.15); color: #4fc3f7; }
.status-review { background: rgba(245,158,11,0.15); color: #f59e0b; }
.status-done { background: rgba(34,197,94,0.15); color: #22c55e; }
.status-cancelled { background: rgba(239,68,68,0.15); color: #ef4444; }
.task-card-title { font-size: 13px; color: #e2e8f0; font-weight: 500; margin-bottom: 4px; }
.task-card-desc { font-size: 12px; color: #64748b; margin-bottom: 6px; }
.task-card-footer { display: flex; gap: 12px; font-size: 11px; color: #475569; margin-bottom: 6px; }
.task-card-actions { display: flex; gap: 6px; align-items: center; }
</style>
