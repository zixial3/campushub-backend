// The API that Playwright's webServer boots for E2E runs: the real Express app
// against an in-memory MongoDB seeded with the standard resources. It never
// touches a developer's database and needs no local mongod.
//
// MONGODB_URI and PORT come from playwright.config.ts; src/config/env.ts reads
// them when it is first imported, so they must be set before this starts.

import type { Server } from 'node:http';
import type { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { initializeApp } from '../../src/app';
import { disconnectDatabase } from '../../src/config/database';
import { appConfig } from '../../src/config/env';
import { resetDatabase } from '../../src/scripts/seed';

async function main(): Promise<void> {
  // Start mongod on the port named in MONGODB_URI, so the URI is known up front.
  const { hostname, port } = new URL(appConfig.mongodbUri);
  const mongod: MongoMemoryServer = await MongoMemoryServer.create({
    instance: { ip: hostname, port: Number(port) },
  });
  const app: Express = await initializeApp();
  await resetDatabase();
  const server: Server = app.listen(appConfig.port, (): void => {
    console.log(`E2E API listening on http://localhost:${appConfig.port}`);
  });

  const stop = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close((): void => resolve()));
    await disconnectDatabase();
    await mongod.stop();
  };
  const shutdown = (): void => {
    stop().catch((err: unknown): void => {
      console.error('E2E API shutdown failed:', err);
      process.exitCode = 1;
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown): void => {
  console.error('E2E API failed to start:', err);
  process.exitCode = 1;
});
