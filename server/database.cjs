const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let db;

function initNativeDb() {
  const Database = require('better-sqlite3');
  const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
  const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const nativeDb = new Database(path.join(DATA_DIR, 'timetable.db'));
  nativeDb.pragma('journal_mode = WAL');
  nativeDb.pragma('foreign_keys = ON');

  nativeDb.exec(`
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
  `);

  const userCount = nativeDb.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('pass123', salt, 10000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;
    
    nativeDb.prepare(`
      INSERT INTO users (id, username, password_hash, display_name)
      VALUES (?, ?, ?, ?)
    `).run('demo-user-id', 'admin', passwordHash, 'Dr. Academic Dean');
  }

  return nativeDb;
}

// In-Memory Fallback for Serverless environments where native binaries fail
function initInMemoryDb() {
  const store = {
    users: [
      {
        id: 'demo-user-id',
        username: 'admin',
        password_hash: (() => {
          const salt = 'a1b2c3d4e5f67890';
          const hash = crypto.pbkdf2Sync('pass123', salt, 10000, 64, 'sha512').toString('hex');
          return `${salt}:${hash}`;
        })(),
        display_name: 'Dr. Academic Dean',
        created_at: new Date().toISOString()
      }
    ],
    timetables: [],
    sections: [],
    subjects: [],
    schedule_slots: []
  };

  return {
    prepare(sql) {
      const cleanSql = sql.trim().toLowerCase();
      return {
        get(...params) {
          if (cleanSql.includes('from users where username = ?')) {
            return store.users.find(u => u.username === params[0]) || null;
          }
          if (cleanSql.includes('from users where id = ?')) {
            return store.users.find(u => u.id === params[0]) || null;
          }
          if (cleanSql.includes('from timetables where id = ?')) {
            return store.timetables.find(t => t.id === params[0]) || null;
          }
          if (cleanSql.includes('count(*) as count from users')) {
            return { count: store.users.length };
          }
          return null;
        },
        all(...params) {
          if (cleanSql.includes('from timetables')) {
            const userId = params[0];
            const list = store.timetables.filter(t => !userId || t.user_id === userId);
            return list.map(t => ({
              ...t,
              section_count: store.sections.filter(s => s.timetable_id === t.id).length,
              subject_count: store.subjects.filter(s => s.timetable_id === t.id).length,
              variant_count: new Set(store.schedule_slots.filter(s => s.timetable_id === t.id).map(s => s.variant)).size
            }));
          }
          if (cleanSql.includes('from sections where timetable_id = ?')) {
            return store.sections.filter(s => s.timetable_id === params[0]);
          }
          if (cleanSql.includes('from subjects where timetable_id = ?')) {
            return store.subjects.filter(s => s.timetable_id === params[0]);
          }
          if (cleanSql.includes('from schedule_slots')) {
            return store.schedule_slots.filter(s => s.timetable_id === params[0]).map(ss => {
              const sub = store.subjects.find(sub => sub.id === ss.subject_id) || {};
              const sec = store.sections.find(sec => sec.id === ss.section_id) || {};
              return {
                ...ss,
                subject_code: sub.code,
                subject_title: sub.title,
                faculty: sub.faculty,
                faculty_short: sub.faculty_short,
                subject_type: sub.type,
                color: sub.color,
                section_name: sec.name
              };
            });
          }
          return [];
        },
        run(...params) {
          if (cleanSql.includes('insert into users')) {
            store.users.push({
              id: params[0],
              username: params[1],
              password_hash: params[2],
              display_name: params[3],
              created_at: new Date().toISOString()
            });
            return { changes: 1 };
          }
          if (cleanSql.includes('insert into timetables')) {
            store.timetables.push({
              id: params[0],
              user_id: params[1],
              name: params[2],
              config: params[3],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            return { changes: 1 };
          }
          if (cleanSql.includes('insert into sections')) {
            store.sections.push({ id: params[0], timetable_id: params[1], name: params[2] });
            return { changes: 1 };
          }
          if (cleanSql.includes('insert into subjects')) {
            store.subjects.push({
              id: params[0], timetable_id: params[1], code: params[2],
              title: params[3], credit: params[4], faculty: params[5],
              faculty_short: params[6], type: params[7], periods_per_week: params[8], color: params[9]
            });
            return { changes: 1 };
          }
          if (cleanSql.includes('insert into schedule_slots')) {
            store.schedule_slots.push({
              id: store.schedule_slots.length + 1,
              timetable_id: params[0], section_id: params[1], subject_id: params[2],
              day: params[3], period: params[4], variant: params[5], label: params[6]
            });
            return { changes: 1 };
          }
          if (cleanSql.includes('delete from timetables where id = ?')) {
            const id = params[0];
            store.timetables = store.timetables.filter(t => t.id !== id);
            store.sections = store.sections.filter(s => s.timetable_id !== id);
            store.subjects = store.subjects.filter(s => s.timetable_id !== id);
            store.schedule_slots = store.schedule_slots.filter(s => s.timetable_id !== id);
            return { changes: 1 };
          }
          if (cleanSql.includes('delete from sections where timetable_id = ?')) {
            store.sections = store.sections.filter(s => s.timetable_id !== params[0]);
            return { changes: 1 };
          }
          if (cleanSql.includes('delete from subjects where timetable_id = ?')) {
            store.subjects = store.subjects.filter(s => s.timetable_id !== params[0]);
            return { changes: 1 };
          }
          if (cleanSql.includes('delete from schedule_slots where timetable_id = ?')) {
            store.schedule_slots = store.schedule_slots.filter(s => s.timetable_id !== params[0]);
            return { changes: 1 };
          }
          if (cleanSql.includes('update timetables set name = ?')) {
            const tt = store.timetables.find(t => t.id === params[2]);
            if (tt) {
              tt.name = params[0];
              tt.config = params[1];
              tt.updated_at = new Date().toISOString();
            }
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    },
    transaction(fn) {
      return fn;
    }
  };
}

try {
  db = initNativeDb();
} catch (err) {
  console.warn('⚠️ Native SQLite initialization failed. Switching to Vercel Serverless In-Memory DB:', err.message);
  db = initInMemoryDb();
}

module.exports = db;
