import type { Server } from 'node:http';
import { createApp } from './app';
import { appConfig } from './config/env';

const app = createApp();

const server: Server = app.listen(appConfig.port, (): void => {
  console.log(
    `${appConfig.serviceName} listening on http://localhost:${appConfig.port}${appConfig.apiPrefix}`,
  );
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, closing server.`);
  server.close((): void => {
    process.exit(0);
  });
}

process.on('SIGINT', (): void => {
  shutdown('SIGINT');
});

process.on('SIGTERM', (): void => {
  shutdown('SIGTERM');
});
