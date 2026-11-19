import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { errorHandler, AppError } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { workspaceRouter } from './routes/workspaces.js';
import { contactRouter } from './routes/contacts.js';
import { dealRouter } from './routes/deals.js';
import { sequenceRouter } from './routes/sequences.js';
import { prisma } from '@reachflow/db';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(requestIdMiddleware);

// Health Check Endpoints
app.get(['/health', '/v1/health'], async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Versioned API Routes (/v1)
app.use('/v1/auth', authRouter);
app.use('/v1/workspaces', workspaceRouter);
app.use('/v1/contacts', contactRouter);
app.use('/v1/deals', dealRouter);
app.use('/v1/sequences', sequenceRouter);

// 404 Handler
app.use((_req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Requested API route does not exist'));
});

// Centralized Error Handler
app.use(errorHandler);
