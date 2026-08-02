const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database.cjs');

// GET all timetables for a user
router.get('/', (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const timetables = db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM sections WHERE timetable_id = t.id) as section_count,
        (SELECT COUNT(*) FROM subjects WHERE timetable_id = t.id) as subject_count,
        (SELECT COUNT(DISTINCT variant) FROM schedule_slots WHERE timetable_id = t.id) as variant_count
      FROM timetables t 
      WHERE t.user_id = ?
      ORDER BY t.updated_at DESC
    `).all(userId);

    res.json(timetables.map(t => ({
      ...t,
      config: JSON.parse(t.config || '{}')
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single timetable with all data
router.get('/:id', (req, res) => {
  try {
    const timetable = db.prepare('SELECT * FROM timetables WHERE id = ?').get(req.params.id);
    if (!timetable) return res.status(404).json({ error: 'Timetable not found' });

    const sections = db.prepare('SELECT * FROM sections WHERE timetable_id = ?').all(req.params.id);
    const subjects = db.prepare('SELECT * FROM subjects WHERE timetable_id = ?').all(req.params.id);
    const slots = db.prepare('SELECT * FROM schedule_slots WHERE timetable_id = ? ORDER BY variant, day, period').all(req.params.id);

    res.json({
      ...timetable,
      config: JSON.parse(timetable.config || '{}'),
      sections,
      subjects,
      slots
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new timetable
router.post('/', (req, res) => {
  try {
    const { name, config, sections, subjects, userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const id = uuidv4();

    const insertTimetable = db.prepare(
      'INSERT INTO timetables (id, user_id, name, config) VALUES (?, ?, ?, ?)'
    );

    const insertSection = db.prepare(
      'INSERT INTO sections (id, timetable_id, name) VALUES (?, ?, ?)'
    );

    const insertSubject = db.prepare(
      'INSERT INTO subjects (id, timetable_id, code, title, credit, faculty, faculty_short, type, periods_per_week, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const transaction = db.transaction(() => {
      insertTimetable.run(id, userId, name, JSON.stringify(config || {}));

      if (sections) {
        for (const sec of sections) {
          const secId = sec.id || uuidv4();
          insertSection.run(secId, id, sec.name);
        }
      }

      if (subjects) {
        for (const sub of subjects) {
          const subId = sub.id || uuidv4();
          insertSubject.run(
            subId, id, sub.code, sub.title,
            sub.credit || 3.0, sub.faculty,
            sub.faculty_short || '', sub.type || 'theory',
            sub.periods_per_week || Math.ceil(sub.credit || 3),
            sub.color || null
          );
        }
      }
    });

    transaction();

    const created = db.prepare('SELECT * FROM timetables WHERE id = ?').get(id);
    const createdSections = db.prepare('SELECT * FROM sections WHERE timetable_id = ?').all(id);
    const createdSubjects = db.prepare('SELECT * FROM subjects WHERE timetable_id = ?').all(id);

    res.status(201).json({
      ...created,
      config: JSON.parse(created.config),
      sections: createdSections,
      subjects: createdSubjects
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update timetable
router.put('/:id', (req, res) => {
  try {
    const { name, config, sections, subjects } = req.body;
    const id = req.params.id;

    const existing = db.prepare('SELECT * FROM timetables WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Timetable not found' });

    const transaction = db.transaction(() => {
      db.prepare(
        'UPDATE timetables SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(name || existing.name, JSON.stringify(config || JSON.parse(existing.config)), id);

      if (sections) {
        db.prepare('DELETE FROM sections WHERE timetable_id = ?').run(id);
        const insertSection = db.prepare(
          'INSERT INTO sections (id, timetable_id, name) VALUES (?, ?, ?)'
        );
        for (const sec of sections) {
          insertSection.run(sec.id || uuidv4(), id, sec.name);
        }
      }

      if (subjects) {
        db.prepare('DELETE FROM subjects WHERE timetable_id = ?').run(id);
        const insertSubject = db.prepare(
          'INSERT INTO subjects (id, timetable_id, code, title, credit, faculty, faculty_short, type, periods_per_week, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const sub of subjects) {
          insertSubject.run(
            sub.id || uuidv4(), id, sub.code, sub.title,
            sub.credit || 3.0, sub.faculty,
            sub.faculty_short || '', sub.type || 'theory',
            sub.periods_per_week || Math.ceil(sub.credit || 3),
            sub.color || null
          );
        }
      }

      db.prepare('DELETE FROM schedule_slots WHERE timetable_id = ?').run(id);
    });

    transaction();

    const updated = db.prepare('SELECT * FROM timetables WHERE id = ?').get(id);
    const updatedSections = db.prepare('SELECT * FROM sections WHERE timetable_id = ?').all(id);
    const updatedSubjects = db.prepare('SELECT * FROM subjects WHERE timetable_id = ?').all(id);

    res.json({
      ...updated,
      config: JSON.parse(updated.config),
      sections: updatedSections,
      subjects: updatedSubjects
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE timetable
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM timetables WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Timetable not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST duplicate timetable
router.post('/:id/duplicate', (req, res) => {
  try {
    const original = db.prepare('SELECT * FROM timetables WHERE id = ?').get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Timetable not found' });

    const newId = uuidv4();
    const sections = db.prepare('SELECT * FROM sections WHERE timetable_id = ?').all(req.params.id);
    const subjects = db.prepare('SELECT * FROM subjects WHERE timetable_id = ?').all(req.params.id);

    const transaction = db.transaction(() => {
      db.prepare('INSERT INTO timetables (id, user_id, name, config) VALUES (?, ?, ?, ?)').run(
        newId, original.user_id, `${original.name} (Copy)`, original.config
      );

      for (const sec of sections) {
        db.prepare('INSERT INTO sections (id, timetable_id, name) VALUES (?, ?, ?)').run(
          uuidv4(), newId, sec.name
        );
      }

      for (const sub of subjects) {
        db.prepare(
          'INSERT INTO subjects (id, timetable_id, code, title, credit, faculty, faculty_short, type, periods_per_week, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(uuidv4(), newId, sub.code, sub.title, sub.credit, sub.faculty, sub.faculty_short, sub.type, sub.periods_per_week, sub.color);
      }
    });

    transaction();

    const created = db.prepare('SELECT * FROM timetables WHERE id = ?').get(newId);
    res.status(201).json({ ...created, config: JSON.parse(created.config) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
