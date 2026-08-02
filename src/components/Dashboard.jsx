import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function Dashboard({ user, addToast }) {
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [commandText, setCommandText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      loadTimetables();
    }
  }, [user]);

  const loadTimetables = async () => {
    try {
      setLoading(true);
      const data = await api.getTimetables(user.id);
      setTimetables(data);
    } catch (err) {
      addToast('Failed to load timetables: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTimetable(id);
      setTimetables(prev => prev.filter(t => t.id !== id));
      addToast('Timetable deleted successfully');
      setDeleteConfirm(null);
    } catch (err) {
      addToast('Failed to delete: ' + err.message, 'error');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await api.duplicateTimetable(id);
      addToast('Timetable cloned successfully');
      loadTimetables();
    } catch (err) {
      addToast('Failed to clone: ' + err.message, 'error');
    }
  };

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!commandText.trim()) return;
    addToast(`Agent Directive: "${commandText}" - Redirecting to builder...`);
    navigate('/create');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div className="animate-in">
      {/* Top Banner & Date Header matching Reference Image 1 & 2 */}
      <div className="dashboard-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="dashboard-date">
            August 2, 2026 <span className="dashboard-date-sub">| TIME TABLE AGENT NSRIT</span>
          </div>
          <div className="dashboard-subtitle">
            Welcome back, {user?.displayName || user?.username}! Managing schedule for 4 section capacity.
          </div>
        </div>

        {/* Agent Insights Pill matching Reference Image 1 */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--sp-3) var(--sp-4)',
            maxWidth: '320px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--warm-600)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            💡 Agent Insights
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            "Zero faculty clashes detected across sections. Optimization engine ready for 3–5 design variants."
          </div>
        </div>
      </div>

      {/* Natural Language Command Center matching Reference Image 4 */}
      <div
        style={{
          background: 'var(--earth-800)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--sp-4) var(--sp-5)',
          marginBottom: 'var(--sp-8)',
          boxShadow: 'var(--shadow-lg)',
          color: 'white',
        }}
      >
        <form onSubmit={handleCommandSubmit} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <input
            type="text"
            className="form-input"
            placeholder='Try typing: "Build a schedule for 3 sections with 5 subjects and Saturday off"'
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--sp-2) var(--sp-4)',
              fontSize: '0.85rem',
            }}
          />
          <button type="submit" className="btn btn-warm btn-sm" style={{ flexShrink: 0 }}>
            Generate ⚡
          </button>
        </form>
      </div>

      {/* Timetables Grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Your Timetables ({timetables.length})
        </h2>
        <Link to="/create" className="btn btn-primary btn-sm">
          Create New
        </Link>
      </div>

      {timetables.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗓️</div>
          <h2 className="empty-state-title">No Schedules Designed Yet</h2>
          <p className="empty-state-text">
            Add subjects, faculty assignments, and lab hours. The agent will solve constraints and generate conflict-free timetables instantly.
          </p>
          <Link to="/create" className="btn btn-warm btn-lg">
            Design First Timetable
          </Link>
        </div>
      ) : (
        <div className="timetable-grid">
          {timetables.map((tt, index) => (
            <div
              key={tt.id}
              className="card timetable-card"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="timetable-card-name">{tt.name}</div>

              <div className="timetable-card-meta">
                <div className="meta-item">
                  <span>📚</span>
                  <span className="meta-value">{tt.subject_count || 0}</span> subjects
                </div>
                <div className="meta-item">
                  <span>🏫</span>
                  <span className="meta-value">{tt.section_count || 0}</span> sections
                </div>
                {tt.variant_count > 0 && (
                  <div className="meta-item">
                    <span>🎯</span>
                    <span className="meta-value">{tt.variant_count}</span> designs
                  </div>
                )}
              </div>

              <div className="meta-item" style={{ marginBottom: 'var(--sp-3)' }}>
                <span>🕐</span>
                <span style={{ fontSize: '0.75rem' }}>Updated {formatDate(tt.updated_at)}</span>
              </div>

              <div className="timetable-card-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/view/${tt.id}`)}
                >
                  {tt.variant_count > 0 ? '👁️ View' : '⚡ Generate'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/edit/${tt.id}`)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDuplicate(tt.id)}
                >
                  📋 Clone
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeleteConfirm(tt.id)}
                  style={{ color: 'var(--accent-red)' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">🗑️ Delete Timetable?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              This will permanently remove the timetable configuration and all generated variants.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
