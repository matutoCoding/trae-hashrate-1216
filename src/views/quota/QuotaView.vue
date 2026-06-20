<template>
  <div class="page-container quota-view">
    <div class="page-header">
      <div class="page-title">
        <el-icon :size="22" color="#409eff"><Coin /></el-icon>
        <span style="margin-left:8px;">额度管控</span>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="openConfigDialog">
          <el-icon><Setting /></el-icon>
          <span>额度配置</span>
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mb-20">
      <el-col :span="8">
        <div class="quota-card primary-card">
          <div class="card-icon">
            <el-icon :size="32"><Wallet /></el-icon>
          </div>
          <div class="card-content">
            <div class="card-label">本月剩余额度</div>
            <div class="card-value">
              <span style="font-size:40px;">{{ currentQuotaRemaining }}</span>
              <span class="card-unit">天</span>
            </div>
            <el-progress
              :percentage="quotaUsedPercentage"
              :stroke-width="10"
              :color="progressColor"
              style="margin-top:12px;"
            />
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="quota-card success-card">
          <div class="card-icon">
            <el-icon :size="32"><Money /></el-icon>
          </div>
          <div class="card-content">
            <div class="card-label">本月自费金额</div>
            <div class="card-value">
              <span style="font-size:36px;">¥</span>
              <span style="font-size:40px;">{{ currentMonthPaidAmount.toFixed(2) }}</span>
            </div>
            <div class="card-desc">
              自费 <el-tag type="primary" size="small">{{ currentMonthPaidCount }}</el-tag> 天
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="quota-card warning-card">
          <div class="card-icon">
            <el-icon :size="32"><Date /></el-icon>
          </div>
          <div class="card-content">
            <div class="card-label">下次重置时间</div>
            <div class="card-value date-value">
              {{ nextResetDate }}
            </div>
            <div class="card-desc" v-if="daysUntilReset > 0">
              还有 <el-tag type="warning" size="small">{{ daysUntilReset }}</el-tag> 天
            </div>
            <div class="card-desc" v-else>
              <el-tag type="danger" size="small">今日重置</el-tag>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="16">
        <div class="stat-card">
          <div class="flex-between mb-10">
            <div style="font-size:16px;font-weight:600;">月度额度使用记录</div>
            <el-date-picker
              v-model="queryMonth"
              type="month"
              format="YYYY-MM"
              value-format="YYYY-MM"
              size="small"
              @change="loadMonthlyQuota"
            />
          </div>
          <el-descriptions :column="3" border size="default">
            <el-descriptions-item label="月份">
              <span style="font-weight:600;">{{ quotaData?.month || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="总免费额度">
              <span>{{ quotaData?.total_quota || 0 }} 天</span>
            </el-descriptions-item>
            <el-descriptions-item label="已使用额度">
              <span :class="{ 'danger-text': quotaExceeded }">{{ quotaData?.used_quota || 0 }} 天</span>
            </el-descriptions-item>
            <el-descriptions-item label="剩余额度">
              <span :class="currentQuotaRemaining < (quotaData?.total_quota || 0) * 0.2 ? 'warning-text' : 'success-text'">
                {{ currentQuotaRemaining }} 天
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="自费天数">
              <span>{{ quotaData?.paid_count || 0 }} 天</span>
            </el-descriptions-item>
            <el-descriptions-item label="自费总额">
              <span style="color:#f56c6c;font-weight:600;">¥{{ (quotaData?.paid_amount || 0).toFixed(2) }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <div style="margin-top:24px;">
            <div class="mb-10" style="font-size:16px;font-weight:600;">额度使用进度</div>
            <div class="progress-visual">
              <div class="progress-bar">
                <div class="progress-used" :style="{ width: `${Math.min(100, quotaUsedPercentage)}%` }">
                  <span v-if="quotaUsedPercentage > 15">已用 {{ quotaData?.used_quota || 0 }} 天</span>
                </div>
                <div class="progress-paid" :style="{ width: `${paidPercentage}%`, left: `${Math.min(100, quotaUsedPercentage)}%` }">
                  <span v-if="paidPercentage > 10">自费 {{ quotaData?.paid_count || 0 }} 天</span>
                </div>
                <div class="progress-remaining" :style="{ width: `${remainingPercentage}%`, left: `${Math.min(100, quotaUsedPercentage) + paidPercentage}%` }">
                  <span v-if="remainingPercentage > 10">剩余 {{ currentQuotaRemaining }} 天</span>
                </div>
              </div>
              <div class="progress-labels mt-10">
                <span><span class="dot used"></span>免费额度</span>
                <span><span class="dot paid"></span>自费</span>
                <span><span class="dot remaining"></span>剩余</span>
              </div>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :span="8">
        <div class="stat-card">
          <div style="font-size:16px;font-weight:600;margin-bottom:16px;">快捷操作</div>
          <div class="action-list">
            <button class="action-btn" @click="handleResetCurrentMonth">
              <el-icon :size="20"><RefreshLeft /></el-icon>
              <div class="action-info">
                <div class="action-title">重置本月额度</div>
                <div class="action-desc">重新发放月度额度</div>
              </div>
            </button>
            <button class="action-btn" @click="openManualGrant">
              <el-icon :size="20"><Plus /></el-icon>
              <div class="action-info">
                <div class="action-title">补发本月额度</div>
                <div class="action-desc">临时增加额度</div>
              </div>
            </button>
            <button class="action-btn" @click="viewMonthHistory">
              <el-icon :size="20"><DataLine /></el-icon>
              <div class="action-info">
                <div class="action-title">查看历史记录</div>
                <div class="action-desc">过去6个月使用情况</div>
              </div>
            </button>
            <button class="action-btn calibrate" @click="handleCalibrate">
              <el-icon :size="20"><Aim /></el-icon>
              <div class="action-info">
                <div class="action-title">额度校准</div>
                <div class="action-desc">按实际房态重算</div>
              </div>
            </button>
          </div>

          <div style="margin-top:24px;">
            <div style="font-size:16px;font-weight:600;margin-bottom:12px;">当前额度配置</div>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="月度免费额度">
                <el-tag type="success" size="small">{{ quotaConfig?.monthly_free_quota || 0 }} 天/月</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="自费单价">
                <el-tag type="danger" size="small">¥{{ quotaConfig?.paid_price_per_day || 0 }}/天</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="重置日期">
                <el-tag type="warning" size="small">每月 {{ quotaConfig?.reset_day || 1 }} 日</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="configDialogVisible" title="额度配置" width="520px">
      <el-form :model="configForm" label-width="120px" ref="configFormRef">
        <el-form-item label="月度免费额度(天)" required>
          <el-input-number v-model="configForm.monthly_free_quota" :min="0" :max="365" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="自费单价(元/天)" required>
          <el-input-number v-model="configForm.paid_price_per_day" :min="0" :precision="2" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="重置日期(每月)" required>
          <el-input-number v-model="configForm.reset_day" :min="1" :max="28" style="width: 100%;" />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="额度规则说明"
          style="margin-top:16px;"
        >
          <div style="line-height:1.8;">
            1. 每月重置日为当月发放免费额度，不累加到下月<br>
            2. 额度用完后挂房自动转为自费<br>
            3. 手动重置仅重新发放当月额度，不影响已有房态
          </div>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveConfig">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="grantDialogVisible" title="补发本月额度" width="420px">
      <el-form :model="grantForm" label-width="120px" ref="grantFormRef">
        <el-form-item label="补额度数(天)" required>
          <el-input-number v-model="grantForm.amount" :min="1" :max="100" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="grantForm.remark" type="textarea" :rows="2" placeholder="请输入补发原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="grantDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleGrantQuota">确认补发</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" title="历史使用记录" width="720px">
      <el-table :data="historyData" border stripe>
        <el-table-column prop="month" label="月份" width="140" />
        <el-table-column prop="total_quota" label="总额度" width="100" align="center">
          <template #default="{ row }">{{ row.total_quota }} 天</template>
        </el-table-column>
        <el-table-column prop="used_quota" label="已用额度" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.used_quota > row.total_quota ? '#f56c6c' : '' }">{{ row.used_quota }} 天</span>
          </template>
        </el-table-column>
        <el-table-column prop="paid_count" label="自费天数" width="100" align="center">
          <template #default="{ row }">{{ row.paid_count }} 天</template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="自费金额" align="center">
          <template #default="{ row }">
            <span style="color:#f56c6c;font-weight:600;">¥{{ (row.paid_amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用率" width="120">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, Math.round(row.used_quota / row.total_quota * 100))"
              :stroke-width="8"
              size="small"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { DataLine, RefreshLeft, Plus, Setting, Aim } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { QuotaConfig, MonthlyQuota } from '@/types'

const queryMonth = ref(dayjs().format('YYYY-MM'))

const quotaConfig = ref<QuotaConfig | null>(null)
const quotaData = ref<MonthlyQuota | null>(null)
const historyData = ref<MonthlyQuota[]>([])

const configDialogVisible = ref(false)
const configFormRef = ref<FormInstance>()
const configForm = reactive<Partial<QuotaConfig>>({
  monthly_free_quota: 30,
  paid_price_per_day: 100,
  reset_day: 1
})

const grantDialogVisible = ref(false)
const grantForm = reactive({ amount: 5, remark: '' })

const historyDialogVisible = ref(false)

const currentQuotaRemaining = computed(() => {
  if (!quotaData.value) return 0
  return Math.max(0, (quotaData.value.total_quota || 0) - (quotaData.value.used_quota || 0))
})

const quotaUsedPercentage = computed(() => {
  if (!quotaData.value || !quotaData.value.total_quota) return 0
  return Math.round((quotaData.value.used_quota / quotaData.value.total_quota) * 100)
})

const paidPercentage = computed(() => {
  if (!quotaData.value || !quotaData.value.total_quota) return 0
  return Math.round(((quotaData.value.paid_count || 0) / quotaData.value.total_quota) * 100)
})

const remainingPercentage = computed(() => {
  return Math.max(0, 100 - quotaUsedPercentage.value - paidPercentage.value)
})

const progressColor = computed(() => {
  if (quotaUsedPercentage.value >= 100) return '#f56c6c'
  if (quotaUsedPercentage.value >= 80) return '#e6a23c'
  return '#67c23a'
})

const quotaExceeded = computed(() => {
  return (quotaData.value?.used_quota || 0) > (quotaData.value?.total_quota || 0)
})

const currentMonthPaidAmount = computed(() => quotaData.value?.paid_amount || 0)
const currentMonthPaidCount = computed(() => quotaData.value?.paid_count || 0)

const nextResetDate = computed(() => {
  const resetDay = quotaConfig.value?.reset_day || 1
  const now = dayjs()
  let next = now.date(resetDay)
  if (now.date() >= resetDay) {
    next = next.add(1, 'month')
  }
  return next.format('YYYY-MM-DD')
})

const daysUntilReset = computed(() => {
  const resetDay = quotaConfig.value?.reset_day || 1
  const now = dayjs()
  let next = now.date(resetDay)
  if (now.date() >= resetDay) {
    next = next.add(1, 'month')
  }
  return next.diff(now, 'day')
})

async function loadQuotaConfig() {
  quotaConfig.value = await window.dbApi.getQuotaConfig()
}

async function loadMonthlyQuota() {
  quotaData.value = await window.dbApi.getMonthlyQuota(queryMonth.value)
}

async function loadHistoryData() {
  const data: MonthlyQuota[] = []
  for (let i = 5; i >= 0; i--) {
    const month = dayjs().subtract(i, 'month').format('YYYY-MM')
    const mq = await window.dbApi.getMonthlyQuota(month)
    data.push(mq)
  }
  historyData.value = data
}

function openConfigDialog() {
  if (quotaConfig.value) {
    Object.assign(configForm, {
      monthly_free_quota: quotaConfig.value.monthly_free_quota,
      paid_price_per_day: quotaConfig.value.paid_price_per_day,
      reset_day: quotaConfig.value.reset_day
    })
  }
  configDialogVisible.value = true
}

async function handleSaveConfig() {
  try {
    await window.dbApi.updateQuotaConfig(configForm)
    ElMessage.success('配置保存成功')
    configDialogVisible.value = false
    await loadQuotaConfig()
    await loadMonthlyQuota()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

function openManualGrant() {
  grantForm.amount = 5
  grantForm.remark = ''
  grantDialogVisible.value = true
}

async function handleGrantQuota() {
  try {
    await ElMessageBox.confirm(
      `确认给本月补发 ${grantForm.amount} 天额度吗？`,
      '补发确认',
      { type: 'info' }
    )
    const month = dayjs().format('YYYY-MM')
    await window.dbApi.grantQuota({
      month,
      amount: grantForm.amount,
      remark: grantForm.remark
    })
    ElMessage.success(`已补发 ${grantForm.amount} 天额度`)
    grantDialogVisible.value = false
    await loadMonthlyQuota()
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e) {
    // 用户取消
  }
}

function viewMonthHistory() {
  loadHistoryData()
  historyDialogVisible.value = true
}

async function handleResetCurrentMonth() {
  try {
    await ElMessageBox.confirm(
      '确认要重置本月额度吗？\n将按当前配置重新发放当月免费额度，已有房态不会被改动。',
      '额度重置确认',
      { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }
    )
    const currentMonth = dayjs().format('YYYY-MM')
    await window.dbApi.resetMonthlyQuota(currentMonth)
    ElMessage.success('额度重置成功')
    await loadMonthlyQuota()
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e) {
    // 用户取消
  }
}

async function handleCalibrate() {
  try {
    const currentMonth = dayjs().format('YYYY-MM')
    const monthCn = dayjs().format('YYYY年MM月')
    await ElMessageBox.confirm(
      `确认要校准 ${monthCn} 的额度数据吗？\n将根据当月实际房态记录重新计算：已用额度、自费天数、自费总额，确保数据一致。`,
      '额度校准确认',
      { type: 'warning', confirmButtonText: '确认校准', cancelButtonText: '取消' }
    )

    const result = await window.dbApi.calibrateMonthlyQuota(currentMonth)
    ElMessage.success(
      `校准完成！已用额度: ${result.used_quota} 天, 自费: ${result.paid_count} 天/¥${result.paid_amount.toFixed(2)}`
    )
    await loadMonthlyQuota()
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e) {
    // 用户取消
  }
}

onMounted(async () => {
  await window.dbApi.autoResetQuotaIfNeeded()
  await loadQuotaConfig()
  await loadMonthlyQuota()
})
</script>

<style lang="scss" scoped>
.quota-view {
  min-height: 100%;
}

.quota-card {
  border-radius: 12px;
  padding: 24px;
  display: flex;
  gap: 20px;
  align-items: center;
  color: #fff;
  min-height: 160px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.primary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.success-card {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.warning-card {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.card-icon {
  width: 72px;
  height: 72px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  color: #fff;
}

.card-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.card-value {
  font-weight: 700;
  line-height: 1.2;
  display: flex;
  align-items: baseline;
}

.card-unit {
  font-size: 18px;
  margin-left: 6px;
  opacity: 0.85;
}

.date-value {
  font-size: 28px !important;
}

.card-desc {
  margin-top: 10px;
  font-size: 13px;
  opacity: 0.9;
}

.danger-text {
  color: #f56c6c;
  font-weight: 600;
}

.warning-text {
  color: #e6a23c;
  font-weight: 600;
}

.success-text {
  color: #67c23a;
  font-weight: 600;
}

.progress-visual {
  padding: 0 4px;
}

.progress-bar {
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f7fa;
  position: relative;
}

.progress-used, .progress-paid, .progress-remaining {
  height: 100%;
  position: absolute;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  transition: width 0.4s ease;
}

.progress-used {
  left: 0;
  background: linear-gradient(90deg, #67c23a, #85ce61);
}

.progress-paid {
  background: linear-gradient(90deg, #f56c6c, #f78989);
}

.progress-remaining {
  background: #e4e7ed;
  color: #909399;
}

.progress-labels {
  display: flex;
  gap: 24px;
  font-size: 13px;
  color: #606266;
  justify-content: center;
}

.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
  &.used { background: #67c23a; }
  &.paid { background: #f56c6c; }
  &.remaining { background: #e4e7ed; }
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: #606266;
  &:hover {
    border-color: #409eff;
    background: #ecf5ff;
    transform: translateX(4px);
  }
}

.action-info {
  flex: 1;
  .action-title {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
  }
  .action-desc {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
  }
}

.action-btn.calibrate {
  background: linear-gradient(135deg, #fff7e6, #ffe7ba);
  border-color: #ffd591;
  &:hover {
    background: linear-gradient(135deg, #ffe7ba, #ffd591);
    border-color: #fa8c16;
  }
  :deep(.el-icon) {
    color: #fa8c16;
  }
  .action-title {
    color: #d46b08;
    font-weight: 600;
  }
  .action-desc {
    color: #fa8c16;
  }
}
</style>
