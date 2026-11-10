import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  var __MONGOD__: MongoMemoryServer | undefined;
}

// Runs once before any test file. src/config/env.ts reads MONGODB_URI when it
// is first imported, so the URI must exist before workers load test files;
// workers inherit this process's environment.
export default async function globalSetup(): Promise<void> {
  const mongod: MongoMemoryServer = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env['MONGODB_URI'] = mongod.getUri();
  process.env['NODE_ENV'] = 'test';
}
