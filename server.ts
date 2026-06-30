import dotenv from "dotenv";
import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import crypto from "node:crypto";

// Load env (prefer .env.local, fallback to .env)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const gemini = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

function requireGemini() {
  if (!gemini) {
    const err = new Error("Missing GEMINI_API_KEY");
    (err as any).code = "MISSING_GEMINI_API_KEY";
    throw err;
  }
  return gemini;
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function safeParseJsonArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type DailyLogRow = {
  date: string;
  symptoms: string;
  pain: number | null;
  mood: string | null;
  notes: string | null;
  flow: string | null;
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  dob: string | null;
};

type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "developer" | (string & {});
  created_at: string;
  last_login_at: string | null;
};

type ActiveUserSnapshot = {
  user_id: number;
  user_name: string;
  email: string;
  last_seen_at: string;
  active_seconds_today: number;
};

const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE || "";
const ADMIN_SIGNUP_OPEN = (process.env.ADMIN_SIGNUP_OPEN || "").toLowerCase() === "true";
const ADMIN_SESSION_TTL_DAYS = process.env.ADMIN_SESSION_TTL_DAYS
  ? Math.max(1, Number(process.env.ADMIN_SESSION_TTL_DAYS))
  : 7;

const DB_PROVIDER = (process.env.DB_PROVIDER || "sqlite").toLowerCase(); // "mysql" | "sqlite"

const sqliteDb = DB_PROVIDER === "sqlite" ? new Database("database.sqlite") : null;

const mysqlPool =
  DB_PROVIDER === "mysql"
    ? mysql.createPool({
        host: process.env.MYSQL_HOST || "127.0.0.1",
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "cycle_track_ai",
        port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true,
      })
    : null;

async function initDb() {
  if (sqliteDb) {
    sqliteDb.exec(`PRAGMA foreign_keys = ON;`);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        symptoms TEXT,
        pain INTEGER,
        mood TEXT,
        notes TEXT,
        flow TEXT,
        PRIMARY KEY (user_id, date)
      );
      
      CREATE TABLE IF NOT EXISTS period_dates (
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        PRIMARY KEY (user_id, date)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        dob TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        target_group TEXT NOT NULL DEFAULT 'all',
        target_user_id INTEGER, -- NULL means send to everyone
        scheduled_for TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS ai_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        prediction_date TEXT NOT NULL,
        actual_date TEXT,
        accuracy_offset INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_activity_daily (
        user_id INTEGER NOT NULL,
        activity_date TEXT NOT NULL,
        active_seconds INTEGER NOT NULL DEFAULT 0,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, activity_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON admin_sessions(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
      CREATE INDEX IF NOT EXISTS idx_feedback_is_resolved ON feedback(is_resolved);
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_user_id ON ai_predictions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activity_daily_last_seen_at ON user_activity_daily(last_seen_at);
    `);

    // Dynamic column updates for existing SQLite users table
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));`); } catch {}
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT;`); } catch {}
    try { sqliteDb.exec(`ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;`); } catch {}
    try { sqliteDb.exec(`ALTER TABLE logs ADD COLUMN flow TEXT;`); } catch {}
    try { sqliteDb.exec(`ALTER TABLE notifications ADD COLUMN target_group TEXT NOT NULL DEFAULT 'all';`); } catch {}
    try { sqliteDb.exec(`ALTER TABLE notifications ADD COLUMN scheduled_for TEXT;`); } catch {}
    try { sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);`); } catch {}
    try { sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_user_activity_daily_last_seen_at ON user_activity_daily(last_seen_at);`); } catch {}

    try {
      sqliteDb.exec(`ALTER TABLE users ADD COLUMN dob TEXT;`);
    } catch {
      // ignore
    }

    // Migrate admin_users password_hash to password
    try {
      const adminCols = sqliteDb.prepare(`PRAGMA table_info('admin_users')`).all() as any[];
      const hasPassword = adminCols.some(c => c.name === 'password');
      const hasPasswordHash = adminCols.some(c => c.name === 'password_hash');

      if (!hasPassword && hasPasswordHash) {
        sqliteDb.exec(`ALTER TABLE admin_users RENAME COLUMN password_hash TO password;`);
      } else if (!hasPassword) {
        sqliteDb.exec(`ALTER TABLE admin_users ADD COLUMN password TEXT;`);
        sqliteDb.exec(`UPDATE admin_users SET password = '' WHERE password IS NULL;`);
      }
      try {
        sqliteDb.exec(`ALTER TABLE admin_users DROP COLUMN password_hash;`);
      } catch {}
    } catch {
      // ignore migration errors
    }

    // Migrate old SQLite schema (single-user) if needed
    try {
      const logsCols = sqliteDb.prepare(`PRAGMA table_info('logs')`).all() as any[];
      const hasUserId = logsCols.some(c => c.name === 'user_id');
      const hasCompositePk = logsCols.some(c => c.pk === 1) && logsCols.length > 0;
      if (!hasUserId || !hasCompositePk) {
        sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS logs_v2 (
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            symptoms TEXT,
            pain INTEGER,
            mood TEXT,
            notes TEXT,
            flow TEXT,
            PRIMARY KEY (user_id, date)
          );
        `);
        sqliteDb.exec(`
          INSERT OR IGNORE INTO logs_v2 (user_id, date, symptoms, pain, mood, notes, flow)
          SELECT 1, date, symptoms, pain, mood, notes, NULL FROM logs;
        `);
        sqliteDb.exec(`DROP TABLE IF EXISTS logs;`);
        sqliteDb.exec(`ALTER TABLE logs_v2 RENAME TO logs;`);
      }
    } catch {
      // ignore migration errors
    }

    try {
      const pdCols = sqliteDb.prepare(`PRAGMA table_info('period_dates')`).all() as any[];
      const hasUserId = pdCols.some(c => c.name === 'user_id');
      if (!hasUserId) {
        sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS period_dates_v2 (
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            PRIMARY KEY (user_id, date)
          );
        `);
        sqliteDb.exec(`
          INSERT OR IGNORE INTO period_dates_v2 (user_id, date)
          SELECT 1, date FROM period_dates;
        `);
        sqliteDb.exec(`DROP TABLE IF EXISTS period_dates;`);
        sqliteDb.exec(`ALTER TABLE period_dates_v2 RENAME TO period_dates;`);
      }
    } catch {
      // ignore migration errors
    }
    return;
  }

  if (!mysqlPool) throw new Error("DB_PROVIDER must be 'sqlite' or 'mysql'");

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      dob DATE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      INDEX idx_users_is_active (is_active)
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      is_resolved TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_feedback_is_resolved (is_resolved),
      CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      target_group VARCHAR(50) NOT NULL DEFAULT 'all',
      target_user_id INT NULL,
      scheduled_for DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_notifications_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      \`key\` VARCHAR(100) NOT NULL PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS logs (
      user_id INT NOT NULL,
      date DATE NOT NULL,
      symptoms TEXT,
      pain INT,
      mood VARCHAR(255),
      notes TEXT,
      flow VARCHAR(50),
      PRIMARY KEY (user_id, date),
      INDEX idx_logs_user_id (user_id),
      CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS period_dates (
      user_id INT NOT NULL,
      date DATE NOT NULL,
      PRIMARY KEY (user_id, date),
      INDEX idx_period_dates_user_id (user_id),
      CONSTRAINT fk_period_dates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME NULL
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS ai_predictions (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      prediction_date DATE NOT NULL,
      actual_date DATE NULL,
      accuracy_offset INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ai_predictions_user_id (user_id),
      CONSTRAINT fk_ai_predictions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS user_activity_daily (
      user_id INT NOT NULL,
      activity_date DATE NOT NULL,
      active_seconds INT NOT NULL DEFAULT 0,
      last_seen_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, activity_date),
      INDEX idx_user_activity_daily_last_seen_at (last_seen_at),
      CONSTRAINT fk_user_activity_daily_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      admin_user_id INT NOT NULL,
      token VARCHAR(128) NOT NULL UNIQUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      ip VARCHAR(45) NULL,
      user_agent VARCHAR(512) NULL,
      INDEX idx_admin_sessions_admin_user_id (admin_user_id),
      INDEX idx_admin_sessions_expires_at (expires_at),
      CONSTRAINT fk_admin_sessions_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    )
  `);

  // Dynamic column updates for existing MySQL users table
  try { await mysqlPool.execute(`ALTER TABLE users ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`); } catch {}
  try { await mysqlPool.execute(`ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL`); } catch {}
  try { await mysqlPool.execute(`ALTER TABLE users ADD COLUMN is_active TINYINT NOT NULL DEFAULT 1`); } catch {}
  try { await mysqlPool.execute(`ALTER TABLE logs ADD COLUMN flow VARCHAR(50) NULL`); } catch {}
  try { await mysqlPool.execute(`ALTER TABLE notifications ADD COLUMN target_group VARCHAR(50) NOT NULL DEFAULT 'all'`); } catch {}
  try { await mysqlPool.execute(`ALTER TABLE notifications ADD COLUMN scheduled_for DATETIME NULL`); } catch {}
  try { await mysqlPool.execute(`CREATE INDEX idx_users_is_active ON users(is_active)`); } catch {}

  // Migrate admin_users password_hash to password for MySQL
  try {
    const [cols] = await mysqlPool.execute(`SHOW COLUMNS FROM admin_users LIKE 'password'`);
    const [hashCols] = await mysqlPool.execute(`SHOW COLUMNS FROM admin_users LIKE 'password_hash'`);
    
    if (!(cols as any[]).length && (hashCols as any[]).length) {
      await mysqlPool.execute(`ALTER TABLE admin_users CHANGE password_hash password VARCHAR(255) NOT NULL`);
    } else if (!(cols as any[]).length) {
      await mysqlPool.execute(`ALTER TABLE admin_users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT ''`);
    }
    if ((hashCols as any[]).length) {
      await mysqlPool.execute(`ALTER TABLE admin_users DROP COLUMN password_hash`);
    }
  } catch {}

  // Migrate old MySQL schema (single-user) if needed
  try {
    await mysqlPool.execute(`ALTER TABLE logs ADD COLUMN user_id INT NULL`);
  } catch {}
  try {
    await mysqlPool.execute(`UPDATE logs SET user_id = 1 WHERE user_id IS NULL`);
  } catch {}
  try {
    await mysqlPool.execute(`ALTER TABLE logs MODIFY user_id INT NOT NULL`);
  } catch {}
  try {
    await mysqlPool.execute(`ALTER TABLE logs DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, date)`);
  } catch {}
  try {
    await mysqlPool.execute(`CREATE INDEX idx_logs_user_id ON logs (user_id)`);
  } catch {}

  try {
    await mysqlPool.execute(`ALTER TABLE period_dates ADD COLUMN user_id INT NULL`);
  } catch {}
  try {
    await mysqlPool.execute(`UPDATE period_dates SET user_id = 1 WHERE user_id IS NULL`);
  } catch {}
  try {
    await mysqlPool.execute(`ALTER TABLE period_dates MODIFY user_id INT NOT NULL`);
  } catch {}
  try {
    await mysqlPool.execute(`ALTER TABLE period_dates DROP PRIMARY KEY, ADD PRIMARY KEY (user_id, date)`);
  } catch {}
  try {
    await mysqlPool.execute(`CREATE INDEX idx_period_dates_user_id ON period_dates (user_id)`);
  } catch {}
}


function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(value ?? "").slice(0, 10);
}

function addDaysToIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffIsoDates(later: string, earlier: string): number {
  const laterDate = new Date(`${later}T00:00:00Z`).getTime();
  const earlierDate = new Date(`${earlier}T00:00:00Z`).getTime();
  return Math.round((laterDate - earlierDate) / (1000 * 60 * 60 * 24));
}

async function getAllLogs(userId: number): Promise<DailyLogRow[]> {
  if (sqliteDb) return sqliteDb.prepare("SELECT date, symptoms, pain, mood, notes, flow FROM logs WHERE user_id = ?").all(userId) as DailyLogRow[];
  const [rows] = await mysqlPool!.execute("SELECT date, symptoms, pain, mood, notes, flow FROM logs WHERE user_id = ?", [userId]);
  return rows as DailyLogRow[];
}

async function upsertLog(userId: number, log: {date: string; symptoms: any[]; pain: number; mood: string; notes: string; flow?: string | null}) {
  if (sqliteDb) {
    const stmt = sqliteDb.prepare(`
      INSERT INTO logs (user_id, date, symptoms, pain, mood, notes, flow)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        symptoms = excluded.symptoms,
        pain = excluded.pain,
        mood = excluded.mood,
        notes = excluded.notes,
        flow = excluded.flow
    `);
    stmt.run(userId, log.date, JSON.stringify(log.symptoms ?? []), log.pain, log.mood, log.notes, log.flow ?? null);
    return;
  }

  await mysqlPool!.execute(
    `
      INSERT INTO logs (user_id, date, symptoms, pain, mood, notes, flow)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        symptoms = VALUES(symptoms),
        pain = VALUES(pain),
        mood = VALUES(mood),
        notes = VALUES(notes),
        flow = VALUES(flow)
    `,
    [userId, log.date, JSON.stringify(log.symptoms ?? []), log.pain, log.mood, log.notes, log.flow ?? null],
  );
}

async function deleteAllLogs(userId: number) {
  if (sqliteDb) {
    sqliteDb.prepare("DELETE FROM logs WHERE user_id = ?").run(userId);
    return;
  }
  await mysqlPool!.execute("DELETE FROM logs WHERE user_id = ?", [userId]);
}

async function getPeriodDates(userId: number): Promise<string[]> {
  if (sqliteDb) {
    const rows = sqliteDb.prepare("SELECT date FROM period_dates WHERE user_id = ?").all(userId) as {date: string}[];
    return rows.map(r => r.date);
  }
  const [rows] = await mysqlPool!.execute("SELECT date FROM period_dates WHERE user_id = ? ORDER BY date ASC", [userId]);
  return (rows as any[]).map(r => normalizeDate(r.date));
}

async function savePeriodDates(userId: number, dates: string[]) {
  if (sqliteDb) {
    const insert = sqliteDb.prepare("INSERT OR IGNORE INTO period_dates (user_id, date) VALUES (?, ?)");
    const transaction = sqliteDb.transaction((datesToSave: string[]) => {
      sqliteDb.prepare("DELETE FROM period_dates WHERE user_id = ?").run(userId);
      for (const date of datesToSave) insert.run(userId, date);
    });
    transaction(dates.map(String));
    return;
  }

  const conn = await mysqlPool!.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM period_dates WHERE user_id = ?", [userId]);
    for (const date of dates) {
      await conn.execute("INSERT INTO period_dates (user_id, date) VALUES (?, ?)", [userId, date]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function signupUser(input: {name: string; email: string; password: string; dob: string}): Promise<UserRow & { created_at: string; is_active: number }> {
  const createdAt = nowIso();
  if (sqliteDb) {
    const stmt = sqliteDb.prepare("INSERT INTO users (name, email, password, dob, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?)");
    const info = stmt.run(input.name, input.email, input.password, input.dob, createdAt, 1);
    return { id: Number(info.lastInsertRowid), name: input.name, email: input.email, dob: input.dob, created_at: createdAt, is_active: 1 };
  }

  const [result] = await mysqlPool!.execute(
    "INSERT INTO users (name, email, password, dob, created_at, is_active) VALUES (?, ?, ?, ?, ?, ?)",
    [input.name, input.email, input.password, input.dob, createdAt, 1],
  );
  const insertId = (result as any).insertId as number;
  return { id: insertId, name: input.name, email: input.email, dob: input.dob, created_at: createdAt, is_active: 1 };
}

async function loginUser(email: string, password: string): Promise<(UserRow & { is_active: number }) | null> {
  const ts = nowIso();
  if (sqliteDb) {
    const user = sqliteDb
      .prepare("SELECT id, name, email, dob, is_active FROM users WHERE email = ? AND password = ?")
      .get(email, password) as any;
    if (!user) return null;
    sqliteDb.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(ts, user.id);
    return { id: Number(user.id), name: String(user.name), email: String(user.email), dob: user.dob, is_active: Number(user.is_active) };
  }

  const [rows] = await mysqlPool!.execute(
    "SELECT id, name, email, dob, is_active FROM users WHERE email = ? AND password = ? LIMIT 1",
    [email, password],
  );
  const arr = rows as any[];
  if (!arr.length) return null;
  const u = arr[0];
  await mysqlPool!.execute("UPDATE users SET last_login_at = ? WHERE id = ?", [ts, u.id]);
  return { id: Number(u.id), name: String(u.name), email: String(u.email), dob: u.dob ? String(u.dob).slice(0, 10) : null, is_active: Number(u.is_active) };
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}



async function adminCount(): Promise<number> {
  if (sqliteDb) {
    const row = sqliteDb.prepare("SELECT COUNT(*) as c FROM admin_users").get() as { c: number };
    return Number(row?.c ?? 0);
  }
  const [rows] = await mysqlPool!.execute("SELECT COUNT(*) as c FROM admin_users");
  const r = (rows as any[])[0];
  return Number(r?.c ?? 0);
}

async function adminListAdmins(input: { q?: string; limit?: number }): Promise<AdminUserRow[]> {
  const q = (input.q || "").trim();
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const like = `%${q}%`;

  if (sqliteDb) {
    const rows = q
      ? (sqliteDb
          .prepare(
            "SELECT id, name, email, role, created_at, last_login_at FROM admin_users WHERE name LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT ?",
          )
          .all(like, like, limit) as any[])
      : (sqliteDb
          .prepare("SELECT id, name, email, role, created_at, last_login_at FROM admin_users ORDER BY id DESC LIMIT ?")
          .all(limit) as any[]);

    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      role: String(r.role),
      created_at: String(r.created_at),
      last_login_at: r.last_login_at ? String(r.last_login_at) : null,
    })) as AdminUserRow[];
  }

  const [rows] = q
    ? await mysqlPool!.execute(
        "SELECT id, name, email, role, created_at, last_login_at FROM admin_users WHERE name LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT ?",
        [like, like, limit],
      )
    : await mysqlPool!.execute(
        "SELECT id, name, email, role, created_at, last_login_at FROM admin_users ORDER BY id DESC LIMIT ?",
        [limit],
      );

  return (rows as any[]).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    email: String(r.email),
    role: String(r.role),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : nowIso(),
    last_login_at: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
  })) as AdminUserRow[];
}

async function adminDeleteAdminUser(adminUserId: number) {
  if (sqliteDb) {
    const info = sqliteDb.prepare("DELETE FROM admin_users WHERE id = ?").run(adminUserId);
    return Number(info.changes ?? 0);
  }
  const [result] = await mysqlPool!.execute("DELETE FROM admin_users WHERE id = ?", [adminUserId]);
  return Number((result as any).affectedRows ?? 0);
}

async function adminResetAdminPassword(adminUserId: number, password: string) {
  if (sqliteDb) {
    const info = sqliteDb.prepare("UPDATE admin_users SET password = ? WHERE id = ?").run(password, adminUserId);
    return Number(info.changes ?? 0);
  }
  const [result] = await mysqlPool!.execute("UPDATE admin_users SET password = ? WHERE id = ?", [password, adminUserId]);
  return Number((result as any).affectedRows ?? 0);
}

async function adminUpdateAdminEmail(adminUserId: number, email: string) {
  if (sqliteDb) {
    const info = sqliteDb.prepare("UPDATE admin_users SET email = ? WHERE id = ?").run(email, adminUserId);
    return Number(info.changes ?? 0);
  }
  const [result] = await mysqlPool!.execute("UPDATE admin_users SET email = ? WHERE id = ?", [email, adminUserId]);
  return Number((result as any).affectedRows ?? 0);
}

async function createAdminUser(input: { name: string; email: string; password: string; role?: string }): Promise<AdminUserRow> {
  const createdAt = nowIso();
  const passwordPlain = input.password;
  const role = (input.role || "admin") as AdminUserRow["role"];

  if (sqliteDb) {
    const stmt = sqliteDb.prepare(
      "INSERT INTO admin_users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    const info = stmt.run(input.name, input.email, passwordPlain, role, createdAt);
    return {
      id: Number(info.lastInsertRowid),
      name: input.name,
      email: input.email,
      role,
      created_at: createdAt,
      last_login_at: null,
    };
  }

  const [result] = await mysqlPool!.execute(
    "INSERT INTO admin_users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)",
    [input.name, input.email, passwordPlain, role, createdAt],
  );
  const insertId = (result as any).insertId as number;
  return { id: insertId, name: input.name, email: input.email, role, created_at: createdAt, last_login_at: null };
}

async function findAdminByEmail(email: string): Promise<(AdminUserRow & { password: string }) | null> {
  if (sqliteDb) {
    const row = sqliteDb
      .prepare("SELECT id, name, email, role, created_at, last_login_at, password FROM admin_users WHERE email = ?")
      .get(email) as any;
    if (!row) return null;
    return {
      id: Number(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role),
      created_at: String(row.created_at),
      last_login_at: row.last_login_at ? String(row.last_login_at) : null,
      password: String(row.password),
    };
  }

  const [rows] = await mysqlPool!.execute(
    "SELECT id, name, email, role, created_at, last_login_at, password FROM admin_users WHERE email = ? LIMIT 1",
    [email],
  );
  const arr = rows as any[];
  if (!arr.length) return null;
  const row = arr[0];
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : nowIso(),
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    password: String(row.password),
  };
}

async function updateAdminLastLogin(adminUserId: number) {
  const ts = nowIso();
  if (sqliteDb) {
    sqliteDb.prepare("UPDATE admin_users SET last_login_at = ? WHERE id = ?").run(ts, adminUserId);
    return;
  }
  await mysqlPool!.execute("UPDATE admin_users SET last_login_at = ? WHERE id = ?", [ts, adminUserId]);
}

async function createAdminSession(input: { adminUserId: number; ip?: string; userAgent?: string }) {
  const token = randomToken();
  const createdAt = nowIso();
  const expiresAt = addDaysIso(ADMIN_SESSION_TTL_DAYS);
  const ip = input.ip ? String(input.ip).slice(0, 45) : null;
  const userAgent = input.userAgent ? String(input.userAgent).slice(0, 512) : null;

  if (sqliteDb) {
    sqliteDb
      .prepare(
        "INSERT INTO admin_sessions (admin_user_id, token, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(input.adminUserId, token, createdAt, expiresAt, createdAt, ip, userAgent);
    return { token, expires_at: expiresAt };
  }

  await mysqlPool!.execute(
    "INSERT INTO admin_sessions (admin_user_id, token, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [input.adminUserId, token, createdAt, expiresAt, createdAt, ip, userAgent],
  );
  return { token, expires_at: expiresAt };
}

async function deleteAdminSession(token: string) {
  if (sqliteDb) {
    sqliteDb.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
    return;
  }
  await mysqlPool!.execute("DELETE FROM admin_sessions WHERE token = ?", [token]);
}

async function getAdminFromToken(token: string): Promise<AdminUserRow | null> {
  const ts = nowIso();
  if (sqliteDb) {
    const row = sqliteDb.prepare(`
      SELECT au.id, au.name, au.email, au.role, au.created_at, au.last_login_at
      FROM admin_sessions s
      JOIN admin_users au ON au.id = s.admin_user_id
      WHERE s.token = ? AND s.expires_at > ?
      LIMIT 1
    `).get(token, ts) as any;
    if (!row) return null;
    sqliteDb.prepare("UPDATE admin_sessions SET last_seen_at = ? WHERE token = ?").run(ts, token);
    return {
      id: Number(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role),
      created_at: String(row.created_at),
      last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    };
  }

  const [rows] = await mysqlPool!.execute(
    `
      SELECT au.id, au.name, au.email, au.role, au.created_at, au.last_login_at
      FROM admin_sessions s
      JOIN admin_users au ON au.id = s.admin_user_id
      WHERE s.token = ? AND s.expires_at > ?
      LIMIT 1
    `,
    [token, ts],
  );
  const arr = rows as any[];
  if (!arr.length) return null;
  await mysqlPool!.execute("UPDATE admin_sessions SET last_seen_at = ? WHERE token = ?", [ts, token]);
  const row = arr[0];
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
    role: String(row.role),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : nowIso(),
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  };
}

function getClientIp(req: any): string | undefined {
  const xfwd = req.header?.("x-forwarded-for");
  if (typeof xfwd === "string" && xfwd.trim()) return xfwd.split(",")[0]!.trim();
  return typeof req.ip === "string" ? req.ip : undefined;
}

function getUserAgent(req: any): string | undefined {
  const ua = req.header?.("user-agent");
  return typeof ua === "string" ? ua : undefined;
}

function extractBearerToken(req: any): string | null {
  const value = req.header?.("authorization") || req.header?.("Authorization");
  if (typeof value !== "string") return null;
  const m = value.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

async function adminListUsers(input: { q?: string; limit?: number; offset?: number; status?: string }) {
  const q = (input.q || "").trim();
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const status = input.status; // 'active', 'inactive'
  const like = `%${q}%`;

  let whereClauses = [];
  let params: any[] = [];

  if (q) {
    whereClauses.push("(name LIKE ? OR email LIKE ?)");
    params.push(like, like);
  }

  if (status === "active") {
    whereClauses.push("is_active = 1");
  } else if (status === "inactive") {
    whereClauses.push("is_active = 0");
  }

  const whereStr = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";

  if (sqliteDb) {
    const rows = sqliteDb
      .prepare(`SELECT id, name, email, dob, created_at, last_login_at, is_active FROM users ${whereStr} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as any[];

    const total = sqliteDb.prepare(`SELECT COUNT(*) as c FROM users ${whereStr}`).get(...params) as any;

    const users = rows.map((r) => ({
      id: Number(r.id),
      name: r.name ? String(r.name) : "",
      email: r.email ? String(r.email) : "",
      dob: r.dob ? String(r.dob) : null,
      created_at: r.created_at ? String(r.created_at) : null,
      last_login_at: r.last_login_at ? String(r.last_login_at) : null,
      is_active: Number(r.is_active ?? 1),
    }));

    return { users, total: Number(total?.c ?? 0) };
  }

  const [rows] = await mysqlPool!.execute(
    `SELECT id, name, email, dob, created_at, last_login_at, is_active FROM users ${whereStr} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [totalRows] = await mysqlPool!.execute(`SELECT COUNT(*) as c FROM users ${whereStr}`, params);

  const users = (rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name ? String(r.name) : "",
    email: r.email ? String(r.email) : "",
    dob: r.dob ? normalizeDate(r.dob) : null,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    last_login_at: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
    is_active: Number(r.is_active ?? 1),
  }));

  return { users, total: Number((totalRows as any[])[0]?.c ?? 0) };
}

async function adminGetUsersStats() {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const realtimeUsage = await adminGetRealtimeUsage();

  if (sqliteDb) {
    const totalUsers = sqliteDb.prepare("SELECT COUNT(*) as c FROM users").get() as any;
    const activeToday = sqliteDb.prepare("SELECT COUNT(DISTINCT id) as c FROM users WHERE last_login_at >= ?").get(today) as any;
    const newThisMonth = sqliteDb.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= ?").get(firstDayOfMonth) as any;
    const inactiveUsers = sqliteDb.prepare("SELECT COUNT(*) as c FROM users WHERE is_active = 0").get() as any;

    return {
      total: Number(totalUsers?.c ?? 0),
      active_today: Number(activeToday?.c ?? 0),
      new_this_month: Number(newThisMonth?.c ?? 0),
      inactive: Number(inactiveUsers?.c ?? 0),
      active_now: realtimeUsage.active_now,
      total_used_today_seconds: realtimeUsage.total_used_today_seconds,
    };
  }

  const [[totalUsers], [activeToday], [newThisMonth], [inactiveUsers]] = await Promise.all([
    mysqlPool!.execute("SELECT COUNT(*) as c FROM users"),
    mysqlPool!.execute("SELECT COUNT(DISTINCT id) as c FROM users WHERE last_login_at >= ?", [today]),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM users WHERE created_at >= ?", [firstDayOfMonth]),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM users WHERE is_active = 0"),
  ]);

  return {
    total: Number((totalUsers as any[])[0]?.c ?? 0),
    active_today: Number((activeToday as any[])[0]?.c ?? 0),
    new_this_month: Number((newThisMonth as any[])[0]?.c ?? 0),
    inactive: Number((inactiveUsers as any[])[0]?.c ?? 0),
    active_now: realtimeUsage.active_now,
    total_used_today_seconds: realtimeUsage.total_used_today_seconds,
  };
}

async function getAllPeriodDateRows(): Promise<Array<{ user_id: number; date: string }>> {
  if (sqliteDb) {
    const rows = sqliteDb.prepare("SELECT user_id, date FROM period_dates ORDER BY user_id ASC, date ASC").all() as Array<{ user_id: number; date: string }>;
    return rows.map((row) => ({ user_id: Number(row.user_id), date: normalizeDate(row.date) }));
  }
  const [rows] = await mysqlPool!.execute("SELECT user_id, date FROM period_dates ORDER BY user_id ASC, date ASC");
  return (rows as Array<{ user_id: number; date: string }>).map((row) => ({
    user_id: Number((row as any).user_id),
    date: normalizeDate((row as any).date),
  }));
}

async function getAllAnalyticsLogs(): Promise<Array<{ user_id: number; date: string; symptoms: string[] }>> {
  if (sqliteDb) {
    const rows = sqliteDb.prepare("SELECT user_id, date, symptoms FROM logs ORDER BY user_id ASC, date ASC").all() as Array<{ user_id: number; date: string; symptoms: string }>;
    return rows.map((row) => ({
      user_id: Number(row.user_id),
      date: normalizeDate(row.date),
      symptoms: safeParseJsonArray<string>(row.symptoms),
    }));
  }
  const [rows] = await mysqlPool!.execute("SELECT user_id, date, symptoms FROM logs ORDER BY user_id ASC, date ASC");
  return (rows as any[]).map((row) => ({
    user_id: Number(row.user_id),
    date: normalizeDate(row.date),
    symptoms: safeParseJsonArray<string>(row.symptoms),
  }));
}

function buildPeriodsFromDates(rows: Array<{ user_id: number; date: string }>) {
  const grouped = new Map<number, string[]>();
  for (const row of rows) {
    const current = grouped.get(row.user_id) ?? [];
    current.push(row.date);
    grouped.set(row.user_id, current);
  }

  const periodsByUser = new Map<number, Array<{ start: string; end: string; duration: number; dates: string[] }>>();

  for (const [userId, dates] of grouped.entries()) {
    const sortedDates = Array.from(new Set(dates)).sort();
    const periods: Array<{ start: string; end: string; duration: number; dates: string[] }> = [];
    let current: string[] = [];

    for (const date of sortedDates) {
      if (!current.length) {
        current = [date];
        continue;
      }
      const prev = current[current.length - 1];
      if (diffIsoDates(date, prev) === 1) {
        current.push(date);
      } else {
        periods.push({
          start: current[0],
          end: current[current.length - 1],
          duration: current.length,
          dates: [...current],
        });
        current = [date];
      }
    }

    if (current.length) {
      periods.push({
        start: current[0],
        end: current[current.length - 1],
        duration: current.length,
        dates: [...current],
      });
    }

    periodsByUser.set(userId, periods);
  }

  return periodsByUser;
}

async function buildAdminAnalyticsSnapshot() {
  const [periodRows, logRows] = await Promise.all([getAllPeriodDateRows(), getAllAnalyticsLogs()]);
  const periodsByUser = buildPeriodsFromDates(periodRows);
  const symptomMap = new Map<string, number>();
  const logSymptomsByUserDate = new Map<string, string[]>();

  for (const log of logRows) {
    logSymptomsByUserDate.set(`${log.user_id}:${log.date}`, log.symptoms);
    for (const symptom of log.symptoms) {
      symptomMap.set(symptom, (symptomMap.get(symptom) ?? 0) + 1);
    }
  }

  const cycleRecords: Array<{
    id: number;
    user_id: number;
    cycleLength: number;
    periodDuration: number;
    symptoms: string[];
    predictionGenerated: number;
    dateLogged: string;
  }> = [];
  const derivedPredictions: Array<{
    user_id: number;
    prediction_date: string;
    actual_date: string;
    accuracy_offset: number;
    created_at: string;
  }> = [];
  const cycleLengths: number[] = [];
  const periodDurations: number[] = [];
  const userCycleLengths = new Map<number, number[]>();

  let recordId = 1;
  for (const [userId, periods] of periodsByUser.entries()) {
    const perUserCycleLengths: number[] = [];
    for (let i = 1; i < periods.length; i++) {
      const current = periods[i];
      const previous = periods[i - 1];
      const cycleLength = diffIsoDates(current.start, previous.start);
      const symptomSet = new Set<string>();

      for (const date of current.dates) {
        for (const symptom of logSymptomsByUserDate.get(`${userId}:${date}`) ?? []) {
          symptomSet.add(symptom);
        }
      }

      cycleRecords.push({
        id: recordId++,
        user_id: userId,
        cycleLength,
        periodDuration: current.duration,
        symptoms: Array.from(symptomSet),
        predictionGenerated: 1,
        dateLogged: current.start,
      });

      cycleLengths.push(cycleLength);
      periodDurations.push(current.duration);
      perUserCycleLengths.push(cycleLength);

      if (i >= 2) {
        const priorCycleLength = diffIsoDates(previous.start, periods[i - 2].start);
        const predictionDate = addDaysToIsoDate(previous.start, priorCycleLength);
        derivedPredictions.push({
          user_id: userId,
          prediction_date: predictionDate,
          actual_date: current.start,
          accuracy_offset: diffIsoDates(current.start, predictionDate),
          created_at: `${current.start}T00:00:00.000Z`,
        });
      }
    }
    if (perUserCycleLengths.length) userCycleLengths.set(userId, perUserCycleLengths);
  }

  const irregularUsers = Array.from(userCycleLengths.values()).filter((lengths) => {
    if (lengths.length < 2) return false;
    const avg = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    return lengths.some((value) => Math.abs(value - avg) > 5);
  }).length;

  return {
    cycleRecords,
    derivedPredictions,
    totalCycleRecords: cycleRecords.length,
    avgCycleLength: cycleLengths.length ? Number((cycleLengths.reduce((sum, value) => sum + value, 0) / cycleLengths.length).toFixed(1)) : 0,
    avgPeriodDuration: periodDurations.length ? Number((periodDurations.reduce((sum, value) => sum + value, 0) / periodDurations.length).toFixed(1)) : 0,
    irregularPercentage: userCycleLengths.size ? Math.round((irregularUsers / userCycleLengths.size) * 100) : 0,
    symptomCounts: Array.from(symptomMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    distribution: {
      short: cycleLengths.filter((value) => value < 21).length,
      normal: cycleLengths.filter((value) => value >= 21 && value <= 35).length,
      long: cycleLengths.filter((value) => value > 35).length,
    },
  };
}

async function adminGetUser(userId: number): Promise<any | null> {
  if (sqliteDb) {
    const row = sqliteDb.prepare("SELECT id, name, email, dob, created_at, last_login_at, is_active FROM users WHERE id = ?").get(userId) as any;
    if (!row) return null;
    
    const predCount = sqliteDb.prepare("SELECT COUNT(*) as c FROM ai_predictions WHERE user_id = ?").get(userId) as any;
    const lastLog = sqliteDb.prepare("SELECT MAX(date) as d FROM logs WHERE user_id = ?").get(userId) as any;
    
    const analytics = await buildAdminAnalyticsSnapshot();
    const derivedCount = analytics.derivedPredictions.filter((row) => row.user_id === userId).length;
    return { 
      id: Number(row.id), 
      name: row.name ? String(row.name) : "", 
      email: row.email ? String(row.email) : "", 
      dob: row.dob ? String(row.dob) : null,
      created_at: row.created_at ? String(row.created_at) : null,
      last_login_at: row.last_login_at ? String(row.last_login_at) : null,
      is_active: Number(row.is_active ?? 1),
      predictionsCount: Math.max(Number(predCount?.c ?? 0), derivedCount),
      lastCycleDate: lastLog?.d || null,
    };
  }
  const [rows] = await mysqlPool!.execute("SELECT id, name, email, dob, created_at, last_login_at, is_active FROM users WHERE id = ? LIMIT 1", [userId]);
  const arr = rows as any[];
  if (!arr.length) return null;
  const row = arr[0];

  const [preds] = await mysqlPool!.execute("SELECT COUNT(*) as c FROM ai_predictions WHERE user_id = ?", [userId]);
  const [logs] = await mysqlPool!.execute("SELECT MAX(date) as d FROM logs WHERE user_id = ?", [userId]);

  const analytics = await buildAdminAnalyticsSnapshot();
  const derivedCount = analytics.derivedPredictions.filter((row) => row.user_id === userId).length;
  return { 
    id: Number(row.id), 
    name: row.name ? String(row.name) : "", 
    email: row.email ? String(row.email) : "", 
    dob: row.dob ? normalizeDate(row.dob) : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    is_active: Number(row.is_active ?? 1),
    predictionsCount: Math.max(Number((preds as any[])[0]?.c ?? 0), derivedCount),
    lastCycleDate: (logs as any[])[0]?.d ? normalizeDate((logs as any[])[0].d) : null,
  };
}

async function adminToggleUserActive(userId: number, isActive: boolean) {
  const val = isActive ? 1 : 0;
  if (sqliteDb) {
    const info = sqliteDb.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(val, userId);
    return Number(info.changes ?? 0);
  }
  const [result] = await mysqlPool!.execute("UPDATE users SET is_active = ? WHERE id = ?", [val, userId]);
  return Number((result as any).affectedRows ?? 0);
}

async function adminGetCycleMonitoring() {
  // Aggregate stats from logs & period_dates
  if (sqliteDb) {
    const avgCycle = sqliteDb.prepare("SELECT AVG(JULIANDAY(date) - JULIANDAY(prev_date)) as avg FROM (SELECT user_id, date, LAG(date) OVER(PARTITION BY user_id ORDER BY date) as prev_date FROM period_dates)").get() as any;
    const commonSymptoms = sqliteDb.prepare("SELECT symptoms FROM logs WHERE symptoms IS NOT NULL AND symptoms != '[]'").all() as any[];
    
    // Simple frequency analysis for symptoms
    const symMap: Record<string, number> = {};
    commonSymptoms.forEach(row => {
      const arr = safeParseJsonArray(row.symptoms);
      arr.forEach(s => symMap[s] = (symMap[s] || 0) + 1);
    });

    return {
      avgCycleLength: Number(avgCycle?.avg || 28).toFixed(1),
      topSymptoms: Object.entries(symMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(e => ({ name: e[0], count: e[1] })),
      totalLogs: sqliteDb.prepare("SELECT COUNT(*) as c FROM logs").get() as any,
    };
  }
  
  // MySQL Aggregate
  const [avgRows] = await mysqlPool!.execute("SELECT AVG(DATEDIFF(date, prev_date)) as avg FROM (SELECT user_id, date, LAG(date) OVER(PARTITION BY user_id ORDER BY date) as prev_date FROM period_dates) t WHERE prev_date IS NOT NULL");
  const [symRows] = await mysqlPool!.execute("SELECT symptoms FROM logs WHERE symptoms IS NOT NULL");
  
  const symMap: Record<string, number> = {};
  (symRows as any[]).forEach(row => {
    const arr = safeParseJsonArray(row.symptoms);
    arr.forEach(s => symMap[s] = (symMap[s] || 0) + 1);
  });

  return {
    avgCycleLength: Number((avgRows as any[])[0]?.avg || 28).toFixed(1),
    topSymptoms: Object.entries(symMap).sort((a,b) => b[1] - a[1]).slice(0, 5).map(e => ({ name: e[0], count: e[1] })),
    totalLogs: (await mysqlPool!.execute("SELECT COUNT(*) as c FROM logs") as any[])[0][0].c,
  };
}

async function adminGetCycleSummary() {
  if (sqliteDb) {
    const snapshot = await buildAdminAnalyticsSnapshot();
    return {
      avgCycleLength: snapshot.avgCycleLength ? snapshot.avgCycleLength.toFixed(1) : "0.0",
      avgPeriodDuration: snapshot.avgPeriodDuration ? snapshot.avgPeriodDuration.toFixed(1) : "0.0",
      totalRecords: snapshot.totalCycleRecords,
      irregularPercentage: snapshot.irregularPercentage,
      symptoms: snapshot.symptomCounts.slice(0, 8),
      distribution: snapshot.distribution,
    };
  }

  const snapshot = await buildAdminAnalyticsSnapshot();
  return {
    avgCycleLength: snapshot.avgCycleLength ? snapshot.avgCycleLength.toFixed(1) : "0.0",
    avgPeriodDuration: snapshot.avgPeriodDuration ? snapshot.avgPeriodDuration.toFixed(1) : "0.0",
    totalRecords: snapshot.totalCycleRecords,
    irregularPercentage: snapshot.irregularPercentage,
    symptoms: snapshot.symptomCounts.slice(0, 8),
    distribution: snapshot.distribution,
  };
}

async function adminListAnonymizedCycles(filters: { minLength?: number; maxLength?: number; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }) {
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  const snapshot = await buildAdminAnalyticsSnapshot();
  const filtered = snapshot.cycleRecords.filter((record) => {
    if (filters.minLength !== undefined && record.cycleLength < filters.minLength) return false;
    if (filters.maxLength !== undefined && record.cycleLength > filters.maxLength) return false;
    if (filters.dateFrom && record.dateLogged < filters.dateFrom) return false;
    if (filters.dateTo && record.dateLogged > filters.dateTo) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.dateLogged.localeCompare(a.dateLogged));
  const pageRows = sorted.slice(offset, offset + limit).map((record, index) => ({
    id: offset + index + 1,
    cycleLength: record.cycleLength,
    periodDuration: record.periodDuration,
    symptoms: record.symptoms,
    predictionGenerated: record.predictionGenerated,
    dateLogged: record.dateLogged,
  }));

  return { cycles: pageRows, total: sorted.length };
}

async function adminListFeedback() {
  if (sqliteDb) return sqliteDb.prepare("SELECT f.*, u.name as user_name FROM feedback f JOIN users u ON u.id = f.user_id ORDER BY f.id DESC").all();
  const [rows] = await mysqlPool!.execute("SELECT f.*, u.name as user_name FROM feedback f JOIN users u ON u.id = f.user_id ORDER BY f.id DESC");
  return (rows as any[]);
}

async function adminResolveFeedback(id: number) {
  if (sqliteDb) return sqliteDb.prepare("UPDATE feedback SET is_resolved = 1 WHERE id = ?").run(id);
  return mysqlPool!.execute("UPDATE feedback SET is_resolved = 1 WHERE id = ?", [id]);
}

async function adminDeleteFeedback(id: number) {
  if (sqliteDb) return sqliteDb.prepare("DELETE FROM feedback WHERE id = ?").run(id);
  return mysqlPool!.execute("DELETE FROM feedback WHERE id = ?", [id]);
}

async function adminListArticles() {
  if (sqliteDb) return sqliteDb.prepare("SELECT a.*, au.name as author_name FROM articles a LEFT JOIN admin_users au ON au.id = a.author_id ORDER BY a.id DESC").all();
  const [rows] = await mysqlPool!.execute("SELECT a.*, au.name as author_name FROM articles a LEFT JOIN admin_users au ON au.id = a.author_id ORDER BY a.id DESC");
  return rows;
}

async function adminUpsertArticle(a: { id?: number; title: string; category: string; content: string; author_id: number; is_published: number }) {
  if (sqliteDb) {
    if (a.id) {
      return sqliteDb.prepare("UPDATE articles SET title = ?, category = ?, content = ?, is_published = ? WHERE id = ?").run(a.title, a.category, a.content, a.is_published, a.id);
    }
    return sqliteDb.prepare("INSERT INTO articles (title, category, content, author_id, is_published) VALUES (?, ?, ?, ?, ?)").run(a.title, a.category, a.content, a.author_id, a.is_published);
  }
  if (a.id) {
    return mysqlPool!.execute("UPDATE articles SET title = ?, category = ?, content = ?, is_published = ? WHERE id = ?", [a.title, a.category, a.content, a.is_published, a.id]);
  }
  return mysqlPool!.execute("INSERT INTO articles (title, category, content, author_id, is_published) VALUES (?, ?, ?, ?, ?)", [a.title, a.category, a.content, a.author_id, a.is_published]);
}

async function adminDeleteArticle(id: number) {
  if (sqliteDb) return sqliteDb.prepare("DELETE FROM articles WHERE id = ?").run(id);
  return mysqlPool!.execute("DELETE FROM articles WHERE id = ?", [id]);
}

async function adminCreateNotification(n: { type: string; title: string; message: string; target_user_id?: number | null; target_group?: string; scheduled_for?: string | null }) {
  if (sqliteDb) {
    return sqliteDb.prepare("INSERT INTO notifications (type, title, message, target_group, target_user_id, scheduled_for) VALUES (?, ?, ?, ?, ?, ?)").run(
      n.type,
      n.title,
      n.message,
      n.target_group || "all",
      n.target_user_id || null,
      n.scheduled_for || null
    );
  }
  return mysqlPool!.execute("INSERT INTO notifications (type, title, message, target_group, target_user_id, scheduled_for) VALUES (?, ?, ?, ?, ?, ?)", [
    n.type,
    n.title,
    n.message,
    n.target_group || "all",
    n.target_user_id || null,
    n.scheduled_for || null
  ]);
}

async function adminListNotifications() {
  if (sqliteDb) return sqliteDb.prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT 100").all();
  const [rows] = await mysqlPool!.execute("SELECT * FROM notifications ORDER BY id DESC LIMIT 100");
  return rows;
}

async function adminUpdateNotification(n: { id: number; type: string; title: string; message: string; target_user_id?: number | null; target_group?: string; scheduled_for?: string | null }) {
  if (sqliteDb) {
    return sqliteDb.prepare("UPDATE notifications SET type = ?, title = ?, message = ?, target_group = ?, target_user_id = ?, scheduled_for = ? WHERE id = ?").run(
      n.type,
      n.title,
      n.message,
      n.target_group || "all",
      n.target_user_id || null,
      n.scheduled_for || null,
      n.id
    );
  }
  return mysqlPool!.execute("UPDATE notifications SET type = ?, title = ?, message = ?, target_group = ?, target_user_id = ?, scheduled_for = ? WHERE id = ?", [
    n.type,
    n.title,
    n.message,
    n.target_group || "all",
    n.target_user_id || null,
    n.scheduled_for || null,
    n.id
  ]);
}

async function adminDeleteNotification(id: number) {
  if (sqliteDb) return sqliteDb.prepare("DELETE FROM notifications WHERE id = ?").run(id);
  return mysqlPool!.execute("DELETE FROM notifications WHERE id = ?", [id]);
}

async function getSystemSettings() {
  const defaults = {
    model_version: "gemini-2.5-flash",
    prediction_threshold: "0.80",
    last_training_date: nowIso(),
    theme_accent: "rose",
  };

  if (sqliteDb) {
    const rows = sqliteDb.prepare("SELECT key, value FROM system_settings").all() as Array<{ key: string; value: string }>;
    const data = { ...defaults } as Record<string, string>;
    rows.forEach((row) => { data[row.key] = row.value; });
    return data;
  }

  const [rows] = await mysqlPool!.execute("SELECT `key`, value FROM system_settings");
  const data = { ...defaults } as Record<string, string>;
  (rows as Array<{ key: string; value: string }>).forEach((row) => { data[row.key] = row.value; });
  return data;
}

async function setSystemSetting(key: string, value: string) {
  if (sqliteDb) {
    return sqliteDb.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(key, value);
  }
  return mysqlPool!.execute(`
    INSERT INTO system_settings (\`key\`, value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP
  `, [key, value]);
}

async function adminGetStats() {
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const realtimeUsage = await adminGetRealtimeUsage();

  if (sqliteDb) {
    const totalUsers = sqliteDb.prepare("SELECT COUNT(*) as c FROM users").get() as any;
    const activeToday = sqliteDb.prepare("SELECT COUNT(DISTINCT id) as c FROM users WHERE last_login_at >= ?").get(today) as any;
    const newThisMonth = sqliteDb.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= ?").get(firstDayOfMonth) as any;
    const logs = sqliteDb.prepare("SELECT COUNT(*) as c FROM logs").get() as any;
    const periods = sqliteDb.prepare("SELECT COUNT(*) as c FROM period_dates").get() as any;
    const admins = sqliteDb.prepare("SELECT COUNT(*) as c FROM admin_users").get() as any;
    const aiTotal = sqliteDb.prepare("SELECT COUNT(*) as c FROM ai_predictions").get() as any;
    
    // Cycle aggregates
    const cycleStats = await adminGetCycleMonitoring();
    const analytics = await buildAdminAnalyticsSnapshot();

    return { 
      users: Number(totalUsers?.c ?? 0),
      active_today: Number(activeToday?.c ?? 0),
      active_now: realtimeUsage.active_now,
      new_this_month: Number(newThisMonth?.c ?? 0),
      logs: Number(logs?.c ?? 0), 
      period_dates: Number(periods?.c ?? 0), 
      admins: Number(admins?.c ?? 0),
      ai_total: Math.max(Number(aiTotal?.c ?? 0), analytics.derivedPredictions.length),
      avg_cycle_length: cycleStats.avgCycleLength,
      total_used_today_seconds: realtimeUsage.total_used_today_seconds,
      active_users: realtimeUsage.active_users,
    };
  }

  const [[totalUsers], [activeToday], [newThisMonth], [logs], [periods], [admins], [aiTotal]] = await Promise.all([
    mysqlPool!.execute("SELECT COUNT(*) as c FROM users"),
    mysqlPool!.execute("SELECT COUNT(DISTINCT id) as c FROM users WHERE last_login_at >= ?", [today]),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM users WHERE created_at >= ?", [firstDayOfMonth]),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM logs"),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM period_dates"),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM admin_users"),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM ai_predictions"),
  ]);

  const [cycleStats, analytics] = await Promise.all([adminGetCycleMonitoring(), buildAdminAnalyticsSnapshot()]);

  return {
    users: Number((totalUsers as any[])[0]?.c ?? 0),
    active_today: Number((activeToday as any[])[0]?.c ?? 0),
    active_now: realtimeUsage.active_now,
    new_this_month: Number((newThisMonth as any[])[0]?.c ?? 0),
    logs: Number((logs as any[])[0]?.c ?? 0),
    period_dates: Number((periods as any[])[0]?.c ?? 0),
    admins: Number((admins as any[])[0]?.c ?? 0),
    ai_total: Math.max(Number((aiTotal as any[])[0]?.c ?? 0), analytics.derivedPredictions.length),
    avg_cycle_length: cycleStats.avgCycleLength,
    total_used_today_seconds: realtimeUsage.total_used_today_seconds,
    active_users: realtimeUsage.active_users,
  };
}

async function adminGetRecentActivity() {
  if (sqliteDb) {
    const registrations = sqliteDb.prepare("SELECT id as user_id, name as user_name, 'Registration' as action, created_at as timestamp FROM users ORDER BY created_at DESC LIMIT 10").all() as any[];
    const logs = sqliteDb.prepare("SELECT l.user_id, u.name as user_name, 'Period Log' as action, (l.date || 'T00:00:00Z') as timestamp FROM logs l JOIN users u ON u.id = l.user_id ORDER BY l.date DESC LIMIT 10").all() as any[];
    
    const combined = [...registrations, ...logs].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
    return combined;
  }
  
  const [registrations] = await mysqlPool!.execute("SELECT id as user_id, name as user_name, 'Registration' as action, created_at as timestamp FROM users ORDER BY created_at DESC LIMIT 10");
  const [logs] = await mysqlPool!.execute("SELECT l.user_id, u.name as user_name, 'Period Log' as action, CONCAT(l.date, ' 00:00:00') as timestamp FROM logs l JOIN users u ON u.id = l.user_id ORDER BY l.date DESC LIMIT 10");
  
  const combined = [...(registrations as any[]), ...(logs as any[])].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
  return combined;
}

async function adminGetAiAccuracyReport() {
  if (sqliteDb) {
    const total = sqliteDb.prepare("SELECT COUNT(*) as c FROM ai_predictions").get() as any;
    const matched = sqliteDb.prepare("SELECT COUNT(*) as c FROM ai_predictions WHERE ABS(accuracy_offset) <= 2").get() as any;
    const mismatches = sqliteDb.prepare("SELECT COUNT(*) as c FROM ai_predictions WHERE ABS(accuracy_offset) > 2").get() as any;
    const analytics = await buildAdminAnalyticsSnapshot();
    const derivedTotal = analytics.derivedPredictions.length;
    const derivedMatched = analytics.derivedPredictions.filter((row) => Math.abs(row.accuracy_offset) <= 2).length;
    const derivedMismatches = analytics.derivedPredictions.filter((row) => Math.abs(row.accuracy_offset) > 2).length;
    const finalTotal = Math.max(Number(total?.c ?? 0), derivedTotal);
    const finalMatched = Number(total?.c ?? 0) > 0 ? Number(matched?.c ?? 0) : derivedMatched;
    const finalMismatches = Number(total?.c ?? 0) > 0 ? Number(mismatches?.c ?? 0) : derivedMismatches;
    
    return {
      total: finalTotal,
      accuracy: finalTotal ? Math.round((finalMatched / finalTotal) * 100) : 100,
      mismatches: finalMismatches,
      lastUpdate: todayIso().split('T')[0]
    };
  }
  
  const [[total], [matched], [mismatches]] = await Promise.all([
    mysqlPool!.execute("SELECT COUNT(*) as c FROM ai_predictions"),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM ai_predictions WHERE ABS(accuracy_offset) <= 2"),
    mysqlPool!.execute("SELECT COUNT(*) as c FROM ai_predictions WHERE ABS(accuracy_offset) > 2"),
  ]);
  
  const tCount = Number((total as any[])[0]?.c ?? 0);
  const mCount = Number((matched as any[])[0]?.c ?? 0);
  if (tCount === 0) {
    const analytics = await buildAdminAnalyticsSnapshot();
    const derivedTotal = analytics.derivedPredictions.length;
    const derivedMatched = analytics.derivedPredictions.filter((row) => Math.abs(row.accuracy_offset) <= 2).length;
    const derivedMismatches = analytics.derivedPredictions.filter((row) => Math.abs(row.accuracy_offset) > 2).length;
    return {
      total: derivedTotal,
      accuracy: derivedTotal ? Math.round((derivedMatched / derivedTotal) * 100) : 100,
      mismatches: derivedMismatches,
      lastUpdate: todayIso().split('T')[0]
    };
  }
  
  return {
    total: tCount,
    accuracy: tCount ? Math.round((mCount / tCount) * 100) : 100,
    mismatches: Number((mismatches as any[])[0]?.c ?? 0),
    lastUpdate: todayIso().split('T')[0]
  };
}

async function adminGetAiComparisonData() {
  if (sqliteDb) {
    const rows = sqliteDb.prepare("SELECT prediction_date, actual_date, accuracy_offset FROM ai_predictions WHERE actual_date IS NOT NULL ORDER BY created_at DESC LIMIT 15").all() as any[];
    if (rows.length) return rows;
    const analytics = await buildAdminAnalyticsSnapshot();
    return analytics.derivedPredictions
      .slice()
      .sort((a, b) => b.actual_date.localeCompare(a.actual_date))
      .slice(0, 15);
  }
  const [rows] = await mysqlPool!.execute("SELECT prediction_date, actual_date, accuracy_offset FROM ai_predictions WHERE actual_date IS NOT NULL ORDER BY created_at DESC LIMIT 15");
  if ((rows as any[]).length) return rows;
  const analytics = await buildAdminAnalyticsSnapshot();
  return analytics.derivedPredictions
    .slice()
    .sort((a, b) => b.actual_date.localeCompare(a.actual_date))
    .slice(0, 15);
}

function todayIso() { return new Date().toISOString(); }

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function toSqlDateTime(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function toActiveUserSnapshot(row: any): ActiveUserSnapshot {
  const lastSeen = row.last_seen_at instanceof Date
    ? row.last_seen_at.toISOString()
    : row.last_seen_at
      ? new Date(row.last_seen_at).toISOString()
      : new Date().toISOString();
  return {
    user_id: Number(row.user_id),
    user_name: row.user_name ? String(row.user_name) : "",
    email: row.email ? String(row.email) : "",
    last_seen_at: lastSeen,
    active_seconds_today: Number(row.active_seconds_today ?? row.active_seconds ?? 0),
  };
}

async function recordUserActivity(userId: number) {
  const now = new Date();
  const activityDate = todayDateKey();
  const nowIso = now.toISOString();
  const nowSql = toSqlDateTime(now);
  const maxGapSeconds = 60;

  if (sqliteDb) {
    const existing = sqliteDb.prepare(
      "SELECT active_seconds, last_seen_at FROM user_activity_daily WHERE user_id = ? AND activity_date = ?"
    ).get(userId, activityDate) as any;

    if (!existing) {
      sqliteDb.prepare(`
        INSERT INTO user_activity_daily (user_id, activity_date, active_seconds, last_seen_at, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?, ?)
      `).run(userId, activityDate, nowIso, nowIso, nowIso);
      return;
    }

    const previous = new Date(String(existing.last_seen_at));
    const deltaSeconds = Number.isNaN(previous.getTime())
      ? 0
      : Math.max(0, Math.min(maxGapSeconds, Math.round((now.getTime() - previous.getTime()) / 1000)));

    sqliteDb.prepare(`
      UPDATE user_activity_daily
      SET active_seconds = active_seconds + ?, last_seen_at = ?, updated_at = ?
      WHERE user_id = ? AND activity_date = ?
    `).run(deltaSeconds, nowIso, nowIso, userId, activityDate);
    return;
  }

  const [rows] = await mysqlPool!.execute(
    "SELECT active_seconds, last_seen_at FROM user_activity_daily WHERE user_id = ? AND activity_date = ? LIMIT 1",
    [userId, activityDate],
  );
  const existing = (rows as any[])[0];

  if (!existing) {
    await mysqlPool!.execute(`
      INSERT INTO user_activity_daily (user_id, activity_date, active_seconds, last_seen_at, created_at, updated_at)
      VALUES (?, ?, 0, ?, ?, ?)
    `, [userId, activityDate, nowSql, nowSql, nowSql]);
    return;
  }

  const previous = new Date(existing.last_seen_at);
  const deltaSeconds = Number.isNaN(previous.getTime())
    ? 0
    : Math.max(0, Math.min(maxGapSeconds, Math.round((now.getTime() - previous.getTime()) / 1000)));

  await mysqlPool!.execute(`
    UPDATE user_activity_daily
    SET active_seconds = active_seconds + ?, last_seen_at = ?, updated_at = ?
    WHERE user_id = ? AND activity_date = ?
  `, [deltaSeconds, nowSql, nowSql, userId, activityDate]);
}

async function adminGetRealtimeUsage() {
  const activityDate = todayDateKey();
  const threshold = new Date(Date.now() - 5 * 60 * 1000);
  const thresholdIso = threshold.toISOString();
  const thresholdSql = toSqlDateTime(threshold);

  if (sqliteDb) {
    const totalRow = sqliteDb.prepare(
      "SELECT COALESCE(SUM(active_seconds), 0) as c FROM user_activity_daily WHERE activity_date = ?"
    ).get(activityDate) as any;
    const activeRows = sqliteDb.prepare(`
      SELECT uad.user_id, u.name as user_name, u.email, uad.last_seen_at, uad.active_seconds as active_seconds_today
      FROM user_activity_daily uad
      JOIN users u ON u.id = uad.user_id
      WHERE uad.activity_date = ? AND uad.last_seen_at >= ?
      ORDER BY uad.last_seen_at DESC, u.name ASC
    `).all(activityDate, thresholdIso) as any[];

    const activeUsers = activeRows.map(toActiveUserSnapshot);
    return {
      active_now: activeUsers.length,
      total_used_today_seconds: Number(totalRow?.c ?? 0),
      active_users: activeUsers,
    };
  }

  const [[totalRows], [activeRows]] = await Promise.all([
    mysqlPool!.execute(
      "SELECT COALESCE(SUM(active_seconds), 0) as c FROM user_activity_daily WHERE activity_date = ?",
      [activityDate],
    ),
    mysqlPool!.execute(`
      SELECT uad.user_id, u.name as user_name, u.email, uad.last_seen_at, uad.active_seconds as active_seconds_today
      FROM user_activity_daily uad
      JOIN users u ON u.id = uad.user_id
      WHERE uad.activity_date = ? AND uad.last_seen_at >= ?
      ORDER BY uad.last_seen_at DESC, u.name ASC
    `, [activityDate, thresholdSql]),
  ]);

  const activeUsers = (activeRows as any[]).map(toActiveUserSnapshot);
  return {
    active_now: activeUsers.length,
    total_used_today_seconds: Number((totalRows as any[])[0]?.c ?? 0),
    active_users: activeUsers,
  };
}

async function adminSetUserPassword(userId: number, password: string) {
  if (sqliteDb) {
    const info = sqliteDb.prepare("UPDATE users SET password = ? WHERE id = ?").run(password, userId);
    return Number(info.changes ?? 0);
  }
  const [result] = await mysqlPool!.execute("UPDATE users SET password = ? WHERE id = ?", [password, userId]);
  return Number((result as any).affectedRows ?? 0);
}

async function adminDeleteUser(userId: number) {
  if (sqliteDb) {
    const tx = sqliteDb.transaction((uid: number) => {
      sqliteDb.prepare("DELETE FROM logs WHERE user_id = ?").run(uid);
      sqliteDb.prepare("DELETE FROM period_dates WHERE user_id = ?").run(uid);
      const info = sqliteDb.prepare("DELETE FROM users WHERE id = ?").run(uid);
      return Number(info.changes ?? 0);
    });
    return tx(userId);
  }

  const conn = await mysqlPool!.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM logs WHERE user_id = ?", [userId]);
    await conn.execute("DELETE FROM period_dates WHERE user_id = ?", [userId]);
    const [result] = await conn.execute("DELETE FROM users WHERE id = ?", [userId]);
    await conn.commit();
    return Number((result as any).affectedRows ?? 0);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  let dbInitError: string | null = null;
  const dbReady = initDb().catch((err: any) => {
    dbInitError = err?.message ? String(err.message) : "Failed to initialize database";
    console.error("DB init error:", err);
  });

  app.get("/api/db-status", (req, res) => {
    (async () => {
      try {
        await dbReady;
        res.json({
          provider: DB_PROVIDER,
          status: dbInitError === null ? "ok" : "error",
          ready: dbInitError === null,
          error: dbInitError,
        });
      } catch {
        res.status(500).json({ error: "Failed to get DB status" });
      }
    })();
  });

  app.get("/api/ai/status", (req, res) => {
    res.json({
      status: GEMINI_API_KEY ? "healthy" : "offline",
      hasKey: Boolean(GEMINI_API_KEY),
      model: "gemini-2.5-flash",
    });
  });

  const requireAdmin = async (req: any, res: any) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing admin token" });
      return null;
    }
    const admin = await getAdminFromToken(token);
    if (!admin) {
      res.status(401).json({ error: "Invalid or expired admin token" });
      return null;
    }
    return { admin, token };
  };

  const requireAdminRole = (role: string) => async (req: any, res: any) => {
    const auth = await requireAdmin(req, res);
    if (!auth) return null;
    if (String(auth.admin.role) !== role) {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }
    return auth;
  };

  // API routes
  app.post("/api/admin/signup", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });

        const { name, email, password, inviteCode, role } = req.body ?? {};
        if (!name || !email || !password) {
          return res.status(400).json({ error: "All fields are required" });
        }

        const admins = await adminCount();
        const canSignup =
          admins === 0 ||
          ADMIN_SIGNUP_OPEN ||
          (ADMIN_INVITE_CODE && String(inviteCode || "") === ADMIN_INVITE_CODE);

        if (!canSignup) {
          return res.status(403).json({
            error: ADMIN_INVITE_CODE
              ? "Admin signup requires a valid invite code"
              : "Admin signup is disabled",
          });
        }

        const admin = await createAdminUser({
          name: String(name),
          email: String(email),
          password: String(password),
          role: role ? String(role) : undefined,
        });

        const session = await createAdminSession({
          adminUserId: admin.id,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        return res.json({ success: true, admin, token: session.token, expiresAt: session.expires_at });
      } catch (error: any) {
        if (error?.code === "SQLITE_CONSTRAINT_UNIQUE" || error?.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Email already exists" });
        }
        console.error("Admin signup error:", error);
        return res.status(500).json({ error: "Failed to create admin" });
      }
    })();
  });

  app.post("/api/admin/login", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });

        const { email, password } = req.body ?? {};
        if (!email || !password) {
          return res.status(400).json({ error: "All fields are required" });
        }

        const row = await findAdminByEmail(String(email));
        if (!row) return res.status(401).json({ error: "Invalid email or password" });
        if (String(password) !== row.password) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        await updateAdminLastLogin(row.id);
        const session = await createAdminSession({
          adminUserId: row.id,
          ip: getClientIp(req),
          userAgent: getUserAgent(req),
        });

        const admin: AdminUserRow = {
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          created_at: row.created_at,
          last_login_at: nowIso(),
        };

        return res.json({ success: true, admin, token: session.token, expiresAt: session.expires_at });
      } catch (error: any) {
        console.error("Admin login error:", error);
        return res.status(500).json({ error: "Login failed" });
      }
    })();
  });

  app.get("/api/admin/me", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        return res.json({ admin: auth.admin });
      } catch {
        return res.status(500).json({ error: "Failed to load admin" });
      }
    })();
  });

  app.post("/api/admin/logout", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const token = extractBearerToken(req);
        if (!token) return res.json({ success: true });
        await deleteAdminSession(token);
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to logout" });
      }
    })();
  });

  async function adminGetDailyStats() {
    const days = 30;
    const stats: Array<{ date: string; users: number; logs: number }> = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      
      let usersCount = 0;
      let logsCount = 0;

      if (sqliteDb) {
        usersCount = (sqliteDb.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at) <= date(?)").get(dateStr) as any).c;
        logsCount = (sqliteDb.prepare("SELECT COUNT(*) as c FROM logs WHERE date = ?").get(dateStr) as any).c;
      } else {
        const [uRows] = await mysqlPool!.execute("SELECT COUNT(*) as c FROM users WHERE DATE(created_at) <= DATE(?)", [dateStr]);
        usersCount = (uRows as any[])[0].c;
        const [lRows] = await mysqlPool!.execute("SELECT COUNT(*) as c FROM logs WHERE date = ?", [dateStr]);
        logsCount = (lRows as any[])[0].c;
      }
      
      stats.push({ date: dateStr, users: usersCount, logs: logsCount });
    }
    return stats;
  }

  app.get("/api/admin/stats/daily", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const stats = await adminGetDailyStats();
        return res.json({ stats });
      } catch {
        return res.status(500).json({ error: "Failed to fetch daily stats" });
      }
    })();
  });

  app.get("/api/admin/stats", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const stats = await adminGetStats();
        return res.json({ stats });
      } catch {
        return res.status(500).json({ error: "Failed to fetch stats" });
      }
    })();
  });

  app.get("/api/admin/users", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const q = typeof req.query?.q === "string" ? req.query.q : "";
        const limit = req.query?.limit ? Number(req.query.limit) : undefined;
        const offset = req.query?.offset ? Number(req.query.offset) : undefined;
        const status = typeof req.query?.status === "string" ? req.query.status : undefined;

        const result = await adminListUsers({ q, limit, offset, status });
        return res.json(result);
      } catch {
        return res.status(500).json({ error: "Failed to fetch users" });
      }
    })();
  });

  app.get("/api/admin/users/stats", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const stats = await adminGetUsersStats();
        return res.json({ stats });
      } catch {
        return res.status(500).json({ error: "Failed to fetch user stats" });
      }
    })();
  });

  app.get("/api/admin/analytics/cycle-summary", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const summary = await adminGetCycleSummary();
        return res.json({ summary });
      } catch {
        return res.status(500).json({ error: "Failed to fetch cycle summary" });
      }
    })();
  });

  app.get("/api/admin/analytics/cycles", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const minLength = req.query?.minLength ? Number(req.query.minLength) : undefined;
        const maxLength = req.query?.maxLength ? Number(req.query.maxLength) : undefined;
        const dateFrom = typeof req.query?.dateFrom === "string" ? req.query.dateFrom : undefined;
        const dateTo = typeof req.query?.dateTo === "string" ? req.query.dateTo : undefined;
        const limit = req.query?.limit ? Number(req.query.limit) : undefined;
        const offset = req.query?.offset ? Number(req.query.offset) : undefined;

        const result = await adminListAnonymizedCycles({ minLength, maxLength, dateFrom, dateTo, limit, offset });
        return res.json(result);
      } catch {
        return res.status(500).json({ error: "Failed to fetch cycle data" });
      }
    })();
  });

  app.get("/api/admin/users/:id", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user id" });
        const user = await adminGetUser(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const logs = await getAllLogs(userId);
        const dates = await getPeriodDates(userId);
        return res.json({
          user,
          summary: {
            logsCount: logs.length,
            periodDatesCount: dates.length,
          },
        });
      } catch {
        return res.status(500).json({ error: "Failed to fetch user" });
      }
    })();
  });

  app.get("/api/admin/users/:id/logs", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user id" });
        const logs = await getAllLogs(userId);
        const formattedLogs = logs.map((log: any) => ({
          ...log,
          date: normalizeDate(log.date),
          symptoms: safeParseJsonArray(log.symptoms),
        }));
        return res.json({ logs: formattedLogs });
      } catch {
        return res.status(500).json({ error: "Failed to fetch logs" });
      }
    })();
  });

  app.get("/api/admin/users/:id/period-dates", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user id" });
        const dates = await getPeriodDates(userId);
        return res.json({ dates });
      } catch {
        return res.status(500).json({ error: "Failed to fetch period dates" });
      }
    })();
  });

  app.post("/api/admin/users/:id/reset-password", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const userId = Number(req.params.id);
        const { password } = req.body ?? {};
        if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user id" });
        if (!password) return res.status(400).json({ error: "password is required" });

        const changed = await adminSetUserPassword(userId, String(password));
        if (!changed) return res.status(404).json({ error: "User not found" });
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to reset password" });
      }
    })();
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: "Invalid user id" });
        const deleted = await adminDeleteUser(userId);
        if (!deleted) return res.status(404).json({ error: "User not found" });
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to delete user" });
      }
    })();
  });

  app.get("/api/admin/activity/recent", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const activity = await adminGetRecentActivity();
        return res.json({ activity });
      } catch {
        return res.status(500).json({ error: "Failed to fetch activity" });
      }
    })();
  });

  app.get("/api/admin/ai/accuracy-report", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const report = await adminGetAiAccuracyReport();
        return res.json({ report });
      } catch {
        return res.status(500).json({ error: "Failed to fetch AI report" });
      }
    })();
  });

  app.get("/api/admin/ai/comparison", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const data = await adminGetAiComparisonData();
        return res.json({ data });
      } catch {
        return res.status(500).json({ error: "Failed to fetch AI comparison data" });
      }
    })();
  });

  app.get("/api/admin/analytics/export", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;

        const type = req.query?.type || "users";
        let csv = "";
        
        if (type === "users") {
          const { users } = await adminListUsers({ limit: 5000 });
          csv = "ID,Name,Email,DOB,Created At,Last Login,Status\n";
          users.forEach(u => {
            csv += `${u.id},"${(u as any).name || ""}","${u.email}",${u.dob || ""},${(u as any).created_at || ""},${(u as any).last_login_at || ""},${u.is_active ? 'Active' : 'Inactive'}\n`;
          });
        } else if (type === "daily") {
          const stats = await adminGetDailyStats();
          csv = "Date,Users,Logs\n";
          stats.forEach(s => {
            csv += `${s.date},${s.users},${s.logs}\n`;
          });
        } else if (type === "cycles") {
          const { cycles } = await adminListAnonymizedCycles({ limit: 10000 });
          csv = "Record ID,Cycle Length,Period Duration,Symptoms,AI Prediction,Date Logged\n";
          cycles.forEach(c => {
            csv += `${c.id},${c.cycleLength},${c.periodDuration},"${c.symptoms}",${c.predictionGenerated ? 'Yes' : 'No'},${c.dateLogged}\n`;
          });
        }

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=export-${type}.csv`);
        return res.send(csv);
      } catch {
        return res.status(500).json({ error: "Failed to export data" });
      }
    })();
  });

  app.get("/api/admin/admins", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdminRole("admin")(req, res);
        if (!auth) return;

        const q = typeof req.query?.q === "string" ? req.query.q : "";
        const limit = req.query?.limit ? Number(req.query.limit) : undefined;
        const admins = await adminListAdmins({ q, limit });
        return res.json({ admins });
      } catch {
        return res.status(500).json({ error: "Failed to fetch admins" });
      }
    })();
  });

  app.post("/api/admin/admins", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdminRole("admin")(req, res);
        if (!auth) return;

        const { name, email, password, role } = req.body ?? {};
        if (!name || !email || !password) {
          return res.status(400).json({ error: "All fields are required" });
        }

        const admin = await createAdminUser({
          name: String(name),
          email: String(email),
          password: String(password),
          role: role ? String(role) : undefined,
        });
        return res.json({ success: true, admin });
      } catch (error: any) {
        if (error?.code === "SQLITE_CONSTRAINT_UNIQUE" || error?.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Email already exists" });
        }
        console.error("Admin create error:", error);
        return res.status(500).json({ error: "Failed to create admin" });
      }
    })();
  });

  app.post("/api/admin/admins/:id/reset-password", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdminRole("admin")(req, res);
        if (!auth) return;

        const adminUserId = Number(req.params.id);
        const { password } = req.body ?? {};
        if (!Number.isInteger(adminUserId) || adminUserId <= 0) return res.status(400).json({ error: "Invalid admin id" });
        if (!password) return res.status(400).json({ error: "password is required" });

        const changed = await adminResetAdminPassword(adminUserId, String(password));
        if (!changed) return res.status(404).json({ error: "Admin not found" });
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to reset admin password" });
      }
    })();
  });

  app.get("/api/admin/cycle-monitoring", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const data = await adminGetCycleMonitoring();
        return res.json(data);
      } catch {
        return res.status(500).json({ error: "Failed to fetch cycle monitoring data" });
      }
    })();
  });

  app.get("/api/admin/feedback", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const feedback = await adminListFeedback();
        return res.json({ feedback });
      } catch {
        return res.status(500).json({ error: "Failed to fetch feedback" });
      }
    })();
  });

  app.post("/api/admin/feedback/:id/resolve", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        await adminResolveFeedback(Number(req.params.id));
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to resolve feedback" });
      }
    })();
  });

  app.delete("/api/admin/feedback/:id", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        await adminDeleteFeedback(Number(req.params.id));
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to delete feedback" });
      }
    })();
  });

  app.get("/api/admin/articles", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const articles = await adminListArticles();
        return res.json({ articles });
      } catch {
        return res.status(500).json({ error: "Failed to fetch articles" });
      }
    })();
  });

  app.post("/api/admin/articles", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const { id, title, category, content, is_published } = req.body ?? {};
        await adminUpsertArticle({
          id,
          title,
          category: category || "Menstrual Health",
          content,
          is_published: is_published ? 1 : 0,
          author_id: auth.admin.id
        });
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to save article" });
      }
    })();
  });

  app.delete("/api/admin/articles/:id", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        await adminDeleteArticle(Number(req.params.id));
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to delete article" });
      }
    })();
  });

  app.get("/api/admin/notifications", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const notifications = await adminListNotifications();
        return res.json({ notifications });
      } catch {
        return res.status(500).json({ error: "Failed to fetch notifications" });
      }
    })();
  });

  app.post("/api/admin/notifications", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const { type, title, message, target_user_id, target_group, scheduled_for } = req.body ?? {};
        await adminCreateNotification({ type, title, message, target_user_id, target_group, scheduled_for });
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to create notification" });
      }
    })();
  });

  app.put("/api/admin/notifications/:id", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const { type, title, message, target_user_id, target_group, scheduled_for } = req.body ?? {};
        await adminUpdateNotification({ id: Number(req.params.id), type, title, message, target_user_id, target_group, scheduled_for });
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to update notification" });
      }
    })();
  });

  app.delete("/api/admin/notifications/:id", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        await adminDeleteNotification(Number(req.params.id));
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to delete notification" });
      }
    })();
  });

  app.put("/api/admin/me", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const email = String(req.body?.email || "").trim();
        if (!email) return res.status(400).json({ error: "Email is required" });
        await adminUpdateAdminEmail(auth.admin.id, email);
        const adminRow = await findAdminByEmail(email);
        if (!adminRow) return res.status(404).json({ error: "Admin not found" });
        const { password: _password, ...admin } = adminRow;
        return res.json({ admin });
      } catch {
        return res.status(500).json({ error: "Failed to update admin profile" });
      }
    })();
  });

  app.get("/api/admin/settings/ai", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const settings = await getSystemSettings();
        return res.json({ settings });
      } catch {
        return res.status(500).json({ error: "Failed to fetch AI settings" });
      }
    })();
  });

  app.post("/api/admin/settings/ai", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const { model_version, prediction_threshold, last_training_date, theme_accent } = req.body ?? {};
        if (model_version !== undefined) await setSystemSetting("model_version", String(model_version));
        if (prediction_threshold !== undefined) await setSystemSetting("prediction_threshold", String(prediction_threshold));
        if (last_training_date !== undefined) await setSystemSetting("last_training_date", String(last_training_date));
        if (theme_accent !== undefined) await setSystemSetting("theme_accent", String(theme_accent));
        const settings = await getSystemSettings();
        return res.json({ settings });
      } catch {
        return res.status(500).json({ error: "Failed to save AI settings" });
      }
    })();
  });

  app.get("/api/admin/system-logs", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const fs = await import("node:fs/promises");
        let raw = "";
        try {
          raw = await fs.readFile(new URL("./log.html", import.meta.url), "utf8");
        } catch {
          raw = "";
        }
        const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const serverLogs = text ? text.split(". ").slice(0, 8) : ["Server log file unavailable."];
        const errorLogs = serverLogs.filter((line) => /error|warn|failed|risk/i.test(line));
        return res.json({ serverLogs, errorLogs });
      } catch {
        return res.status(500).json({ error: "Failed to fetch system logs" });
      }
    })();
  });

  app.post("/api/admin/users/:id/toggle-active", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdmin(req, res);
        if (!auth) return;
        const { is_active } = req.body ?? {};
        await adminToggleUserActive(Number(req.params.id), Boolean(is_active));
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to toggle user status" });
      }
    })();
  });

  app.delete("/api/admin/admins/:id", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const auth = await requireAdminRole("admin")(req, res);
        if (!auth) return;

        const adminUserId = Number(req.params.id);
        if (!Number.isInteger(adminUserId) || adminUserId <= 0) return res.status(400).json({ error: "Invalid admin id" });
        if (adminUserId === auth.admin.id) return res.status(400).json({ error: "You cannot delete your own admin account" });

        const deleted = await adminDeleteAdminUser(adminUserId);
        if (!deleted) return res.status(404).json({ error: "Admin not found" });
        return res.json({ success: true });
      } catch {
        return res.status(500).json({ error: "Failed to delete admin" });
      }
    })();
  });

  app.post("/api/signup", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const { name, email, password, dob } = req.body;
      if (!name || !email || !password || !dob) {
        return res.status(400).json({ error: "All fields are required" });
      }
      
        const user = await signupUser({ name, email, password, dob });
        res.json({ success: true, user });
      } catch (error: any) {
        if (
          error?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
          error?.code === "ER_DUP_ENTRY"
        ) {
          return res.status(400).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: "Failed to create user" });
      }
    })();
  });

  app.post("/api/ai/insights", (req, res) => {
    (async () => {
      try {
        const { phase, cycleDay, todaysLog, language } = req.body ?? {};
        if (typeof phase !== "string" || !phase.trim()) {
          return res.status(400).json({ error: "phase is required" });
        }
        if (typeof cycleDay !== "number" || !Number.isFinite(cycleDay)) {
          return res.status(400).json({ error: "cycleDay must be a number" });
        }
        const lang: "en" | "ne" = language === "ne" ? "ne" : "en";

        const prompt = `
You are a women's health expert. The user is in the ${phase} phase of her menstrual cycle (Day ${Math.round(cycleDay)} of 28).
The user's preferred language is ${lang === "ne" ? "Nepali" : "English"}. Respond in that language.
${todaysLog ? `Today she logged: Mood: ${todaysLog.mood}, Pain: ${todaysLog.pain}/10, Symptoms: ${(Array.isArray(todaysLog.symptoms) ? todaysLog.symptoms : []).join(", ")}, Notes: ${todaysLog.notes}.` : "She has not logged any symptoms for today yet."}

Based on this, provide a JSON response with the following structure:
{
  "summary": "A personalized 2-3 sentence summary of what is happening in her body and how she might be feeling.",
  "carePlan": {
    "activity": "A specific activity recommendation.",
    "nutrition": "A specific nutrition recommendation.",
    "selfCare": "A specific self-care recommendation."
  }
}
Do not include markdown formatting. Return only the JSON string.
        `.trim();

        const ai = requireGemini();
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });

        const text = response.text ?? "";
        const data = text ? safeJsonParse<any>(text) : null;
        if (!data) return res.status(502).json({ error: "Invalid AI response" });
        return res.json(data);
      } catch (error: any) {
        if (error?.code === "MISSING_GEMINI_API_KEY") {
          return res.status(503).json({ error: "Missing GEMINI_API_KEY" });
        }
        if (error?.message?.includes("429") || error?.status === 429) {
          return res.status(429).json({ error: "Gemini quota exceeded" });
        }
        console.error("AI insights error:", error);
        const details =
          process.env.NODE_ENV !== "production"
            ? String(error?.message || error)
            : undefined;
        return res
          .status(500)
          .json(details ? { error: "Failed to generate insights", details } : { error: "Failed to generate insights" });
      }
    })();
  });

  app.post("/api/ai/chat", (req, res) => {
    (async () => {
      try {
        const { messages } = req.body ?? {};
        if (!Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: "messages is required" });
        }

        const trimmed = messages
          .filter((m: any) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
          .slice(-20);
        if (trimmed.length === 0) {
          return res.status(400).json({ error: "messages is invalid" });
        }

        const systemInstruction =
          "You are a compassionate, knowledgeable, and helpful menstrual health assistant. Answer questions related to periods, ovulation, menstrual cycles, symptoms, and general women's health. You MUST provide medically accurate answers. Keep your responses very simple, clear, and concise. Do not write long paragraphs. When listing items, ALWAYS use numbered lists (1., 2., 3.) instead of bullet points (* or -), and format them line by line. If a medical emergency is implied, advise them to see a doctor.";

        const conversation = trimmed
          .map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
          .join("\n");

        const prompt = `${systemInstruction}\n\nConversation so far:\n${conversation}\n\nAssistant:`;

        const ai = requireGemini();
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const text = (response.text ?? "").trim();
        if (!text) return res.status(502).json({ error: "Empty AI response" });
        return res.json({ text });
      } catch (error: any) {
        if (error?.code === "MISSING_GEMINI_API_KEY") {
          return res.status(503).json({ error: "Missing GEMINI_API_KEY" });
        }
        if (error?.message?.includes("429") || error?.status === 429) {
          return res.status(429).json({ error: "Gemini quota exceeded" });
        }
        console.error("AI chat error:", error);
        const details =
          process.env.NODE_ENV !== "production"
            ? String(error?.message || error)
            : undefined;
        return res
          .status(500)
          .json(details ? { error: "Failed to generate chat response", details } : { error: "Failed to generate chat response" });
      }
    })();
  });

  app.post("/api/login", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }

        const user = await loginUser(email, password);
      
        if (user) {
          res.json({ success: true, user });
        } else {
          res.status(401).json({ error: "Invalid email or password" });
        }
      } catch {
        res.status(500).json({ error: "Login failed" });
      }
    })();
  });

  app.get("/api/logs", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const userId = Number(req.header("x-user-id"));
        if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: "Missing user" });

        const logs = await getAllLogs(userId);
        const formattedLogs = logs.map((log: any) => ({
          ...log,
          date: normalizeDate(log.date),
          symptoms: safeParseJsonArray(log.symptoms),
        }));
        res.json(formattedLogs);
      } catch {
        res.status(500).json({ error: "Failed to fetch logs" });
      }
    })();
  });

  app.post("/api/activity/ping", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const userId = Number(req.header("x-user-id"));
        if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: "Missing user" });

        await recordUserActivity(userId);
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to record activity" });
      }
    })();
  });

  app.post("/api/logs", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const userId = Number(req.header("x-user-id"));
        if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: "Missing user" });

        const { date, symptoms, pain, mood, notes, flow } = req.body;
        await upsertLog(userId, { date, symptoms, pain, mood, notes, flow });
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to save log" });
      }
    })();
  });

  app.delete("/api/logs/all", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const userId = Number(req.header("x-user-id"));
        if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: "Missing user" });

        await deleteAllLogs(userId);
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to delete logs" });
      }
    })();
  });

  app.get("/api/period-dates", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const userId = Number(req.header("x-user-id"));
        if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: "Missing user" });

        const dates = await getPeriodDates(userId);
        res.json(dates);
      } catch {
        res.status(500).json({ error: "Failed to fetch period dates" });
      }
    })();
  });

  app.post("/api/period-dates", (req, res) => {
    (async () => {
      try {
        await dbReady;
        if (dbInitError) return res.status(503).json({ error: "Database unavailable" });
        const userId = Number(req.header("x-user-id"));
        if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ error: "Missing user" });

        const { dates } = req.body;
        await savePeriodDates(userId, Array.isArray(dates) ? dates : []);
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: "Failed to save period dates" });
      }
    })();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const { fileURLToPath } = await import("url");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
