<template>
  <div class="agent-mesh-panel">
    <!-- 工具栏 -->
    <div class="mesh-toolbar">
      <el-button type="primary" size="small" @click="showCreateDialog = true">创建 Agent</el-button>
      <el-button size="small" @click="showCollaborateDialog = true">协作任务</el-button>
      <el-button size="small" @click="refreshAgents" :loading="loading">刷新</el-button>
      <el-button size="small" @click="cleanupAgents" :loading="cleaning">清理已完成</el-button>
      <span class="agent-count">活跃: {{ agents.filter(a => a.status === 'running' || a.status === 'idle').length }} / {{ agents.length }}</span>
    </div>

    <!-- Agent 网格 -->
    <div class="agent-grid">
      <div v-for="agent in agents" :key="agent.id" class="agent-card" :class="agent.status">
        <div class="agent-header">
          <span class="agent-role">{{ agent.role }}</span>
          <el-tag :type="statusTag(agent.status)" size="mini">{{ statusLabel(agent.status) }}</el-tag>
          <el-button text size="small" type="danger" @click="destroy(agent.id)" style="margin-left: auto; padding: 0">✕</el-button>
        </div>
        <div class="agent-goal">{{ agent.goal }}</div>
        <div class="agent-meta">
          创建: {{ formatTime(agent.createdAt) }}
          <span v-if="agent.currentTask">| 任务: {{ agent.currentTask.slice(0, 40) }}{{ agent.currentTask.length > 40 ? '...' : '' }}</span>
        </div>
        <div class="agent-actions">
          <el-button size="small" @click="selectAgent(agent)">查看</el-button>
          <el-button size="small" type="primary" :disabled="agent.status === 'running'" @click="runTask(agent)">运行</el-button>
        </div>
      </div>
      <el-empty v-if="!agents.length" description="暂无 Agent，点击创建 Agent 开始" />
    </div>

    <!-- Agent 详情 -->
    <el-drawer v-model="detailVisible" :title="selectedAgent?.role || 'Agent 详情'" size="400px">
      <template v-if="selectedAgent">
        <div class="detail-section">
          <div class="detail-label">ID</div>
          <div class="detail-value">{{ selectedAgent.id }}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">目标</div>
          <div class="detail-value">{{ selectedAgent.goal }}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">专长</div>
          <div class="detail-value">{{ selectedAgent.expertise?.join(', ') }}</div>
        </div>
        <div class="detail-section">
          <div class="detail-label">状态</div>
          <el-tag :type="statusTag(selectedAgent.status)">{{ statusLabel(selectedAgent.status) }}</el-tag>
        </div>
        <div class="detail-section" v-if="selectedAgent.result?.reply">
          <div class="detail-label">执行结果</div>
          <pre class="result-pre">{{ selectedAgent.result.reply }}</pre>
        </div>
        <div class="detail-section" v-if="selectedAgent.error">
          <div class="detail-label">错误</div>
          <el-alert :title="selectedAgent.error" type="error" show-icon :closable="false" />
        </div>
        <div class="detail-section" v-if="selectedAgent.conversation?.length">
          <div class="detail-label">对话历史 ({{ selectedAgent.conversation.length }} 条)</div>
          <div v-for="(msg, i) in selectedAgent.conversation" :key="i" class="conv-msg" :class="msg.role">
            <div class="conv-role">{{ msg.role === 'user' ? '用户' : 'Agent' }}</div>
            <div class="conv-content">{{ msg.content.slice(0, 200) }}</div>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- 创建 Agent 对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建 Agent" width="450px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="角色">
          <el-select v-model="createForm.role" filterable style="width: 100%">
            <el-option v-for="(t, k) in roleTemplates" :key="k" :label="t.role + ' - ' + t.goal" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标">
          <el-input v-model="createForm.goal" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="工具">
          <el-select v-model="createForm.tools" multiple filterable placeholder="选择工具" style="width: 100%">
            <el-option label="llm_chat" value="llm_chat" />
            <el-option label="worklog_query" value="worklog_query" />
            <el-option label="knowledge_query" value="knowledge_query" />
            <el-option label="fs_read" value="fs_read" />
            <el-option label="fs_write" value="fs_write" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 协作对话框 -->
    <el-dialog v-model="showCollaborateDialog" title="协作任务" width="500px">
      <el-form :model="collabForm" label-width="100px">
        <el-form-item label="任务描述">
          <el-input v-model="collabForm.task" type="textarea" :rows="3" placeholder="例如: 分析项目代码结构并生成测试用例" />
        </el-form-item>
        <el-form-item label="协作模式">
          <el-radio-group v-model="collabForm.workflow">
            <el-radio value="sequential">顺序执行</el-radio>
            <el-radio value="parallel">并行执行</el-radio>
            <el-radio value="swarm">Swarm 模式</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Agent 1">
          <el-select v-model="collabForm.agent1Role" filterable style="width: 100%">
            <el-option v-for="(t, k) in roleTemplates" :key="k" :label="t.role" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="Agent 2">
          <el-select v-model="collabForm.agent2Role" filterable style="width: 100%">
            <el-option v-for="(t, k) in roleTemplates" :key="k" :label="t.role" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="Agent 3 (可选)">
          <el-select v-model="collabForm.agent3Role" filterable clearable style="width: 100%">
            <el-option v-for="(t, k) in roleTemplates" :key="k" :label="t.role" :value="k" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCollaborateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCollaborate" :loading="collaborating">开始协作</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { meshListAgents, meshCreateAgent, meshRunAgent, meshCollaborate, meshDestroyAgent, meshCleanup } from '@/api'

const loading = ref(false)
const cleaning = ref(false)
const agents = ref<any[]>([])
const creating = ref(false)
const collaborating = ref(false)
const showCreateDialog = ref(false)
const showCollaborateDialog = ref(false)
const detailVisible = ref(false)
const selectedAgent = ref<any>(null)

const roleTemplates: Record<string, any> = {
  analyst: { role: 'analyst', goal: '分析问题并提供见解' },
  coder: { role: 'coder', goal: '编写和修改代码' },
  reviewer: { role: 'reviewer', goal: '审查代码和工作成果' },
  planner: { role: 'planner', goal: '制定计划和分解任务' },
  tester: { role: 'tester', goal: '编写测试用例和执行测试' },
  researcher: { role: 'researcher', goal: '研究技术方案和收集信息' }
}

const createForm = ref({
  role: 'coder',
  goal: '',
  tools: [] as string[]
})

const collabForm = ref({
  task: '',
  workflow: 'sequential',
  agent1Role: 'analyst',
  agent2Role: 'coder',
  agent3Role: ''
})

function statusTag(s: string) {
  return s === 'running' ? 'warning' : s === 'done' ? 'success' : s === 'error' ? 'danger' : s === 'cancelled' ? 'info' : ''
}
function statusLabel(s: string) {
  return s === 'idle' ? '空闲' : s === 'running' ? '运行中' : s === 'done' ? '完成' : s === 'error' ? '错误' : s === 'cancelled' ? '已取消' : s || '未知'
}
function formatTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function refreshAgents() {
  loading.value = true
  try {
    const res = await meshListAgents()
    if (res.code === 200) agents.value = res.data
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  creating.value = true
  try {
    const role = createForm.value.role
    const template = roleTemplates[role]
    const res = await meshCreateAgent(role, createForm.value.goal || template.goal, createForm.value.tools)
    if (res.code === 200) {
      ElMessage.success(`Agent ${res.data.role} 已创建`)
      showCreateDialog.value = false
      refreshAgents()
    }
  } finally {
    creating.value = false
  }
}

function selectAgent(agent: any) {
  selectedAgent.value = agent
  detailVisible.value = true
}

async function runTask(agent: any) {
  const taskRes = await ElMessageBox.prompt('为 ' + agent.role + ' 分配任务:', '输入任务', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPlaceholder: '例如: 分析项目依赖是否正确'
  })
  const task = taskRes.value
  if (!task) return
  const res = await meshRunAgent(agent.id, task)
  if (res.code === 200) {
    if (res.data.error) ElMessage.error(res.data.error)
    else ElMessage.success('任务完成')
    refreshAgents()
  }
}

async function handleCollaborate() {
  collaborating.value = true
  try {
    const agents = [
      { role: collabForm.value.agent1Role, goal: roleTemplates[collabForm.value.agent1Role]?.goal || '' },
      { role: collabForm.value.agent2Role, goal: roleTemplates[collabForm.value.agent2Role]?.goal || '' }
    ]
    if (collabForm.value.agent3Role) {
      agents.push({ role: collabForm.value.agent3Role, goal: roleTemplates[collabForm.value.agent3Role]?.goal || '' })
    }
    const res = await meshCollaborate(agents, collabForm.value.task, collabForm.value.workflow)
    if (res.code === 200) {
      ElMessage.success('协作完成')
      showCollaborateDialog.value = false
      refreshAgents()
    }
  } finally {
    collaborating.value = false
  }
}

async function destroy(id: string) {
  await ElMessageBox.confirm('确定要销毁这个 Agent？', '确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
  await meshDestroyAgent(id)
  refreshAgents()
}

async function cleanupAgents() {
  cleaning.value = true
  try {
    const res = await meshCleanup()
    if (res.code === 200) {
      ElMessage.success(`已清理 ${res.data.removed} 个 Agent`)
      refreshAgents()
    }
  } finally {
    cleaning.value = false
  }
}

onMounted(refreshAgents)
</script>

<style scoped>
.agent-mesh-panel {
  padding: 16px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}
.mesh-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.agent-count {
  margin-left: auto;
  font-size: 13px;
  color: #909399;
}
.agent-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.agent-card {
  background: #fff;
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  border-left: 3px solid #e4e7ed;
}
.agent-card.running { border-left-color: #e6a23c; }
.agent-card.done { border-left-color: #67c23a; }
.agent-card.error { border-left-color: #f56c6c; }
.agent-card.cancelled { border-left-color: #909399; }
.agent-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.agent-role { font-weight: 600; font-size: 15px; text-transform: capitalize; }
.agent-goal { font-size: 13px; color: #606266; margin-bottom: 8px; line-height: 1.4; }
.agent-meta { font-size: 12px; color: #909399; margin-bottom: 8px; }
.agent-actions { display: flex; gap: 8px; }
.detail-section { margin-bottom: 16px; }
.detail-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.detail-value { font-size: 14px; }
.result-pre {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}
.conv-msg { margin-bottom: 8px; }
.conv-role { font-size: 12px; color: #909399; margin-bottom: 2px; }
.conv-content { font-size: 13px; padding: 6px 8px; background: #f5f7fa; border-radius: 4px; }
.conv-msg.assistant .conv-content { background: #ecf5ff; }
</style>
