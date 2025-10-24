
import express, { Request, Response } from 'express';
import cors from 'cors';
import session from 'express-session';
import { createServer } from 'http';
import { config } from './config';
import { query } from './database/database';
import { initWebSocketServer } from './utils/websocket';

import v1Router from './api/v1';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_default_session_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// API Routes
app.use('/api/v1', v1Router);

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Bigezo Lite API is running.');
});

// Test DB connection
app.get('/db-test', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT NOW()');
    res.status(200).json({ now: result.rows[0].now });
  } catch (error) {
    console.error('Database connection error', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Initialize WebSocket server
initWebSocketServer(server);

server.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
