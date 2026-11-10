import * as os from 'node:os';
import mongoose from 'mongoose';
import { ReservationModel } from '../models/Reservation.model';
import { ResourceModel } from '../models/Resource.model';
import { ResourceLockModel } from '../models/ResourceLock.model';

// Runs in every test file. Each Jest worker uses its own database on the
// shared in-memory server, so parallel files never see each other's data.

beforeAll(async (): Promise<void> => {
  const uri: string | undefined = process.env['MONGODB_URI'];
  if (uri === undefined) {
    throw new Error('MONGODB_URI is not set; src/test/globalSetup.ts did not run.');
  }
  await mongoose.connect(uri, {
    dbName: `campushub-test-${process.env['JEST_WORKER_ID'] ?? '0'}`,
    serverSelectionTimeoutMS: 5000,
    // MongoDB driver 7 loads `os` with a dynamic import() to build its
    // handshake metadata. Jest's vm sandbox rejects dynamic import without
    // --experimental-vm-modules, so the handshake goes out without its
    // `driver` field and the server refuses the connection. Handing the
    // driver `os` directly skips that import.
    runtimeAdapters: { os },
  });
  // The lock relies on the unique _id index and the reservation queries on
  // the compound indexes, so build them before the first test runs.
  await Promise.all([
    ResourceModel.syncIndexes(),
    ReservationModel.syncIndexes(),
    ResourceLockModel.syncIndexes(),
  ]);
});

afterEach(async (): Promise<void> => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async (): Promise<void> => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
