<template>
  <div class="page-container cycle-view">
    <div class="page-header">
      <div class="page-title">
        <el-icon :size="22" color="#409eff"><Refresh /></el-icon>
        <span style="margin-left:8px;">周期生成</span>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="房间管理" name="rooms">
        <div class="tab-content">
          <div class="toolbar mb-20">
            <el-button type="primary" @click="openRoomDialog()">
              <el-icon><Plus /></el-icon>
              <span>新建房间</span>
            </el-button>
          </div>

          <el-table :data="rooms" border stripe v-loading="loadingRooms">
            <el-table-column prop="room_no" label="房间号" width="100" />
            <el-table-column prop="room_name" label="房间名称" width="160" />
            <el-table-column prop="room_type" label="房型" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.room_type" size="small">{{ row.room_type }}</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="floor" label="楼层" width="80">
              <template #default="{ row }">{{ row.floor || '-' }}F</template>
            </el-table-column>
            <el-table-column prop="area" label="面积(㎡)" width="100">
              <template #default="{ row }">{{ row.area || '-' }}</template>
            </el-table-column>
            <el-table-column prop="base_price" label="基础价格(元/天)" width="140">
              <template #default="{ row }">
                <span style="color:#f56c6c;font-weight:600;">¥{{ row.base_price || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'active'" type="success" size="small">启用</el-tag>
                <el-tag v-else type="info" size="small">停用</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remarks" label="备注" show-overflow-tooltip />
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openRoomDialog(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteRoom(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="周期规则" name="rules">
        <div class="tab-content">
          <div class="toolbar mb-20">
            <el-button type="primary" @click="openRuleDialog()">
              <el-icon><Plus /></el-icon>
              <span>新建周期规则</span>
            </el-button>
          </div>

          <el-table :data="cycleRules" border stripe v-loading="loadingRules">
            <el-table-column prop="name" label="规则名称" width="180" />
            <el-table-column label="适用房间" min-width="200">
              <template #default="{ row }">
                <div class="room-tags">
                  <el-tag v-for="rid in parseRoomIds(row.room_ids)" :key="rid" size="small" style="margin:2px;">
                    {{ getRoomNo(rid) }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="挂房周期" width="200">
              <template #default="{ row }">
                <div>{{ formatWeekdays(row.weekdays) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="有效日期" width="220">
              <template #default="{ row }">
                <span style="font-size:12px;">{{ row.start_date }} ~ {{ row.end_date }}</span>
              </template>
            </el-table-column>
            <el-table-column label="入住/退房" width="160">
              <template #default="{ row }">
                <span style="font-size:12px;">
                  {{ row.check_in_time }} / {{ row.check_out_time }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'active'" type="success" size="small">启用</el-tag>
                <el-tag v-else type="info" size="small">停用</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="handleExecuteRule(row)">
                  <el-icon><VideoPlay /></el-icon>
                  执行生成
                </el-button>
                <el-button link type="primary" size="small" @click="openRuleDialog(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteRule(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="roomDialogVisible" :title="editingRoomId ? '编辑房间' : '新建房间'" width="560px">
      <el-form :model="roomForm" label-width="100px" ref="roomFormRef">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="房间号" required>
              <el-input v-model="roomForm.room_no" placeholder="请输入房间号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房间名称" required>
              <el-input v-model="roomForm.room_name" placeholder="请输入房间名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="房型">
              <el-select v-model="roomForm.room_type" placeholder="请选择房型" style="width: 100%;">
                <el-option label="单人间" value="单人间" />
                <el-option label="标准间" value="标准间" />
                <el-option label="大床房" value="大床房" />
                <el-option label="双床房" value="双床房" />
                <el-option label="套房" value="套房" />
                <el-option label="家庭房" value="家庭房" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="楼层">
              <el-input-number v-model="roomForm.floor" :min="0" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="面积(㎡)">
              <el-input-number v-model="roomForm.area" :min="0" :precision="1" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="基础价格(元)">
              <el-input-number v-model="roomForm.base_price" :min="0" :precision="2" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="roomForm.status">
                <el-radio value="active">启用</el-radio>
                <el-radio value="inactive">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="roomForm.remarks" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roomDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRoom">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="ruleDialogVisible" :title="editingRuleId ? '编辑周期规则' : '新建周期规则'" width="680px">
      <el-form :model="ruleForm" label-width="110px" ref="ruleFormRef">
        <el-form-item label="规则名称" required>
          <el-input v-model="ruleForm.name" placeholder="例如：每周五六日挂房" />
        </el-form-item>
        <el-form-item label="适用房间" required>
          <el-select
            v-model="ruleForm.room_ids"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择适用房间"
            style="width: 100%;"
          >
            <el-option
              v-for="r in activeRooms"
              :key="r.id"
              :label="`${r.room_no} - ${r.room_name}`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="挂房周几" required>
          <el-checkbox-group v-model="ruleForm.weekdays">
            <el-checkbox :value="0">周日</el-checkbox>
            <el-checkbox :value="1">周一</el-checkbox>
            <el-checkbox :value="2">周二</el-checkbox>
            <el-checkbox :value="3">周三</el-checkbox>
            <el-checkbox :value="4">周四</el-checkbox>
            <el-checkbox :value="5">周五</el-checkbox>
            <el-checkbox :value="6">周六</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="起始日期" required>
              <el-date-picker
                v-model="ruleForm.start_date"
                type="date"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期" required>
              <el-date-picker
                v-model="ruleForm.end_date"
                type="date"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="入住时间">
              <el-time-picker
                v-model="ruleForm.check_in_time"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="退房时间">
              <el-time-picker
                v-model="ruleForm.check_out_time"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-radio-group v-model="ruleForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="ruleForm.remarks" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="generateResultVisible" title="批量生成结果" width="520px">
      <div v-if="generateResult" class="generate-result">
        <el-result icon="success" :title="`批量生成完成`" :sub-title="`共处理 ${generateResult.count} 条房态记录`">
          <template #extra>
            <div class="result-stats">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="总生成数量">
                  <span style="font-size:18px;font-weight:600;color:#409eff;">{{ generateResult.count }}</span> 条
                </el-descriptions-item>
                <el-descriptions-item label="使用免费额度">
                  <span style="font-weight:600;color:#67c23a;">{{ generateResult.count - (generateResult.quotaOverflow || 0) }}</span> 条
                </el-descriptions-item>
                <el-descriptions-item label="额度不足转自费">
                  <span style="font-weight:600;color:#f56c6c;">{{ generateResult.quotaOverflow || 0 }}</span> 条
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <el-button type="primary" style="margin-top:16px;" @click="generateResultVisible = false">
              确定
            </el-button>
          </template>
        </el-result>
        <el-collapse v-if="generateResult.quotaOverflow > 0" style="margin-top:16px;">
          <el-collapse-item title="查看转自费明细" name="1">
            <el-table :data="generateResult.quotaOverflowDetails" size="small" border>
              <el-table-column prop="room" label="房间" width="100" />
              <el-table-column prop="date" label="日期" />
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import dayjs from 'dayjs'
import type { Room, CycleRule } from '@/types'

const activeTab = ref('rooms')

const loadingRooms = ref(false)
const loadingRules = ref(false)
const rooms = ref<Room[]>([])
const cycleRules = ref<CycleRule[]>([])

const activeRooms = computed(() => rooms.value.filter(r => r.status === 'active'))

const roomDialogVisible = ref(false)
const editingRoomId = ref<number | null>(null)
const roomFormRef = ref<FormInstance>()
const roomForm = reactive<Partial<Room>>({
  room_no: '',
  room_name: '',
  room_type: '',
  floor: undefined,
  area: undefined,
  base_price: undefined,
  status: 'active',
  remarks: ''
})

const ruleDialogVisible = ref(false)
const editingRuleId = ref<number | null>(null)
const ruleFormRef = ref<FormInstance>()
const ruleForm = reactive<Partial<CycleRule> & { weekdays: number[]; room_ids: number[] }>({
  name: '',
  room_ids: [],
  weekdays: [],
  start_date: '',
  end_date: '',
  check_in_time: '14:00',
  check_out_time: '12:00',
  status: 'active',
  remarks: ''
})

const generateResultVisible = ref(false)
const generateResult = ref<{ count: number; quotaOverflow: number; quotaOverflowDetails: any[] } | null>(null)

function parseRoomIds(val: any): number[] {
  if (Array.isArray(val)) return val
  try {
    return JSON.parse(val as string)
  } catch {
    return []
  }
}

function parseWeekdays(val: any): number[] {
  if (Array.isArray(val)) return val
  try {
    return JSON.parse(val as string)
  } catch {
    return []
  }
}

function getRoomNo(id: number): string {
  return rooms.value.find(r => r.id === id)?.room_no || `#${id}`
}

function formatWeekdays(val: any): string {
  const arr = parseWeekdays(val)
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return arr.map(i => weekMap[i]).join('、') || '-'
}

async function loadRooms() {
  loadingRooms.value = true
  try {
    rooms.value = await window.dbApi.getRooms()
  } finally {
    loadingRooms.value = false
  }
}

async function loadCycleRules() {
  loadingRules.value = true
  try {
    cycleRules.value = await window.dbApi.getCycleRules()
  } finally {
    loadingRules.value = false
  }
}

function openRoomDialog(row?: Room) {
  if (row) {
    editingRoomId.value = row.id
    Object.assign(roomForm, { ...row })
  } else {
    editingRoomId.value = null
    Object.assign(roomForm, {
      room_no: '',
      room_name: '',
      room_type: '',
      floor: undefined,
      area: undefined,
      base_price: undefined,
      status: 'active',
      remarks: ''
    })
  }
  roomDialogVisible.value = true
}

async function handleSaveRoom() {
  if (!roomForm.room_no || !roomForm.room_name) {
    ElMessage.warning('请填写房间号和房间名称')
    return
  }
  try {
    if (editingRoomId.value) {
      await window.dbApi.updateRoom(roomForm as Room)
      ElMessage.success('房间更新成功')
    } else {
      await window.dbApi.addRoom(roomForm)
      ElMessage.success('房间创建成功')
    }
    roomDialogVisible.value = false
    await loadRooms()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function handleDeleteRoom(row: Room) {
  try {
    await ElMessageBox.confirm(`确认删除房间「${row.room_no} ${row.room_name}」吗？`, '删除确认', { type: 'warning' })
    await window.dbApi.deleteRoom(row.id)
    ElMessage.success('删除成功')
    await loadRooms()
  } catch (e) {
    // 用户取消
  }
}

function openRuleDialog(row?: CycleRule) {
  if (row) {
    editingRuleId.value = row.id
    Object.assign(ruleForm, {
      ...row,
      room_ids: parseRoomIds(row.room_ids),
      weekdays: parseWeekdays(row.weekdays)
    })
  } else {
    editingRuleId.value = null
    Object.assign(ruleForm, {
      name: '',
      room_ids: [],
      weekdays: [],
      start_date: dayjs().format('YYYY-MM-DD'),
      end_date: dayjs().add(2, 'month').format('YYYY-MM-DD'),
      check_in_time: '14:00',
      check_out_time: '12:00',
      status: 'active',
      remarks: ''
    })
  }
  ruleDialogVisible.value = true
}

async function handleSaveRule() {
  if (!ruleForm.name) {
    ElMessage.warning('请填写规则名称')
    return
  }
  if (!ruleForm.room_ids || ruleForm.room_ids.length === 0) {
    ElMessage.warning('请选择适用房间')
    return
  }
  if (!ruleForm.weekdays || ruleForm.weekdays.length === 0) {
    ElMessage.warning('请选择挂房周期')
    return
  }
  if (!ruleForm.start_date || !ruleForm.end_date) {
    ElMessage.warning('请选择有效日期范围')
    return
  }
  try {
    const toSave = {
      ...ruleForm,
      room_ids: ruleForm.room_ids,
      weekdays: ruleForm.weekdays
    }
    if (editingRuleId.value) {
      await window.dbApi.updateCycleRule(toSave as CycleRule)
      ElMessage.success('规则更新成功')
    } else {
      await window.dbApi.addCycleRule(toSave)
      ElMessage.success('规则创建成功')
    }
    ruleDialogVisible.value = false
    await loadCycleRules()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function handleDeleteRule(row: CycleRule) {
  try {
    await ElMessageBox.confirm(`确认删除规则「${row.name}」吗？`, '删除确认', { type: 'warning' })
    await window.dbApi.deleteCycleRule(row.id)
    ElMessage.success('删除成功')
    await loadCycleRules()
  } catch (e) {
    // 用户取消
  }
}

async function handleExecuteRule(row: CycleRule) {
  try {
    const weekdays = parseWeekdays(row.weekdays)
    const weekdaysStr = formatWeekdays(row.weekdays)
    const roomIds = parseRoomIds(row.room_ids)

    await ElMessageBox.confirm(
      `即将按规则批量生成房态：\n\n` +
      `• 规则名称：${row.name}\n` +
      `• 适用房间：${roomIds.length}间\n` +
      `• 挂房周期：${weekdaysStr}\n` +
      `• 日期范围：${row.start_date} ~ ${row.end_date}\n\n` +
      `额度不足时将自动转为付费挂房。是否继续？`,
      '执行生成确认',
      { type: 'info', confirmButtonText: '确认生成', cancelButtonText: '取消' }
    )

    const result = await window.dbApi.batchGenerateRoomStatuses({
      ruleId: row.id,
      roomIds,
      weekdays,
      startDate: row.start_date,
      endDate: row.end_date
    })

    generateResult.value = result
    generateResultVisible.value = true
    window.dispatchEvent(new CustomEvent('quota-updated'))
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.message || '生成失败')
    }
  }
}

onMounted(async () => {
  await loadRooms()
  await loadCycleRules()
})
</script>

<style lang="scss" scoped>
.cycle-view {
  min-height: 100%;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.room-tags {
  display: flex;
  flex-wrap: wrap;
}

.generate-result {
  padding: 12px 0;
  .result-stats {
    max-width: 360px;
    margin: 0 auto;
  }
}
</style>
