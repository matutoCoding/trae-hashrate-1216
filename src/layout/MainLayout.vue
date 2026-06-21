<template>
  <el-container class="main-layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon :size="28" color="#fff"><House /></el-icon>
        <span>短租管理系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="menu"
        router
        background-color="#001529"
        text-color="#fff"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataLine /></el-icon>
          <span>经营看板</span>
        </el-menu-item>
        <el-menu-item index="/schedule">
          <el-icon><Calendar /></el-icon>
          <span>房态排期</span>
        </el-menu-item>
        <el-menu-item index="/cycle">
          <el-icon><Refresh /></el-icon>
          <span>周期生成</span>
        </el-menu-item>
        <el-menu-item index="/quota">
          <el-icon><Coin /></el-icon>
          <span>额度管控</span>
        </el-menu-item>
        <el-menu-item index="/consumption">
          <el-icon><Tickets /></el-icon>
          <span>消费明细</span>
        </el-menu-item>
        <el-menu-item index="/cleaning">
          <el-icon><Brush /></el-icon>
          <span>保洁排程</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tag :type="quotaRemaining > 0 ? 'success' : 'danger'" size="small" effect="dark" class="quota-tag">
            本月剩余额度: {{ quotaRemaining }} 天
          </el-tag>
          <el-tooltip content="手动重置本月额度" placement="bottom">
            <el-button size="small" type="warning" @click="handleResetQuota">
              <el-icon><RefreshLeft /></el-icon>
              <span>重置额度</span>
            </el-button>
          </el-tooltip>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { House, Calendar, Refresh, Coin, Tickets, Brush, RefreshLeft, DataLine } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { MonthlyQuota, QuotaConfig } from '@/types'

const route = useRoute()

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta?.title as string) || '')

const quotaRemaining = ref(0)
const quotaConfig = ref<QuotaConfig | null>(null)
const monthlyQuota = ref<MonthlyQuota | null>(null)

async function loadQuotaInfo() {
  const currentMonth = dayjs().format('YYYY-MM')
  monthlyQuota.value = await window.dbApi.getMonthlyQuota(currentMonth)
  quotaConfig.value = await window.dbApi.getQuotaConfig()
  quotaRemaining.value = Math.max(0, (monthlyQuota.value?.total_quota || 0) - (monthlyQuota.value?.used_quota || 0))
}

async function handleResetQuota() {
  try {
    await ElMessageBox.confirm(
      '确认要重置本月额度吗？将按当前配置重新发放当月免费额度，已有房态不会被改动。',
      '额度重置确认',
      { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }
    )
    const currentMonth = dayjs().format('YYYY-MM')
    await window.dbApi.resetMonthlyQuota(currentMonth)
    await loadQuotaInfo()
    ElMessage.success('额度重置成功')
  } catch (e) {
    // 用户取消
  }
}

onMounted(async () => {
  await window.dbApi.autoResetQuotaIfNeeded()
  await loadQuotaInfo()

  window.addEventListener('quota-updated', () => {
    loadQuotaInfo()
  })

  const interval = setInterval(async () => {
    await loadQuotaInfo()
  }, 60000)
})
</script>

<style lang="scss" scoped>
.main-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.aside {
  background-color: #001529;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  background-color: #002140;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.menu {
  flex: 1;
  border-right: none;
}

.header {
  background-color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  padding: 0 24px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.quota-tag {
  padding: 0 12px;
  height: 28px;
  display: flex;
  align-items: center;
}

.main-content {
  background-color: #f5f7fa;
  padding: 0;
  overflow: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
