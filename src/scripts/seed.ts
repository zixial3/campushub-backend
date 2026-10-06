import { Types } from 'mongoose';
import { appConfig } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { ReservationModel } from '../models/Reservation.model';
import { ResourceModel } from '../models/Resource.model';
import type { IResource } from '../models/Resource.model';
import { ResourceLockModel } from '../models/ResourceLock.model';

// Fixed ObjectIds keep the manual curl tests reproducible across reseeds.
const SEED_RESOURCES: readonly IResource[] = [
  {
    _id: new Types.ObjectId('000000000000000000000101'),
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Snell Library, Floor 3',
    isAvailable: true,
  },
  {
    _id: new Types.ObjectId('000000000000000000000102'),
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'EXP Makerspace',
    isAvailable: true,
  },
  {
    _id: new Types.ObjectId('000000000000000000000103'),
    name: 'Chemistry Lab B',
    type: 'LAB',
    location: 'Hurtig Hall 210',
    isAvailable: true,
  },
  {
    _id: new Types.ObjectId('000000000000000000000104'),
    name: 'Group Study Room 115',
    type: 'ROOM',
    location: 'Snell Library, Floor 1',
    isAvailable: true,
  },
  // Out of service, to exercise RESOURCE_UNAVAILABLE.
  {
    _id: new Types.ObjectId('000000000000000000000202'),
    name: 'Laser Cutter',
    type: 'EQUIPMENT',
    location: 'EXP Makerspace',
    isAvailable: false,
  },
];

// Resets both collections, so every test run starts from the same state.
async function seed(): Promise<void> {
  await connectDatabase(appConfig.mongodbUri);
  try {
    await ReservationModel.deleteMany({}).exec();
    await ResourceModel.deleteMany({}).exec();
    await ResourceLockModel.deleteMany({}).exec();
    await ResourceModel.insertMany(SEED_RESOURCES);
    // Builds the declared indexes now rather than on the first request.
    await Promise.all([
      ResourceModel.syncIndexes(),
      ReservationModel.syncIndexes(),
      ResourceLockModel.syncIndexes(),
    ]);
    console.log(`Seeded ${SEED_RESOURCES.length} resources:`);
    for (const resource of SEED_RESOURCES) {
      console.log(
        `  ${resource._id.toHexString()}  ${resource.type.padEnd(9)} ${resource.name}`,
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

seed().catch((err: unknown): void => {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
});
