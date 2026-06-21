import { ipcMain } from 'electron'
import { getDb } from './database'
import dayjs from 'dayjs'

export function registerDatabaseIpc() {
  // ==================== 房间管理 ====================
  ipcMain.handle('db:getRooms', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM rooms ORDER BY room_no').all()
  })

  ipcMain.handle('db:getRoom', (_e, id: number) => {
    const db = getDb()
    return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id)
  })

  ipcMain.handle('db:addRoom', (_e, room: any) => {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO rooms (room_no, room_name, room_type, floor, area, base_price, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      room.room_no, room.room_name, room.room_type, room.floor,
      room.area, room.base_price, room.status || 'active', room.remarks
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('db:updateRoom', (_e, room: any) => {
    const db = getDb()
    const stmt = db.prepare(`
      UPDATE rooms SET room_no=?, room_name=?, room_type=?, floor=?, area=?,
      base_price=?, status=?, remarks=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `)
    stmt.run(
      room.room_no, room.room_name, room.room_type, room.floor,
      room.area, room.base_price, room.status, room.remarks, room.id
    )
    return true
  })

  ipcMain.handle('db:deleteRoom', (_e, id: number) => {
    const db = getDb()
    db.prepare('DELETE FROM rooms WHERE id = ?').run(id)
    return true
  })

  // ==================== 周期规则 ====================
  ipcMain.handle('db:getCycleRules', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM cycle_rules ORDER BY created_at DESC').all()
  })

  ipcMain.handle('db:addCycleRule', (_e, rule: any) => {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO cycle_rules (name, room_ids, weekdays, start_date, end_date,
      check_in_time, check_out_time, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      rule.name, JSON.stringify(rule.room_ids), JSON.stringify(rule.weekdays),
      rule.start_date, rule.end_date, rule.check_in_time || '14:00',
      rule.check_out_time || '12:00', rule.status || 'active', rule.remarks
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('db:updateCycleRule', (_e, rule: any) => {
    const db = getDb()
    const stmt = db.prepare(`
      UPDATE cycle_rules SET name=?, room_ids=?, weekdays=?, start_date=?, end_date=?,
      check_in_time=?, check_out_time=?, status=?, remarks=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `)
    stmt.run(
      rule.name, JSON.stringify(rule.room_ids), JSON.stringify(rule.weekdays),
      rule.start_date, rule.end_date, rule.check_in_time, rule.check_out_time,
      rule.status, rule.remarks, rule.id
    )
    return true
  })

  ipcMain.handle('db:deleteCycleRule', (_e, id: number) => {
    const db = getDb()
    db.prepare('DELETE FROM cycle_rules WHERE id = ?').run(id)
    return true
  })

  // ==================== 房态管理 ====================
  ipcMain.handle('db:getRoomStatuses', (_e, params: any) => {
    const db = getDb()
    let sql = 'SELECT rs.*, r.room_no, r.room_name FROM room_statuses rs LEFT JOIN rooms r ON rs.room_id = r.id WHERE 1=1'
    const args: any[] = []

    if (params?.startDate) {
      sql += ' AND rs.date >= ?'
      args.push(params.startDate)
    }
    if (params?.endDate) {
      sql += ' AND rs.date <= ?'
      args.push(params.endDate)
    }
    if (params?.roomId) {
      sql += ' AND rs.room_id = ?'
      args.push(params.roomId)
    }
    if (params?.status) {
      sql += ' AND rs.status = ?'
      args.push(params.status)
    }

    sql += ' ORDER BY rs.date ASC, rs.room_id ASC'
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('db:getRoomStatus', (_e, id: number) => {
    const db = getDb()
    return db.prepare('SELECT * FROM room_statuses WHERE id = ?').get(id)
  })

  ipcMain.handle('db:getStatusByRoomAndDate', (_e, roomId: number, date: string) => {
    const db = getDb()
    return db.prepare('SELECT * FROM room_statuses WHERE room_id = ? AND date = ?').get(roomId, date)
  })

  ipcMain.handle('db:addRoomStatus', (_e, status: any) => {
    const db = getDb()
    return saveRoomStatusTransaction(db, status)
  })

  ipcMain.handle('db:updateRoomStatus', (_e, status: any) => {
    const db = getDb()
    return saveRoomStatusTransaction(db, status)
  })

  ipcMain.handle('db:deleteRoomStatus', (_e, id: number) => {
    const db = getDb()
    const tx = db.transaction((statusId: number) => {
      const rs = db.prepare('SELECT room_id, date, quota_used, is_paid, amount FROM room_statuses WHERE id = ?').get(statusId) as any
      if (rs) {
        const month = dayjs(rs.date).format('YYYY-MM')
        if (rs.quota_used) {
          refundQuotaInternal(db, { month, amount: rs.quota_used })
        }
        if (rs.is_paid) {
          refundPaidInternal(db, { month, count: 1, amount: rs.amount || 0 })
        }
        db.prepare('DELETE FROM consumption_records WHERE room_status_id = ?').run(statusId)
      }
      db.prepare('DELETE FROM room_statuses WHERE id = ?').run(statusId)
      return true
    })
    return tx(id)
  })

  ipcMain.handle('db:batchGenerateRoomStatuses', (_e, params: any) => {
    const db = getDb()
    const { ruleId, roomIds, weekdays, startDate, endDate } = params

    const tx = db.transaction(() => {
      const start = dayjs(startDate)
      const end = dayjs(endDate)
      let count = 0
      let quotaOverflow = 0
      let quotaOverflowDetails: { room: string; date: string }[] = []

      const weekdaysArr: number[] = weekdays || []
      const monthMap = new Map<string, { used: number; total: number }>()

      const rooms = db.prepare('SELECT id, room_no, room_name FROM rooms WHERE id IN (' + roomIds.map(() => '?').join(',') + ')')
        .all(...roomIds) as any[]

      const quotaConfig = db.prepare('SELECT monthly_free_quota, paid_price_per_day FROM quota_configs').get() as any
      const paidPrice = quotaConfig.paid_price_per_day || 100

      for (let d = start.clone(); d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
        const weekday = d.day()
        if (!weekdaysArr.includes(weekday)) continue

        const dateStr = d.format('YYYY-MM-DD')
        const month = d.format('YYYY-MM')

        if (!monthMap.has(month)) {
          const mq = getOrCreateMonthlyQuotaInternal(db, month)
          monthMap.set(month, { used: mq.used_quota, total: mq.total_quota })
        }

        for (const room of rooms) {
          const existing = db.prepare('SELECT id, status, quota_used, is_paid FROM room_statuses WHERE room_id = ? AND date = ?')
            .get(room.id, dateStr) as any

          if (existing && existing.status === 'occupied') continue

          const monthQuota = monthMap.get(month)!
          let useQuota = 0
          let isPaid = 0
          let amount = 0

          if (monthQuota.used < monthQuota.total) {
            useQuota = 1
            monthQuota.used++
          } else {
            isPaid = 1
            amount = paidPrice
            quotaOverflow++
            quotaOverflowDetails.push({ room: room.room_no, date: dateStr })
          }

          let statusId: number | bigint

          if (existing) {
            db.prepare(`
              UPDATE room_statuses SET status='occupied', source='cycle', cycle_rule_id=?,
              quota_used=?, is_paid=?, amount=?, updated_at=CURRENT_TIMESTAMP
              WHERE id=?
            `).run(ruleId || null, useQuota, isPaid, amount, existing.id)
            statusId = existing.id as number
          } else {
            const result = db.prepare(`
              INSERT INTO room_statuses (room_id, date, status, source, cycle_rule_id,
              quota_used, is_paid, amount)
              VALUES (?, ?, 'occupied', 'cycle', ?, ?, ?, ?)
            `).run(room.id, dateStr, ruleId || null, useQuota, isPaid, amount)
            statusId = result.lastInsertRowid
          }

          if (useQuota) {
            updateMonthlyQuotaUsedInternal(db, month, 1)
            addConsumptionRecordInternal(db, {
              room_status_id: Number(statusId),
              room_id: room.id,
              date: dateStr,
              type: 'quota',
              amount: 0,
              quota_used: 1,
              description: `房间${room.room_no}${dateStr}周期挂房(免费额度)`
            })
          }
          if (isPaid) {
            addConsumptionRecordInternal(db, {
              room_status_id: Number(statusId),
              room_id: room.id,
              date: dateStr,
              type: 'paid',
              amount,
              quota_used: 0,
              description: `房间${room.room_no}${dateStr}周期挂房(超额自费)`
            })
          }

          count++
        }
      }

      return { count, quotaOverflow, quotaOverflowDetails }
    })

    return tx()
  })

  ipcMain.handle('db:getDateRangeStatuses', (_e, startDate: string, endDate: string) => {
    const db = getDb()
    const rooms = db.prepare('SELECT * FROM rooms WHERE status = ? ORDER BY room_no').all('active') as any[]
    const statuses = db.prepare(`
      SELECT rs.*, r.room_no, r.room_name
      FROM room_statuses rs
      LEFT JOIN rooms r ON rs.room_id = r.id
      WHERE rs.date >= ? AND rs.date <= ?
      ORDER BY rs.date ASC, rs.room_id ASC
    `).all(startDate, endDate) as any[]

    return { rooms, statuses }
  })

  // ==================== 额度管理 ====================
  ipcMain.handle('db:getQuotaConfig', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM quota_configs ORDER BY id DESC LIMIT 1').get()
  })

  ipcMain.handle('db:updateQuotaConfig', (_e, config: any) => {
    const db = getDb()
    const tx = db.transaction((c: any) => {
      const existing = db.prepare('SELECT id FROM quota_configs ORDER BY id DESC LIMIT 1').get() as { id?: number } | undefined
      if (existing) {
        db.prepare(`
          UPDATE quota_configs SET monthly_free_quota=?, paid_price_per_day=?, reset_day=?,
          updated_at=CURRENT_TIMESTAMP WHERE id=?
        `).run(c.monthly_free_quota, c.paid_price_per_day, c.reset_day, existing.id)
      } else {
        db.prepare(`
          INSERT INTO quota_configs (monthly_free_quota, paid_price_per_day, reset_day)
          VALUES (?, ?, ?)
        `).run(c.monthly_free_quota, c.paid_price_per_day, c.reset_day)
      }

      const currentMonth = dayjs().format('YYYY-MM')
      const mq = db.prepare('SELECT id FROM monthly_quotas WHERE month = ?').get(currentMonth) as { id?: number } | undefined
      if (mq) {
        db.prepare('UPDATE monthly_quotas SET total_quota=?, updated_at=CURRENT_TIMESTAMP WHERE month=?')
          .run(c.monthly_free_quota, currentMonth)
      } else {
        db.prepare('INSERT INTO monthly_quotas (month, total_quota, used_quota) VALUES (?, ?, 0)')
          .run(currentMonth, c.monthly_free_quota)
      }

      return true
    })
    return tx(config)
  })

  ipcMain.handle('db:getMonthlyQuota', (_e, month: string) => {
    const db = getDb()
    return getOrCreateMonthlyQuotaInternal(db, month)
  })

  ipcMain.handle('db:useQuota', (_e, params: any) => {
    const db = getDb()
    return useQuotaInternal(db, params)
  })

  ipcMain.handle('db:refundQuota', (_e, params: any) => {
    const db = getDb()
    return refundQuotaInternal(db, params)
  })

  ipcMain.handle('db:resetMonthlyQuota', (_e, month: string) => {
    const db = getDb()
    return resetMonthlyQuotaNewLogic(db, month)
  })

  ipcMain.handle('db:autoResetQuotaIfNeeded', () => {
    const db = getDb()
    const now = dayjs()
    const currentMonth = now.format('YYYY-MM')
    const resetDay = (db.prepare('SELECT reset_day FROM quota_configs ORDER BY id DESC LIMIT 1').get() as any)?.reset_day || 1

    if (now.date() === resetDay) {
      const mq = db.prepare('SELECT id, updated_at FROM monthly_quotas WHERE month = ?').get(currentMonth) as any
      if (!mq) {
        resetMonthlyQuotaNewLogic(db, currentMonth)
        return { reset: true, month: currentMonth }
      }
    }
    return { reset: false, month: currentMonth }
  })

  ipcMain.handle('db:grantQuota', (_e, params: any) => {
    const db = getDb()
    const tx = db.transaction((p: any) => {
      const month = p.month || dayjs().format('YYYY-MM')
      const mq = getOrCreateMonthlyQuotaInternal(db, month)
      const newTotal = (mq.total_quota || 0) + (p.amount || 0)
      db.prepare('UPDATE monthly_quotas SET total_quota=?, updated_at=CURRENT_TIMESTAMP WHERE month=?')
        .run(newTotal, month)

      addConsumptionRecordInternal(db, {
        room_id: 0,
        date: dayjs().format('YYYY-MM-DD'),
        type: 'quota',
        amount: 0,
        quota_used: -(p.amount || 0),
        description: p.remark ? `补发额度: ${p.remark}` : `补发额度 ${p.amount} 天`
      })

      return { total_quota: newTotal, granted: p.amount }
    })
    return tx(params)
  })

  // ==================== 消费明细 ====================
  ipcMain.handle('db:getConsumptionRecords', (_e, params: any) => {
    const db = getDb()
    let sql = `
      SELECT cr.*, r.room_no, r.room_name
      FROM consumption_records cr
      LEFT JOIN rooms r ON cr.room_id = r.id
      WHERE cr.room_id > 0
    `
    const args: any[] = []

    if (params?.month) {
      sql += ' AND cr.date LIKE ?'
      args.push(params.month + '%')
    }
    if (params?.startDate) {
      sql += ' AND cr.date >= ?'
      args.push(params.startDate)
    }
    if (params?.endDate) {
      sql += ' AND cr.date <= ?'
      args.push(params.endDate)
    }
    if (params?.type) {
      sql += ' AND cr.type = ?'
      args.push(params.type)
    }
    if (params?.roomId) {
      sql += ' AND cr.room_id = ?'
      args.push(params.roomId)
    }

    sql += ' ORDER BY cr.created_at DESC LIMIT ? OFFSET ?'
    args.push(params?.limit || 1000, params?.offset || 0)

    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('db:addConsumptionRecord', (_e, record: any) => {
    const db = getDb()
    return addConsumptionRecordInternal(db, record)
  })

  ipcMain.handle('db:getConsumptionSummary', (_e, params: any) => {
    const db = getDb()
    let sql = `
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN type = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN type = 'quota' THEN 1 ELSE 0 END) as quota_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN type = 'paid' THEN amount ELSE 0 END), 0) as paid_amount
      FROM consumption_records
      WHERE 1=1
    `
    const args: any[] = []

    if (params?.startDate) {
      sql += ' AND date >= ?'
      args.push(params.startDate)
    }
    if (params?.endDate) {
      sql += ' AND date <= ?'
      args.push(params.endDate)
    }
    if (params?.type) {
      sql += ' AND type = ?'
      args.push(params.type)
    }

    return db.prepare(sql).get(...args)
  })

  // ==================== 保洁管理 ====================
  ipcMain.handle('db:getCleaningConfig', () => {
    const db = getDb()
    return db.prepare('SELECT * FROM cleaning_configs ORDER BY id DESC LIMIT 1').get()
  })

  ipcMain.handle('db:updateCleaningConfig', (_e, config: any) => {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM cleaning_configs ORDER BY id DESC LIMIT 1').get() as { id?: number } | undefined
    if (existing) {
      db.prepare(`
        UPDATE cleaning_configs SET cleaning_hours=?, buffer_hours=?, auto_assign=?,
        updated_at=CURRENT_TIMESTAMP WHERE id=?
      `).run(config.cleaning_hours, config.buffer_hours, config.auto_assign, existing.id)
    } else {
      db.prepare(`
        INSERT INTO cleaning_configs (cleaning_hours, buffer_hours, auto_assign)
        VALUES (?, ?, ?)
      `).run(config.cleaning_hours, config.buffer_hours, config.auto_assign)
    }
    return true
  })

  ipcMain.handle('db:getCleaningTasks', (_e, params: any) => {
    const db = getDb()
    let sql = `
      SELECT ct.*, r.room_no, r.room_name
      FROM cleaning_tasks ct
      LEFT JOIN rooms r ON ct.room_id = r.id
      WHERE 1=1
    `
    const args: any[] = []

    if (params?.startDate) {
      sql += ' AND ct.task_date >= ?'
      args.push(params.startDate)
    }
    if (params?.endDate) {
      sql += ' AND ct.task_date <= ?'
      args.push(params.endDate)
    }
    if (params?.status) {
      sql += ' AND ct.status = ?'
      args.push(params.status)
    }
    if (params?.roomId) {
      sql += ' AND ct.room_id = ?'
      args.push(params.roomId)
    }

    sql += ' ORDER BY ct.task_date ASC, ct.start_time ASC'
    return db.prepare(sql).all(...args)
  })

  ipcMain.handle('db:addCleaningTask', (_e, task: any) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO cleaning_tasks (room_id, room_status_id, task_date, start_time,
      end_time, status, cleaner, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.room_id, task.room_status_id || null, task.task_date,
      task.start_time, task.end_time, task.status || 'pending',
      task.cleaner, task.remarks
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('db:updateCleaningTask', (_e, task: any) => {
    const db = getDb()
    db.prepare(`
      UPDATE cleaning_tasks SET room_id=?, task_date=?, start_time=?, end_time=?,
      status=?, cleaner=?, remarks=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      task.room_id, task.task_date, task.start_time, task.end_time,
      task.status, task.cleaner, task.remarks, task.id
    )
    return true
  })

  ipcMain.handle('db:deleteCleaningTask', (_e, id: number) => {
    const db = getDb()
    db.prepare('DELETE FROM cleaning_tasks WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('db:autoGenerateCleaningTasks', (_e, params: any) => {
    const db = getDb()
    const config = db.prepare('SELECT cleaning_hours, buffer_hours FROM cleaning_configs ORDER BY id DESC LIMIT 1').get() as any
    const cleaningHours = config?.cleaning_hours || 4
    const bufferHours = config?.buffer_hours || 2

    const tx = db.transaction(() => {
      let sql = `
        SELECT rs.id, rs.room_id, rs.date, rs.cycle_rule_id, cr.check_out_time, r.room_no
        FROM room_statuses rs
        LEFT JOIN rooms r ON rs.room_id = r.id
        LEFT JOIN cycle_rules cr ON rs.cycle_rule_id = cr.id
        WHERE rs.status = 'occupied'
      `
      const args: any[] = []
      if (params?.startDate) {
        sql += ' AND rs.date >= ?'
        args.push(params.startDate)
      }
      if (params?.endDate) {
        sql += ' AND rs.date <= ?'
        args.push(params.endDate)
      }
      sql += ' ORDER BY rs.date, rs.room_id'

      const statuses = db.prepare(sql).all(...args) as any[]
      let count = 0

      for (const rs of statuses) {
        const taskDate = rs.date

        const existing = db.prepare(
          'SELECT id FROM cleaning_tasks WHERE room_id = ? AND task_date = ?'
        ).get(rs.room_id, taskDate)

        if (!existing) {
          const checkOutTime = rs.check_out_time || '12:00'
          const [checkOutH, checkOutM] = checkOutTime.split(':').map(Number)
          const totalBufferMin = (checkOutH || 0) * 60 + (checkOutM || 0) + bufferHours * 60
          const startHour = Math.floor(totalBufferMin / 60)
          const startMin = totalBufferMin % 60
          const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`

          const endTotalMin = totalBufferMin + cleaningHours * 60
          const endHour = Math.floor(endTotalMin / 60)
          const endMin = endTotalMin % 60
          const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`

          db.prepare(`
            INSERT INTO cleaning_tasks (room_id, room_status_id, task_date,
            start_time, end_time, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
          `).run(rs.room_id, rs.id, taskDate, startTime, endTime)
          count++
        }
      }

      return { count }
    })

    return tx()
  })

  // ==================== 批量更新房态 ====================
  ipcMain.handle('db:batchUpdateRoomStatuses', (_e, params: any) => {
    const db = getDb()
    const tx = db.transaction((p: any) => {
      const { roomIds, startDate, endDate, status, is_paid, amount, source } = p
      const config = db.prepare('SELECT paid_price_per_day FROM quota_configs ORDER BY id DESC LIMIT 1').get() as any
      const paidPrice = config?.paid_price_per_day || 100

      const dateStart = dayjs(startDate)
      const dateEnd = dayjs(endDate)
      const days = dateEnd.diff(dateStart, 'day') + 1

      const snapshot: any[] = []
      for (const roomId of roomIds) {
        for (let i = 0; i < days; i++) {
          const date = dateStart.add(i, 'day').format('YYYY-MM-DD')
          const existing = db.prepare(`
            SELECT rs.id, rs.room_id, rs.date, rs.status, rs.is_paid, rs.amount, rs.quota_used,
                   r.room_no, r.room_name
            FROM room_statuses rs
            LEFT JOIN rooms r ON rs.room_id = r.id
            WHERE rs.room_id = ? AND rs.date = ?
          `).get(roomId, date) as any
          if (existing) {
            snapshot.push({
              ...existing,
              new_status: status,
              new_is_paid: is_paid,
              new_amount: amount || paidPrice
            })
          }
        }
      }

      let updated = 0
      for (const roomId of roomIds) {
        for (let i = 0; i < days; i++) {
          const date = dateStart.add(i, 'day').format('YYYY-MM-DD')
          const existing = db.prepare('SELECT id FROM room_statuses WHERE room_id = ? AND date = ?').get(roomId, date) as { id?: number } | undefined

          if (existing) {
            saveRoomStatusTransaction(db, {
              id: existing.id,
              room_id: roomId,
              date,
              status,
              is_paid,
              amount: amount || paidPrice,
              source: source || 'manual'
            })
            updated++
          }
        }
      }

      if (updated > 0 && snapshot.length > 0) {
        db.prepare(`
          INSERT INTO batch_operation_logs (
            operation_type, operator, target_status, target_is_paid, target_amount,
            room_ids, start_date, end_date, affected_count, snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'batch_update',
          'manual',
          status,
          is_paid,
          amount || paidPrice,
          JSON.stringify(roomIds),
          startDate,
          endDate,
          updated,
          JSON.stringify(snapshot)
        )
      }

      return { updated }
    })
    return tx(params)
  })

  // ==================== 批量操作日志 ====================
  ipcMain.handle('db:getLastBatchOperation', () => {
    const db = getDb()
    return db.prepare(`
      SELECT * FROM batch_operation_logs
      WHERE is_revert = 0
      ORDER BY id DESC LIMIT 1
    `).get()
  })

  ipcMain.handle('db:getBatchOperationLogs', () => {
    const db = getDb()
    return db.prepare(`
      SELECT * FROM batch_operation_logs
      ORDER BY id DESC LIMIT 50
    `).all() as any[]
  })

  ipcMain.handle('db:revertLastBatchOperation', () => {
    const db = getDb()
    const tx = db.transaction(() => {
      const lastLog = db.prepare(`
        SELECT * FROM batch_operation_logs
        WHERE is_revert = 0
        ORDER BY id DESC LIMIT 1
      `).get() as any

      if (!lastLog) {
        return { success: false, message: '没有可撤销的批量操作' }
      }

      const snapshot = JSON.parse(lastLog.snapshot)
      const revertSnapshot: any[] = []
      let reverted = 0

      for (const old of snapshot) {
        const current = db.prepare(`
          SELECT rs.id, rs.room_id, rs.date, rs.status, rs.is_paid, rs.amount, rs.quota_used,
                 r.room_no, r.room_name
          FROM room_statuses rs
          LEFT JOIN rooms r ON rs.room_id = r.id
          WHERE rs.id = ?
        `).get(old.id) as any

        if (current) {
          revertSnapshot.push({
            ...current,
            new_status: old.status,
            new_is_paid: old.is_paid,
            new_amount: old.amount
          })
        }

        saveRoomStatusTransaction(db, {
          id: old.id,
          room_id: old.room_id,
          date: old.date,
          status: old.status,
          is_paid: old.is_paid,
          amount: old.amount,
          source: 'revert'
        })
        reverted++
      }

      if (reverted > 0 && revertSnapshot.length > 0) {
        db.prepare(`
          INSERT INTO batch_operation_logs (
            operation_type, operator, target_status, target_is_paid, target_amount,
            room_ids, start_date, end_date, affected_count, snapshot, parent_id, is_revert
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          'batch_revert',
          'manual',
          'revert',
          0,
          0,
          lastLog.room_ids,
          lastLog.start_date,
          lastLog.end_date,
          reverted,
          JSON.stringify(revertSnapshot),
          lastLog.id
        )
      }

      return { success: true, reverted }
    })
    return tx()
  })

  // ==================== 额度校准 ====================
  ipcMain.handle('db:calibrateMonthlyQuota', (_e, month: string) => {
    const db = getDb()
    const tx = db.transaction((m: string) => {
      const quotaUsedResult = db.prepare(`
        SELECT COALESCE(SUM(quota_used), 0) as total_used
        FROM room_statuses
        WHERE status = 'occupied' AND date LIKE ?
      `).get(m + '%') as { total_used: number }

      const paidResult = db.prepare(`
        SELECT COUNT(*) as paid_count, COALESCE(SUM(amount), 0) as paid_amount
        FROM room_statuses
        WHERE status = 'occupied' AND is_paid = 1 AND date LIKE ?
      `).get(m + '%') as { paid_count: number; paid_amount: number }

      const mq = getOrCreateMonthlyQuotaInternal(db, m)
      db.prepare(`
        UPDATE monthly_quotas
        SET used_quota = ?, paid_count = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE month = ?
      `).run(
        quotaUsedResult.total_used,
        paidResult.paid_count,
        paidResult.paid_amount,
        m
      )

      return {
        month: m,
        used_quota: quotaUsedResult.total_used,
        paid_count: paidResult.paid_count,
        paid_amount: paidResult.paid_amount,
        total_quota: mq.total_quota
      }
    })
    return tx(month)
  })

  // ==================== 经营看板 ====================
  ipcMain.handle('db:getDashboardStats', (_e, params: any) => {
    const db = getDb()
    const { month, roomType, floor } = params || {}

    let roomFilter = ''
    const roomArgs: any[] = []

    if (roomType) {
      roomFilter += ' AND r.room_type = ?'
      roomArgs.push(roomType)
    }
    if (floor) {
      roomFilter += ' AND r.floor = ?'
      roomArgs.push(floor)
    }

    const datePattern = month ? month + '%' : '%'

    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN rs.status = 'occupied' THEN 1 ELSE 0 END) as occupied_days,
        SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 0 THEN rs.quota_used ELSE 0 END) as quota_used,
        SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 1 THEN rs.amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 1 THEN 1 ELSE 0 END) as paid_days,
        SUM(CASE WHEN rs.status = 'blocked' THEN 1 ELSE 0 END) as blocked_days,
        COUNT(DISTINCT rs.room_id) as active_rooms
      FROM room_statuses rs
      LEFT JOIN rooms r ON rs.room_id = r.id
      WHERE rs.date LIKE ? ${roomFilter}
    `).get(datePattern, ...roomArgs) as any

    const totalRoomsResult = db.prepare(`
      SELECT COUNT(*) as total_rooms FROM rooms WHERE status = 'active' ${roomFilter}
    `).get(...roomArgs) as { total_rooms: number }
    const totalRooms = totalRoomsResult.total_rooms || 0

    const daysInMonth = month ? dayjs(month + '-01').daysInMonth() : dayjs().daysInMonth()
    const totalAvailableRoomDays = totalRooms * daysInMonth
    const occupancyRate = totalAvailableRoomDays > 0
      ? Math.round(((stats.occupied_days || 0) / totalAvailableRoomDays) * 10000) / 100
      : 0

    return {
      occupied_days: stats.occupied_days || 0,
      quota_used: stats.quota_used || 0,
      paid_amount: stats.paid_amount || 0,
      paid_days: stats.paid_days || 0,
      blocked_days: stats.blocked_days || 0,
      active_rooms: stats.active_rooms || 0,
      total_rooms: totalRooms,
      total_available_days: totalAvailableRoomDays,
      occupancy_rate: occupancyRate
    }
  })

  ipcMain.handle('db:getDashboardByRoom', (_e, params: any) => {
    const db = getDb()
    const { month, roomType, floor } = params || {}

    let roomFilter = ''
    const roomArgs: any[] = []

    if (roomType) {
      roomFilter += ' AND r.room_type = ?'
      roomArgs.push(roomType)
    }
    if (floor) {
      roomFilter += ' AND r.floor = ?'
      roomArgs.push(floor)
    }

    const datePattern = month ? month + '%' : '%'

    return db.prepare(`
      SELECT
        r.id as room_id,
        r.room_no,
        r.room_name,
        r.room_type,
        r.floor,
        SUM(CASE WHEN rs.status = 'occupied' THEN 1 ELSE 0 END) as occupied_days,
        SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 0 THEN rs.quota_used ELSE 0 END) as quota_used,
        SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 1 THEN rs.amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 1 THEN 1 ELSE 0 END) as paid_days,
        SUM(CASE WHEN rs.status = 'blocked' THEN 1 ELSE 0 END) as blocked_days
      FROM rooms r
      LEFT JOIN room_statuses rs ON r.id = rs.room_id AND rs.date LIKE ?
      WHERE r.status = 'active' ${roomFilter}
      GROUP BY r.id, r.room_no, r.room_name, r.room_type, r.floor
      ORDER BY occupied_days DESC, paid_amount DESC
    `).all(datePattern, ...roomArgs)
  })

  ipcMain.handle('db:getRoomTypes', () => {
    const db = getDb()
    return db.prepare(`
      SELECT DISTINCT room_type FROM rooms WHERE room_type IS NOT NULL AND room_type != '' ORDER BY room_type
    `).all().map((r: any) => r.room_type)
  })

  ipcMain.handle('db:getFloors', () => {
    const db = getDb()
    return db.prepare(`
      SELECT DISTINCT floor FROM rooms WHERE floor IS NOT NULL ORDER BY floor
    `).all().map((r: any) => r.floor)
  })

  ipcMain.handle('db:getDashboardTrend', (_e, params: any) => {
    const db = getDb()
    const { roomType, floor } = params || {}

    let roomFilter = ''
    const roomArgs: any[] = []

    if (roomType) {
      roomFilter += ' AND r.room_type = ?'
      roomArgs.push(roomType)
    }
    if (floor) {
      roomFilter += ' AND r.floor = ?'
      roomArgs.push(floor)
    }

    const months: string[] = []
    const today = dayjs()
    for (let i = 5; i >= 0; i--) {
      months.push(today.subtract(i, 'month').format('YYYY-MM'))
    }

    const result: any[] = []
    for (const month of months) {
      const datePattern = month + '%'
      const stats = db.prepare(`
        SELECT
          SUM(CASE WHEN rs.status = 'occupied' THEN 1 ELSE 0 END) as occupied_days,
          SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 0 THEN rs.quota_used ELSE 0 END) as quota_used,
          SUM(CASE WHEN rs.status = 'occupied' AND rs.is_paid = 1 THEN rs.amount ELSE 0 END) as paid_amount
        FROM room_statuses rs
        LEFT JOIN rooms r ON rs.room_id = r.id
        WHERE rs.date LIKE ? ${roomFilter}
      `).get(datePattern, ...roomArgs) as any

      const totalRoomsResult = db.prepare(`
        SELECT COUNT(*) as total_rooms FROM rooms WHERE status = 'active' ${roomFilter}
      `).get(...roomArgs) as { total_rooms: number }
      const totalRooms = totalRoomsResult.total_rooms || 0
      const daysInMonth = dayjs(month + '-01').daysInMonth()
      const totalAvailableRoomDays = totalRooms * daysInMonth
      const occupancyRate = totalAvailableRoomDays > 0
        ? Math.round(((stats.occupied_days || 0) / totalAvailableRoomDays) * 10000) / 100
        : 0

      result.push({
        month,
        occupied_days: stats.occupied_days || 0,
        quota_used: stats.quota_used || 0,
        paid_amount: stats.paid_amount || 0,
        occupancy_rate: occupancyRate,
        total_rooms: totalRooms,
        days_in_month: daysInMonth
      })
    }

    return result
  })

  // ==================== 对账差异核对 ====================
  ipcMain.handle('db:getReconciliationDiff', (_e, month: string) => {
    const db = getDb()
    const datePattern = month + '%'

    const sideBySide = db.prepare(`
      SELECT
        rs.id as room_status_id,
        rs.room_id,
        r.room_no,
        r.room_name,
        rs.date,
        rs.status as rs_status,
        rs.is_paid as rs_is_paid,
        rs.quota_used as rs_quota_used,
        rs.amount as rs_amount,
        cr.id as cr_id,
        cr.type as cr_type,
        cr.quota_used as cr_quota_used,
        cr.amount as cr_amount
      FROM room_statuses rs
      LEFT JOIN rooms r ON rs.room_id = r.id
      LEFT JOIN consumption_records cr ON rs.id = cr.room_status_id
      WHERE rs.date LIKE ? AND rs.status != 'available'
      ORDER BY rs.date ASC, rs.room_id ASC
    `).all(datePattern) as any[]

    const orphanRecords = db.prepare(`
      SELECT
        cr.id as cr_id,
        cr.room_id,
        r.room_no,
        r.room_name,
        cr.date,
        cr.type as cr_type,
        cr.quota_used as cr_quota_used,
        cr.amount as cr_amount
      FROM consumption_records cr
      LEFT JOIN rooms r ON cr.room_id = r.id
      WHERE cr.date LIKE ? AND cr.room_status_id IS NOT NULL
        AND cr.room_status_id NOT IN (SELECT id FROM room_statuses)
      ORDER BY cr.date ASC
    `).all(datePattern) as any[]

    const quotaResult = db.prepare(`
      SELECT used_quota, paid_count, paid_amount, total_quota
      FROM monthly_quotas WHERE month = ?
    `).get(month) as any

    const actualFromRoomStatus = db.prepare(`
      SELECT
        SUM(CASE WHEN is_paid = 0 AND status = 'occupied' THEN quota_used ELSE 0 END) as used_quota,
        SUM(CASE WHEN is_paid = 1 AND status = 'occupied' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN is_paid = 1 AND status = 'occupied' THEN amount ELSE 0 END) as paid_amount
      FROM room_statuses
      WHERE date LIKE ? AND status = 'occupied'
    `).get(datePattern) as any

    const actualFromConsumption = db.prepare(`
      SELECT
        SUM(CASE WHEN type = 'quota' AND room_id > 0 THEN ABS(quota_used) ELSE 0 END) as used_quota,
        SUM(CASE WHEN type = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN type = 'paid' THEN amount ELSE 0 END) as paid_amount
      FROM consumption_records
      WHERE date LIKE ? AND room_id > 0
    `).get(datePattern) as any

    const diffs: any[] = []
    let diffId = 1

    for (const row of sideBySide) {
      let issues: string[] = []

      if (row.rs_status === 'occupied' && row.rs_is_paid === 0 && row.rs_quota_used > 0) {
        if (!row.cr_id || row.cr_type !== 'quota' || Math.abs(row.cr_quota_used || 0) !== row.rs_quota_used) {
          issues.push('免费占用但流水缺失或不匹配')
        }
      }

      if (row.rs_status === 'occupied' && row.rs_is_paid === 1) {
        if (!row.cr_id || row.cr_type !== 'paid' || Math.abs(row.cr_amount || 0) !== row.rs_amount) {
          issues.push('自费占用但流水缺失或金额不匹配')
        }
      }

      if (row.rs_status === 'blocked') {
        if (row.cr_id) {
          issues.push('锁房状态但存在消费流水')
        }
      }

      if (issues.length > 0) {
        diffs.push({
          id: diffId++,
          type: 'mismatch',
          room_id: row.room_id,
          room_no: row.room_no,
          room_name: row.room_name,
          date: row.date,
          issues,
          room_status: {
            status: row.rs_status,
            is_paid: row.rs_is_paid,
            quota_used: row.rs_quota_used,
            amount: row.rs_amount
          },
          consumption: row.cr_id ? {
            type: row.cr_type,
            quota_used: row.cr_quota_used,
            amount: row.cr_amount
          } : null
        })
      }
    }

    for (const row of orphanRecords) {
      diffs.push({
        id: diffId++,
        type: 'orphan',
        room_id: row.room_id,
        room_no: row.room_no,
        room_name: row.room_name,
        date: row.date,
        issues: ['消费流水存在但对应房态已删除'],
        room_status: null,
        consumption: {
          type: row.cr_type,
          quota_used: row.cr_quota_used,
          amount: row.cr_amount
        }
      })
    }

    const hasQuotaDiff = (quotaResult?.used_quota || 0) !== (actualFromRoomStatus?.used_quota || 0) ||
                        (quotaResult?.paid_count || 0) !== (actualFromRoomStatus?.paid_count || 0) ||
                        (quotaResult?.paid_amount || 0) !== (actualFromRoomStatus?.paid_amount || 0)

    return {
      diffs,
      diff_count: diffs.length,
      quota_summary: {
        from_monthly_quotas: quotaResult || { used_quota: 0, paid_count: 0, paid_amount: 0, total_quota: 0 },
        from_room_statuses: actualFromRoomStatus || { used_quota: 0, paid_count: 0, paid_amount: 0 },
        from_consumption_records: actualFromConsumption || { used_quota: 0, paid_count: 0, paid_amount: 0 },
        has_diff: hasQuotaDiff
      }
    }
  })

  ipcMain.handle('db:regenerateConsumptionRecords', (_e, month: string) => {
    const db = getDb()
    const tx = db.transaction((m: string) => {
      const datePattern = m + '%'

      const deleted1 = db.prepare(`
        DELETE FROM consumption_records
        WHERE date LIKE ? AND room_status_id IN (
          SELECT id FROM room_statuses WHERE date LIKE ?
        )
      `).run(datePattern, datePattern)

      const deleted2 = db.prepare(`
        DELETE FROM consumption_records
        WHERE date LIKE ? AND room_status_id IS NOT NULL
          AND room_status_id NOT IN (SELECT id FROM room_statuses)
      `).run(datePattern)

      const allOccupied = db.prepare(`
        SELECT rs.*, r.room_no, r.room_name
        FROM room_statuses rs
        LEFT JOIN rooms r ON rs.room_id = r.id
        WHERE rs.date LIKE ? AND rs.status = 'occupied'
        ORDER BY rs.date ASC
      `).all(datePattern) as any[]

      let generated = 0
      for (const rs of allOccupied) {
        if (rs.is_paid === 1) {
          addConsumptionRecordInternal(db, {
            room_id: rs.room_id,
            room_status_id: rs.id,
            date: rs.date,
            type: 'paid',
            amount: rs.amount,
            quota_used: 0,
            description: `房态同步 - ${rs.room_no || ''} - 自费挂房`,
            created_by: 'reconciliation'
          })
        } else {
          addConsumptionRecordInternal(db, {
            room_id: rs.room_id,
            room_status_id: rs.id,
            date: rs.date,
            type: 'quota',
            amount: 0,
            quota_used: -(rs.quota_used || 1),
            description: `房态同步 - ${rs.room_no || ''} - 免费额度占用`,
            created_by: 'reconciliation'
          })
        }
        generated++
      }

      const monthQuota = getOrCreateMonthlyQuotaInternal(db, m)
      const actualFromRoomStatus = db.prepare(`
        SELECT
          SUM(CASE WHEN is_paid = 0 AND status = 'occupied' THEN quota_used ELSE 0 END) as used_quota,
          SUM(CASE WHEN is_paid = 1 AND status = 'occupied' THEN 1 ELSE 0 END) as paid_count,
          SUM(CASE WHEN is_paid = 1 AND status = 'occupied' THEN amount ELSE 0 END) as paid_amount
        FROM room_statuses
        WHERE date LIKE ? AND status = 'occupied'
      `).get(datePattern) as any

      db.prepare(`
        UPDATE monthly_quotas
        SET used_quota = ?, paid_count = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE month = ?
      `).run(
        actualFromRoomStatus.used_quota || 0,
        actualFromRoomStatus.paid_count || 0,
        actualFromRoomStatus.paid_amount || 0,
        m
      )

      return {
        deleted: (deleted1.changes || 0) + (deleted2.changes || 0),
        deleted_orphans: deleted2.changes || 0,
        generated,
        month: m,
        new_used_quota: actualFromRoomStatus.used_quota || 0,
        new_paid_count: actualFromRoomStatus.paid_count || 0,
        new_paid_amount: actualFromRoomStatus.paid_amount || 0
      }
    })
    return tx(month)
  })

  // ==================== 单独修复差异 ====================
  ipcMain.handle('db:fixReconciliationDiff', (_e, params: any) => {
    const db = getDb()
    const { month, diffIds } = params
    const datePattern = month + '%'

    const tx = db.transaction(() => {
      const sideBySide = db.prepare(`
        SELECT
          rs.id as room_status_id,
          rs.room_id,
          r.room_no,
          r.room_name,
          rs.date,
          rs.status as rs_status,
          rs.is_paid as rs_is_paid,
          rs.quota_used as rs_quota_used,
          rs.amount as rs_amount,
          cr.id as cr_id,
          cr.type as cr_type,
          cr.quota_used as cr_quota_used,
          cr.amount as cr_amount
        FROM room_statuses rs
        LEFT JOIN rooms r ON rs.room_id = r.id
        LEFT JOIN consumption_records cr ON rs.id = cr.room_status_id
        WHERE rs.date LIKE ? AND rs.status != 'available'
        ORDER BY rs.date ASC, rs.room_id ASC
      `).all(datePattern) as any[]

      const orphanRecords = db.prepare(`
        SELECT
          cr.id as cr_id,
          cr.room_id,
          r.room_no,
          r.room_name,
          cr.date,
          cr.type as cr_type,
          cr.quota_used as cr_quota_used,
          cr.amount as cr_amount
        FROM consumption_records cr
        LEFT JOIN rooms r ON cr.room_id = r.id
        WHERE cr.date LIKE ? AND cr.room_status_id IS NOT NULL
          AND cr.room_status_id NOT IN (SELECT id FROM room_statuses)
        ORDER BY cr.date ASC
      `).all(datePattern) as any[]

      const allDiffs: any[] = []
      let diffId = 1
      for (const row of sideBySide) {
        let issues: string[] = []
        if (row.rs_status === 'occupied' && row.rs_is_paid === 0 && row.rs_quota_used > 0) {
          if (!row.cr_id || row.cr_type !== 'quota' || Math.abs(row.cr_quota_used || 0) !== row.rs_quota_used) {
            issues.push('免费占用但流水缺失或不匹配')
          }
        }
        if (row.rs_status === 'occupied' && row.rs_is_paid === 1) {
          if (!row.cr_id || row.cr_type !== 'paid' || Math.abs(row.cr_amount || 0) !== row.rs_amount) {
            issues.push('自费占用但流水缺失或金额不匹配')
          }
        }
        if (row.rs_status === 'blocked') {
          if (row.cr_id) {
            issues.push('锁房状态但存在消费流水')
          }
        }
        if (issues.length > 0) {
          allDiffs.push({
            id: diffId++,
            type: 'mismatch',
            room_id: row.room_id,
            room_no: row.room_no,
            room_name: row.room_name,
            date: row.date,
            issues,
            room_status: { status: row.rs_status, is_paid: row.rs_is_paid, quota_used: row.rs_quota_used, amount: row.rs_amount },
            consumption: row.cr_id ? { type: row.cr_type, quota_used: row.cr_quota_used, amount: row.cr_amount } : null,
            raw: row
          })
        }
      }
      for (const row of orphanRecords) {
        allDiffs.push({
          id: diffId++,
          type: 'orphan',
          room_id: row.room_id,
          room_no: row.room_no,
          room_name: row.room_name,
          date: row.date,
          issues: ['消费流水存在但对应房态已删除'],
          room_status: null,
          consumption: { type: row.cr_type, quota_used: row.cr_quota_used, amount: row.cr_amount },
          raw: row
        })
      }

      const selectedDiffs = allDiffs.filter(d => diffIds.includes(d.id))
      let fixed = 0
      const errors: string[] = []
      const results: any[] = []

      for (const diff of selectedDiffs) {
        try {
          let before = ''
          let after = ''

          if (diff.type === 'mismatch' && diff.room_status) {
            before = `房态: ${diff.room_status.status}/${diff.room_status.is_paid ? '自费' : '免费'}, 流水: ${diff.consumption ? diff.consumption.type + ' ¥' + diff.consumption.amount : '无'}`

            if (diff.raw.cr_id) {
              db.prepare('DELETE FROM consumption_records WHERE id = ?').run(diff.raw.cr_id)
            }

            if (diff.room_status.status === 'occupied') {
              if (diff.room_status.is_paid === 1) {
                addConsumptionRecordInternal(db, {
                  room_id: diff.room_id,
                  room_status_id: diff.raw.room_status_id,
                  date: diff.date,
                  type: 'paid',
                  amount: diff.room_status.amount,
                  quota_used: 0,
                  description: `对账修复 - ${diff.room_no} - 自费挂房`,
                  created_by: 'manual_fix'
                })
                after = `已生成自费流水 ¥${diff.room_status.amount}`
              } else {
                addConsumptionRecordInternal(db, {
                  room_id: diff.room_id,
                  room_status_id: diff.raw.room_status_id,
                  date: diff.date,
                  type: 'quota',
                  amount: 0,
                  quota_used: -(diff.room_status.quota_used || 1),
                  description: `对账修复 - ${diff.room_no} - 免费额度占用`,
                  created_by: 'manual_fix'
                })
                after = `已生成免费额度流水 ${diff.room_status.quota_used || 1}天`
              }
            } else if (diff.room_status.status === 'blocked') {
              after = '已删除锁房对应的流水'
            }
          } else if (diff.type === 'orphan' && diff.consumption) {
            before = `孤立流水: ${diff.consumption.type} ¥${diff.consumption.amount}`
            db.prepare('DELETE FROM consumption_records WHERE id = ?').run(diff.raw.cr_id)
            after = '已删除孤立流水'
          }

          const monthQuota = getOrCreateMonthlyQuotaInternal(db, month)
          const actualFromRoomStatus = db.prepare(`
            SELECT
              SUM(CASE WHEN is_paid = 0 AND status = 'occupied' THEN quota_used ELSE 0 END) as used_quota,
              SUM(CASE WHEN is_paid = 1 AND status = 'occupied' THEN 1 ELSE 0 END) as paid_count,
              SUM(CASE WHEN is_paid = 1 AND status = 'occupied' THEN amount ELSE 0 END) as paid_amount
            FROM room_statuses
            WHERE date LIKE ? AND status = 'occupied'
          `).get(datePattern) as any

          db.prepare(`
            UPDATE monthly_quotas
            SET used_quota = ?, paid_count = ?, paid_amount = ?, updated_at = CURRENT_TIMESTAMP
            WHERE month = ?
          `).run(
            actualFromRoomStatus.used_quota || 0,
            actualFromRoomStatus.paid_count || 0,
            actualFromRoomStatus.paid_amount || 0,
            month
          )

          fixed++
          results.push({ id: diff.id, before, after, success: true })
        } catch (e: any) {
          errors.push(`${diff.room_no} ${diff.date}: ${e.message}`)
          results.push({ id: diff.id, success: false, error: e.message })
        }
      }

      return { fixed, errors, results }
    })

    return tx()
  })

  // ==================== 对账汇总 ====================
  ipcMain.handle('db:getConsumptionMonthlySummary', (_e, month: string) => {
    const db = getDb()
    return db.prepare(`
      SELECT
        SUM(CASE WHEN type = 'quota' AND room_id > 0 THEN ABS(quota_used) ELSE 0 END) as quota_used,
        SUM(CASE WHEN type = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN type = 'paid' THEN amount ELSE 0 END) as paid_amount,
        COUNT(*) as total_records
      FROM consumption_records
      WHERE date LIKE ? AND room_id > 0
    `).get(month + '%')
  })

  ipcMain.handle('db:getConsumptionRoomRanking', (_e, month: string) => {
    const db = getDb()
    return db.prepare(`
      SELECT
        cr.room_id,
        r.room_no,
        r.room_name,
        SUM(CASE WHEN cr.type = 'quota' AND cr.room_id > 0 THEN ABS(cr.quota_used) ELSE 0 END) as quota_used,
        SUM(CASE WHEN cr.type = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN cr.type = 'paid' THEN cr.amount ELSE 0 END) as paid_amount,
        COUNT(*) as total_days
      FROM consumption_records cr
      LEFT JOIN rooms r ON cr.room_id = r.id
      WHERE cr.date LIKE ? AND cr.room_id > 0
      GROUP BY cr.room_id, r.room_no, r.room_name
      ORDER BY paid_amount DESC, quota_used DESC
    `).all(month + '%')
  })

  ipcMain.handle('db:getRoomDailyConsumption', (_e, params: any) => {
    const db = getDb()
    const { roomId, month } = params
    return db.prepare(`
      SELECT cr.*, r.room_no, r.room_name
      FROM consumption_records cr
      LEFT JOIN rooms r ON cr.room_id = r.id
      WHERE cr.room_id = ? AND cr.date LIKE ? AND cr.room_id > 0
      ORDER BY cr.date ASC
    `).all(roomId, month + '%')
  })
}

// ==================== 核心事务：保存房态（新增/更新统一入口） ====================
function saveRoomStatusTransaction(db: any, s: any) {
  const tx = db.transaction((input: any) => {
    const config = db.prepare('SELECT paid_price_per_day FROM quota_configs ORDER BY id DESC LIMIT 1').get() as any
    const paidPrice = config?.paid_price_per_day || 100

    const existing = db.prepare('SELECT id FROM room_statuses WHERE room_id = ? AND date = ?').get(input.room_id, input.date) as { id?: number } | undefined

    let statusId: number | bigint
    let oldQuotaUsed = 0
    let oldIsPaid = 0
    let oldStatus = ''
    let oldAmount = 0

    if (existing) {
      const old = db.prepare('SELECT quota_used, is_paid, status, amount FROM room_statuses WHERE id = ?').get(existing.id) as any
      oldQuotaUsed = old?.quota_used || 0
      oldIsPaid = old?.is_paid || 0
      oldStatus = old?.status || ''
      oldAmount = old?.amount || 0

      const oldMonth = dayjs(input.date).format('YYYY-MM')
      if (oldQuotaUsed > 0) {
        refundQuotaInternal(db, { month: oldMonth, amount: oldQuotaUsed })
      }
      if (oldIsPaid > 0) {
        refundPaidInternal(db, { month: oldMonth, count: 1, amount: oldAmount })
      }
      db.prepare('DELETE FROM consumption_records WHERE room_status_id = ?').run(existing.id)

      db.prepare(`
        UPDATE room_statuses SET status=?, source=?, cycle_rule_id=?, quota_used=?,
        is_paid=?, amount=?, order_no=?, guest_name=?, guest_phone=?, remarks=?,
        updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(
        input.status, input.source || 'manual', input.cycle_rule_id || null,
        0, 0, 0,
        input.order_no, input.guest_name, input.guest_phone, input.remarks, existing.id
      )
      statusId = existing.id as number
    } else {
      const result = db.prepare(`
        INSERT INTO room_statuses (room_id, date, status, source, cycle_rule_id,
        quota_used, is_paid, amount, order_no, guest_name, guest_phone, remarks)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)
      `).run(
        input.room_id, input.date, input.status, input.source || 'manual', input.cycle_rule_id || null,
        input.order_no, input.guest_name, input.guest_phone, input.remarks
      )
      statusId = result.lastInsertRowid
    }

    const month = dayjs(input.date).format('YYYY-MM')
    const mq = getOrCreateMonthlyQuotaInternal(db, month)

    if (input.status === 'occupied' && input.is_paid) {
      const finalAmount = input.amount || paidPrice
      db.prepare('UPDATE room_statuses SET quota_used=0, is_paid=1, amount=? WHERE id=?')
        .run(finalAmount, statusId)
      addConsumptionRecordInternal(db, {
        room_status_id: Number(statusId),
        room_id: input.room_id,
        date: input.date,
        type: 'paid',
        amount: finalAmount,
        quota_used: 0,
        description: input.source === 'cycle'
          ? `周期挂房(自费)`
          : `手动挂房(自费)`
      })
    } else if (input.status === 'occupied' && !input.is_paid) {
      if (mq.used_quota < mq.total_quota) {
        db.prepare('UPDATE room_statuses SET quota_used=1, is_paid=0, amount=0 WHERE id=?')
          .run(statusId)
        updateMonthlyQuotaUsedInternal(db, month, 1)
        addConsumptionRecordInternal(db, {
          room_status_id: Number(statusId),
          room_id: input.room_id,
          date: input.date,
          type: 'quota',
          amount: 0,
          quota_used: 1,
          description: input.source === 'cycle'
            ? `周期挂房(免费额度)`
            : `手动挂房(免费额度)`
        })
      } else {
        const finalAmount = input.amount || paidPrice
        db.prepare('UPDATE room_statuses SET quota_used=0, is_paid=1, amount=? WHERE id=?')
          .run(finalAmount, statusId)
        addConsumptionRecordInternal(db, {
          room_status_id: Number(statusId),
          room_id: input.room_id,
          date: input.date,
          type: 'paid',
          amount: finalAmount,
          quota_used: 0,
          description: '额度不足，自动转自费'
        })
      }
    }

    return { id: statusId, isNew: !existing }
  })

  return tx(s)
}

// ==================== 额度重置：只发放新月份额度，不改动已有房态 ====================
function resetMonthlyQuotaNewLogic(db: any, month: string) {
  const tx = db.transaction((m: string) => {
    const config = db.prepare('SELECT monthly_free_quota, paid_price_per_day FROM quota_configs ORDER BY id DESC LIMIT 1').get() as any
    const quota = config?.monthly_free_quota || 30

    const existing = db.prepare('SELECT id, used_quota FROM monthly_quotas WHERE month = ?').get(m) as { id?: number; used_quota?: number } | undefined

    if (existing) {
      const newUsed = existing.used_quota || 0
      db.prepare(`
        UPDATE monthly_quotas SET total_quota=?, used_quota=?, updated_at=CURRENT_TIMESTAMP WHERE month=?
      `).run(quota, newUsed, m)
    } else {
      db.prepare(`
        INSERT INTO monthly_quotas (month, total_quota, used_quota)
        VALUES (?, ?, 0)
      `).run(m, quota)
    }

    return true
  })
  return tx(month)
}

// ==================== 内部辅助函数 ====================
function getOrCreateMonthlyQuotaInternal(db: any, month: string) {
  const existing = db.prepare('SELECT * FROM monthly_quotas WHERE month = ?').get(month)
  if (existing) return existing

  const config = db.prepare('SELECT monthly_free_quota FROM quota_configs ORDER BY id DESC LIMIT 1').get() as any
  const quota = config?.monthly_free_quota || 30

  db.prepare(`
    INSERT INTO monthly_quotas (month, total_quota, used_quota)
    VALUES (?, ?, 0)
  `).run(month, quota)

  return db.prepare('SELECT * FROM monthly_quotas WHERE month = ?').get(month)
}

function useQuotaInternal(db: any, params: any) {
  const tx = db.transaction((p: any) => {
    const mq = getOrCreateMonthlyQuotaInternal(db, p.month)
    let usedQuota = 0
    let isPaid = 0
    const config = db.prepare('SELECT paid_price_per_day FROM quota_configs ORDER BY id DESC LIMIT 1').get() as any
    const paidPrice = config?.paid_price_per_day || 100

    if (mq.used_quota < mq.total_quota) {
      usedQuota = 1
      updateMonthlyQuotaUsedInternal(db, p.month, 1)
    } else {
      isPaid = 1
    }

    if (p.room_status_id && usedQuota) {
      db.prepare('UPDATE room_statuses SET quota_used=1, is_paid=0, amount=0 WHERE id=?').run(p.room_status_id)
    }
    if (p.room_status_id && isPaid) {
      db.prepare('UPDATE room_statuses SET quota_used=0, is_paid=1, amount=? WHERE id=?').run(paidPrice, p.room_status_id)
      addConsumptionRecordInternal(db, {
        room_status_id: p.room_status_id,
        room_id: p.room_id,
        date: p.date,
        type: 'paid',
        amount: paidPrice,
        quota_used: 0,
        description: '额度不足，自动转自费'
      })
    }

    return { usedQuota, isPaid, remaining: mq.total_quota - mq.used_quota - usedQuota }
  })
  return tx(params)
}

function refundQuotaInternal(db: any, params: any) {
  const tx = db.transaction((p: any) => {
    const mq = db.prepare('SELECT * FROM monthly_quotas WHERE month = ?').get(p.month)
    if (mq) {
      const newUsed = Math.max(0, mq.used_quota - (p.amount || 1))
      db.prepare('UPDATE monthly_quotas SET used_quota=?, updated_at=CURRENT_TIMESTAMP WHERE month=?')
        .run(newUsed, p.month)
    }
    return true
  })
  return tx(params)
}

function refundPaidInternal(db: any, params: any) {
  const tx = db.transaction((p: any) => {
    const mq = db.prepare('SELECT * FROM monthly_quotas WHERE month = ?').get(p.month)
    if (mq) {
      const newPaidCount = Math.max(0, (mq.paid_count || 0) - (p.count || 1))
      const newPaidAmount = Math.max(0, (mq.paid_amount || 0) - (p.amount || 0))
      db.prepare(`
        UPDATE monthly_quotas SET paid_count=?, paid_amount=?, updated_at=CURRENT_TIMESTAMP
        WHERE month=?
      `).run(newPaidCount, newPaidAmount, p.month)
    }
    return true
  })
  return tx(params)
}

function updateMonthlyQuotaUsedInternal(db: any, month: string, delta: number) {
  getOrCreateMonthlyQuotaInternal(db, month)
  const mq = db.prepare('SELECT * FROM monthly_quotas WHERE month = ?').get(month)
  const newUsed = Math.max(0, mq.used_quota + delta)
  db.prepare('UPDATE monthly_quotas SET used_quota=?, updated_at=CURRENT_TIMESTAMP WHERE month=?')
    .run(newUsed, month)
}

function addConsumptionRecordInternal(db: any, record: any) {
  const tx = db.transaction((r: any) => {
    const result = db.prepare(`
      INSERT INTO consumption_records (room_status_id, room_id, date, type, amount, quota_used, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      r.room_status_id || null, r.room_id, r.date, r.type,
      r.amount || 0, r.quota_used || 0, r.description
    )

    if (r.type === 'paid') {
      const month = dayjs(r.date).format('YYYY-MM')
      getOrCreateMonthlyQuotaInternal(db, month)
      db.prepare(`
        UPDATE monthly_quotas SET paid_count = paid_count + 1, paid_amount = paid_amount + ?
        WHERE month = ?
      `).run(r.amount || 0, month)
    }

    return { id: result.lastInsertRowid }
  })
  return tx(record)
}
