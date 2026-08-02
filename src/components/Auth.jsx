import { useState } from 'react';
import { api } from '../utils/api';

export default function Auth({ onLogin, addToast }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      addToast('Please enter both User ID and Passkey', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const user = await api.register(username, password, displayName || username);
        addToast(`Account created! Welcome, ${user.displayName}`);
        onLogin(user);
      } else {
        const user = await api.login(username, password);
        addToast(`Welcome back, ${user.displayName}!`);
        onLogin(user);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setUsername('admin');
    setPassword('pass123');
    addToast('Demo credentials filled!');
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-in">
        <div className="auth-logo">🗓️</div>
        <h1 className="auth-title">TIME TABLE AGENT NSRIT</h1>
        <p className="auth-subtitle">
          {isRegister ? 'Create your agent account' : 'Sign in to access your timetables'}
        </p>

        {/* Demo Credentials Helper Pill */}
        <div
          onClick={fillDemoAccount}
          style={{
            background: 'var(--warm-50)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--sp-3) var(--sp-4)',
            marginBottom: 'var(--sp-6)',
            cursor: 'pointer',
            fontSize: '0.78rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'background 0.2s',
          }}
          title="Click to auto-fill credentials"
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--warm-600)', marginBottom: 2 }}>
              🔑 Quick Demo Access
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              User ID: <strong style={{ color: 'var(--text-primary)' }}>admin</strong> &nbsp;|&nbsp; Passkey: <strong style={{ color: 'var(--text-primary)' }}>pass123</strong>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warm-500)' }}>
            Auto-fill ⚡
          </span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label className="form-label">Full Name / Title</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g., Dr. Academic Dean"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">User ID / Username *</label>
            <input
              className="form-input"
              type="text"
              placeholder="Enter User ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Passkey / Password *</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter Passkey"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-warm btn-lg"
            style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            disabled={loading}
          >
            {loading ? '⏳ Authenticating...' : isRegister ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(false); }}>
                Sign In
              </a>
            </span>
          ) : (
            <span>
              Need an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setIsRegister(true); }}>
                Register
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
