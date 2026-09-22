import express, { type Express } from 'express';
import { appConfig } from './config/env';
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
