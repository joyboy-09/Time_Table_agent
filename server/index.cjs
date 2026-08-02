const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
const authRoutes = require('./routes/auth.cjs');
const timetableRoutes = require('./routes/timetable.cjs');
const generateRoutes = require('./routes/generate.cjs');

app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/timetables', timetableRoutes);
app.use('/timetables', timetableRoutes);

app.use('/api/generate', generateRoutes);
app.use('/generate', generateRoutes);

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('(.*)', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🗓️  TIME TABLE AGENT NSRIT server running on http://localhost:${PORT}`);
});
