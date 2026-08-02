import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import SetupWizard from './components/SetupWizard';
import TimetableView from './components/TimetableView';
import Auth from './components/Auth';
import './index.css';

function Navbar({ user, onLogout }) {
  const location = useLocation();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">🗓️</div>
        <div>
          <div className="navbar-title">TIME TABLE AGENT NSRIT</div>
          <div className="navbar-subtitle">Academic Schedule Builder</div>
        </div>
      </Link>

      <div className="navbar-center">
        <Link
          to="/"
          className={`navbar-tab ${location.pathname === '/' ? 'active' : ''}`}
        >
          Dashboard
        </Link>
        <Link
          to="/create"
          className={`navbar-tab ${location.pathname === '/create' ? 'active' : ''}`}
        >
          New Schedule
        </Link>
      </div>

      <div className="navbar-actions">
        <Link to="/create" className="btn btn-warm btn-sm">
          Create
        </Link>
        <div
          className="navbar-avatar"
          title={`${user?.displayName || user?.username} (ID: ${user?.username})`}
          onClick={onLogout}
        >
          {user?.displayName ? user.displayName[0].toUpperCase() : 'U'}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onLogout}
          style={{ color: 'var(--text-muted)' }}
          title="Sign out"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`} onClick={() => onDismiss(toast.id)}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('timetable_agent_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('timetable_agent_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('timetable_agent_user');
    addToast('Signed out successfully');
  };

  if (!user) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <Auth onLogin={handleLogin} addToast={addToast} />
      </>
    );
  }

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <main className="app-container">
        <Routes>
          <Route path="/" element={<Dashboard user={user} addToast={addToast} />} />
          <Route path="/create" element={<SetupWizard user={user} addToast={addToast} />} />
          <Route path="/edit/:id" element={<SetupWizard user={user} addToast={addToast} />} />
          <Route path="/view/:id" element={<TimetableView user={user} addToast={addToast} />} />
        </Routes>
      </main>
    </Router>
  );
}
