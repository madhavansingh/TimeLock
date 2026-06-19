import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import notaryRoutes from './routes/notary.routes';
import documentRoutes from './routes/document.routes';
import systemRoutes from './routes/system.routes';
import userRoutes from './routes/user.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';

const app = express();

// ---------------------------------------------------------------------------
// Core middleware (order matters)
// ---------------------------------------------------------------------------

// Allow all origins for hackathon development ease
app.use(cors({ origin: '*' }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inject a unique request ID into every request for log correlation
app.use((req, res, next) => {
  const reqId = Math.random().toString(36).substring(2, 10);
  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
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

// ---------------------------------------------------------------------------
// Global error handler — must be registered LAST
// ---------------------------------------------------------------------------
app.use(errorMiddleware);

export default app;
