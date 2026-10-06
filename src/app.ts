import express, { type Express } from 'express';
import { appConfig } from './config/env';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app: Express = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use(appConfig.apiPrefix, apiRouter);

  // Registered last: unmatched routes, then centralized error handling.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Connects before the app is built, so no request is served without a database.
export async function initializeApp(): Promise<Express> {
  await connectDatabase(appConfig.mongodbUri);
  return createApp();
}
