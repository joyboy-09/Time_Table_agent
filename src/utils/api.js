const API_BASE = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username, password, displayName) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),
  getUser: (id) => request(`/auth/user/${id}`),

  // Timetables
  getTimetables: (userId) => request(`/timetables?userId=${encodeURIComponent(userId)}`),
  getTimetable: (id) => request(`/timetables/${id}`),
  createTimetable: (data) => request('/timetables', { method: 'POST', body: JSON.stringify(data) }),
  updateTimetable: (id, data) => request(`/timetables/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTimetable: (id) => request(`/timetables/${id}`, { method: 'DELETE' }),
  duplicateTimetable: (id) => request(`/timetables/${id}/duplicate`, { method: 'POST' }),

  // Generation
  generateTimetable: (id, numVariants = 3) =>
    request(`/generate/${id}`, { method: 'POST', body: JSON.stringify({ numVariants }) }),
  getVariants: (id) => request(`/generate/${id}/variants`),
};
