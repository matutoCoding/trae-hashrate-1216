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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { DataLine, Calendar, Coin, Money, Lock, Wallet, House, OfficeBuilding, TrendCharts, FirstAidKit, View } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading = ref(false)
const selectedMonth = ref(dayjs().format('YYYY-MM'))
const roomTypes = ref<string[]>([])
const floors = ref<number[]>([])

const filterForm = reactive({
  roomType: '' as string,
  floor: null as number | null
})

interface DashboardStats {
  occupied_days: number
  quota_used: number
  paid_amount: number
  paid_days: number
  blocked_days: number
  active_rooms: number
  total_rooms: number
  total_available_days: number
  occupancy_rate: number
}

interface RoomStat {
  room_id: number
  room_no: string
  room_name: string
  room_type: string
  floor: number
  occupied_days: number
  quota_used: number
  paid_amount: number
  paid_days: number
  blocked_days: number
}

const stats = ref<DashboardStats | null>(null)
const roomStats = ref<RoomStat[]>([])

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

    stats.value = await window.dbApi.getDashboardStats(params)
    roomStats.value = await window.dbApi.getDashboardByRoom(params)
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
</style>
