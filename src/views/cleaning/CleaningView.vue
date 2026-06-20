<template>
  <div class="page-container cleaning-view">
    <div class="page-header">
      <div class="page-title">
        <el-icon :size="22" color="#409eff"><Brush /></el-icon>
        <span style="margin-left:8px;">保洁排程</span>
      </div>
      <div class="header-actions">
        <el-button @click="openConfigDialog">
          <el-icon><Setting /></el-icon>
          <span>保洁配置</span>
        </el-button>
        <el-button type="success" @click="handleAutoGenerate">
          <el-icon><MagicStick /></el-icon>
          <span>自动生成任务</span>
        </el-button>
        <el-button type="primary" @click="openTaskDialog()">
          <el-icon><Plus /></el-icon>
          <span>新建任务</span>
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mb-20">
      <el-col :span="6">
        <div class="stat-card pending-card">
          <div class="stat-num">{{ taskStats.pending }}</div>
          <div class="stat-label">待处理</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card progress-card">
          <div class="stat-num">{{ taskStats.in_progress }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card done-card">
          <div class="stat-num">{{ taskStats.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card cancel-card">
          <div class="stat-num">{{ taskStats.cancelled }}</div>
          <div class="stat-label">已取消</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="8">
        <div class="stat-card">
          <div style="font-size:16px;font-weight:600;margin-bottom:16px;">当前配置</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="保洁时长">
              <el-tag type="primary" size="small">{{ cleaningConfig?.cleaning_hours || 4 }} 小时</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="缓冲时间">
              <el-tag type="warning" size="small">{{ cleaningConfig?.buffer_hours || 2 }} 小时</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="自动分配">
              <el-tag v-if="cleaningConfig?.auto_assign" type="success" size="small">已启用</el-tag>
              <el-tag v-else type="info" size="small">已关闭</el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div style="margin-top:20px;padding:12px;background:#f5f7fa;border-radius:6px;">
            <div style="font-size:13px;color:#606266;margin-bottom:8px;">💡 任务生成规则</div>
            <div style="font-size:12px;color:#909399;line-height:1.8;">
              退房时间 12:00 + 缓冲 {{ cleaningConfig?.buffer_hours || 2 }}h<br>
              → 保洁开始 14:00<br>
              保洁时长 {{ cleaningConfig?.cleaning_hours || 4 }}h<br>
              → 保洁完成 18:00
            </div>
          </div>
        </div>

        <div class="stat-card mt-20">
          <div style="font-size:16px;font-weight:600;margin-bottom:12px;">快捷日期导航</div>
          <div class="date-nav">
            <button
              v-for="item in dateNavList"
              :key="item.date"
              class="date-nav-btn"
              :class="{ active: filterDate === item.date }"
              @click="handleFilterDate(item.date)"
            >
              <div class="nav-label">{{ item.label }}</div>
              <div class="nav-date">{{ item.date.slice(-2) }}日</div>
              <div v-if="item.count > 0" class="nav-badge">{{ item.count }}</div>
            </button>
          </div>
        </div>
      </el-col>

      <el-col :span="16">
        <div class="stat-card">
          <div class="flex-between mb-10">
            <div style="font-size:16px;font-weight:600;">
              保洁任务列表
              <el-tag v-if="filterDate" type="info" size="small" style="margin-left:8px;">
                {{ filterDate }}
                <el-icon style="margin-left:4px;cursor:pointer;" @click="filterDate = ''; loadTasks();">
                  <Close />
                </el-icon>
              </el-tag>
            </div>
            <div class="filter-group">
              <el-select v-model="filterStatus" placeholder="任务状态" clearable size="small" style="width:130px;" @change="loadTasks">
                <el-option label="待处理" value="pending" />
                <el-option label="进行中" value="in_progress" />
                <el-option label="已完成" value="completed" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
              <el-date-picker
                v-model="filterRange"
                type="daterange"
                size="small"
                range-separator="~"
                start-placeholder="开始"
                end-placeholder="结束"
                format="MM-DD"
                value-format="YYYY-MM-DD"
                style="width:220px;margin-left:10px;"
                @change="loadTasks"
              />
            </div>
          </div>

          <el-table :data="tasks" border stripe v-loading="loading" height="560">
            <el-table-column type="index" label="序号" width="60" align="center" fixed="left" />
            <el-table-column label="房间" width="140">
              <template #default="{ row }">
                <div style="display:flex;flex-direction:column;">
                  <span style="font-weight:600;color:#303133;">{{ row.room_no }}</span>
                  <span style="font-size:12px;color:#909399;">{{ row.room_name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="task_date" label="保洁日期" width="120" sortable>
              <template #default="{ row }">
                <el-tag size="small" :type="isToday(row.task_date) ? 'danger' : ''">
                  {{ row.task_date }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="时间段" width="140">
              <template #default="{ row }">
                <div style="text-align:center;">
                  <span style="font-weight:500;">{{ row.start_time }}</span>
                  <span style="color:#c0c4cc;margin:0 4px;">→</span>
                  <span style="font-weight:500;">{{ row.end_time }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="statusTagMap[row.status]?.type" effect="light" size="small" round>
                  {{ statusTagMap[row.status]?.label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="cleaner" label="保洁员" width="110">
              <template #default="{ row }">
                <span v-if="row.cleaner">{{ row.cleaner }}</span>
                <span v-else style="color:#c0c4cc;">未分配</span>
              </template>
            </el-table-column>
            <el-table-column prop="remarks" label="备注" show-overflow-tooltip />
            <el-table-column label="操作" width="180" fixed="right" align="center">
              <template #default="{ row }">
                <el-dropdown trigger="click" @command="(cmd:any) => handleTaskAction(cmd, row)">
                  <el-button type="primary" link size="small">
                    操作 <el-icon><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-if="row.status === 'pending'" command="start">
                        <el-icon><VideoPlay /></el-icon>开始保洁
                      </el-dropdown-item>
                      <el-dropdown-item v-if="row.status === 'in_progress'" command="complete">
                        <el-icon><CircleCheck /></el-icon>标记完成
                      </el-dropdown-item>
                      <el-dropdown-item v-if="row.status !== 'completed' && row.status !== 'cancelled'" command="edit">
                        <el-icon><Edit /></el-icon>编辑
                      </el-dropdown-item>
                      <el-dropdown-item v-if="row.status !== 'completed' && row.status !== 'cancelled'" command="cancel" divided>
                        <el-icon><Close /></el-icon>取消任务
                      </el-dropdown-item>
                      <el-dropdown-item v-if="row.status === 'cancelled' || row.status === 'completed'" command="delete" divided>
                        <el-icon><Delete /></el-icon>删除记录
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-dialog v-model="configDialogVisible" title="保洁配置" width="480px">
      <el-form :model="configForm" label-width="120px" ref="configFormRef">
        <el-form-item label="保洁时长(小时)" required>
          <el-input-number v-model="configForm.cleaning_hours" :min="1" :max="24" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="缓冲时间(小时)" required>
          <el-input-number v-model="configForm.buffer_hours" :min="0" :max="12" style="width: 100%;" />
          <div style="font-size:12px;color:#909399;margin-top:4px;">
            退房后多久开始保洁
          </div>
        </el-form-item>
        <el-form-item label="自动分配任务">
          <el-switch v-model="configForm.auto_assign" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveConfig">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="taskDialogVisible" :title="editingTaskId ? '编辑保洁任务' : '新建保洁任务'" width="560px">
      <el-form :model="taskForm" label-width="100px" ref="taskFormRef">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="房间" required>
              <el-select v-model="taskForm.room_id" placeholder="请选择房间" style="width:100%;">
                <el-option v-for="r in rooms" :key="r.id" :label="`${r.room_no} - ${r.room_name}`" :value="r.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="保洁日期" required>
              <el-date-picker
                v-model="taskForm.task_date"
                type="date"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width:100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间" required>
              <el-time-picker
                v-model="taskForm.start_time"
                format="HH:mm"
                value-format="HH:mm"
                style="width:100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" required>
              <el-time-picker
                v-model="taskForm.end_time"
                format="HH:mm"
                value-format="HH:mm"
                style="width:100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="状态" required>
              <el-select v-model="taskForm.status" style="width:100%;">
                <el-option label="待处理" value="pending" />
                <el-option label="进行中" value="in_progress" />
                <el-option label="已完成" value="completed" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="保洁员">
              <el-input v-model="taskForm.cleaner" placeholder="请输入保洁员姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="taskForm.remarks" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveTask">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import dayjs from 'dayjs'
import type { CleaningTask, CleaningConfig, Room, CleaningStatus } from '@/types'

const loading = ref(false)
const rooms = ref<Room[]>([])
const tasks = ref<CleaningTask[]>([])
const cleaningConfig = ref<CleaningConfig | null>(null)

const filterStatus = ref('')
const filterRange = ref<string[]>([])
const filterDate = ref('')

const statusTagMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待处理', type: 'warning' },
  in_progress: { label: '进行中', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' }
}

const taskStats = computed(() => {
  const stats = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 }
  tasks.value.forEach(t => {
    if (stats[t.status as keyof typeof stats] !== undefined) {
      stats[t.status as keyof typeof stats]++
    }
  })
  return stats
})

const dateNavList = computed(() => {
  const result = []
  const weekMap = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 0; i < 7; i++) {
    const d = dayjs().add(i, 'day')
    const dateStr = d.format('YYYY-MM-DD')
    const count = tasks.value.filter(t => t.task_date === dateStr).length
    let label = '周' + weekMap[d.day()]
    if (i === 0) label = '今天'
    if (i === 1) label = '明天'
    result.push({ date: dateStr, label, count })
  }
  return result
})

const configDialogVisible = ref(false)
const configFormRef = ref<FormInstance>()
const configForm = reactive<Partial<CleaningConfig>>({
  cleaning_hours: 4,
  buffer_hours: 2,
  auto_assign: 1
})

const taskDialogVisible = ref(false)
const editingTaskId = ref<number | null>(null)
const taskFormRef = ref<FormInstance>()
const taskForm = reactive<Partial<CleaningTask>>({
  room_id: undefined,
  task_date: '',
  start_time: '',
  end_time: '',
  status: 'pending',
  cleaner: '',
  remarks: ''
})

function isToday(date: string) {
  return dayjs(date).isSame(dayjs(), 'day')
}

function handleFilterDate(date: string) {
  filterDate.value = date
  loadTasks()
}

async function loadRooms() {
  rooms.value = await window.dbApi.getRooms()
}

async function loadCleaningConfig() {
  cleaningConfig.value = await window.dbApi.getCleaningConfig()
}

async function loadTasks() {
  loading.value = true
  try {
    const params: any = {}
    if (filterStatus.value) {
      params.status = filterStatus.value
    }
    if (filterRange.value.length === 2) {
      params.startDate = filterRange.value[0]
      params.endDate = filterRange.value[1]
    } else if (filterDate.value) {
      params.startDate = filterDate.value
      params.endDate = filterDate.value
    } else {
      params.startDate = dayjs().format('YYYY-MM-DD')
      params.endDate = dayjs().add(14, 'day').format('YYYY-MM-DD')
    }
    tasks.value = await window.dbApi.getCleaningTasks(params)
  } finally {
    loading.value = false
  }
}

function openConfigDialog() {
  if (cleaningConfig.value) {
    Object.assign(configForm, {
      cleaning_hours: cleaningConfig.value.cleaning_hours,
      buffer_hours: cleaningConfig.value.buffer_hours,
      auto_assign: cleaningConfig.value.auto_assign
    })
  }
  configDialogVisible.value = true
}

async function handleSaveConfig() {
  try {
    await window.dbApi.updateCleaningConfig(configForm)
    ElMessage.success('配置保存成功')
    configDialogVisible.value = false
    await loadCleaningConfig()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

function openTaskDialog(row?: CleaningTask) {
  if (row) {
    editingTaskId.value = row.id
    Object.assign(taskForm, {
      room_id: row.room_id,
      task_date: row.task_date,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      cleaner: row.cleaner,
      remarks: row.remarks
    })
  } else {
    editingTaskId.value = null
    Object.assign(taskForm, {
      room_id: rooms.value[0]?.id,
      task_date: dayjs().format('YYYY-MM-DD'),
      start_time: '14:00',
      end_time: '18:00',
      status: 'pending' as CleaningStatus,
      cleaner: '',
      remarks: ''
    })
  }
  taskDialogVisible.value = true
}

async function handleSaveTask() {
  if (!taskForm.room_id || !taskForm.task_date || !taskForm.start_time || !taskForm.end_time) {
    ElMessage.warning('请填写必要信息')
    return
  }
  try {
    if (editingTaskId.value) {
      await window.dbApi.updateCleaningTask({ ...taskForm, id: editingTaskId.value } as CleaningTask)
      ElMessage.success('更新成功')
    } else {
      await window.dbApi.addCleaningTask(taskForm)
      ElMessage.success('创建成功')
    }
    taskDialogVisible.value = false
    await loadTasks()
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function handleAutoGenerate() {
  try {
    await ElMessageBox.confirm(
      `将根据房态记录自动生成未来14天的保洁任务，是否继续？`,
      '自动生成任务',
      { type: 'info', confirmButtonText: '确认生成', cancelButtonText: '取消' }
    )
    const result = await window.dbApi.autoGenerateCleaningTasks({
      startDate: dayjs().format('YYYY-MM-DD'),
      endDate: dayjs().add(14, 'day').format('YYYY-MM-DD')
    })
    ElMessage.success(`已生成 ${result.count} 条保洁任务`)
    await loadTasks()
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.message || '生成失败')
    }
  }
}

async function handleTaskAction(cmd: string, row: CleaningTask) {
  try {
    switch (cmd) {
      case 'start':
        await window.dbApi.updateCleaningTask({ ...row, status: 'in_progress' })
        ElMessage.success('任务已开始')
        break
      case 'complete':
        await window.dbApi.updateCleaningTask({ ...row, status: 'completed' })
        ElMessage.success('任务已完成')
        break
      case 'edit':
        openTaskDialog(row)
        return
      case 'cancel':
        await ElMessageBox.confirm('确认取消该保洁任务吗？', '取消确认', { type: 'warning' })
        await window.dbApi.updateCleaningTask({ ...row, status: 'cancelled' })
        ElMessage.success('任务已取消')
        break
      case 'delete':
        await ElMessageBox.confirm('确认删除该记录吗？', '删除确认', { type: 'warning' })
        await window.dbApi.deleteCleaningTask(row.id)
        ElMessage.success('删除成功')
        break
    }
    await loadTasks()
  } catch (e) {
    // 用户取消
  }
}

onMounted(async () => {
  await loadRooms()
  await loadCleaningConfig()
  await loadTasks()
})
</script>

<style lang="scss" scoped>
.cleaning-view {
  min-height: 100%;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.pending-card {
  background: linear-gradient(135deg, #fff7e6, #ffe7ba);
  .stat-num { color: #d48806; }
  .stat-label { color: #ad6800; }
}

.progress-card {
  background: linear-gradient(135deg, #e6f4ff, #bae0ff);
  .stat-num { color: #0958d9; }
  .stat-label { color: #003eb3; }
}

.done-card {
  background: linear-gradient(135deg, #f6ffed, #d9f7be);
  .stat-num { color: #389e0d; }
  .stat-label { color: #237804; }
}

.cancel-card {
  background: linear-gradient(135deg, #f5f5f5, #e8e8e8);
  .stat-num { color: #595959; }
  .stat-label { color: #434343; }
}

.stat-num {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  margin-top: 4px;
}

.filter-group {
  display: flex;
  align-items: center;
}

.date-nav {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.date-nav-btn {
  position: relative;
  padding: 10px 6px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  &:hover {
    border-color: #409eff;
    background: #ecf5ff;
  }
  &.active {
    border-color: #409eff;
    background: #409eff;
    .nav-label, .nav-date { color: #fff; }
  }
}

.nav-label {
  font-size: 12px;
  color: #606266;
}

.nav-date {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-top: 2px;
}

.nav-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #f56c6c;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
