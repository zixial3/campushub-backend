import type { Server } from 'node:http';
import type { Express } from 'express';
import { initializeApp } from './app';
import { appConfig } from './config/env';
import { disconnectDatabase } from './config/database';

function listen(app: Express): Server {
  return app.listen(appConfig.port, (): void => {
    console.log(
      `${appConfig.serviceName} listening on http://localhost:${appConfig.port}${appConfig.apiPrefix}`,
    );
  });
}

function registerShutdown(server: Server): void {
  const shutdown = (signal: string): void => {
    console.log(`Received ${signal}, closing server.`);
    server.close((): void => {
      disconnectDatabase()
        .then((): void => {
          process.exit(0);
        })
        .catch((err: unknown): void => {
          console.error('Failed to close database connection:', err);
          process.exit(1);
        });
    });
  };
  process.on('SIGINT', (): void => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', (): void => {
    shutdown('SIGTERM');
  });
}

async function main(): Promise<void> {
  const app: Express = await initializeApp();
  registerShutdown(listen(app));
}

main().catch((err: unknown): void => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
