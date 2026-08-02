const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database.cjs');
const TimetableGenerator = require('../engine/generator.cjs');

// POST generate timetable variants
router.post('/:timetableId', (req, res) => {
  try {
    const timetableId = req.params.timetableId;
    const { numVariants = 3 } = req.body;

    const timetable = db.prepare('SELECT * FROM timetables WHERE id = ?').get(timetableId);
    if (!timetable) return res.status(404).json({ error: 'Timetable not found' });

    const config = JSON.parse(timetable.config || '{}');
    const sections = db.prepare('SELECT * FROM sections WHERE timetable_id = ?').all(timetableId);
    const subjects = db.prepare('SELECT * FROM subjects WHERE timetable_id = ?').all(timetableId);

    if (sections.length === 0) {
      return res.status(400).json({ error: 'No sections defined. Add at least one section.' });
    }

    if (subjects.length === 0) {
      return res.status(400).json({ error: 'No subjects defined. Add at least one subject.' });
    }

    // Generate variants
    const generator = new TimetableGenerator(config, subjects, sections);
    const variants = generator.generate(Math.min(numVariants, 5));

    if (variants.length === 0) {
      return res.status(400).json({
        error: 'Could not generate a valid timetable. Try adjusting the schedule configuration or reducing constraints.'
      });
    }

    // Clear existing slots
    db.prepare('DELETE FROM schedule_slots WHERE timetable_id = ?').run(timetableId);

    // Save all variants to database
    const insertSlot = db.prepare(`
      INSERT INTO schedule_slots (timetable_id, section_id, subject_id, day, period, variant, label)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (const variant of variants) {
        for (const sectionId of Object.keys(variant.schedule)) {
          const sectionSchedule = variant.schedule[sectionId];
          for (const day of Object.keys(sectionSchedule)) {
            for (const period of Object.keys(sectionSchedule[day])) {
              const slot = sectionSchedule[day][period];
              if (slot && !slot.isLabContinuation) {
                insertSlot.run(
                  timetableId,
                  sectionId,
                  slot.subjectId,
                  day,
                  parseInt(period),
                  variant.variant,
                  slot.isLabBlock ? 'lab' : null
                );

                // If lab, also insert continuation
                if (slot.isLabBlock) {
                  insertSlot.run(
                    timetableId,
                    sectionId,
                    slot.subjectId,
                    day,
                    parseInt(period) + 1,
                    variant.variant,
                    'lab-continuation'
                  );
                }
              }
            }
          }
        }
      }
    });

    transaction();

    // Return variants with full schedule data for frontend
    const response = variants.map(v => ({
      variant: v.variant,
      score: v.score,
      sections: Object.keys(v.schedule).map(sectionId => {
        const section = sections.find(s => s.id === sectionId);
        return {
          sectionId,
          sectionName: section?.name || 'Unknown',
          schedule: v.schedule[sectionId]
        };
      })
    }));

    res.json({
      timetableId,
      timetableName: timetable.name,
      config,
      subjects,
      variants: response
    });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET saved variants for a timetable
router.get('/:timetableId/variants', (req, res) => {
  try {
    const timetableId = req.params.timetableId;

    const timetable = db.prepare('SELECT * FROM timetables WHERE id = ?').get(timetableId);
    if (!timetable) return res.status(404).json({ error: 'Timetable not found' });

    const config = JSON.parse(timetable.config || '{}');
    const sections = db.prepare('SELECT * FROM sections WHERE timetable_id = ?').all(timetableId);
    const subjects = db.prepare('SELECT * FROM subjects WHERE timetable_id = ?').all(timetableId);

    const slots = db.prepare(`
      SELECT ss.*, sub.code as subject_code, sub.title as subject_title,
             sub.faculty, sub.faculty_short, sub.type as subject_type, sub.color,
             sec.name as section_name
      FROM schedule_slots ss
      LEFT JOIN subjects sub ON ss.subject_id = sub.id
      LEFT JOIN sections sec ON ss.section_id = sec.id
      WHERE ss.timetable_id = ?
      ORDER BY ss.variant, ss.day, ss.period
    `).all(timetableId);

    // Organize slots into variants
    const variantMap = {};
    for (const slot of slots) {
      if (!variantMap[slot.variant]) {
        variantMap[slot.variant] = {};
      }
      if (!variantMap[slot.variant][slot.section_id]) {
        variantMap[slot.variant][slot.section_id] = {
          sectionId: slot.section_id,
          sectionName: slot.section_name,
          schedule: {}
        };
      }

      const sched = variantMap[slot.variant][slot.section_id].schedule;
      if (!sched[slot.day]) sched[slot.day] = {};

      sched[slot.day][slot.period] = {
        subjectId: slot.subject_id,
        subjectCode: slot.subject_code,
        subjectTitle: slot.subject_title,
        faculty: slot.faculty,
        facultyShort: slot.faculty_short,
        type: slot.subject_type,
        color: slot.color,
        isLabBlock: slot.label === 'lab',
        isLabContinuation: slot.label === 'lab-continuation'
      };
    }

    const variants = Object.keys(variantMap).map(v => ({
      variant: parseInt(v),
      sections: Object.values(variantMap[v])
    }));

    res.json({
      timetableId,
      timetableName: timetable.name,
      config,
      subjects,
      sections,
      variants
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
