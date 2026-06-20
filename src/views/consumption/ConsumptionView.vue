<template>
  <div class="page-container consumption-view">
    <div class="page-header">
      <div class="page-title">
        <el-icon :size="22" color="#409eff"><Tickets /></el-icon>
        <span style="margin-left:8px;">消费明细</span>
      </div>
      <div class="header-actions">
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          <span>导出CSV</span>
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mb-20">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon total-icon">
            <el-icon :size="24"><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">总记录数</div>
            <div class="stat-num">{{ summary?.total_count || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon success-icon">
            <el-icon :size="24"><Coin /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">额度使用</div>
            <div class="stat-num success">{{ summary?.quota_count || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon primary-icon">
            <el-icon :size="24"><Wallet /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">自费条数</div>
            <div class="stat-num primary">{{ summary?.paid_count || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon danger-icon">
            <el-icon :size="24"><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">自费总额</div>
            <div class="stat-num danger">¥{{ (summary?.paid_amount || 0).toFixed(2) }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import type { ConsumptionRecord, ConsumptionSummary, Room } from '@/types'

const loading = ref(false)
const rooms = ref<Room[]>([])
const records = ref<ConsumptionRecord[]>([])
const summary = ref<ConsumptionSummary | null>(null)

const filterForm = reactive({
  dateRange: [] as string[],
  type: '' as string,
  roomId: null as number | null
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

async function loadRooms() {
  rooms.value = await window.dbApi.getRooms()
}

async function loadData() {
  loading.value = true
  try {
    const params: any = {
      limit: 1000,
      offset: 0
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
    summary.value = await window.dbApi.getConsumptionSummary(params)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  loadData()
}

function handleReset() {
  filterForm.dateRange = []
  filterForm.type = ''
  filterForm.roomId = null
  loadData()
}

function handleExport() {
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

  const csvContent = '\uFEFF' + [headers, ...rows].map(row =>
    row.map(cell => {
      const str = String(cell).replace(/"/g, '""')
      return `"${str}"`
    }).join(',')
  ).join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  const dateStr = dayjs().format('YYYYMMDD_HHmmss')
  link.download = `消费明细_${dateStr}.csv`
  link.click()
  URL.revokeObjectURL(link.href)

  ElMessage.success(`已导出 ${records.value.length} 条记录`)
}

onMounted(async () => {
  await loadRooms()
  await loadData()
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

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
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
</style>
