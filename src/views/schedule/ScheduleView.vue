<template>
  <div class="page-container schedule-view">
    <div class="page-header">
      <div class="page-title">
        <el-icon :size="22" color="#409eff"><Calendar /></el-icon>
        <span style="margin-left:8px;">房态排期</span>
      </div>
      <div class="header-actions">
        <el-select v-model="viewMode" style="width: 120px; margin-right: 12px;">
          <el-option label="月视图" value="month" />
          <el-option label="周视图" value="week" />
        </el-select>
        <el-date-picker
          v-model="currentMonth"
          type="month"
          format="YYYY-MM"
          value-format="YYYY-MM"
          placeholder="选择月份"
          style="width: 160px; margin-right: 12px;"
          @change="loadData"
        />
        <el-button @click="openBatchDialog()" style="margin-right: 12px;">
          <el-icon><Grid /></el-icon>
          <span>批量调整</span>
        </el-button>
        <el-button :disabled="!hasLastBatch" @click="handleRevertLastBatch" style="margin-right: 12px;">
          <el-icon><RefreshLeft /></el-icon>
          <span>撤销上次批量</span>
        </el-button>
        <el-button @click="openBatchLogDialog()" style="margin-right: 12px;">
          <el-icon><Document /></el-icon>
          <span>操作记录</span>
        </el-button>
        <el-button type="primary" @click="openStatusDialog()">
          <el-icon><Plus /></el-icon>
          <span>添加房态</span>
        </el-button>
      </div>
    </div>

    <div class="stats-bar mb-20">
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">总房间数</div>
            <div class="stat-value primary">{{ rooms.length }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">已占用</div>
            <div class="stat-value danger">{{ occupiedCount }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">可预订</div>
            <div class="stat-value success">{{ availableCount }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-label">本月占用率</div>
            <div class="stat-value warning">{{ occupancyRate }}%</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="legend-bar mb-10">
      <span class="legend-item"><span class="legend-dot available"></span>可预订</span>
      <span class="legend-item"><span class="legend-dot occupied-free"></span>占用(免费额度)</span>
      <span class="legend-item"><span class="legend-dot occupied-paid"></span>占用(付费)</span>
      <span class="legend-item"><span class="legend-dot blocked"></span>锁房</span>
      <span class="legend-item"><span class="legend-dot cleaning"></span>保洁中</span>
    </div>

    <div class="schedule-grid-wrapper" v-loading="loading">
      <div class="schedule-grid">
        <div class="grid-header">
          <div class="header-cell room-col">房间</div>
          <div v-for="date in dateList" :key="date"
               class="header-cell date-col"
               :class="{ weekend: isWeekend(date), today: isToday(date) }">
            <div class="date-day">{{ getDay(date) }}</div>
            <div class="date-week">{{ getWeekday(date) }}</div>
          </div>
        </div>

        <div class="grid-body">
          <div v-for="room in rooms" :key="room.id" class="grid-row">
            <div class="row-cell room-col">
              <div class="room-info">
                <div class="room-no">{{ room.room_no }}</div>
                <div class="room-name">{{ room.room_name }}</div>
              </div>
            </div>
            <div v-for="date in dateList" :key="date"
                 class="row-cell date-col"
                 :class="getCellClass(room.id, date)"
                 :style="getCellStyle(room.id, date)"
                 @click="handleCellClick(room, date)">
              <template v-if="getStatusInfo(room.id, date) as any">
                <div class="cell-content">
                  <el-tag v-if="getStatusInfo(room.id, date)?.is_paid" type="primary" size="small" effect="dark" round>
                    ¥{{ getStatusInfo(room.id, date)?.amount || 0 }}
                  </el-tag>
                  <el-tag v-else-if="getStatusInfo(room.id, date)?.quota_used" type="success" size="small" effect="dark" round>
                    免费
                  </el-tag>
                  <div v-if="getStatusInfo(room.id, date)?.guest_name" class="guest-name">
                    {{ getStatusInfo(room.id, date)?.guest_name }}
                  </div>
                </div>
              </template>
              <div v-else class="cell-empty">
                <el-icon :size="14" color="#c0c4cc"><Plus /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="statusDialogVisible" :title="dialogTitle" width="600px" :close-on-click-modal="false">
      <el-form :model="statusForm" label-width="100px" ref="statusFormRef">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="房间" required>
              <el-select v-model="statusForm.room_id" placeholder="请选择房间" style="width: 100%" :disabled="!!editingId">
                <el-option v-for="r in rooms" :key="r.id" :label="`${r.room_no} - ${r.room_name}`" :value="r.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="日期" required>
              <el-date-picker v-model="statusForm.date" type="date" format="YYYY-MM-DD" value-format="YYYY-MM-DD" style="width: 100%" :disabled="!!editingId" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="房态" required>
              <el-radio-group v-model="statusForm.status">
                <el-radio value="occupied">已占用</el-radio>
                <el-radio value="blocked">锁房</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="statusForm.status === 'occupied'">
            <el-form-item label="付费方式" required>
              <el-radio-group v-model="isPaid" @change="handlePaidChange">
                <el-radio :label="0">免费额度</el-radio>
                <el-radio :label="1">自费</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16" v-if="statusForm.status === 'occupied' && isPaid === 1">
          <el-col :span="12">
            <el-form-item label="金额(元)" required>
              <el-input-number v-model="statusForm.amount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16" v-if="statusForm.status === 'occupied'">
          <el-col :span="12">
            <el-form-item label="订单号">
              <el-input v-model="statusForm.order_no" placeholder="请输入订单号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客人姓名">
              <el-input v-model="statusForm.guest_name" placeholder="请输入客人姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16" v-if="statusForm.status === 'occupied'">
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="statusForm.guest_phone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="statusForm.remarks" type="textarea" :rows="2" placeholder="请输入备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusDialogVisible = false">取消</el-button>
        <el-button type="danger" v-if="editingId" @click="handleDeleteStatus">删除</el-button>
        <el-button type="primary" @click="handleSaveStatus">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchDialogVisible" title="批量调整房态" width="700px" :close-on-click-modal="false">
      <el-form :model="batchForm" label-width="100px" ref="batchFormRef">
        <el-form-item label="选择房间" required>
          <el-select
            v-model="batchForm.roomIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择要调整的房间"
            style="width: 100%">
            <el-option v-for="r in rooms" :key="r.id" :label="`${r.room_no} - ${r.room_name}`" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围" required>
          <el-date-picker
            v-model="batchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整为" required>
          <el-radio-group v-model="batchForm.targetStatus">
            <el-radio value="blocked">锁房</el-radio>
            <el-radio value="occupied-free">免费占用</el-radio>
            <el-radio value="occupied-paid">自费占用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="batchForm.targetStatus === 'occupied-paid'" label="金额(元/天)" required>
          <el-input-number v-model="batchForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-alert
          type="info"
          show-icon
          title="调整说明"
          :closable="false"
          style="margin-top: 8px;">
          <template #default>
            将所选日期范围内已存在的房态统一调整为目标状态。<br>
            <b>注意</b>：只会更新所选日期范围内<b>已经存在</b>的房态记录，不会新增不存在的房态。
          </template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBatchSubmit">确认调整</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchLogDialogVisible" title="批量操作记录" width="900px">
      <div class="batch-log-tabs">
        <div
          v-for="log in batchOperationLogs"
          :key="log.id"
          class="batch-log-item"
          :class="{ active: log.id === selectedLogId }"
          @click="selectLog(log)"
        >
          <div class="log-header">
            <el-tag :type="log.is_revert ? 'info' : 'primary'" size="small">
              {{ log.is_revert ? '撤销操作' : '批量调整' }}
            </el-tag>
            <span class="log-time">{{ formatDateTime(log.created_at) }}</span>
            <span class="log-count">影响 {{ log.affected_count }} 条</span>
          </div>
          <div class="log-target">
            <span v-if="log.is_revert" style="color:#909399;">↩️ 撤销之前的批量操作</span>
            <span v-else-if="log.target_status === 'blocked'" style="color:#909399;">🔒 锁房</span>
            <span v-else-if="log.target_is_paid === 1" style="color:#f56c6c;">💰 自费占用 ¥{{ log.target_amount }}/天</span>
            <span v-else style="color:#67c23a;">🎁 免费占用</span>
          </div>
        </div>
        <el-empty v-if="batchOperationLogs.length === 0" description="暂无批量操作记录" :image-size="80" />
      </div>

      <div v-if="selectedLog" class="batch-log-detail">
        <el-descriptions :column="2" border size="small" class="mb-16">
          <el-descriptions-item label="操作时间">
            {{ formatDateTime(selectedLog.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="操作类型">
            <el-tag :type="selectedLog.is_revert ? 'info' : 'primary'">
              {{ selectedLog.is_revert ? '撤销操作' : '批量调整' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="操作人">
            {{ selectedLog.operator === 'manual' ? '手动操作' : selectedLog.operator }}
          </el-descriptions-item>
          <el-descriptions-item label="影响记录数">
            <span style="color:#409eff;font-weight:600;">{{ selectedLog.affected_count }}</span> 条
          </el-descriptions-item>
          <el-descriptions-item label="日期范围">
            {{ selectedLog.start_date }} ~ {{ selectedLog.end_date }}
          </el-descriptions-item>
          <el-descriptions-item label="调整目标">
            <span v-if="selectedLog.is_revert" style="color:#909399;">恢复原始状态</span>
            <span v-else-if="selectedLog.target_status === 'blocked'" style="color:#909399;">🔒 锁房</span>
            <span v-else-if="selectedLog.target_is_paid === 1" style="color:#f56c6c;">💰 自费占用 ¥{{ selectedLog.target_amount }}/天</span>
            <span v-else style="color:#67c23a;">🎁 免费占用</span>
          </el-descriptions-item>
        </el-descriptions>

        <div>
          <div class="section-title mb-12">
            <span>变更明细（共 {{ currentSnapshot.length }} 条）</span>
          </div>
          <el-table :data="currentSnapshot" border stripe height="320">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="room_no" label="房间号" width="100" />
            <el-table-column prop="room_name" label="房间名称" width="140" show-overflow-tooltip />
            <el-table-column prop="date" label="日期" width="130" />
            <el-table-column label="原状态 → 新状态" width="200" align="center">
              <template #default="{ row }">
                <div class="status-transition">
                  <el-tag v-if="row.status === 'blocked'" type="info" size="small">锁房</el-tag>
                  <el-tag v-else-if="row.is_paid === 1" type="danger" size="small">自费</el-tag>
                  <el-tag v-else type="success" size="small">免费</el-tag>
                  <el-icon class="arrow-icon"><Right /></el-icon>
                  <el-tag v-if="row.new_status === 'blocked'" type="info" size="small">锁房</el-tag>
                  <el-tag v-else-if="row.new_is_paid === 1" type="danger" size="small">自费</el-tag>
                  <el-tag v-else type="success" size="small">免费</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="金额变更" width="180" align="right">
              <template #default="{ row }">
                <span v-if="row.is_paid === 1" style="color:#f56c6c;">¥{{ row.amount.toFixed(2) }}</span>
                <span v-else style="color:#c0c4cc;">-</span>
                <el-icon class="arrow-icon"><Right /></el-icon>
                <span v-if="row.new_is_paid === 1" style="color:#f56c6c;font-weight:600;">¥{{ row.new_amount.toFixed(2) }}</span>
                <span v-else style="color:#c0c4cc;">-</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div style="margin-top:16px;text-align:right;">
          <el-button
            v-if="!selectedLog.is_revert && selectedLog.id === latestNonRevertLogId"
            type="warning"
            @click="handleRevertLastBatch"
          >
            <el-icon><RefreshLeft /></el-icon>
            <span>撤销此操作</span>
          </el-button>
          <el-button type="primary" @click="batchLogDialogVisible = false">关闭</el-button>
        </div>
      </div>
      <el-empty v-else-if="batchOperationLogs.length > 0" description="请选择左侧记录查看详情" :image-size="80" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { Calendar, Plus, Grid, RefreshLeft, Document, Right } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Room, RoomStatus, RoomStatusType, BatchOperationLog, BatchOperationSnapshotItem } from '@/types'

const loading = ref(false)
const viewMode = ref<'month' | 'week'>('month')
const currentMonth = ref(dayjs().format('YYYY-MM'))

const rooms = ref<Room[]>([])
const allStatuses = ref<RoomStatus[]>([])

const statusDialogVisible = ref(false)
const editingId = ref<number | null>(null)
const statusFormRef = ref<FormInstance>()
const statusForm = reactive<Partial<RoomStatus>>({
  room_id: undefined,
  date: '',
  status: 'occupied',
  is_paid: 0,
  amount: 0,
  order_no: '',
  guest_name: '',
  guest_phone: '',
  remarks: ''
})
const isPaid = ref(0)

const batchDialogVisible = ref(false)
const batchFormRef = ref<FormInstance>()
const batchForm = reactive({
  roomIds: [] as number[],
  dateRange: [] as string[],
  targetStatus: 'blocked' as 'blocked' | 'occupied-free' | 'occupied-paid',
  amount: 100
})

const batchLogDialogVisible = ref(false)
const batchOperationLogs = ref<BatchOperationLog[]>([])
const selectedLogId = ref<number | null>(null)
const selectedLog = ref<BatchOperationLog | null>(null)
const currentSnapshot = ref<BatchOperationSnapshotItem[]>([])

const latestNonRevertLogId = computed(() => {
  const log = batchOperationLogs.value.find(l => !l.is_revert)
  return log?.id || null
})

const hasLastBatch = computed(() => {
  return batchOperationLogs.value.some(l => !l.is_revert)
})

const dialogTitle = computed(() => editingId.value ? '编辑房态' : '添加房态')

const dateList = computed(() => {
  const dates: string[] = []
  if (viewMode.value === 'month') {
    const start = dayjs(currentMonth.value).startOf('month')
    const end = dayjs(currentMonth.value).endOf('month')
    for (let d = start.clone(); d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
      dates.push(d.format('YYYY-MM-DD'))
    }
  } else {
    const now = dayjs()
    const start = now.startOf('week')
    const end = now.endOf('week')
    for (let d = start.clone(); d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
      dates.push(d.format('YYYY-MM-DD'))
    }
  }
  return dates
})

const statusMap = computed(() => {
  const map = new Map<string, RoomStatus>()
  allStatuses.value.forEach(s => {
    map.set(`${s.room_id}_${s.date}`, s)
  })
  return map
})

const occupiedCount = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  return allStatuses.value.filter(s => s.date === today && s.status === 'occupied').length
})

const availableCount = computed(() => rooms.value.length - occupiedCount.value)

const occupancyRate = computed(() => {
  if (rooms.value.length === 0 || dateList.value.length === 0) return 0
  const totalDays = rooms.value.length * dateList.value.length
  const occupiedDays = allStatuses.value.filter(s => dateList.value.includes(s.date) && s.status === 'occupied').length
  return Math.round((occupiedDays / totalDays) * 100)
})

function getStatusInfo(roomId: number, date: string): RoomStatus | undefined {
  return statusMap.value.get(`${roomId}_${date}`)
}

function getCellClass(roomId: number, date: string) {
  const info = getStatusInfo(roomId, date)
  const classes: string[] = []
  if (isToday(date)) classes.push('today')
  if (isWeekend(date)) classes.push('weekend')
  if (!info) return classes
  if (info.status === 'occupied') {
    classes.push(info.is_paid ? 'status-occupied-paid' : 'status-occupied-free')
  } else if (info.status === 'blocked') {
    classes.push('status-blocked')
  }
  return classes
}

function getCellStyle(_roomId: number, _date: string) {
  return {}
}

function getDay(date: string) {
  return dayjs(date).format('DD')
}

function getWeekday(date: string) {
  const weeks = ['日', '一', '二', '三', '四', '五', '六']
  return weeks[dayjs(date).day()]
}

function isToday(date: string) {
  return dayjs(date).isSame(dayjs(), 'day')
}

function isWeekend(date: string) {
  const d = dayjs(date).day()
  return d === 0 || d === 6
}

async function loadData() {
  loading.value = true
  try {
    const start = dateList.value[0]
    const end = dateList.value[dateList.value.length - 1]
    const data = await window.dbApi.getDateRangeStatuses(start, end)
    rooms.value = data.rooms
    allStatuses.value = data.statuses
  } finally {
    loading.value = false
  }
}

function handleCellClick(room: Room, date: string) {
  const existing = getStatusInfo(room.id, date)
  if (existing) {
    editingId.value = existing.id
    Object.assign(statusForm, {
      room_id: existing.room_id,
      date: existing.date,
      status: existing.status,
      is_paid: existing.is_paid,
      amount: existing.amount,
      order_no: existing.order_no,
      guest_name: existing.guest_name,
      guest_phone: existing.guest_phone,
      remarks: existing.remarks
    })
    isPaid.value = existing.is_paid
  } else {
    editingId.value = null
    Object.assign(statusForm, {
      room_id: room.id,
      date: date,
      status: 'occupied',
      is_paid: 0,
      amount: room.base_price || 100,
      order_no: '',
      guest_name: '',
      guest_phone: '',
      remarks: ''
    })
    isPaid.value = 0
  }
  statusDialogVisible.value = true
}

function openStatusDialog() {
  editingId.value = null
  const today = dayjs().format('YYYY-MM-DD')
  Object.assign(statusForm, {
    room_id: rooms.value[0]?.id,
    date: today,
    status: 'occupied' as RoomStatusType,
    is_paid: 0,
    amount: rooms.value[0]?.base_price || 100,
    order_no: '',
    guest_name: '',
    guest_phone: '',
    remarks: ''
  })
  isPaid.value = 0
  statusDialogVisible.value = true
}

function handlePaidChange(val: number) {
  statusForm.is_paid = val
  if (val === 0) {
    statusForm.amount = 0
  } else {
    const room = rooms.value.find(r => r.id === statusForm.room_id)
    statusForm.amount = room?.base_price || 100
  }
}

async function handleSaveStatus() {
  if (!statusForm.room_id || !statusForm.date) {
    ElMessage.warning('请选择房间和日期')
    return
  }

  try {
    if (editingId.value) {
      await window.dbApi.updateRoomStatus({
        ...statusForm,
        id: editingId.value,
        is_paid: isPaid.value,
        amount: isPaid.value ? statusForm.amount : 0
      } as any)
      ElMessage.success('更新成功')
    } else {
      await window.dbApi.addRoomStatus({
        ...statusForm,
        is_paid: isPaid.value,
        amount: isPaid.value ? statusForm.amount : 0
      })
      ElMessage.success('添加成功')
    }
    statusDialogVisible.value = false
    await loadData()
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function handleDeleteStatus() {
  if (!editingId.value) return
  try {
    await ElMessageBox.confirm('确认删除该房态记录吗？', '删除确认', { type: 'warning' })
    await window.dbApi.deleteRoomStatus(editingId.value)
    ElMessage.success('删除成功')
    statusDialogVisible.value = false
    await loadData()
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e) {
    // 用户取消
  }
}

function openBatchDialog() {
  batchForm.roomIds = []
  batchForm.dateRange = [
    dayjs().format('YYYY-MM-DD'),
    dayjs().add(7, 'day').format('YYYY-MM-DD')
  ]
  batchForm.targetStatus = 'blocked'
  batchForm.amount = 100
  batchDialogVisible.value = true
}

async function handleBatchSubmit() {
  if (!batchForm.roomIds || batchForm.roomIds.length === 0) {
    ElMessage.warning('请选择要调整的房间')
    return
  }
  if (!batchForm.dateRange || batchForm.dateRange.length !== 2) {
    ElMessage.warning('请选择日期范围')
    return
  }
  if (batchForm.targetStatus === 'occupied-paid' && (!batchForm.amount || batchForm.amount <= 0)) {
    ElMessage.warning('请输入自费金额')
    return
  }

  let status: RoomStatusType = 'blocked'
  let is_paid = 0
  let amount = 0

  if (batchForm.targetStatus === 'occupied-free') {
    status = 'occupied'
    is_paid = 0
    amount = 0
  } else if (batchForm.targetStatus === 'occupied-paid') {
    status = 'occupied'
    is_paid = 1
    amount = batchForm.amount
  }

  try {
    const result = await window.dbApi.batchUpdateRoomStatuses({
      roomIds: batchForm.roomIds,
      startDate: batchForm.dateRange[0],
      endDate: batchForm.dateRange[1],
      status,
      is_paid,
      amount
    })

    ElMessage.success(`批量调整完成，共更新 ${result.updated} 条记录`)
    batchDialogVisible.value = false
    await loadData()
    await loadBatchOperationLogs()
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e: any) {
    ElMessage.error(e.message || '批量调整失败')
  }
}

async function loadBatchOperationLogs() {
  try {
    batchOperationLogs.value = await window.dbApi.getBatchOperationLogs()
    if (batchOperationLogs.value.length > 0 && !selectedLogId.value) {
      selectLog(batchOperationLogs.value[0])
    }
  } catch (e) {
    batchOperationLogs.value = []
  }
}

function selectLog(log: BatchOperationLog) {
  selectedLogId.value = log.id
  selectedLog.value = log
  if (log.snapshot) {
    currentSnapshot.value = JSON.parse(log.snapshot)
  } else {
    currentSnapshot.value = []
  }
}

async function openBatchLogDialog() {
  await loadBatchOperationLogs()
  selectedLogId.value = null
  selectedLog.value = null
  currentSnapshot.value = []
  batchLogDialogVisible.value = true
}

async function handleRevertLastBatch() {
  if (!latestNonRevertLogId.value) {
    ElMessage.warning('没有可撤销的批量操作')
    return
  }

  const latestLog = batchOperationLogs.value.find(l => l.id === latestNonRevertLogId.value)
  if (!latestLog) {
    ElMessage.warning('没有可撤销的批量操作')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认要撤销 ${formatDateTime(latestLog.created_at)} 的批量操作吗？\n共 ${latestLog.affected_count} 条记录将恢复到调整前的状态。`,
      '撤销确认',
      { type: 'warning', confirmButtonText: '确认撤销', cancelButtonText: '取消' }
    )

    const result = await window.dbApi.revertLastBatchOperation()
    if (result.success) {
      ElMessage.success(`撤销成功，共恢复 ${result.reverted} 条记录`)
      batchLogDialogVisible.value = false
      await loadData()
      await loadBatchOperationLogs()
      window.dispatchEvent(new CustomEvent('quota-updated'))
    } else {
      ElMessage.error(result.message || '撤销失败')
    }
  } catch (e) {
    // 用户取消
  }
}

function formatDateTime(dt: string) {
  if (!dt) return '-'
  return dayjs(dt).format('YYYY-MM-DD HH:mm:ss')
}

watch(viewMode, loadData)

onMounted(async () => {
  await loadData()
  await loadBatchOperationLogs()
})
</script>

<style lang="scss" scoped>
.schedule-view {
  min-height: 100%;
}

.stats-bar {
  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .stat-label {
    color: #909399;
    font-size: 14px;
  }
  .stat-value {
    font-size: 28px;
    font-weight: 600;
    &.primary { color: #409eff; }
    &.danger { color: #f56c6c; }
    &.success { color: #67c23a; }
    &.warning { color: #e6a23c; }
  }
}

.legend-bar {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.legend-dot {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  &.available { background: #f0f9eb; border: 1px solid #e1f3d8; }
  &.occupied-free { background: #fef0f0; border: 1px solid #fde2e2; }
  &.occupied-paid { background: #ecf5ff; border: 1px solid #d9ecff; }
  &.blocked { background: #fdf6ec; border: 1px solid #faecd8; }
  &.cleaning { background: #f4f4f5; border: 1px solid #e9e9eb; }
}

.schedule-grid-wrapper {
  background: #fff;
  border-radius: 8px;
  overflow: auto;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.schedule-grid {
  min-width: max-content;
}

.grid-header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.header-cell {
  padding: 12px 8px;
  text-align: center;
  border-right: 1px solid #ebeef5;
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}

.header-cell.room-col {
  width: 120px;
  min-width: 120px;
  position: sticky;
  left: 0;
  z-index: 11;
  background: #fafafa;
}

.header-cell.date-col {
  width: 110px;
  min-width: 110px;
  .date-day { font-size: 18px; font-weight: 600; color: #303133; }
  .date-week { font-size: 12px; color: #909399; margin-top: 2px; }
}

.header-cell.today {
  background: #ecf5ff;
  .date-day { color: #409eff; }
}

.header-cell.weekend {
  .date-day, .date-week { color: #f56c6c; }
}

.grid-body {
  display: flex;
  flex-direction: column;
}

.grid-row {
  display: flex;
  border-bottom: 1px solid #ebeef5;
  &:last-child { border-bottom: none; }
}

.grid-row:hover .row-cell.date-col {
  background-color: #f5f7fa;
}

.row-cell {
  padding: 0;
  border-right: 1px solid #ebeef5;
  min-height: 80px;
  cursor: pointer;
  transition: background-color 0.15s;
  position: relative;
}

.row-cell.room-col {
  width: 120px;
  min-width: 120px;
  position: sticky;
  left: 0;
  z-index: 5;
  background: #fff;
  border-right: 1px solid #ebeef5;
  cursor: default;
  display: flex;
  align-items: center;
  padding: 8px 12px;
}

.row-cell.date-col {
  width: 110px;
  min-width: 110px;
}

.grid-row:hover .row-cell.date-col.today {
  background-color: #d9ecff;
}

.room-info {
  .room-no {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
  }
  .room-name {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}

.cell-content {
  padding: 6px 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  .guest-name {
    font-size: 11px;
    color: #606266;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }
}

.cell-empty {
  height: 100%;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.row-cell:hover .cell-empty {
  opacity: 1;
}

.row-cell.status-occupied-free {
  background-color: #fef0f0;
  &:hover { background-color: #fde2e2 !important; }
}

.row-cell.status-occupied-paid {
  background-color: #ecf5ff;
  &:hover { background-color: #d9ecff !important; }
}

.row-cell.status-blocked {
  background-color: #fdf6ec;
  &:hover { background-color: #faecd8 !important; }
}

.row-cell.today {
  outline: 2px solid #409eff;
  outline-offset: -2px;
}

.row-cell.weekend {
  background-color: rgba(245, 108, 108, 0.03);
}

.batch-log-tabs {
  display: flex;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
  margin-bottom: 16px;
  border-bottom: 1px dashed #ebeef5;
  padding-bottom: 16px;
}

.batch-log-item {
  flex: 1;
  min-width: 180px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
    background: #f5f7fa;
  }

  &.active {
    border-color: #409eff;
    background: #ecf5ff;
  }
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.log-time {
  flex: 1;
  font-size: 12px;
  color: #606266;
}

.log-count {
  font-size: 12px;
  color: #409eff;
  font-weight: 600;
}

.log-target {
  font-size: 13px;
  color: #303133;
}

.status-transition {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.arrow-icon {
  color: #909399;
  font-size: 14px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
</style>
