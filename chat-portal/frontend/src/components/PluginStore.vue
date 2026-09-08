<template>
  <div class="plugin-store">
    <el-tabs v-model="storeTab">
      <el-tab-pane label="浏览市场" name="browse">
        <!-- 搜索和分类 -->
        <div class="store-toolbar">
          <el-input v-model="searchQuery" placeholder="搜索插件..." clearable size="small" class="search-input" @input="searchPlugins" />
          <el-select v-model="categoryFilter" clearable placeholder="分类" size="small" @change="searchPlugins">
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-select v-model="sortBy" size="small" @change="searchPlugins">
            <el-option label="下载最多" value="downloads" />
            <el-option label="评分最高" value="rating" />
            <el-option label="最新发布" value="newest" />
          </el-select>
        </div>

        <!-- 插件列表 -->
        <div v-if="!searching" class="plugin-grid">
          <div v-for="p in plugins" :key="p.id" class="plugin-card" @click="showDetail(p)">
            <div class="plugin-icon">{{ p.icon || '📦' }}</div>
            <div class="plugin-info">
              <div class="plugin-name">{{ p.name }}</div>
              <div class="plugin-desc">{{ p.description }}</div>
              <div class="plugin-meta">
                <span>v{{ p.version }}</span>
                <span>{{ p.author }}</span>
                <span>⭐ {{ p.rating?.toFixed(1) }}</span>
                <span>📥 {{ p.downloads }}</span>
              </div>
              <div class="plugin-tags" v-if="p.tags?.length">
                <el-tag v-for="t in p.tags" :key="t" size="small">{{ t }}</el-tag>
              </div>
            </div>
            <el-button
              :type="isInstalled(p.id) ? 'default' : 'primary'"
              size="small"
              :disabled="isInstalled(p.id)"
              @click.stop="installPlugin(p)"
              class="install-btn"
            >
              {{ isInstalled(p.id) ? '已安装' : '安装' }}
            </el-button>
          </div>
          <el-empty v-if="!plugins.length" description="没有找到匹配的插件" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="已安装" name="installed">
        <div class="installed-list">
          <div v-for="p in installed" :key="p.id" class="installed-item">
            <div class="installed-info">
              <span class="installed-name">{{ p.name }}</span>
              <span class="installed-version">v{{ p.version }}</span>
              <span class="installed-date">安装于 {{ formatTime(p.installedAt) }}</span>
            </div>
            <div class="installed-actions">
              <el-switch v-model="p.enabled" size="small" @change="toggleInstalled(p)" active-text="启用" inactive-text="禁用" />
              <el-button size="small" type="danger" plain @click="uninstallPlugin(p)">卸载</el-button>
            </div>
          </div>
          <el-empty v-if="!installed.length" description="还没有安装任何插件" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="发布插件" name="publish">
        <div class="publish-form">
          <el-form :model="publishForm" label-width="100px">
            <el-form-item label="插件名称" required>
              <el-input v-model="publishForm.name" placeholder="例如: My Awesome Plugin" />
            </el-form-item>
            <el-form-item label="描述" required>
              <el-input v-model="publishForm.description" type="textarea" :rows="3" placeholder="简短描述插件功能" />
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="publishForm.category" style="width: 100%">
                <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="作者">
              <el-input v-model="publishForm.author" placeholder="作者名" />
            </el-form-item>
            <el-form-item label="版本">
              <el-input v-model="publishForm.version" placeholder="1.0.0" />
            </el-form-item>
            <el-form-item label="图标">
              <el-input v-model="publishForm.icon" placeholder="Emoji 图标 (如 🚀)" />
            </el-form-item>
            <el-form-item label="标签">
              <el-select v-model="publishForm.tags" multiple filterable allow-create default-first-option style="width: 100%">
                <el-option v-for="t in ['ai','editor','productivity','developer-tools','analytics','integration']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handlePublish" :loading="publishing">发布插件</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 插件详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detailPlugin?.name || '插件详情'" size="400px">
      <template v-if="detailPlugin">
        <div class="detail-icon">{{ detailPlugin.icon || '📦' }}</div>
        <div class="detail-desc">{{ detailPlugin.description }}</div>
        <div class="detail-meta">
          <div><span>作者:</span> {{ detailPlugin.author }}</div>
          <div><span>版本:</span> v{{ detailPlugin.version }}</div>
          <div><span>分类:</span> {{ detailPlugin.category }}</div>
          <div><span>下载:</span> {{ detailPlugin.downloads }}</div>
          <div><span>评分:</span> ⭐ {{ detailPlugin.rating?.toFixed(1) || '暂无' }}</div>
        </div>
        <div class="detail-tags" v-if="detailPlugin.tags?.length">
          <el-tag v-for="t in detailPlugin.tags" :key="t" size="small">{{ t }}</el-tag>
        </div>
        <el-button
          type="primary"
          style="width: 100%; margin-top: 16px"
          :disabled="isInstalled(detailPlugin.id)"
          @click="installPlugin(detailPlugin)"
        >
          {{ isInstalled(detailPlugin.id) ? '已安装' : '安装插件' }}
        </el-button>

        <!-- 评分 -->
        <div class="rate-section" v-if="!isInstalled(detailPlugin.id)">
          <div class="rate-label">评分</div>
          <el-rate v-model="rateValue" :max="5" @change="handleRate" />
        </div>

        <!-- 评论 -->
        <div class="reviews-section" v-if="detailPlugin.reviews?.length">
          <div class="section-title">用户评价</div>
          <div v-for="(r, i) in detailPlugin.reviews" :key="i" class="review-item">
            <el-rate v-model="r.rating" disabled size="small" />
            <div class="review-text">{{ r.review }}</div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  storeGetPlugins, storeGetPlugin, storeInstallPlugin, storeRatePlugin,
  storeGetInstalled, storeTogglePlugin, storeUninstallPlugin, storePublishPlugin,
  storeGetCategories
} from '@/api'

const storeTab = ref('browse')
const searchQuery = ref('')
const categoryFilter = ref('')
const sortBy = ref('downloads')
const plugins = ref<any[]>([])
const installed = ref<any[]>([])
const categories = ref<Array<{ id: string; name: string }>>([])
const searching = ref(false)
const detailVisible = ref(false)
const detailPlugin = ref<any>(null)
const rateValue = ref(0)
const publishing = ref(false)

const publishForm = ref({
  name: '',
  description: '',
  category: 'other',
  author: '',
  version: '1.0.0',
  icon: '📦',
  tags: [] as string[]
})

function formatTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function isInstalled(id: string) {
  return installed.value.some(i => i.id === id)
}

async function searchPlugins() {
  searching.value = true
  try {
    const res = await storeGetPlugins({
      category: categoryFilter.value || undefined,
      search: searchQuery.value || undefined,
      sort: sortBy.value
    })
    if (res.code === 200) plugins.value = res.data
  } finally {
    searching.value = false
  }
}

async function refreshInstalled() {
  const res = await storeGetInstalled()
  if (res.code === 200) installed.value = res.data
}

async function showDetail(p: any) {
  const res = await storeGetPlugin(p.id)
  if (res.code === 200) detailPlugin.value = res.data
  detailVisible.value = true
  rateValue.value = 0
}

async function installPlugin(p: any) {
  const res = await storeInstallPlugin(p.id)
  if (res.code === 200) {
    if (res.data.error) {
      ElMessage.warning(res.data.error)
    } else {
      ElMessage.success(`已安装 ${res.data.name || p.name}`)
    }
    refreshInstalled()
    searchPlugins()
  }
}

async function toggleInstalled(p: any) {
  await storeTogglePlugin(p.id, p.enabled)
}

async function uninstallPlugin(p: any) {
  await ElMessageBox.confirm('确定卸载 ' + p.name + '？', '确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
  await storeUninstallPlugin(p.id)
  refreshInstalled()
  searchPlugins()
}

async function handleRate() {
  if (!detailPlugin.value || !rateValue.value) return
  await storeRatePlugin(detailPlugin.value.id, rateValue.value)
  ElMessage.success('评分成功')
}

async function handlePublish() {
  if (!publishForm.value.name || !publishForm.value.description) {
    ElMessage.warning('名称和描述为必填项')
    return
  }
  publishing.value = true
  try {
    const res = await storePublishPlugin(publishForm.value)
    if (res.code === 200) {
      ElMessage.success('插件已发布')
      publishForm.value = { name: '', description: '', category: 'other', author: '', version: '1.0.0', icon: '📦', tags: [] }
      searchPlugins()
    }
  } finally {
    publishing.value = false
  }
}

onMounted(async () => {
  const [catRes] = await Promise.all([storeGetCategories(), searchPlugins(), refreshInstalled()])
  if (catRes.code === 200) categories.value = catRes.data
})
</script>

<style scoped>
.plugin-store {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  background: #f5f7fa;
}
.store-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.search-input { width: 300px; }
.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
}
.plugin-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #fff;
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.plugin-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
.plugin-icon { font-size: 36px; width: 48px; text-align: center; flex-shrink: 0; }
.plugin-info { flex: 1; min-width: 0; }
.plugin-name { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
.plugin-desc { font-size: 13px; color: #606266; margin-bottom: 6px; line-height: 1.4; }
.plugin-meta { display: flex; gap: 12px; font-size: 12px; color: #909399; margin-bottom: 6px; }
.plugin-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.install-btn { flex-shrink: 0; margin-top: 4px; }
.installed-list { display: flex; flex-direction: column; gap: 8px; }
.installed-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 6px;
  padding: 12px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.installed-info { display: flex; align-items: center; gap: 12px; }
.installed-name { font-weight: 600; }
.installed-version { color: #909399; font-size: 13px; }
.installed-date { color: #909399; font-size: 12px; }
.installed-actions { display: flex; align-items: center; gap: 8px; }
.publish-form { max-width: 500px; }
.detail-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
.detail-desc { font-size: 14px; color: #606266; margin-bottom: 16px; line-height: 1.6; }
.detail-meta { font-size: 13px; line-height: 2; }
.detail-meta span { color: #909399; }
.detail-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 12px; }
.rate-section { margin-top: 16px; }
.rate-label { font-size: 13px; color: #909399; margin-bottom: 8px; }
.reviews-section { margin-top: 16px; }
.section-title { font-weight: 600; margin-bottom: 8px; }
.review-item { margin-bottom: 8px; padding: 8px; background: #f5f7fa; border-radius: 4px; }
.review-text { font-size: 13px; margin-top: 4px; }
</style>
