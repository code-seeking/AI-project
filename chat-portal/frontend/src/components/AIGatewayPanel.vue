<template>
  <div class="ai-gateway-panel">
    <!-- 模型状态 -->
    <div class="section">
      <div class="section-header">
        <span>模型状态</span>
        <el-button size="small" @click="refreshStatus" :loading="loading">刷新状态</el-button>
      </div>
      <div class="model-grid">
        <div v-for="m in models" :key="m.id" class="model-card" :class="statuses[m.id] || 'unknown'">
          <div class="model-header">
            <span class="model-name">{{ m.name }}</span>
            <el-tag :type="m.enabled ? 'success' : 'info'" size="mini">{{ m.enabled ? '已启用' : '已禁用' }}</el-tag>
          </div>
          <div class="model-status">
            状态: <el-tag :type="statusTag(statuses[m.id])" size="mini">{{ statusLabel(statuses[m.id]) }}</el-tag>
          </div>
          <div class="model-info">
            <div>提供商: {{ m.provider }}</div>
            <div>模型: {{ m.models?.join(', ') }}</div>
            <div>成本: ${{ m.costPer1KTokens }}/1K tokens</div>
            <div>任务: {{ m.taskTypes?.join(', ') }}</div>
          </div>
          <div class="model-actions">
            <el-switch v-model="m.enabled" @change="toggleModel(m)" size="small" active-text="启用" inactive-text="禁用" />
          </div>
        </div>
      </div>
    </div>

    <!-- 使用统计 -->
    <div class="section">
      <div class="section-header">
        <span>使用统计</span>
        <el-radio-group v-model="usagePeriod" size="small" @change="refreshUsage">
          <el-radio-button value="day">今日</el-radio-button>
          <el-radio-button value="week">本周</el-radio-button>
          <el-radio-button value="month">本月</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="usage" class="usage-stats">
        <div class="stat-item">
          <span class="stat-label">总调用</span>
          <span class="stat-value">{{ usage.totalCalls }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">成功率</span>
          <span class="stat-value" :class="successRateClass(usage.successRate)">{{ usage.successRate }}</span>
        </div>
        <div v-for="(v, k) in usage.byModel" :key="k" class="stat-item">
          <span class="stat-label">{{ k }}</span>
          <span class="stat-value">{{ v.calls }}次 / {{ v.successes }}成功</span>
        </div>
      </div>
    </div>

    <!-- 成本 -->
    <div class="section">
      <div class="section-header">
        <span>成本分析</span>
      </div>
      <div v-if="costs" class="cost-grid">
        <div class="cost-card">
          <div class="cost-label">今日</div>
          <div class="cost-value">${{ costs.today?.total || '0' }}</div>
        </div>
        <div class="cost-card">
          <div class="cost-label">本周</div>
          <div class="cost-value">${{ costs.week?.total || '0' }}</div>
        </div>
        <div class="cost-card">
          <div class="cost-label">本月</div>
          <div class="cost-value">${{ costs.month?.total || '0' }}</div>
        </div>
        <div class="cost-card">
          <div class="cost-label">累计</div>
          <div class="cost-value">${{ costs.total?.total || '0' }}</div>
        </div>
      </div>
    </div>

    <!-- Prompt 模板 -->
    <div class="section">
      <div class="section-header">
        <span>Prompt 模板</span>
      </div>
      <div v-if="templates.length" class="template-list">
        <el-tag v-for="t in templates" :key="t" size="small" class="template-tag">{{ t }}</el-tag>
      </div>
    </div>

    <!-- 最近记录 -->
    <div class="section">
      <div class="section-header">
        <span>最近调用记录</span>
        <el-button size="small" @click="clearCache" :loading="clearing">清除缓存</el-button>
      </div>
      <div v-if="usage?.records?.length" class="records-table">
        <div v-for="(r, i) in usage.records.slice(0, 20)" :key="i" class="record-row">
          <el-tag :type="r.success ? 'success' : 'danger'" size="mini">{{ r.success ? 'OK' : 'FAIL' }}</el-tag>
          <span class="record-model">{{ r.model }}</span>
          <span class="record-type">{{ r.taskType }}</span>
          <span class="record-tokens">{{ r.tokens }} tok</span>
          <span class="record-latency">{{ r.latency }}ms</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { aiGetModels, aiCheckStatus, aiUpdateModel, aiGetUsage, aiGetCosts, aiClearCache, aiGetTemplates } from '@/api'

const loading = ref(false)
const clearing = ref(false)
const models = ref<any[]>([])
const statuses = ref<Record<string, string>>({})
const usagePeriod = ref('day')
const usage = ref<any>(null)
const costs = ref<any>(null)
const templates = ref<string[]>([])

function statusTag(s: string) {
  return s === 'online' ? 'success' : s === 'offline' ? 'danger' : s === 'no_key' ? 'warning' : 'info'
}
function statusLabel(s: string) {
  return s === 'online' ? '在线' : s === 'offline' ? '离线' : s === 'no_key' ? '未配置密钥' : s || '未知'
}
function successRateClass(r: string) {
  const v = parseFloat(r)
  return v >= 90 ? 'success' : v >= 70 ? 'warning' : 'danger'
}

async function refreshStatus() {
  loading.value = true
  try {
    const [mRes, sRes] = await Promise.all([aiGetModels(), aiCheckStatus()])
    if (mRes.code === 200) models.value = mRes.data
    if (sRes.code === 200) statuses.value = sRes.data
  } finally {
    loading.value = false
  }
}

async function toggleModel(m: any) {
  await aiUpdateModel(m.id, { enabled: m.enabled })
}

async function refreshUsage() {
  const [uRes, cRes, tRes] = await Promise.all([
    aiGetUsage(usagePeriod.value),
    aiGetCosts(),
    aiGetTemplates()
  ])
  if (uRes.code === 200) usage.value = uRes.data
  if (cRes.code === 200) costs.value = cRes.data
  if (tRes.code === 200) templates.value = tRes.data
}

async function clearCache() {
  clearing.value = true
  try {
    await aiClearCache()
    ElMessage.success('缓存已清除')
  } finally {
    clearing.value = false
  }
}

onMounted(() => {
  refreshStatus()
  refreshUsage()
})
</script>

<style scoped>
.ai-gateway-panel {
  padding: 16px;
  overflow-y: auto;
  height: 100%;
  background: #f5f7fa;
}
.section {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 15px;
}
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.model-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
}
.model-card.online { border-left: 3px solid #67c23a; }
.model-card.offline { border-left: 3px solid #f56c6c; }
.model-card.no_key { border-left: 3px solid #e6a23c; }
.model-card.unknown { border-left: 3px solid #909399; }
.model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.model-name { font-weight: 600; }
.model-status { font-size: 13px; margin-bottom: 8px; }
.model-info { font-size: 12px; color: #606266; line-height: 1.8; }
.model-actions { margin-top: 8px; }
.usage-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: #f5f7fa;
  border-radius: 6px;
}
.stat-label { font-size: 12px; color: #909399; }
.stat-value { font-size: 18px; font-weight: 600; margin-top: 4px; }
.stat-value.success { color: #67c23a; }
.stat-value.warning { color: #e6a23c; }
.stat-value.danger { color: #f56c6c; }
.cost-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.cost-card {
  text-align: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}
.cost-label { font-size: 12px; color: #909399; }
.cost-value { font-size: 20px; font-weight: 600; color: #409eff; }
.template-list { display: flex; gap: 6px; flex-wrap: wrap; }
.records-table { max-height: 300px; overflow-y: auto; }
.record-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #f2f2f2;
}
.record-model { width: 80px; font-weight: 500; }
.record-type { width: 70px; color: #606266; }
.record-tokens { width: 80px; color: #909399; }
.record-latency { color: #909399; }
</style>
