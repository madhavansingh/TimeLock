import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { requestContextStorage } from './config/context';
import authRoutes from './routes/auth.routes';
import notaryRoutes from './routes/notary.routes';
import documentRoutes from './routes/document.routes';
import systemRoutes from './routes/system.routes';
import userRoutes from './routes/user.routes';
import transferRoutes from './routes/transfer.routes';
import authorityRoutes from './routes/authority.routes';
import aiRoutes from './routes/ai.routes';
import avccRoutes from './routes/avcc.routes';
import adminRoutes from './routes/admin.routes';
import judgeRoutes from './routes/judge.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';

import { config } from './config/env';

const app = express();

// ---------------------------------------------------------------------------
// Core middleware (order matters)
// ---------------------------------------------------------------------------

// Configure CORS using FRONTEND_URL
const allowedOrigins = [config.frontendUrl];
if (config.isDevelopment) {
  allowedOrigins.push('http://localhost:3000');
  allowedOrigins.push('http://127.0.0.1:3000');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin === '*') {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-nvidia-api-key']
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inject a unique request ID into every request for log correlation using AsyncLocalStorage
app.use((req, res, next) => {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  const nvidiaApiKey = req.headers['x-nvidia-api-key'] as string;
  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-Id', reqId);
  requestContextStorage.run({ requestId: reqId, nvidiaApiKey }, () => {
    next();
  });
});

// Structured HTTP request logger (after request ID so it can log the ID)
app.use(requestLoggerMiddleware);

// ---------------------------------------------------------------------------
// System routes — health, readiness, version (no auth required)
// ---------------------------------------------------------------------------
app.use('/', systemRoutes);

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/v1/auth', authRoutes);
app.use('/v1/notaries', notaryRoutes);
app.use('/v1/documents', documentRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/transfers', transferRoutes);
app.use('/transfers', transferRoutes);
app.use('/v1/authorities', authorityRoutes);
app.use('/authorities', authorityRoutes);
app.use('/v1/ai', aiRoutes);
app.use('/v1/avcc', avccRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/judge', judgeRoutes);

// ---------------------------------------------------------------------------
// Global error handler — must be registered LAST
// ---------------------------------------------------------------------------
app.use(errorMiddleware);

export default app;
