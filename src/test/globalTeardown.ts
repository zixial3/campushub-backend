// Stops the mongod started in globalSetup.ts (same process, so globalThis is shared).
export default async function globalTeardown(): Promise<void> {
  await globalThis.__MONGOD__?.stop();
}
