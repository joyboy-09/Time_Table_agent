const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

/**
 * Timetable Generation Engine
 * Uses constraint-based scheduling with backtracking to produce
 * conflict-free timetables for multiple sections.
 */

const SUBJECT_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#EA580C',
  '#D97706', '#65A30D', '#059669', '#0891B2', '#2563EB',
  '#7C3AED', '#9333EA', '#C026D3', '#E11D48', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
];

class TimetableGenerator {
  constructor(config, subjects, sections) {
    this.config = config;
    this.subjects = subjects;
    this.sections = sections;
    this.workingDays = config.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    this.periodsPerDay = config.periodsPerDay || 7;
    this.lunchAfterPeriod = config.lunchAfterPeriod || 4;
  }

  /**
   * Generate multiple timetable variants
   * @param {number} numVariants - Number of variants to generate
   * @returns {Array} Array of variant schedules
   */
  generate(numVariants = 3) {
    const variants = [];

    for (let v = 0; v < numVariants; v++) {
      const schedule = this._generateSingleVariant(v);
      if (schedule) {
        variants.push({
          variant: v + 1,
          schedule,
          score: this._scoreSchedule(schedule)
        });
      }
    }

    // Sort by score (higher is better)
    variants.sort((a, b) => b.score - a.score);
    return variants;
  }

  /**
   * Generate a single timetable variant for all sections
   */
  _generateSingleVariant(seed) {
    const allSectionSchedules = {};
    const globalFacultyMap = {}; // Track faculty assignments across all sections

    // Initialize faculty map: day -> period -> Set of faculty names
    for (const day of this.workingDays) {
      globalFacultyMap[day] = {};
      for (let p = 1; p <= this.periodsPerDay; p++) {
        globalFacultyMap[day][p] = new Set();
      }
    }

    // Shuffle sections for different orderings per variant
    const shuffledSections = this._shuffleWithSeed([...this.sections], seed);

    for (const section of shuffledSections) {
      const sectionSchedule = this._scheduleSectionSubjects(
        section,
        globalFacultyMap,
        seed
      );

      if (!sectionSchedule) {
        return null; // Failed to generate valid schedule
      }

      allSectionSchedules[section.id] = sectionSchedule;
    }

    return allSectionSchedules;
  }

  /**
   * Schedule all subjects for a single section
   */
  _scheduleSectionSubjects(section, globalFacultyMap, seed) {
    const schedule = {}; // day -> period -> { subjectId, subjectCode, faculty, ... }

    // Initialize empty schedule
    for (const day of this.workingDays) {
      schedule[day] = {};
      for (let p = 1; p <= this.periodsPerDay; p++) {
        schedule[day][p] = null;
      }
    }

    // Build subject slots needed
    const subjectSlots = [];
    for (const subject of this.subjects) {
      const periodsNeeded = subject.periods_per_week || Math.ceil(subject.credit);

      if (subject.type === 'lab') {
        // Labs need double-period blocks
        const labBlocks = Math.floor(periodsNeeded / 2);
        for (let i = 0; i < labBlocks; i++) {
          subjectSlots.push({ ...subject, isLabBlock: true, slotSize: 2 });
        }
        // If odd period remaining, add single
        if (periodsNeeded % 2 === 1) {
          subjectSlots.push({ ...subject, isLabBlock: false, slotSize: 1 });
        }
      } else {
        for (let i = 0; i < periodsNeeded; i++) {
          subjectSlots.push({ ...subject, isLabBlock: false, slotSize: 1 });
        }
      }
    }

    // Shuffle slots for randomization
    const shuffledSlots = this._shuffleWithSeed([...subjectSlots], seed + this.sections.indexOf(section) * 17);

    // Sort: labs first (harder to place), then by periods needed
    shuffledSlots.sort((a, b) => {
      if (a.isLabBlock !== b.isLabBlock) return b.isLabBlock ? 1 : -1;
      return b.slotSize - a.slotSize;
    });

    // Try to place each slot
    for (const slot of shuffledSlots) {
      const placed = this._placeSlot(slot, schedule, globalFacultyMap, section, seed);
      if (!placed) {
        // Try with backtracking
        const placedWithBacktrack = this._placeSlotWithBacktrack(slot, schedule, globalFacultyMap, section);
        if (!placedWithBacktrack) {
          console.warn(`Could not place ${slot.code} for section ${section.name}`);
          // Continue anyway - some subjects might not fit
        }
      }
    }

    return schedule;
  }

  /**
   * Try to place a subject slot in the schedule
   */
  _placeSlot(slot, schedule, globalFacultyMap, section, seed) {
    const allFaculty = this._parseFaculty(slot.faculty);
    const availablePositions = [];

    for (const day of this.workingDays) {
      for (let p = 1; p <= this.periodsPerDay; p++) {
        if (this._canPlace(slot, day, p, schedule, globalFacultyMap, allFaculty)) {
          availablePositions.push({ day, period: p });
        }
      }
    }

    if (availablePositions.length === 0) return false;

    // Score positions and pick the best one with some randomization
    const scored = availablePositions.map(pos => ({
      ...pos,
      score: this._scorePosition(slot, pos.day, pos.period, schedule, seed)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Pick from top candidates with some randomization
    const topN = Math.min(3, scored.length);
    const pick = scored[seed % topN] || scored[0];

    // Place the slot
    this._doPlace(slot, pick.day, pick.period, schedule, globalFacultyMap, allFaculty, section);
    return true;
  }

  /**
   * Place slot with simple backtracking
   */
  _placeSlotWithBacktrack(slot, schedule, globalFacultyMap, section) {
    const allFaculty = this._parseFaculty(slot.faculty);

    for (const day of this._shuffleWithSeed([...this.workingDays], Date.now())) {
      for (let p = 1; p <= this.periodsPerDay; p++) {
        if (this._canPlace(slot, day, p, schedule, globalFacultyMap, allFaculty)) {
          this._doPlace(slot, day, p, schedule, globalFacultyMap, allFaculty, section);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if a slot can be placed at a given position
   */
  _canPlace(slot, day, period, schedule, globalFacultyMap, allFaculty) {
    // Check if period slot is empty
    if (schedule[day][period] !== null) return false;

    // For labs, check consecutive period too
    if (slot.isLabBlock) {
      const nextPeriod = period + 1;
      if (nextPeriod > this.periodsPerDay) return false;
      if (schedule[day][nextPeriod] !== null) return false;

      // Don't span across lunch break
      if (period === this.lunchAfterPeriod) return false;

      // Check faculty availability for both periods
      for (const f of allFaculty) {
        if (globalFacultyMap[day][nextPeriod].has(f)) return false;
      }
    }

    // Check faculty availability
    for (const f of allFaculty) {
      if (globalFacultyMap[day][period].has(f)) return false;
    }

    // Limit same subject per day (max 1 theory per day, max 1 lab block per day)
    const subjectCountToday = Object.values(schedule[day]).filter(
      s => s && s.subjectId === slot.id
    ).length;

    if (slot.type === 'theory' && subjectCountToday >= 1) return false;
    if (slot.type === 'lab' && subjectCountToday >= 2) return false;

    return true;
  }

  /**
   * Execute placement of a slot
   */
  _doPlace(slot, day, period, schedule, globalFacultyMap, allFaculty, section) {
    const colorIndex = this.subjects.findIndex(s => s.id === slot.id);
    const entry = {
      subjectId: slot.id,
      subjectCode: slot.code,
      subjectTitle: slot.title,
      faculty: slot.faculty,
      facultyShort: slot.faculty_short || this._abbreviateFaculty(slot.faculty),
      type: slot.type,
      isLabBlock: slot.isLabBlock,
      color: slot.color || SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length],
      sectionId: section.id,
      sectionName: section.name
    };

    schedule[day][period] = entry;

    // Mark faculty as busy
    for (const f of allFaculty) {
      globalFacultyMap[day][period].add(f);
    }

    // Place second period for labs
    if (slot.isLabBlock) {
      schedule[day][period + 1] = { ...entry, isLabContinuation: true };
      for (const f of allFaculty) {
        globalFacultyMap[day][period + 1].add(f);
      }
    }
  }

  /**
   * Score a position (higher = better placement)
   */
  _scorePosition(slot, day, period, schedule, seed) {
    let score = 100;

    // Prefer morning periods for theory
    if (slot.type === 'theory') {
      score += (this.periodsPerDay - period) * 2;
    }

    // Prefer afternoon for labs
    if (slot.type === 'lab') {
      score += period * 2;
    }

    // Avoid adjacent same-subject periods (unless lab)
    if (!slot.isLabBlock) {
      if (period > 1 && schedule[day][period - 1]?.subjectId === slot.id) {
        score -= 20;
      }
      if (period < this.periodsPerDay && schedule[day][period + 1]?.subjectId === slot.id) {
        score -= 20;
      }
    }

    // Distribute evenly across days
    const dayIndex = this.workingDays.indexOf(day);
    const subjectDays = this.workingDays.filter(d =>
      Object.values(schedule[d]).some(s => s && s.subjectId === slot.id)
    );
    if (!subjectDays.includes(day)) {
      score += 15; // Prefer unoccupied days
    }

    // Add some randomization based on seed
    score += ((seed * 37 + period * 13 + dayIndex * 7) % 10);

    return score;
  }

  /**
   * Score a complete schedule (higher = better)
   */
  _scoreSchedule(scheduleBySection) {
    let totalScore = 0;

    for (const sectionId of Object.keys(scheduleBySection)) {
      const schedule = scheduleBySection[sectionId];

      // Check distribution evenness
      const subjectDayCounts = {};

      for (const day of this.workingDays) {
        for (let p = 1; p <= this.periodsPerDay; p++) {
          const slot = schedule[day][p];
          if (slot && !slot.isLabContinuation) {
            if (!subjectDayCounts[slot.subjectId]) {
              subjectDayCounts[slot.subjectId] = new Set();
            }
            subjectDayCounts[slot.subjectId].add(day);
          }
        }
      }

      // More spread = higher score
      for (const sid of Object.keys(subjectDayCounts)) {
        totalScore += subjectDayCounts[sid].size * 10;
      }

      // Penalize empty periods in the middle of the day
      for (const day of this.workingDays) {
        let firstOccupied = this.periodsPerDay + 1;
        let lastOccupied = 0;
        for (let p = 1; p <= this.periodsPerDay; p++) {
          if (schedule[day][p]) {
            firstOccupied = Math.min(firstOccupied, p);
            lastOccupied = Math.max(lastOccupied, p);
          }
        }
        for (let p = firstOccupied; p <= lastOccupied; p++) {
          if (!schedule[day][p]) {
            totalScore -= 5; // Penalize gaps
          }
        }
      }
    }

    return totalScore;
  }

  /**
   * Parse faculty string to extract individual faculty names
   */
  _parseFaculty(facultyStr) {
    return facultyStr.split(/[\/,&]/).map(f => f.trim()).filter(f => f.length > 0);
  }

  /**
   * Create abbreviated faculty name
   */
  _abbreviateFaculty(name) {
    if (!name) return '';
    // If already short, return as is
    if (name.length <= 6) return name;
    // If has parenthetical abbreviation, use it
    const match = name.match(/\(([^)]+)\)/);
    if (match) return match[1];
    // Otherwise abbreviate
    const words = name.replace(/[()]/g, '').split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
    return words.map(w => w[0]).join('').toUpperCase();
  }

  /**
   * Shuffle array with seed for reproducibility
   */
  _shuffleWithSeed(array, seed) {
    let currentSeed = seed;
    const random = () => {
      currentSeed = (currentSeed * 16807 + 0) % 2147483647;
      return currentSeed / 2147483647;
    };

    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

module.exports = TimetableGenerator;
