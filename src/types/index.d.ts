export interface Room {
  id: number
  room_no: string
  room_name: string
  room_type?: string
  floor?: number
  area?: number
  base_price?: number
  status: string
  remarks?: string
  created_at: string
  updated_at: string
}

export interface CycleRule {
  id: number
  name: string
  room_ids: string | number[]
  weekdays: string | number[]
  start_date: string
  end_date: string
  check_in_time: string
  check_out_time: string
  status: string
  remarks?: string
  created_at: string
  updated_at: string
}

export type RoomStatusType = 'available' | 'occupied' | 'blocked'

export interface RoomStatus {
  id: number
  room_id: number
  date: string
  status: RoomStatusType
  source: 'manual' | 'cycle'
  cycle_rule_id?: number
  quota_used: number
  is_paid: number
  amount: number
  order_no?: string
  guest_name?: string
  guest_phone?: string
  remarks?: string
  room_no?: string
  room_name?: string
  created_at: string
  updated_at: string
}

export interface QuotaConfig {
  id: number
  monthly_free_quota: number
  paid_price_per_day: number
  reset_day: number
  updated_at: string
}

export interface MonthlyQuota {
  id: number
  month: string
  total_quota: number
  used_quota: number
  paid_count: number
  paid_amount: number
  created_at: string
  updated_at: string
}

export type ConsumptionType = 'paid' | 'quota' | 'refund'

export interface ConsumptionRecord {
  id: number
  room_status_id?: number
  room_id: number
  date: string
  type: ConsumptionType
  amount: number
  quota_used?: number
  description?: string
  room_no?: string
  room_name?: string
  created_at: string
}

export interface ConsumptionSummary {
  total_count: number
  paid_count: number
  quota_count: number
  total_amount: number
  paid_amount: number
}

export interface ConsumptionMonthlySummary {
  quota_used: number
  paid_count: number
  paid_amount: number
  total_records: number
}

export interface ConsumptionRoomRanking {
  room_id: number
  room_no: string
  room_name: string
  quota_used: number
  paid_count: number
  paid_amount: number
  total_days: number
}

export interface CalibrateResult {
  month: string
  used_quota: number
  paid_count: number
  paid_amount: number
  total_quota: number
}

export interface BatchOperationLog {
  id: number
  operation_type: string
  operator: string
  target_status: string
  target_is_paid: number
  target_amount: number
  room_ids: string
  start_date: string
  end_date: string
  affected_count: number
  snapshot: string
  created_at: string
}

export interface BatchOperationSnapshotItem {
  id: number
  room_id: number
  date: string
  status: RoomStatusType
  is_paid: number
  amount: number
  quota_used: number
}

export interface DashboardStats {
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

export interface RoomStat {
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

export interface ReconciliationDiffItem {
  type: 'mismatch' | 'orphan'
  room_id: number
  room_no: string
  room_name: string
  date: string
  issues: string[]
  room_status: {
    status: string
    is_paid: number
    quota_used: number
    amount: number
  } | null
  consumption: {
    type: string
    quota_used: number
    amount: number
  } | null
}

export interface ReconciliationResult {
  diffs: ReconciliationDiffItem[]
  diff_count: number
  quota_summary: {
    from_monthly_quotas: { used_quota: number; paid_count: number; paid_amount: number; total_quota: number }
    from_room_statuses: { used_quota: number; paid_count: number; paid_amount: number }
    from_consumption_records: { used_quota: number; paid_count: number; paid_amount: number }
    has_diff: boolean
  }
}

export interface RegenerateResult {
  deleted: number
  generated: number
  month: string
  new_used_quota: number
  new_paid_count: number
  new_paid_amount: number
}

export type CleaningStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface CleaningTask {
  id: number
  room_id: number
  room_status_id?: number
  task_date: string
  start_time: string
  end_time: string
  status: CleaningStatus
  cleaner?: string
  remarks?: string
  room_no?: string
  room_name?: string
  created_at: string
  updated_at: string
}

export interface CleaningConfig {
  id: number
  cleaning_hours: number
  buffer_hours: number
  auto_assign: number
  updated_at: string
}

declare global {
  interface Window {
    dbApi: {
      getRooms(): Promise<Room[]>
      getRoom(id: number): Promise<Room>
      addRoom(room: Partial<Room>): Promise<{ id: number }>
      updateRoom(room: Room): Promise<boolean>
      deleteRoom(id: number): Promise<boolean>

      getCycleRules(): Promise<CycleRule[]>
      addCycleRule(rule: Partial<CycleRule>): Promise<{ id: number }>
      updateCycleRule(rule: CycleRule): Promise<boolean>
      deleteCycleRule(id: number): Promise<boolean>

      getRoomStatuses(params?: any): Promise<RoomStatus[]>
      getRoomStatus(id: number): Promise<RoomStatus>
      addRoomStatus(status: Partial<RoomStatus>): Promise<any>
      updateRoomStatus(status: RoomStatus): Promise<any>
      deleteRoomStatus(id: number): Promise<boolean>
      batchGenerateRoomStatuses(params: any): Promise<{ count: number; quotaOverflow: number; quotaOverflowDetails: any[] }>
      batchUpdateRoomStatuses(params: { roomIds: number[]; startDate: string; endDate: string; status: RoomStatusType; is_paid: number; amount?: number }): Promise<{ updated: number }>
      getLastBatchOperation(): Promise<BatchOperationLog | undefined>
      revertLastBatchOperation(): Promise<{ success: boolean; reverted?: number; message?: string }>
      getStatusByRoomAndDate(roomId: number, date: string): Promise<RoomStatus | undefined>

      // 经营看板
      getRoomTypes(): Promise<string[]>
      getFloors(): Promise<number[]>
      getDashboardStats(params?: { month?: string; roomType?: string; floor?: number }): Promise<DashboardStats>
      getDashboardByRoom(params?: { month?: string; roomType?: string; floor?: number }): Promise<RoomStat[]>

      // 额度
      getQuotaConfig(): Promise<QuotaConfig>
      updateQuotaConfig(config: Partial<QuotaConfig>): Promise<boolean>
      getMonthlyQuota(month: string): Promise<MonthlyQuota>
      useQuota(params: any): Promise<any>
      refundQuota(params: any): Promise<boolean>
      resetMonthlyQuota(month: string): Promise<boolean>
      autoResetQuotaIfNeeded(): Promise<{ reset: boolean; month: string }>
      grantQuota(params: { month?: string; amount: number; remark?: string }): Promise<{ total_quota: number; granted: number }>
      calibrateMonthlyQuota(month: string): Promise<CalibrateResult>

      getConsumptionRecords(params?: any): Promise<ConsumptionRecord[]>
      addConsumptionRecord(record: Partial<ConsumptionRecord>): Promise<{ id: number }>
      getConsumptionSummary(params?: any): Promise<ConsumptionSummary>
      getConsumptionMonthlySummary(month: string): Promise<ConsumptionMonthlySummary>
      getConsumptionRoomRanking(month: string): Promise<ConsumptionRoomRanking[]>
      getRoomDailyConsumption(params: { roomId: number; month: string }): Promise<ConsumptionRecord[]>
      getReconciliationDiff(month: string): Promise<ReconciliationResult>
      regenerateConsumptionRecords(month: string): Promise<RegenerateResult>

      getCleaningTasks(params?: any): Promise<CleaningTask[]>
      addCleaningTask(task: Partial<CleaningTask>): Promise<{ id: number }>
      updateCleaningTask(task: CleaningTask): Promise<boolean>
      deleteCleaningTask(id: number): Promise<boolean>
      autoGenerateCleaningTasks(params?: any): Promise<{ count: number }>
      getCleaningConfig(): Promise<CleaningConfig>
      updateCleaningConfig(config: Partial<CleaningConfig>): Promise<boolean>

      getDateRangeStatuses(startDate: string, endDate: string): Promise<{ rooms: Room[]; statuses: RoomStatus[] }>
    }
  }
}

export {}
