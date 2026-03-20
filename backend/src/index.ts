import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { db } from './db/client';
import { redis } from './db/redis';
import { startEventAggregator } from './services/eventAggregator';
import { startPremiumCron } from './services/premiumEngine';
import authRoutes from './routes/auth';
import workerRoutes from './routes/workers';
import subscriptionRoutes from './routes/subscriptions';
import triggerRoutes from './routes/triggers';
import adminRoutes from './routes/admin';
import whatsappRoutes from './routes/whatsapp';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gigshield-backend', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/triggers', triggerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

async function bootstrap() {
  try {
    await db.connect();
    logger.info('PostgreSQL connected');

    await redis.ping();
    logger.info('Redis connected');

    // Start background services
    startEventAggregator();
    startPremiumCron();

    app.listen(config.port, () => {
      logger.info(`GigShield backend listening on port ${config.port}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

bootstrap();

export default app;
