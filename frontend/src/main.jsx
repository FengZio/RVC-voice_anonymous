import React from 'react';
import { createRoot } from 'react-dom/client';
import { PatientDashboard } from './pages/PatientDashboard/index.jsx';
import { DoctorDashboard } from './pages/DoctorDashboard/index.jsx';
import { AdminDashboard } from './pages/AdminDashboard/index.jsx';
import AuthScreen from './pages/AuthScreen/index.jsx';
import { apiForm, apiJson } from './utils/api.js';
import { STORAGE_TOKEN_KEY, STORAGE_USER_KEY, STORAGE_ROLE_KEY } from './constants.js';
import './styles.css';

function App() {
  const [user, setUser] = React.useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const token = React.useMemo(() => localStorage.getItem(STORAGE_TOKEN_KEY) || '', []);

  function handleAuthed(nextUser) {
    setUser(nextUser);
  }

  function handleLogout() {
    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (savedToken) {
      const form = new FormData();
      form.append('token', savedToken);
      apiForm('/api/auth/logout', form).catch(() => {});
    }
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_ROLE_KEY);
    setUser(null);
  }

  React.useEffect(() => {
    if (!token || user) {
      return;
    }
    apiJson(`/api/auth/me?token=${encodeURIComponent(token)}`)
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        localStorage.removeItem(STORAGE_ROLE_KEY);
      });
  }, [token, user]);

  if (!user) {
    return <AuthScreen onAuthed={handleAuthed} />;
  }

  if (user.role === 'doctor') {
    return <DoctorDashboard user={user} onLogout={handleLogout} />;
  }

  if (user.role === 'admin' || user.role === 'manager') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  return <PatientDashboard user={user} onLogout={handleLogout} />;
}

createRoot(document.getElementById('root')).render(<App />);
