import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { exportAsPNG, exportAsPDF, exportAsCSV } from '../utils/export';

const THEMES = [
  { id: 'default', name: 'Warm Editorial', preview: 'linear-gradient(135deg, #FEFCF8, #F8F5F0)' },
  { id: 'classic', name: 'Classic White', preview: 'linear-gradient(135deg, #ffffff, #f5f5f5)' },
  { id: 'colorful', name: 'Colorful Accent', preview: 'linear-gradient(135deg, #E8853A, #4A7BBA, #5B9A6B)' },
  { id: 'minimal', name: 'Minimal Mono', preview: 'linear-gradient(135deg, #fafafa, #e5e5e5)' },
];

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableView({ addToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [timetable, setTimetable] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(1);
  const [selectedSection, setSelectedSection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [theme, setTheme] = useState('default');
  const [config, setConfig] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getTimetable(id);
      setTimetable(data);
      setConfig(data.config || {});
      setSubjects(data.subjects || []);
      setSections(data.sections || []);

      if (data.sections?.length > 0) {
        setSelectedSection(data.sections[0].id);
      }

      // Check if variants exist
      try {
        const variantData = await api.getVariants(id);
        if (variantData.variants && variantData.variants.length > 0) {
          setVariants(variantData.variants);
        } else {
          // Auto-generate
          await handleGenerate();
        }
      } catch {
        await handleGenerate();
      }
    } catch (err) {
      addToast('Failed to load timetable: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result = await api.generateTimetable(id, 4);
      setVariants(result.variants || []);
      setConfig(result.config || config);
      setSubjects(result.subjects || subjects);

      if (result.variants?.length > 0) {
        setSelectedVariant(result.variants[0].variant);
        addToast(`Generated ${result.variants.length} timetable variants!`);
      } else {
        addToast('Could not generate valid timetables. Try adjusting constraints.', 'error');
      }
    } catch (err) {
      addToast('Generation failed: ' + err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const currentVariant = variants.find(v => v.variant === selectedVariant) || variants[0];
  const currentSectionData = currentVariant?.sections?.find(s => s.sectionId === selectedSection);
  const schedule = currentSectionData?.schedule || {};

  const workingDays = (config.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  const periodsPerDay = config.periodsPerDay || 7;
  const lunchAfterPeriod = config.lunchAfterPeriod || 4;
  const periodConfigs = config.periods || [];

  // Get all days including holidays
  const allDays = DAY_ORDER.filter(d =>
    workingDays.includes(d) || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(d)
  );

  const formatTime = (time) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  };

  const handleExportPNG = () => {
    const sectionName = sections.find(s => s.id === selectedSection)?.name || 'timetable';
    exportAsPNG('timetable-export', `${timetable?.name}_${sectionName}_v${selectedVariant}`);
  };

  const handleExportPDF = () => {
    const sectionName = sections.find(s => s.id === selectedSection)?.name || 'timetable';
    exportAsPDF('timetable-export', `${timetable?.name}_${sectionName}_v${selectedVariant}`);
  };

  const handleExportCSV = () => {
    const sectionName = sections.find(s => s.id === selectedSection)?.name || 'timetable';
    exportAsCSV(schedule, config, sectionName, `${timetable?.name}_${sectionName}_v${selectedVariant}`);
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  if (generating) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <div className="loading-text">⚡ Generating timetable variants...</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Creating conflict-free schedules for {sections.length} section(s)
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">🗓️ {timetable?.name}</h1>
          <p className="dashboard-subtitle">
            {sections.length} section(s) • {subjects.length} subjects • {variants.length} variants generated
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/edit/${id}`)}>
            ✏️ Edit Config
          </button>
          <button className="btn btn-primary" onClick={handleGenerate}>
            🔄 Regenerate
          </button>
        </div>
      </div>

      {/* Variant Selector */}
      {variants.length > 1 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
            🎯 Select Design Variant
          </h3>
          <div className="variant-cards">
            {variants.map(v => (
              <div
                key={v.variant}
                className={`variant-card ${selectedVariant === v.variant ? 'selected' : ''}`}
                onClick={() => setSelectedVariant(v.variant)}
              >
                <div className="variant-card-title">Design {v.variant}</div>
                <div className="variant-card-score">
                  Quality Score: {v.score || 'N/A'}
                </div>
                {selectedVariant === v.variant && (
                  <div style={{ marginTop: 'var(--space-2)', color: 'var(--primary-400)', fontSize: '0.75rem', fontWeight: 700 }}>
                    ✓ Selected
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Theme Selector & Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="theme-options" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`btn btn-sm ${theme === t.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTheme(t.id)}
              style={{ fontSize: '0.75rem' }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: t.preview, border: '1px solid rgba(255,255,255,0.2)'
              }} />
              {t.name}
            </button>
          ))}
        </div>

        <div className="export-panel">
          <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            📄 PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportPNG}>
            🖼️ PNG
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
            📊 CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      {sections.length > 1 && (
        <div className="section-tabs">
          {sections.map(sec => (
            <button
              key={sec.id}
              className={`section-tab ${selectedSection === sec.id ? 'active' : ''}`}
              onClick={() => setSelectedSection(sec.id)}
            >
              🏫 {sec.name}
            </button>
          ))}
        </div>
      )}

      {/* Timetable */}
      <div id="timetable-export" className={`theme-${theme}`}>
        <div className="timetable-print-title">
          {timetable?.name} — {sections.find(s => s.id === selectedSection)?.name}
        </div>

        <div className="timetable-container">
          <table className="timetable">
            <thead>
              <tr>
                <th rowSpan="2" style={{ verticalAlign: 'middle' }}>
                  <div style={{ fontSize: '0.7rem' }}>Timing</div>
                </th>
                {/* Pre-lunch periods */}
                {Array.from({ length: lunchAfterPeriod }, (_, i) => i + 1).map(p => (
                  <th key={p}>Period {p}</th>
                ))}
                {/* Lunch column */}
                <th rowSpan={workingDays.length + 3} className="lunch-break-cell">
                  <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
                    Lunch Break ({config.lunchDuration || 50} Min)
                  </div>
                </th>
                {/* Post-lunch periods */}
                {Array.from({ length: periodsPerDay - lunchAfterPeriod }, (_, i) => i + lunchAfterPeriod + 1).map(p => (
                  <th key={p}>Period {p}</th>
                ))}
              </tr>
              {/* Timing Row */}
              <tr className="timing-row">
                {Array.from({ length: periodsPerDay }, (_, i) => i).map(i => {
                  if (i === lunchAfterPeriod) return null; // Skip lunch column (already handled)
                  const period = periodConfigs[i];
                  return (
                    <td key={i} style={{
                      fontSize: '0.65rem', color: 'var(--text-muted)',
                      padding: '4px 6px', height: 'auto', fontWeight: 500
                    }}>
                      {period ? `${formatTime(period.startTime)} - ${formatTime(period.endTime)}` : '—'}
                    </td>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {allDays.map(day => {
                const isHoliday = !workingDays.includes(day);
                return (
                  <tr key={day}>
                    <td style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {day}
                    </td>

                    {isHoliday ? (
                      <td
                        colSpan={periodsPerDay}
                        className="cell-holiday"
                        style={{ textAlign: 'center', fontSize: '1rem', letterSpacing: 2 }}
                      >
                        Holiday
                      </td>
                    ) : (
                      <>
                        {/* Pre-lunch periods */}
                        {Array.from({ length: lunchAfterPeriod }, (_, i) => i + 1).map(p => {
                          const slot = schedule[day]?.[p];
                          return renderCell(slot, p, day, theme);
                        })}
                        {/* Post-lunch periods */}
                        {Array.from({ length: periodsPerDay - lunchAfterPeriod }, (_, i) => i + lunchAfterPeriod + 1).map(p => {
                          const slot = schedule[day]?.[p];
                          return renderCell(slot, p, day, theme);
                        })}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subject Legend */}
      <div className="card" style={{ marginTop: 'var(--space-6)' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>
          📚 Subject Legend
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
          {subjects.map((sub, idx) => (
            <div key={sub.id || idx} className="subject-item">
              <div className="subject-color-dot" style={{
                background: sub.color || `hsl(${idx * 37}, 70%, 50%)`
              }} />
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
                  &nbsp; • &nbsp; Credit: {sub.credit}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderCell(slot, period, day, theme) {
  if (!slot) {
    return (
      <td key={`${day}-${period}`}>
        <div className="cell-empty">—</div>
      </td>
    );
  }

  if (slot.isLabContinuation) {
    return (
      <td key={`${day}-${period}`} className="cell-lab" style={{
        borderLeft: 'none',
      }}>
        <div className="timetable-cell">
          <div className="cell-subject" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            (cont.)
          </div>
        </div>
      </td>
    );
  }

  const isLab = slot.type === 'lab' || slot.isLabBlock;
  const bgColor = theme === 'colorful' && slot.color
    ? `${slot.color}18`
    : isLab ? undefined : undefined;

  return (
    <td
      key={`${day}-${period}`}
      className={isLab ? 'cell-lab' : ''}
      style={{
        background: bgColor,
        borderLeft: isLab ? `3px solid ${slot.color || 'var(--accent-500)'}` : undefined
      }}
    >
      <div className="timetable-cell">
        <div className="cell-subject" style={{
          color: theme === 'colorful' && slot.color ? slot.color : undefined
        }}>
          {slot.subjectCode}
        </div>
        <div className="cell-faculty">
          ({slot.facultyShort || slot.faculty})
        </div>
        {isLab && (
          <div style={{ fontSize: '0.6rem', color: 'var(--accent-400)', fontWeight: 600 }}>
            LAB
          </div>
        )}
      </div>
    </td>
  );
}
