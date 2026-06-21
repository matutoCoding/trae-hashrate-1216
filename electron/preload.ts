import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dbApi', {
  // 房间
  getRooms: () => ipcRenderer.invoke('db:getRooms'),
  getRoom: (id: number) => ipcRenderer.invoke('db:getRoom', id),
  addRoom: (room: any) => ipcRenderer.invoke('db:addRoom', room),
  updateRoom: (room: any) => ipcRenderer.invoke('db:updateRoom', room),
  deleteRoom: (id: number) => ipcRenderer.invoke('db:deleteRoom', id),

  // 周期规则
  getCycleRules: () => ipcRenderer.invoke('db:getCycleRules'),
  addCycleRule: (rule: any) => ipcRenderer.invoke('db:addCycleRule', rule),
  updateCycleRule: (rule: any) => ipcRenderer.invoke('db:updateCycleRule', rule),
  deleteCycleRule: (id: number) => ipcRenderer.invoke('db:deleteCycleRule', id),

  // 房态
  getRoomStatuses: (params: any) => ipcRenderer.invoke('db:getRoomStatuses', params),
  getRoomStatus: (id: number) => ipcRenderer.invoke('db:getRoomStatus', id),
  addRoomStatus: (status: any) => ipcRenderer.invoke('db:addRoomStatus', status),
  updateRoomStatus: (status: any) => ipcRenderer.invoke('db:updateRoomStatus', status),
  deleteRoomStatus: (id: number) => ipcRenderer.invoke('db:deleteRoomStatus', id),
  batchGenerateRoomStatuses: (params: any) => ipcRenderer.invoke('db:batchGenerateRoomStatuses', params),
  batchUpdateRoomStatuses: (params: any) => ipcRenderer.invoke('db:batchUpdateRoomStatuses', params),
  getLastBatchOperation: () => ipcRenderer.invoke('db:getLastBatchOperation'),
  revertLastBatchOperation: () => ipcRenderer.invoke('db:revertLastBatchOperation'),
  getStatusByRoomAndDate: (roomId: number, date: string) => ipcRenderer.invoke('db:getStatusByRoomAndDate', roomId, date),

  // 经营看板
  getDashboardStats: (params: any) => ipcRenderer.invoke('db:getDashboardStats', params),
  getDashboardByRoom: (params: any) => ipcRenderer.invoke('db:getDashboardByRoom', params),
  getDashboardTrend: (params: any) => ipcRenderer.invoke('db:getDashboardTrend', params),
  getRoomTypes: () => ipcRenderer.invoke('db:getRoomTypes'),
  getFloors: () => ipcRenderer.invoke('db:getFloors'),
  getBatchOperationLogs: () => ipcRenderer.invoke('db:getBatchOperationLogs'),

  // 额度
  getQuotaConfig: () => ipcRenderer.invoke('db:getQuotaConfig'),
  updateQuotaConfig: (config: any) => ipcRenderer.invoke('db:updateQuotaConfig', config),
  getMonthlyQuota: (month: string) => ipcRenderer.invoke('db:getMonthlyQuota', month),
  useQuota: (params: any) => ipcRenderer.invoke('db:useQuota', params),
  refundQuota: (params: any) => ipcRenderer.invoke('db:refundQuota', params),
  resetMonthlyQuota: (month: string) => ipcRenderer.invoke('db:resetMonthlyQuota', month),
  autoResetQuotaIfNeeded: () => ipcRenderer.invoke('db:autoResetQuotaIfNeeded'),
  grantQuota: (params: any) => ipcRenderer.invoke('db:grantQuota', params),
  calibrateMonthlyQuota: (month: string) => ipcRenderer.invoke('db:calibrateMonthlyQuota', month),

  // 消费明细
  getConsumptionRecords: (params: any) => ipcRenderer.invoke('db:getConsumptionRecords', params),
  addConsumptionRecord: (record: any) => ipcRenderer.invoke('db:addConsumptionRecord', record),
  getConsumptionSummary: (params: any) => ipcRenderer.invoke('db:getConsumptionSummary', params),
  getConsumptionMonthlySummary: (month: string) => ipcRenderer.invoke('db:getConsumptionMonthlySummary', month),
  getConsumptionRoomRanking: (month: string) => ipcRenderer.invoke('db:getConsumptionRoomRanking', month),
  getRoomDailyConsumption: (params: any) => ipcRenderer.invoke('db:getRoomDailyConsumption', params),
  getReconciliationDiff: (month: string) => ipcRenderer.invoke('db:getReconciliationDiff', month),
  regenerateConsumptionRecords: (month: string) => ipcRenderer.invoke('db:regenerateConsumptionRecords', month),
  fixReconciliationDiff: (params: any) => ipcRenderer.invoke('db:fixReconciliationDiff', params),

  // 保洁
  getCleaningTasks: (params: any) => ipcRenderer.invoke('db:getCleaningTasks', params),
  addCleaningTask: (task: any) => ipcRenderer.invoke('db:addCleaningTask', task),
  updateCleaningTask: (task: any) => ipcRenderer.invoke('db:updateCleaningTask', task),
  deleteCleaningTask: (id: number) => ipcRenderer.invoke('db:deleteCleaningTask', id),
  autoGenerateCleaningTasks: (params: any) => ipcRenderer.invoke('db:autoGenerateCleaningTasks', params),
  getCleaningConfig: () => ipcRenderer.invoke('db:getCleaningConfig'),
  updateCleaningConfig: (config: any) => ipcRenderer.invoke('db:updateCleaningConfig', config),

  // 工具
  getDateRangeStatuses: (startDate: string, endDate: string) => ipcRenderer.invoke('db:getDateRangeStatuses', startDate, endDate)
})
