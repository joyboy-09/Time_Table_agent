const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'timetable.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS timetables (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    config TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    timetable_id TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    timetable_id TEXT NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    credit REAL NOT NULL DEFAULT 3.0,
    faculty TEXT NOT NULL,
    faculty_short TEXT,
    type TEXT NOT NULL DEFAULT 'theory',
    periods_per_week INTEGER NOT NULL DEFAULT 3,
    color TEXT,
    FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedule_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timetable_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    subject_id TEXT,
    day TEXT NOT NULL,
    period INTEGER NOT NULL,
    variant INTEGER NOT NULL DEFAULT 1,
    is_break INTEGER NOT NULL DEFAULT 0,
    label TEXT,
    FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_slots_timetable ON schedule_slots(timetable_id, variant);
  CREATE INDEX IF NOT EXISTS idx_slots_section ON schedule_slots(section_id);
  CREATE INDEX IF NOT EXISTS idx_subjects_timetable ON subjects(timetable_id);
  CREATE INDEX IF NOT EXISTS idx_sections_timetable ON sections(timetable_id);
  CREATE INDEX IF NOT EXISTS idx_timetables_user ON timetables(user_id);
`);

// Seed default user if none exists
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('pass123', salt, 10000, 64, 'sha512').toString('hex');
  const passwordHash = `${salt}:${hash}`;
  
  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name)
    VALUES (?, ?, ?, ?)
  `).run('demo-user-id', 'admin', passwordHash, 'Dr. Academic Dean');
  console.log('🌱 Seeded default user: admin / pass123');
}

module.exports = db;
