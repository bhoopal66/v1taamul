import express from 'express';
import cors from 'cors';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { pool } from './config/database.js';

// Import routes
import authRoutes from './routes/auth.js';
import leadsRoutes from './routes/leads.js';
import callsRoutes from './routes/calls.js';
import performanceRoutes from './routes/performance.js';
import submissionsRoutes from './routes/submissions.js';
import talktimeRoutes from './routes/talktime.js';
import goalsRoutes from './routes/goals.js';
import teamsRoutes from './routes/teams.js';
import coachRoutes from './routes/coach.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000');

// Session store
const PgStore = pgSession(session);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  store: new PgStore({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/talktime', talktimeRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/coach', coachRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Server running on port ${PORT}`);
});
