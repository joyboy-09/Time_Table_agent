import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';

const DEFAULT_PERIODS = [
  { startTime: '09:00', endTime: '09:50' },
  { startTime: '09:50', endTime: '10:40' },
  { startTime: '10:40', endTime: '11:30' },
  { startTime: '11:30', endTime: '12:20' },
  { startTime: '01:10', endTime: '02:00' },
  { startTime: '02:00', endTime: '02:50' },
  { startTime: '02:50', endTime: '03:40' },
];

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBJECT_COLORS = [
  '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#EA580C',
  '#D97706', '#65A30D', '#059669', '#0891B2', '#2563EB',
  '#9333EA', '#C026D3', '#E11D48', '#F97316', '#22C55E',
];

export default function SetupWizard({ user, addToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [sections, setSections] = useState([
    { id: crypto.randomUUID(), name: 'Section A' }
  ]);

  // Step 2: Schedule Config
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [lunchAfterPeriod, setLunchAfterPeriod] = useState(4);
  const [lunchDuration, setLunchDuration] = useState(50);
  const [workingDays, setWorkingDays] = useState(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [periods, setPeriods] = useState(DEFAULT_PERIODS);

  // Step 3: Subjects
  const [subjects, setSubjects] = useState([]);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '', title: '', credit: 3, faculty: '', faculty_short: '',
    type: 'theory', periods_per_week: 3, color: SUBJECT_COLORS[0]
  });

  // Load existing timetable data
  useEffect(() => {
    if (isEditing) {
      loadTimetable();
    }
  }, [id]);

  const loadTimetable = async () => {
    try {
      const data = await api.getTimetable(id);
      setName(data.name);
      setSections(data.sections || [{ id: crypto.randomUUID(), name: 'Section A' }]);
      setSubjects(data.subjects || []);

      if (data.config) {
        setPeriodsPerDay(data.config.periodsPerDay || 7);
        setLunchAfterPeriod(data.config.lunchAfterPeriod || 4);
        setLunchDuration(data.config.lunchDuration || 50);
        setWorkingDays(data.config.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        setPeriods(data.config.periods || DEFAULT_PERIODS);
      }
    } catch (err) {
      addToast('Failed to load timetable: ' + err.message, 'error');
    }
  };

  // Period management
  useEffect(() => {
    if (periods.length < periodsPerDay) {
      const newPeriods = [...periods];
      while (newPeriods.length < periodsPerDay) {
        const last = newPeriods[newPeriods.length - 1];
        newPeriods.push({
          startTime: last?.endTime || '09:00',
          endTime: addMinutes(last?.endTime || '09:00', 50)
        });
      }
      setPeriods(newPeriods);
    } else if (periods.length > periodsPerDay) {
      setPeriods(periods.slice(0, periodsPerDay));
    }
  }, [periodsPerDay]);

  function addMinutes(timeStr, minutes) {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMin = h * 60 + m + minutes;
    const newH = Math.floor(totalMin / 60) % 24;
    const newM = totalMin % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  // Section management
  const addSection = () => {
    const letters = 'ABCDEFGHIJKLMNOP';
    const nextLetter = letters[sections.length] || sections.length + 1;
    setSections([...sections, { id: crypto.randomUUID(), name: `Section ${nextLetter}` }]);
  };

  const removeSection = (idx) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSectionName = (idx, newName) => {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], name: newName };
    setSections(updated);
  };

  // Subject management
  const resetSubjectForm = () => {
    setSubjectForm({
      code: '', title: '', credit: 3, faculty: '', faculty_short: '',
      type: 'theory', periods_per_week: 3, color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length]
    });
    setEditingSubject(null);
  };

  const addOrUpdateSubject = () => {
    if (!subjectForm.code || !subjectForm.title || !subjectForm.faculty) {
      addToast('Please fill subject code, title, and faculty name', 'error');
      return;
    }

    if (editingSubject !== null) {
      const updated = [...subjects];
      updated[editingSubject] = { ...updated[editingSubject], ...subjectForm };
      setSubjects(updated);
      addToast('Subject updated');
    } else {
      setSubjects([...subjects, { id: crypto.randomUUID(), ...subjectForm }]);
      addToast('Subject added');
    }
    resetSubjectForm();
  };

  const editSubject = (idx) => {
    setEditingSubject(idx);
    setSubjectForm({ ...subjects[idx] });
  };

  const removeSubject = (idx) => {
    setSubjects(subjects.filter((_, i) => i !== idx));
  };

  // Save
  const handleSave = async () => {
    if (!name.trim()) {
      addToast('Please enter a timetable name', 'error');
      return;
    }
    if (sections.length === 0) {
      addToast('Add at least one section', 'error');
      return;
    }
    if (subjects.length === 0) {
      addToast('Add at least one subject', 'error');
      return;
    }

    setSaving(true);
    try {
      const config = {
        periodsPerDay,
        lunchAfterPeriod,
        lunchDuration,
        workingDays,
        periods,
      };

      const data = { name, config, sections, subjects, userId: user?.id };

      if (isEditing) {
        await api.updateTimetable(id, data);
        addToast('Timetable updated successfully');
      } else {
        const created = await api.createTimetable(data);
        addToast('Timetable created successfully');
        navigate(`/view/${created.id}`);
        return;
      }
      navigate(`/view/${id}`);
    } catch (err) {
      addToast('Failed to save: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle working day
  const toggleDay = (day) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const updatePeriodTime = (idx, field, value) => {
    const updated = [...periods];
    updated[idx] = { ...updated[idx], [field]: value };
    setPeriods(updated);
  };

  const totalSteps = 3;

  return (
    <div className="animate-in" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 className="dashboard-title" style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
        {isEditing ? '✏️ Edit Timetable' : 'Create New Timetable'}
      </h1>
      <p className="dashboard-subtitle" style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        {isEditing ? 'Update your timetable configuration' : 'Set up your schedule in 3 easy steps'}
      </p>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        {[
          { num: 1, label: 'Basic Info' },
          { num: 2, label: 'Schedule' },
          { num: 3, label: 'Subjects' },
        ].map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {i > 0 && <div className={`wizard-connector ${step > s.num - 1 ? 'active' : ''}`} />}
            <div
              className={`wizard-step ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}
              onClick={() => setStep(s.num)}
              style={{ cursor: 'pointer' }}
            >
              <div className="wizard-step-number">
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="wizard-step-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="animate-in">
            <h2 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>
              📝 Basic Information
            </h2>

            <div className="form-group">
              <label className="form-label">Timetable Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g., CSE III Year - 2026 Odd Semester"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sections (Max 4)</label>
              <div className="subject-list">
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="subject-item">
                    <div className="period-number">{idx + 1}</div>
                    <input
                      className="form-input"
                      type="text"
                      value={sec.name}
                      onChange={e => updateSectionName(idx, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {sections.length > 1 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => removeSection(idx)}
                        style={{ color: 'var(--danger-400)' }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {sections.length < 4 && (
                <button className="btn btn-secondary btn-sm" onClick={addSection}
                  style={{ marginTop: 'var(--space-3)' }}>
                  ➕ Add Section
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Schedule Config */}
        {step === 2 && (
          <div className="animate-in">
            <h2 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>
              ⏰ Schedule Configuration
            </h2>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Periods Per Day</label>
                <select
                  className="form-select"
                  value={periodsPerDay}
                  onChange={e => setPeriodsPerDay(Number(e.target.value))}
                >
                  {[5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n} Periods</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Lunch Break After Period</label>
                <select
                  className="form-select"
                  value={lunchAfterPeriod}
                  onChange={e => setLunchAfterPeriod(Number(e.target.value))}
                >
                  {Array.from({ length: periodsPerDay - 1 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>After Period {n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Lunch Break Duration (minutes)</label>
              <input
                className="form-input"
                type="number"
                min={15}
                max={120}
                value={lunchDuration}
                onChange={e => setLunchDuration(Number(e.target.value))}
                style={{ maxWidth: 200 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Working Days</label>
              <div className="form-checkbox-group">
                {ALL_DAYS.map(day => (
                  <label key={day} className="form-checkbox">
                    <input
                      type="checkbox"
                      checked={workingDays.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Period Timings</label>
              <div className="period-config">
                {periods.map((period, idx) => (
                  <div key={idx} className="period-row">
                    <div className="period-number">
                      P{idx + 1}
                      {idx + 1 === lunchAfterPeriod && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--warning-500)' }}>▼ Lunch</div>
                      )}
                    </div>
                    <input
                      className="form-input"
                      type="time"
                      value={period.startTime}
                      onChange={e => updatePeriodTime(idx, 'startTime', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="time"
                      value={period.endTime}
                      onChange={e => updatePeriodTime(idx, 'endTime', e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 50 }}>
                      {(() => {
                        const [sh, sm] = period.startTime.split(':').map(Number);
                        const [eh, em] = period.endTime.split(':').map(Number);
                        const mins = (eh * 60 + em) - (sh * 60 + sm);
                        return mins > 0 ? `${mins} min` : '';
                      })()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Subjects */}
        {step === 3 && (
          <div className="animate-in">
            <h2 className="card-title" style={{ marginBottom: 'var(--space-6)' }}>
              📚 Subjects & Faculty
            </h2>

            {/* Subject Form */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', background: 'var(--bg-glass)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                {editingSubject !== null ? '✏️ Edit Subject' : '➕ Add Subject'}
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Subject Code *</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., 23CS601"
                    value={subjectForm.code}
                    onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject Title *</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., Computer Networks"
                    value={subjectForm.title}
                    onChange={e => setSubjectForm({ ...subjectForm, title: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Faculty Name *</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., Mr V.S.N Murthy"
                    value={subjectForm.faculty}
                    onChange={e => setSubjectForm({ ...subjectForm, faculty: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Faculty Short Name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g., VSNM"
                    value={subjectForm.faculty_short}
                    onChange={e => setSubjectForm({ ...subjectForm, faculty_short: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Credit Hours</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0.5}
                    max={6}
                    step={0.5}
                    value={subjectForm.credit}
                    onChange={e => setSubjectForm({ ...subjectForm, credit: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={subjectForm.type}
                    onChange={e => setSubjectForm({ ...subjectForm, type: e.target.value })}
                  >
                    <option value="theory">Theory</option>
                    <option value="lab">Lab</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Periods/Week</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    max={10}
                    value={subjectForm.periods_per_week}
                    onChange={e => setSubjectForm({ ...subjectForm, periods_per_week: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Color Tag</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {SUBJECT_COLORS.map(color => (
                    <div
                      key={color}
                      onClick={() => setSubjectForm({ ...subjectForm, color })}
                      style={{
                        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                        background: color, cursor: 'pointer',
                        border: subjectForm.color === color ? '3px solid white' : '3px solid transparent',
                        boxShadow: subjectForm.color === color ? `0 0 10px ${color}` : 'none',
                        transition: 'all 0.2s'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="btn btn-primary" onClick={addOrUpdateSubject}>
                  {editingSubject !== null ? '💾 Update Subject' : '➕ Add Subject'}
                </button>
                {editingSubject !== null && (
                  <button className="btn btn-secondary" onClick={resetSubjectForm}>
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Subject List */}
            {subjects.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                  Added Subjects ({subjects.length})
                </h3>
                <div className="subject-list">
                  {subjects.map((sub, idx) => (
                    <div key={sub.id || idx} className="subject-item">
                      <div
                        className="subject-color-dot"
                        style={{ background: sub.color || SUBJECT_COLORS[idx % SUBJECT_COLORS.length] }}
                      />
                      <div className="subject-item-info">
                        <div className="subject-item-code">
                          {sub.code}
                          <span className={`badge ${sub.type === 'lab' ? 'badge-lab' : 'badge-theory'}`}
                            style={{ marginLeft: 'var(--space-2)' }}>
                            {sub.type}
                          </span>
                        </div>
                        <div className="subject-item-title">{sub.title}</div>
                        <div className="subject-item-faculty">
                          👤 {sub.faculty} {sub.faculty_short ? `(${sub.faculty_short})` : ''}
                          &nbsp; • &nbsp; Credits: {sub.credit} &nbsp; • &nbsp; {sub.periods_per_week} periods/week
                        </div>
                      </div>
                      <div className="subject-item-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => editSubject(idx)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeSubject(idx)}
                          style={{ color: 'var(--danger-400)' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
        <div>
          {step > 1 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              ← Previous
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            Cancel
          </button>
          {step < totalSteps ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              Next →
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Saving...' : isEditing ? '💾 Save & Generate' : '🚀 Create & Generate'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
