<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">🔐</div>
        <h2>{{ isRegister ? '注册账号' : '登录' }}</h2>
        <p class="login-sub">Chat Portal 团队协作平台</p>
      </div>
      <el-form @submit.prevent="handleSubmit" class="login-form">
        <el-input v-model="form.username" placeholder="用户名" size="large" :prefix-icon="User" class="login-input" />
        <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password :prefix-icon="Lock" class="login-input" />
        <el-select v-if="isRegister" v-model="form.role" placeholder="角色" size="large" class="login-input">
          <el-option label="成员" value="member" />
          <el-option label="管理员" value="admin" />
          <el-option label="观察者" value="viewer" />
        </el-select>
        <el-button type="primary" native-type="submit" size="large" class="login-btn" :loading="loading">
          {{ isRegister ? '注册' : '登录' }}
        </el-button>
      </el-form>
      <div class="login-footer">
        <span>{{ isRegister ? '已有账号？' : '没有账号？' }}</span>
        <el-button link type="primary" @click="isRegister = !isRegister; form.role = 'member'">
          {{ isRegister ? '去登录' : '去注册' }}
        </el-button>
      </div>
      <div v-if="!isRegister" class="login-guest">
        <el-button size="small" @click="handleGuestLogin">以访客身份浏览</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { authLogin, authRegister } from '@/api'

const emit = defineEmits<{
  (e: 'login', data: { token: string; user: { id: string; username: string; role: string } }): void
  (e: 'guest'): void
}>()

const isRegister = ref(false)
const loading = ref(false)
const form = reactive({ username: '', password: '', role: 'member' })

async function handleSubmit() {
  if (!form.username.trim() || !form.password.trim()) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  loading.value = true
  try {
    if (isRegister.value) {
      const res = await authRegister(form.username, form.password, form.role)
      if (res.code === 200) {
        ElMessage.success('注册成功，请登录')
        isRegister.value = false
      } else {
        ElMessage.error(res.message || '注册失败')
      }
    } else {
      const res = await authLogin(form.username, form.password)
      if (res.code === 200 && res.data) {
        localStorage.setItem('auth_token', res.data.token)
        localStorage.setItem('refresh_token', res.data.refreshToken)
        localStorage.setItem('auth_user', JSON.stringify(res.data.user))
        emit('login', res.data)
        ElMessage.success('登录成功')
      } else {
        ElMessage.error(res.message || '登录失败')
      }
    }
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    loading.value = false
  }
}

function handleGuestLogin() {
  emit('guest')
}
</script>

<style scoped>
.login-wrapper {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; background: #0f172a;
  padding: 20px;
}
.login-card {
  background: #1e293b; border-radius: 16px;
  padding: 40px; width: 100%; max-width: 400px;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.login-header { text-align: center; margin-bottom: 28px; }
.login-logo { font-size: 48px; margin-bottom: 12px; }
.login-header h2 { margin: 0; color: #e2e8f0; font-size: 22px; font-weight: 600; }
.login-sub { color: #64748b; font-size: 13px; margin: 6px 0 0; }
.login-form { display: flex; flex-direction: column; gap: 14px; }
.login-input { --el-input-bg-color: #0f172a; --el-input-text-color: #e2e8f0; --el-input-border-color: rgba(255,255,255,0.08); --el-input-hover-border-color: #4fc3f7; --el-input-focus-border-color: #4fc3f7; }
.login-btn { width: 100%; margin-top: 4px; }
.login-footer { text-align: center; margin-top: 16px; color: #64748b; font-size: 13px; }
.login-guest { text-align: center; margin-top: 8px; }
</style>
