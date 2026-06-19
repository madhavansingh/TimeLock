import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import notaryRoutes from './routes/notary.routes';
import documentRoutes from './routes/document.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// Standard middleware
app.use(cors({ origin: '*' })); // Allow all origins for hackathon development ease
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID injector middleware
app.use((req, res, next) => {
  const reqId = Math.random().toString(36).substring(2, 10);
  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Routing
app.use('/v1/auth', authRoutes);
app.use('/v1/notaries', notaryRoutes);
app.use('/v1/documents', documentRoutes);

// Base health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// Global error handler (must be registered last)
app.use(errorMiddleware);

export default app;
