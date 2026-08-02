import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function Dashboard({ user, addToast }) {
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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



  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="dashboard-header" style={{ marginBottom: 'var(--sp-6)' }}>
        <div>
          <h1 className="dashboard-title">TIME TABLE AGENT NSRIT</h1>
          <div className="dashboard-subtitle">
            Welcome back, {user?.displayName || user?.username}! Managing schedule for 4 section capacity.
          </div>
        </div>
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
