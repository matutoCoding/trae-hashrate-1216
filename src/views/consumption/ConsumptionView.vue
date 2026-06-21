<template>
  <div class="page-container consumption-view">
    <div class="page-header">
      <div class="page-title">
        <el-icon :size="22" color="#409eff"><Tickets /></el-icon>
        <span style="margin-left:8px;">消费明细 / 对账</span>
      </div>
      <div class="header-actions">
        <el-date-picker
          v-model="selectedMonth"
          type="month"
          format="YYYY-MM"
          value-format="YYYY-MM"
          placeholder="选择月份"
          style="width: 160px; margin-right: 12px;"
          @change="handleMonthChange"
        />
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          <span>导出CSV</span>
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mb-20">
      <el-col :span="6">
        <div class="stat-card month-summary-card">
          <div class="stat-icon success-icon">
            <el-icon :size="24"><Coin /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月额度使用(天)</div>
            <div class="stat-num success">{{ monthlySummary?.quota_used || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card month-summary-card">
          <div class="stat-icon primary-icon">
            <el-icon :size="24"><Wallet /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月自费天数</div>
            <div class="stat-num primary">{{ monthlySummary?.paid_count || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card month-summary-card">
          <div class="stat-icon danger-icon">
            <el-icon :size="24"><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月自费总额</div>
            <div class="stat-num danger">¥{{ (monthlySummary?.paid_amount || 0).toFixed(2) }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card month-summary-card">
          <div class="stat-icon total-icon">
            <el-icon :size="24"><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">本月总记录数</div>
            <div class="stat-num">{{ monthlySummary?.total_records || 0 }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="consumption-tabs">
      <el-tab-pane label="房间维度排行" name="ranking">
        <div class="stat-card">
          <el-table :data="roomRanking" border stripe v-loading="loading" height="560">
            <el-table-column type="index" label="排名" width="70" align="center" fixed="left">
              <template #default="{ $index }">
                <el-tag v-if="$index === 0" type="danger" effect="dark" size="small">
                  <el-icon><FirstAidKit /></el-icon> 第1
                </el-tag>
                <el-tag v-else-if="$index === 1" type="warning" effect="dark" size="small">
                  第2
                </el-tag>
                <el-tag v-else-if="$index === 2" type="info" effect="dark" size="small">
                  第3
                </el-tag>
                <span v-else style="color:#909399;">第{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="room_no" label="房间号" width="100" />
            <el-table-column prop="room_name" label="房间名称" width="140" show-overflow-tooltip />
            <el-table-column prop="quota_used" label="额度使用(天)" width="120" align="center" sortable>
              <template #default="{ row }">
                <span style="color:#67c23a;font-weight:600;">{{ row.quota_used || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="paid_count" label="自费天数" width="100" align="center" sortable>
              <template #default="{ row }">
                <span style="color:#409eff;font-weight:600;">{{ row.paid_count || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="paid_amount" label="自费金额(元)" width="140" align="right" sortable>
              <template #default="{ row }">
                <span style="color:#f56c6c;font-weight:600;">¥{{ (row.paid_amount || 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="total_days" label="累计占用(天)" width="120" align="center" sortable />
            <el-table-column label="操作" width="140" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="openRoomDailyDetail(row)">
                  <el-icon><View /></el-icon>
                  <span>查看日流水</span>
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-footer-tip">
            点击「查看日流水」可查看该房间当月每一天的详细流水
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="明细流水" name="detail">
        <div class="stat-card">
          <div class="filter-bar mb-20">
            <el-form :inline="true" :model="filterForm" @submit.prevent>
              <el-form-item label="日期范围">
                <el-date-picker
                  v-model="filterForm.dateRange"
                  type="daterange"
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                />
              </el-form-item>
              <el-form-item label="消费类型">
                <el-select v-model="filterForm.type" placeholder="全部类型" clearable style="width: 140px;">
                  <el-option label="自费挂房" value="paid" />
                  <el-option label="额度使用" value="quota" />
                  <el-option label="额度退回" value="refund" />
                </el-select>
              </el-form-item>
              <el-form-item label="房间">
                <el-select v-model="filterForm.roomId" placeholder="全部房间" clearable style="width: 180px;">
                  <el-option v-for="r in rooms" :key="r.id" :label="`${r.room_no} - ${r.room_name}`" :value="r.id" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="handleSearch">
                  <el-icon><Search /></el-icon>
                  <span>查询</span>
                </el-button>
                <el-button @click="handleReset">
                  <el-icon><RefreshRight /></el-icon>
                  <span>重置</span>
                </el-button>
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="records" border stripe v-loading="loading" height="520">
            <el-table-column type="index" label="序号" width="70" align="center" fixed="left" />
            <el-table-column prop="date" label="日期" width="120" sortable>
              <template #default="{ row }">
                <span style="font-weight:500;">{{ row.date }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="room_no" label="房间号" width="100" />
            <el-table-column prop="room_name" label="房间名称" width="140" show-overflow-tooltip />
            <el-table-column label="消费类型" width="110" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.type === 'paid'" type="danger" effect="light" size="small">
                  <el-icon style="margin-right:4px;"><Wallet /></el-icon>自费
                </el-tag>
                <el-tag v-else-if="row.type === 'quota'" type="success" effect="light" size="small">
                  <el-icon style="margin-right:4px;"><Coin /></el-icon>额度
                </el-tag>
                <el-tag v-else type="info" effect="light" size="small">
                  <el-icon style="margin-right:4px;"><RefreshLeft /></el-icon>退回
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额(元)" width="110" align="right" sortable>
              <template #default="{ row }">
                <template v-if="row.type === 'paid'">
                  <span style="color:#f56c6c;font-weight:600;">+¥{{ row.amount.toFixed(2) }}</span>
                </template>
                <template v-else-if="row.type === 'refund'">
                  <span style="color:#67c23a;">-¥{{ row.amount.toFixed(2) }}</span>
                </template>
                <template v-else>
                  <span style="color:#909399;">-</span>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="额度使用(天)" width="120" align="center">
              <template #default="{ row }">
                <span v-if="row.type === 'quota'" style="color:#67c23a;font-weight:600;">-{{ row.quota_used || 0 }}</span>
                <span v-else-if="row.type === 'refund'" style="color:#e6a23c;">+{{ row.quota_used || 0 }}</span>
                <span v-else style="color:#c0c4cc;">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="240" show-overflow-tooltip />
            <el-table-column prop="created_at" label="创建时间" width="170">
              <template #default="{ row }">
                <span style="font-size:12px;color:#909399;">{{ formatDateTime(row.created_at) }}</span>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-bar mt-20 flex-between">
            <div style="color:#606266;font-size:13px;">
              共 <b style="color:#303133;">{{ records.length }}</b> 条记录，
              自费金额合计 <b style="color:#f56c6c;">¥{{ totalPaidAmount.toFixed(2) }}</b>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="差异核对" name="reconciliation">
        <div class="stat-card">
          <div class="reconciliation-header mb-16">
            <div class="reconciliation-title">
              <el-icon color="#f56c6c" :size="20"><Warning /></el-icon>
              <span>三边数据对账：房态记录 ↔ 消费流水 ↔ 额度管控</span>
            </div>
            <div class="reconciliation-actions">
              <el-button @click="loadReconciliation">
                <el-icon><RefreshRight /></el-icon>
                <span>刷新核对</span>
              </el-button>
              <el-button type="primary" @click="handleRegenerateRecords">
                <el-icon><Refresh /></el-icon>
                <span>一键重生成当月流水</span>
              </el-button>
            </div>
          </div>

          <el-descriptions v-if="reconciliationResult" :column="3" border size="small" class="mb-20">
            <el-descriptions-item label="数据来源" align="center">
              <span style="font-weight:600;">额度管控</span>
            </el-descriptions-item>
            <el-descriptions-item label="数据来源" align="center">
              <span style="font-weight:600;">房态记录</span>
            </el-descriptions-item>
            <el-descriptions-item label="数据来源" align="center">
              <span style="font-weight:600;">消费流水</span>
            </el-descriptions-item>
            <el-descriptions-item label="已用额度(天)" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                {{ reconciliationResult.quota_summary.from_monthly_quotas.used_quota }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="已用额度(天)" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                {{ reconciliationResult.quota_summary.from_room_statuses.used_quota }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="已用额度(天)" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                {{ reconciliationResult.quota_summary.from_consumption_records.used_quota }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="自费天数" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                {{ reconciliationResult.quota_summary.from_monthly_quotas.paid_count }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="自费天数" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                {{ reconciliationResult.quota_summary.from_room_statuses.paid_count }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="自费天数" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                {{ reconciliationResult.quota_summary.from_consumption_records.paid_count }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="自费总额(元)" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                ¥{{ reconciliationResult.quota_summary.from_monthly_quotas.paid_amount.toFixed(2) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="自费总额(元)" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                ¥{{ reconciliationResult.quota_summary.from_room_statuses.paid_amount.toFixed(2) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="自费总额(元)" align="center">
              <span :class="{ 'text-danger': reconciliationResult.quota_summary.has_diff }">
                ¥{{ reconciliationResult.quota_summary.from_consumption_records.paid_amount.toFixed(2) }}
              </span>
            </el-descriptions-item>
          </el-descriptions>

          <el-alert
            v-if="reconciliationResult?.quota_summary?.has_diff"
            type="warning"
            show-icon
            :closable="false"
            class="mb-20"
            title="数据不一致">
            <template #default>
              三边数据存在差异，建议点击「一键重生成当月流水」以消费流水为准重新对齐，或点击「额度校准」以房态为准重新对齐。
            </template>
          </el-alert>
          <el-alert
            v-else-if="reconciliationResult"
            type="success"
            show-icon
            :closable="false"
            class="mb-20"
            title="数据一致 ✅">
            <template #default>
              房态记录、消费流水、额度管控三边数据完全一致，当前对账通过。
            </template>
          </el-alert>

          <div class="section-title mb-12">
            <span>差异明细（共 {{ reconciliationResult?.diff_count || 0 }} 处差异）</span>
          </div>
          <el-table
            :data="reconciliationResult?.diffs || []"
            border
            stripe
            v-loading="reconciliationLoading"
            height="420">
            <el-table-column type="index" label="序号" width="70" align="center" />
            <el-table-column label="类型" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.type === 'mismatch'" type="danger" size="small">不匹配</el-tag>
                <el-tag v-else type="warning" size="small">孤立流水</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="date" label="日期" width="130" />
            <el-table-column prop="room_no" label="房间号" width="100" />
            <el-table-column prop="room_name" label="房间名称" width="140" show-overflow-tooltip />
            <el-table-column label="房态状态" width="120" align="center">
              <template #default="{ row }">
                <template v-if="row.room_status">
                  <el-tag v-if="row.room_status.status === 'blocked'" type="info" size="small">锁房</el-tag>
                  <el-tag v-else-if="row.room_status.is_paid === 1" type="danger" size="small">自费</el-tag>
                  <el-tag v-else type="success" size="small">免费</el-tag>
                </template>
                <span v-else style="color:#c0c4cc;">已删除</span>
              </template>
            </el-table-column>
            <el-table-column label="房态金额" width="110" align="right">
              <template #default="{ row }">
                <template v-if="row.room_status?.is_paid === 1">
                  ¥{{ row.room_status.amount.toFixed(2) }}
                </template>
                <span v-else style="color:#c0c4cc;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="流水类型" width="100" align="center">
              <template #default="{ row }">
                <template v-if="row.consumption">
                  <el-tag v-if="row.consumption.type === 'paid'" type="danger" size="small">自费</el-tag>
                  <el-tag v-else type="success" size="small">额度</el-tag>
                </template>
                <span v-else style="color:#c0c4cc;">缺失</span>
              </template>
            </el-table-column>
            <el-table-column label="流水金额" width="110" align="right">
              <template #default="{ row }">
                <template v-if="row.consumption?.type === 'paid'">
                  ¥{{ row.consumption.amount.toFixed(2) }}
                </template>
                <span v-else style="color:#c0c4cc;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="差异原因" min-width="200">
              <template #default="{ row }">
                <el-tag
                  v-for="(issue, idx) in row.issues"
                  :key="idx"
                  type="warning"
                  size="small"
                  style="margin-right:4px;">
                  {{ issue }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dailyDetailVisible" :title="dailyDetailTitle" width="900px" :close-on-click-modal="false">
      <div class="room-summary-bar mb-16">
        <el-row :gutter="16">
          <el-col :span="8">
            <div class="mini-stat">
              <div class="mini-label">房间</div>
              <div class="mini-value primary">{{ selectedRoom?.room_no }} - {{ selectedRoom?.room_name }}</div>
            </div>
          </el-col>
          <el-col :span="5">
            <div class="mini-stat">
              <div class="mini-label">额度使用(天)</div>
              <div class="mini-value success">{{ selectedRoom?.quota_used || 0 }}</div>
            </div>
          </el-col>
          <el-col :span="5">
            <div class="mini-stat">
              <div class="mini-label">自费天数</div>
              <div class="mini-value primary">{{ selectedRoom?.paid_count || 0 }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="mini-stat">
              <div class="mini-label">自费总额</div>
              <div class="mini-value danger">¥{{ (selectedRoom?.paid_amount || 0).toFixed(2) }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
      <el-table :data="roomDailyRecords" border stripe v-loading="dailyLoading" height="480">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="date" label="日期" width="130" sortable>
          <template #default="{ row }">
            <div style="font-weight:500;">{{ row.date }}</div>
            <div style="font-size:11px;color:#909399;">{{ getWeekdayCn(row.date) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="消费类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'paid'" type="danger" effect="light" size="small">自费</el-tag>
            <el-tag v-else-if="row.type === 'quota'" type="success" effect="light" size="small">额度</el-tag>
            <el-tag v-else type="info" effect="light" size="small">退回</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额(元)" width="110" align="right">
          <template #default="{ row }">
            <template v-if="row.type === 'paid'">
              <span style="color:#f56c6c;font-weight:600;">+¥{{ row.amount.toFixed(2) }}</span>
            </template>
            <template v-else>
              <span style="color:#909399;">-</span>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="额度使用(天)" width="120" align="center">
          <template #default="{ row }">
            <span v-if="row.type === 'quota'" style="color:#67c23a;font-weight:600;">-{{ row.quota_used || 0 }}</span>
            <span v-else style="color:#c0c4cc;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="170">
          <template #default="{ row }">
            <span style="font-size:12px;color:#909399;">{{ formatDateTime(row.created_at) }}</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="dailyDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataLine, Download, Document, Coin, Wallet, Money, FirstAidKit, View, Search, RefreshRight, Warning, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useRoute } from 'vue-router'
import type {
  ConsumptionRecord,
  ConsumptionSummary,
  ConsumptionMonthlySummary,
  ConsumptionRoomRanking,
  Room,
  ReconciliationResult,
  RegenerateResult
} from '@/types'

const route = useRoute()

const loading = ref(false)
const dailyLoading = ref(false)
const rooms = ref<Room[]>([])
const records = ref<ConsumptionRecord[]>([])
const summary = ref<ConsumptionSummary | null>(null)
const monthlySummary = ref<ConsumptionMonthlySummary | null>(null)
const roomRanking = ref<ConsumptionRoomRanking[]>([])
const activeTab = ref<'ranking' | 'detail' | 'reconciliation'>('ranking')
const selectedMonth = ref(dayjs().format('YYYY-MM'))

const reconciliationLoading = ref(false)
const reconciliationResult = ref<ReconciliationResult | null>(null)

const dailyDetailVisible = ref(false)
const roomDailyRecords = ref<ConsumptionRecord[]>([])
const selectedRoom = ref<ConsumptionRoomRanking | null>(null)

const filterForm = reactive({
  dateRange: [] as string[],
  type: '' as string,
  roomId: null as number | null
})

const dailyDetailTitle = computed(() => {
  if (!selectedRoom.value) return ''
  return `${selectedMonth.value} - ${selectedRoom.value.room_no} ${selectedRoom.value.room_name} 日流水明细`
})

const totalPaidAmount = computed(() => {
  return records.value
    .filter(r => r.type === 'paid')
    .reduce((sum, r) => sum + (r.amount || 0), 0)
})

function formatDateTime(dt: string) {
  if (!dt) return '-'
  return dayjs(dt).format('YYYY-MM-DD HH:mm:ss')
}

function getWeekdayCn(date: string) {
  if (!date) return ''
  const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weeks[dayjs(date).day()]
}

async function loadRooms() {
  rooms.value = await window.dbApi.getRooms()
}

async function loadMonthlySummary() {
  monthlySummary.value = await window.dbApi.getConsumptionMonthlySummary(selectedMonth.value)
}

async function loadRoomRanking() {
  roomRanking.value = await window.dbApi.getConsumptionRoomRanking(selectedMonth.value)
}

async function loadData() {
  loading.value = true
  try {
    const params: any = {
      limit: 1000,
      offset: 0,
      month: selectedMonth.value
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]
      params.endDate = filterForm.dateRange[1]
    }
    if (filterForm.type) {
      params.type = filterForm.type
    }
    if (filterForm.roomId) {
      params.roomId = filterForm.roomId
    }

    records.value = await window.dbApi.getConsumptionRecords(params)
    summary.value = await window.dbApi.getConsumptionSummary({ ...params })
  } finally {
    loading.value = false
  }
}

function handleMonthChange() {
  loadMonthlySummary()
  loadRoomRanking()
  loadData()
  if (activeTab.value === 'reconciliation') {
    loadReconciliation()
  }
}

async function loadReconciliation() {
  reconciliationLoading.value = true
  try {
    reconciliationResult.value = await window.dbApi.getReconciliationDiff(selectedMonth.value)
  } catch (e: any) {
    ElMessage.error(e.message || '加载对账数据失败')
  } finally {
    reconciliationLoading.value = false
  }
}

async function handleRegenerateRecords() {
  try {
    await ElMessage({
      type: 'warning',
      message: '正在重生成流水，请稍候...',
      duration: 0
    })

    const result = await window.dbApi.regenerateConsumptionRecords(selectedMonth.value)
    ElMessage.closeAll()
    ElMessage.success(
      `重生成成功！删除旧流水 ${result.deleted} 条，生成新流水 ${result.generated} 条，已自动对齐额度数据。`
    )

    await loadReconciliation()
    await loadMonthlySummary()
    await loadRoomRanking()
    await loadData()
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e: any) {
    ElMessage.closeAll()
    ElMessage.error(e.message || '重生成失败')
  }
}

function handleSearch() {
  activeTab.value = 'detail'
  loadData()
}

function handleReset() {
  filterForm.dateRange = []
  filterForm.type = ''
  filterForm.roomId = null
  loadData()
}

async function openRoomDailyDetail(room: ConsumptionRoomRanking) {
  if (!room.room_id) {
    ElMessage.warning('该房间没有ID')
    return
  }
  selectedRoom.value = room
  dailyLoading.value = true
  try {
    roomDailyRecords.value = await window.dbApi.getRoomDailyConsumption({
      roomId: room.room_id,
      month: selectedMonth.value
    })
    dailyDetailVisible.value = true
  } catch (e: any) {
    ElMessage.error(e.message || '加载日流水失败')
  } finally {
    dailyLoading.value = false
  }
}

function handleExport() {
  if (activeTab.value === 'ranking') {
    exportRanking()
  } else {
    exportDetail()
  }
}

function exportRanking() {
  if (roomRanking.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  const headers = ['排名', '房间号', '房间名称', '额度使用(天)', '自费天数', '自费金额(元)', '累计占用(天)']
  const rows = roomRanking.value.map((r, i) => [
    i + 1,
    r.room_no || '',
    r.room_name || '',
    r.quota_used || 0,
    r.paid_count || 0,
    (r.paid_amount || 0).toFixed(2),
    r.total_days || 0
  ])

  const filterInfo = `筛选条件: ${selectedMonth.value}月 - 房间维度排行`
  const csvContent = '\uFEFF' + [
    [filterInfo],
    [],
    headers,
    ...rows
  ].map(row =>
    row.map(cell => {
      const str = String(cell).replace(/"/g, '""')
      return `"${str}"`
    }).join(',')
  ).join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  const dateStr = dayjs().format('YYYYMMDD_HHmmss')
  link.download = `房间维度排行_${selectedMonth.value}_${dateStr}.csv`
  link.click()
  URL.revokeObjectURL(link.href)

  ElMessage.success(`已导出 ${roomRanking.value.length} 条房间排行记录`)
}

function exportDetail() {
  if (records.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  const headers = ['序号', '日期', '房间号', '房间名称', '消费类型', '金额(元)', '额度使用(天)', '说明', '创建时间']
  const typeMap: Record<string, string> = {
    paid: '自费挂房',
    quota: '额度使用',
    refund: '额度退回'
  }

  const rows = records.value.map((r, i) => [
    i + 1,
    r.date,
    r.room_no || '',
    r.room_name || '',
    typeMap[r.type] || r.type,
    r.type === 'paid' ? r.amount.toFixed(2) : r.type === 'refund' ? `-${r.amount.toFixed(2)}` : '0',
    r.type === 'quota' ? r.quota_used || 0 : r.type === 'refund' ? `+${r.quota_used || 0}` : '',
    r.description || '',
    formatDateTime(r.created_at)
  ])

  const filters: string[] = [`筛选条件: ${selectedMonth.value}月`]
  if (filterForm.dateRange?.length === 2) {
    filters.push(`日期: ${filterForm.dateRange[0]} ~ ${filterForm.dateRange[1]}`)
  }
  if (filterForm.type) {
    filters.push(`类型: ${typeMap[filterForm.type] || filterForm.type}`)
  }
  if (filterForm.roomId) {
    const room = rooms.value.find(r => r.id === filterForm.roomId)
    filters.push(`房间: ${room?.room_no || ''} ${room?.room_name || ''}`)
  }

  const csvContent = '\uFEFF' + [
    [filters.join(' | ')],
    [],
    headers,
    ...rows
  ].map(row =>
    row.map(cell => {
      const str = String(cell).replace(/"/g, '""')
      return `"${str}"`
    }).join(',')
  ).join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  const dateStr = dayjs().format('YYYYMMDD_HHmmss')
  link.download = `消费明细_${selectedMonth.value}_${dateStr}.csv`
  link.click()
  URL.revokeObjectURL(link.href)

  ElMessage.success(`已导出 ${records.value.length} 条明细记录`)
}

onMounted(async () => {
  if (route.query.month && typeof route.query.month === 'string') {
    selectedMonth.value = route.query.month
  }
  if (route.query.tab === 'detail') {
    activeTab.value = 'detail'
  }
  if (route.query.roomId) {
    const roomId = Number(route.query.roomId)
    if (!isNaN(roomId)) {
      filterForm.roomId = roomId
    }
  }

  await loadRooms()
  await loadMonthlySummary()
  await loadRoomRanking()
  await loadData()
  if (activeTab.value === 'reconciliation') {
    await loadReconciliation()
  }

  if (route.query.roomId) {
    const roomId = Number(route.query.roomId)
    const room = roomRanking.value.find(r => r.room_id === roomId)
    if (room) {
      setTimeout(() => openRoomDailyDetail(room), 300)
    }
  }
})
</script>

<style lang="scss" scoped>
.consumption-view {
  min-height: 100%;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.month-summary-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.total-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
}
.success-icon {
  background: linear-gradient(135deg, #11998e, #38ef7d);
}
.primary-icon {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}
.danger-icon {
  background: linear-gradient(135deg, #f5576c, #f093fb);
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  &.primary { color: #409eff; }
  &.success { color: #67c23a; }
  &.danger { color: #f56c6c; }
}

.filter-bar {
  padding: 16px;
  background: #fafbfc;
  border-radius: 8px;
}

.pagination-bar {
  padding: 0 8px;
}

.consumption-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 16px;
  }
  :deep(.el-tabs__nav-wrap::after) {
    height: 2px;
  }
  :deep(.el-tabs__item) {
    font-size: 15px;
    height: 48px;
    line-height: 48px;
  }
}

.room-summary-bar {
  padding: 16px;
  background: linear-gradient(135deg, #f0f9ff, #e6f7ff);
  border-radius: 8px;
  border: 1px solid #bae7ff;
}

.mini-stat {
  text-align: center;
}
.mini-label {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}
.mini-value {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  &.primary { color: #409eff; }
  &.success { color: #67c23a; }
  &.danger { color: #f56c6c; }
}

.table-footer-tip {
  margin-top: 12px;
  padding: 10px 14px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 6px;
  color: #e6a23c;
  font-size: 13px;
  text-align: center;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reconciliation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reconciliation-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.reconciliation-actions {
  display: flex;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.text-danger {
  color: #f56c6c !important;
  font-weight: 600;
}
</style>
