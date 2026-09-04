import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import intakeRoutes from './routes/intake.routes';
import usersRoutes from './routes/users.routes';
import settingsRoutes from './routes/settings.routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { sendSuccess } from './utils/apiResponse';

const app: Application = express();

// Security Headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Auth rate limiter (skipped in test environment to avoid test throttling)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

// Health check
app.get('/api/health', (_req, res) => {
  return sendSuccess(
    res,
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV
    },
    'AquaTrack API is operational'
  );
});

// Mount Routes with auth rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/intake', intakeRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);

// Catch 404
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

export default app;
