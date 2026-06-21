import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

export function initDatabase() {
  const dbPath = join(app.getPath('userData'), 'rental_management.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  createTables()
  initDefaultData()
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

function createTables() {
  const dbInstance = getDb()

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_no TEXT NOT NULL UNIQUE,
      room_name TEXT NOT NULL,
      room_type TEXT,
      floor INTEGER,
      area REAL,
      base_price REAL,
      status TEXT DEFAULT 'active',
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cycle_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      room_ids TEXT NOT NULL,
      weekdays TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      check_in_time TEXT DEFAULT '14:00',
      check_out_time TEXT DEFAULT '12:00',
      status TEXT DEFAULT 'active',
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS room_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      cycle_rule_id INTEGER,
      quota_used INTEGER DEFAULT 0,
      is_paid INTEGER DEFAULT 0,
      amount REAL DEFAULT 0,
      order_no TEXT,
      guest_name TEXT,
      guest_phone TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, date)
    );

    CREATE TABLE IF NOT EXISTS quota_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monthly_free_quota INTEGER NOT NULL DEFAULT 30,
      paid_price_per_day REAL NOT NULL DEFAULT 100,
      reset_day INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS monthly_quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      total_quota INTEGER NOT NULL,
      used_quota INTEGER NOT NULL DEFAULT 0,
      paid_count INTEGER NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consumption_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_status_id INTEGER,
      room_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      quota_used INTEGER DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cleaning_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cleaning_hours INTEGER NOT NULL DEFAULT 4,
      buffer_hours INTEGER NOT NULL DEFAULT 2,
      auto_assign INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cleaning_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      room_status_id INTEGER,
      task_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      cleaner TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batch_operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      operator TEXT DEFAULT 'system',
      target_status TEXT,
      target_is_paid INTEGER DEFAULT 0,
      target_amount REAL DEFAULT 0,
      room_ids TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      affected_count INTEGER NOT NULL DEFAULT 0,
      snapshot TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

function initDefaultData() {
  const dbInstance = getDb()

  const quotaConfig = dbInstance.prepare('SELECT COUNT(*) as count FROM quota_configs').get() as { count: number }
  if (quotaConfig.count === 0) {
    dbInstance.prepare(`
      INSERT INTO quota_configs (monthly_free_quota, paid_price_per_day, reset_day)
      VALUES (30, 100, 1)
    `).run()
  }

  const cleaningConfig = dbInstance.prepare('SELECT COUNT(*) as count FROM cleaning_configs').get() as { count: number }
  if (cleaningConfig.count === 0) {
    dbInstance.prepare(`
      INSERT INTO cleaning_configs (cleaning_hours, buffer_hours, auto_assign)
      VALUES (4, 2, 1)
    `).run()
  }
}
