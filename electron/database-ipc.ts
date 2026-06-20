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
      const rs = db.prepare('SELECT room_id, date, quota_used, is_paid FROM room_statuses WHERE id = ?').get(statusId) as any
      if (rs) {
        if (rs.quota_used) {
          refundQuotaInternal(db, { month: dayjs(rs.date).format('YYYY-MM'), amount: rs.quota_used })
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
      WHERE 1=1
    `
    const args: any[] = []

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
    args.push(params?.limit || 100, params?.offset || 0)

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

      if (oldQuotaUsed > 0) {
        refundQuotaInternal(db, { month: dayjs(input.date).format('YYYY-MM'), amount: oldQuotaUsed })
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
