<template>
  <div class="page-container dashboard-view">
    <div class="page-header">
      <div class="page-title">
        <el-icon :size="22" color="#409eff"><DataLine /></el-icon>
        <span style="margin-left:8px;">经营看板</span>
      </div>
      <div class="header-actions">
        <el-select v-model="filterForm.roomType" placeholder="房间类型" clearable style="width: 140px; margin-right: 12px;" @change="loadDashboardData">
          <el-option v-for="t in roomTypes" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="filterForm.floor" placeholder="楼层" clearable style="width: 120px; margin-right: 12px;" @change="loadDashboardData">
          <el-option v-for="f in floors" :key="f" :label="f + '楼'" :value="f" />
        </el-select>
        <el-date-picker
          v-model="selectedMonth"
          type="month"
          format="YYYY-MM"
          value-format="YYYY-MM"
          placeholder="选择月份"
          style="width: 160px; margin-right: 12px;"
          @change="loadDashboardData"
        />
      </div>
    </div>

    <el-row :gutter="16" class="mb-20">
      <el-col :span="6">
        <div class="stat-card primary-card">
          <div class="stat-icon">
            <el-icon :size="24"><OfficeBuilding /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">总房间数</div>
            <div class="stat-num">{{ stats?.total_rooms || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card success-card">
          <div class="stat-icon">
            <el-icon :size="24"><Calendar /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">入住天数</div>
            <div class="stat-num success">{{ stats?.occupied_days || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card warning-card">
          <div class="stat-icon">
            <el-icon :size="24"><Coin /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">免费额度消耗(天)</div>
            <div class="stat-num warning">{{ stats?.quota_used || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card danger-card">
          <div class="stat-icon">
            <el-icon :size="24"><Money /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">自费收入</div>
            <div class="stat-num danger">¥{{ (stats?.paid_amount || 0).toFixed(2) }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mb-20">
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-row">
            <div class="stat-row-label">
              <el-icon color="#e6a23c"><Lock /></el-icon>
              <span>锁房天数</span>
            </div>
            <div class="stat-row-value warning">{{ stats?.blocked_days || 0 }}</div>
          </div>
          <div class="stat-row">
            <div class="stat-row-label">
              <el-icon color="#f56c6c"><Wallet /></el-icon>
              <span>自费天数</span>
            </div>
            <div class="stat-row-value danger">{{ stats?.paid_days || 0 }}</div>
          </div>
          <div class="stat-row">
            <div class="stat-row-label">
              <el-icon color="#909399"><House /></el-icon>
              <span>可用房天总数</span>
            </div>
            <div class="stat-row-value">{{ stats?.total_available_days || 0 }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="16">
        <div class="stat-card occupancy-card">
          <div class="occupancy-header">
            <div>
              <div class="occupancy-label">本月房间利用率</div>
              <div class="occupancy-value">{{ stats?.occupancy_rate || 0 }}%</div>
            </div>
            <div class="occupancy-tip">
              入住率 = 入住天数 / (总房间数 × 本月天数)
            </div>
          </div>
          <el-progress
            :percentage="stats?.occupancy_rate || 0"
            :stroke-width="18"
            :color="getOccupancyColor(stats?.occupancy_rate || 0)"
            text-inside
          />
          <div class="occupancy-breakdown">
            <div class="breakdown-item">
              <span class="breakdown-dot free"></span>
              <span>免费</span>
              <span class="breakdown-value">{{ stats?.quota_used || 0 }}天</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-dot paid"></span>
              <span>自费</span>
              <span class="breakdown-value">{{ stats?.paid_days || 0 }}天</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-dot blocked"></span>
              <span>锁房</span>
              <span class="breakdown-value">{{ stats?.blocked_days || 0 }}天</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="stat-card mb-20">
      <div class="section-title mb-16">
        <el-icon color="#409eff"><TrendCharts /></el-icon>
        <span>最近6个月趋势</span>
        <span class="trend-tip">（点击柱子查看对应月份明细）</span>
      </div>
      <div class="trend-container">
        <div class="trend-legend">
          <div class="legend-item">
            <span class="legend-dot" style="background:#67c23a;"></span>
            <span>入住天数</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#409eff;"></span>
            <span>免费额度(天)</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#f56c6c;"></span>
            <span>自费收入(元)</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background:#e6a23c;"></span>
            <span>入住率(%)</span>
          </div>
        </div>
        <div class="trend-chart">
          <div
            v-for="item in trendData"
            :key="item.month"
            class="trend-column"
            @click="goToMonthDetail(item.month)"
          >
            <div class="column-bars">
              <div
                class="bar bar-occupied"
                :style="{ height: getBarHeight(item.occupied_days, 'days') + '%' }"
                :title="`入住天数: ${item.occupied_days}`"
              ></div>
              <div
                class="bar bar-quota"
                :style="{ height: getBarHeight(item.quota_used, 'days') + '%' }"
                :title="`免费额度: ${item.quota_used}天`"
              ></div>
              <div
                class="bar bar-paid"
                :style="{ height: getBarHeight(item.paid_amount, 'amount') + '%' }"
                :title="`自费收入: ¥${item.paid_amount.toFixed(2)}`"
              ></div>
            </div>
            <div class="column-rate" :style="{ color: getOccupancyColor(item.occupancy_rate) }">
              {{ item.occupancy_rate }}%
            </div>
            <div class="column-label" :class="{ active: item.month === selectedMonth }">
              {{ item.month.slice(5) }}月
            </div>
          </div>
        </div>
        <div class="trend-stats" v-if="trendData.length > 0">
          <div class="trend-stat-item">
            <span class="trend-stat-label">6个月总入住</span>
            <span class="trend-stat-value">{{ totalTrendStats.occupied_days }}天</span>
          </div>
          <div class="trend-stat-item">
            <span class="trend-stat-label">6个月总自费</span>
            <span class="trend-stat-value">¥{{ totalTrendStats.paid_amount.toFixed(2) }}</span>
          </div>
          <div class="trend-stat-item">
            <span class="trend-stat-label">6个月平均入住率</span>
            <span class="trend-stat-value">{{ totalTrendStats.avg_rate }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="stat-card">
      <div class="section-title mb-16">
        <el-icon color="#409eff"><TrendCharts /></el-icon>
        <span>房间维度统计</span>
      </div>
      <el-table :data="roomStats" border stripe v-loading="loading" height="520">
        <el-table-column type="index" label="排名" width="70" align="center" fixed="left">
          <template #default="{ $index }">
            <el-tag v-if="$index === 0" type="danger" effect="dark" size="small">
              <el-icon><FirstAidKit /></el-icon> 第1
            </el-tag>
            <el-tag v-else-if="$index === 1" type="warning" effect="dark" size="small">第2</el-tag>
            <el-tag v-else-if="$index === 2" type="info" effect="dark" size="small">第3</el-tag>
            <span v-else style="color:#909399;">第{{ $index + 1 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="room_no" label="房间号" width="100" />
        <el-table-column prop="room_name" label="房间名称" width="140" show-overflow-tooltip />
        <el-table-column prop="room_type" label="类型" width="100" />
        <el-table-column prop="floor" label="楼层" width="80" align="center">
          <template #default="{ row }">{{ row.floor }}楼</template>
        </el-table-column>
        <el-table-column prop="occupied_days" label="入住天数" width="100" align="center" sortable>
          <template #default="{ row }">
            <span style="color:#409eff;font-weight:600;">{{ row.occupied_days || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="quota_used" label="额度(天)" width="90" align="center" sortable>
          <template #default="{ row }">
            <span style="color:#67c23a;font-weight:600;">{{ row.quota_used || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paid_days" label="自费(天)" width="90" align="center" sortable>
          <template #default="{ row }">
            <span style="color:#f56c6c;font-weight:600;">{{ row.paid_days || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="自费金额(元)" width="130" align="right" sortable>
          <template #default="{ row }">
            <span style="color:#f56c6c;font-weight:600;">¥{{ (row.paid_amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="blocked_days" label="锁房(天)" width="90" align="center" sortable>
          <template #default="{ row }">
            <span style="color:#e6a23c;">{{ row.blocked_days || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="goToRoomDetail(row)">
              <el-icon><View /></el-icon>
              <span>查看明细</span>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { DataLine, Calendar, Coin, Money, Lock, Wallet, House, OfficeBuilding, TrendCharts, FirstAidKit, View } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import type { DashboardStats, RoomStat, DashboardTrendItem } from '@/types'

const router = useRouter()

const loading = ref(false)
const selectedMonth = ref(dayjs().format('YYYY-MM'))
const roomTypes = ref<string[]>([])
const floors = ref<number[]>([])

const filterForm = reactive({
  roomType: '' as string,
  floor: null as number | null
})

const stats = ref<DashboardStats | null>(null)
const roomStats = ref<RoomStat[]>([])
const trendData = ref<DashboardTrendItem[]>([])

const totalTrendStats = computed(() => {
  const result = {
    occupied_days: 0,
    paid_amount: 0,
    avg_rate: 0
  }
  if (trendData.value.length === 0) return result
  let totalRate = 0
  for (const item of trendData.value) {
    result.occupied_days += item.occupied_days
    result.paid_amount += item.paid_amount
    totalRate += item.occupancy_rate
  }
  result.avg_rate = Math.round((totalRate / trendData.value.length) * 100) / 100
  return result
})

const maxDays = computed(() => {
  let max = 0
  for (const item of trendData.value) {
    max = Math.max(max, item.occupied_days, item.quota_used)
  }
  return max || 1
})

const maxAmount = computed(() => {
  let max = 0
  for (const item of trendData.value) {
    max = Math.max(max, item.paid_amount)
  }
  return max || 1
})

async function loadFilters() {
  roomTypes.value = await window.dbApi.getRoomTypes()
  floors.value = await window.dbApi.getFloors()
}

async function loadDashboardData() {
  loading.value = true
  try {
    const params: any = {
      month: selectedMonth.value
    }
    if (filterForm.roomType) {
      params.roomType = filterForm.roomType
    }
    if (filterForm.floor) {
      params.floor = filterForm.floor
    }

    const [statsResult, roomResult, trendResult] = await Promise.all([
      window.dbApi.getDashboardStats(params),
      window.dbApi.getDashboardByRoom(params),
      window.dbApi.getDashboardTrend({
        roomType: filterForm.roomType || undefined,
        floor: filterForm.floor || undefined
      })
    ])

    stats.value = statsResult
    roomStats.value = roomResult
    trendData.value = trendResult
  } catch (e: any) {
    ElMessage.error(e.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

function getOccupancyColor(rate: number) {
  if (rate >= 80) return '#67c23a'
  if (rate >= 50) return '#409eff'
  if (rate >= 30) return '#e6a23c'
  return '#f56c6c'
}

function getBarHeight(value: number, type: 'days' | 'amount') {
  if (type === 'days') {
    return Math.round((value / maxDays.value) * 100)
  } else {
    return Math.round((value / maxAmount.value) * 100)
  }
}

function goToRoomDetail(room: RoomStat) {
  router.push({
    path: '/consumption',
    query: {
      month: selectedMonth.value,
      roomId: room.room_id,
      tab: 'detail'
    }
  })
}

function goToMonthDetail(month: string) {
  selectedMonth.value = month
  loadDashboardData()
  router.push({
    path: '/consumption',
    query: {
      month: month,
      tab: 'detail'
    }
  })
}

onMounted(async () => {
  await loadFilters()
  await loadDashboardData()
})
</script>

<style lang="scss" scoped>
.dashboard-view {
  min-height: 100%;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.primary-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  color: #fff;
  .stat-label, .stat-num { color: #fff; }
  .stat-icon {
    background: rgba(255, 255, 255, 0.2);
  }
}

.success-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #11998e, #38ef7d);
  color: #fff;
  .stat-label, .stat-num { color: #fff; }
  .stat-icon {
    background: rgba(255, 255, 255, 0.2);
  }
}

.warning-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: #fff;
  .stat-label, .stat-num { color: #fff; }
  .stat-icon {
    background: rgba(255, 255, 255, 0.2);
  }
}

.danger-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  .stat-label, .stat-num { color: #fff; }
  .stat-icon {
    background: rgba(255, 255, 255, 0.2);
  }
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-label {
  font-size: 13px;
  margin-bottom: 4px;
  opacity: 0.9;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  &.primary { color: #409eff; }
  &.success { color: #67c23a; }
  &.warning { color: #e6a23c; }
  &.danger { color: #f56c6c; }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px dashed #ebeef5;
  &:last-child {
    border-bottom: none;
  }
}

.stat-row-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
}

.stat-row-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  &.warning { color: #e6a23c; }
  &.danger { color: #f56c6c; }
}

.occupancy-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.occupancy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.occupancy-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.occupancy-value {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
}

.occupancy-tip {
  font-size: 12px;
  color: #c0c4cc;
  max-width: 240px;
  text-align: right;
}

.occupancy-breakdown {
  display: flex;
  gap: 32px;
  margin-top: 8px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.breakdown-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  &.free { background: #67c23a; }
  &.paid { background: #f56c6c; }
  &.blocked { background: #e6a23c; }
}

.breakdown-value {
  font-weight: 600;
  color: #303133;
}

.trend-tip {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
  margin-left: 8px;
}

.trend-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trend-legend {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #606266;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.trend-chart {
  display: flex;
  gap: 8px;
  height: 260px;
  align-items: flex-end;
  padding: 0 8px;
}

.trend-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 8px 4px;
  border-radius: 6px;

  &:hover {
    background: #f5f7fa;
    transform: translateY(-2px);
  }
}

.column-bars {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 180px;
  width: 100%;
  justify-content: center;
}

.bar {
  width: 14px;
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  transition: all 0.3s;
  opacity: 0.85;

  &:hover {
    opacity: 1;
  }
}

.bar-occupied {
  background: linear-gradient(180deg, #67c23a, #85ce61);
}

.bar-quota {
  background: linear-gradient(180deg, #409eff, #66b1ff);
}

.bar-paid {
  background: linear-gradient(180deg, #f56c6c, #f78989);
}

.column-rate {
  font-size: 12px;
  font-weight: 600;
  height: 16px;
}

.column-label {
  font-size: 13px;
  color: #909399;
  font-weight: 500;

  &.active {
    color: #409eff;
    font-weight: 600;
  }
}

.trend-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
}

.trend-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.trend-stat-label {
  font-size: 12px;
  color: #909399;
}

.trend-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}
</style>
