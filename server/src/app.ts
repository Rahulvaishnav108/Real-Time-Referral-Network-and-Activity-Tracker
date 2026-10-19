import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import type { Server } from 'socket.io';
import { config } from './config.js';
import authRoutes from './routes/authRoutes.js';
import { referralRoutes } from './routes/referralRoutes.js';

export const createApp = (io: Server) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }), authRoutes);
  app.use('/api/referrals', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }), referralRoutes(io));
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.name === 'ZodError') { res.status(400).json({ error: 'Invalid request' }); return; }
    if (error?.code === 11000) { res.status(409).json({ error: 'A record with this value already exists' }); return; }
    if (error?.name === 'ValidationError' || error?.name === 'CastError') { res.status(400).json({ error: 'Invalid data' }); return; }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(errors);
  return app;
};
