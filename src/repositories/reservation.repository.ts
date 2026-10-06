import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { mongo } from 'mongoose';
import type { Types } from 'mongoose';
import { ReservationModel } from '../models/Reservation.model';
import type { IReservation } from '../models/Reservation.model';
import { ResourceLockModel } from '../models/ResourceLock.model';
import { ACTIVE_RESERVATION_STATUSES } from '../types/reservation';
import type { ReservationStatus } from '../types/reservation';

export interface NewReservationRecord {
  readonly resourceId: Types.ObjectId;
  readonly userId: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly status: ReservationStatus;
}

export type InsertReservationResult =
  | { readonly inserted: true; readonly reservation: IReservation }
  | { readonly inserted: false };

export interface ReservationRepository {
  /**
   * Inserts the reservation unless an active reservation for the same resource
   * overlaps its [startTime, endTime) slot. Check and insert run under a
   * per-resource lock, so concurrent requests cannot both claim one slot.
   */
  insertIfSlotFree(record: NewReservationRecord): Promise<InsertReservationResult>;
  findActiveByUser(userId: string): Promise<IReservation[]>;
}

const ACTIVE_STATUSES: ReservationStatus[] = [...ACTIVE_RESERVATION_STATUSES];
const LOCK_TTL_MS = 5000;
const LOCK_WAIT_MS = 3000;
const LOCK_RETRY_MS = 15;
const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof mongo.MongoServerError && err.code === DUPLICATE_KEY;
}

// Upsert claims a missing or expired lock; a live lock makes the filter miss,
// so the upsert tries to insert a second document with the same _id and fails.
async function tryAcquireLock(
  resourceId: Types.ObjectId,
  token: string,
): Promise<boolean> {
  const now: number = Date.now();
  try {
    await ResourceLockModel.updateOne(
      { _id: resourceId, expiresAt: { $lte: new Date(now) } },
      { $set: { token, expiresAt: new Date(now + LOCK_TTL_MS) } },
      { upsert: true },
    ).exec();
    return true;
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return false;
    }
    throw err;
  }
}

async function withResourceLock<T>(
  resourceId: Types.ObjectId,
  work: () => Promise<T>,
): Promise<T> {
  // A standalone mongod has no multi-document transactions, so the
  // check-then-insert below is serialized per resource with this lock instead.
  const token: string = randomUUID();
  const deadline: number = Date.now() + LOCK_WAIT_MS;
  while (!(await tryAcquireLock(resourceId, token))) {
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for booking lock on ${resourceId.toHexString()}.`,
      );
    }
    await sleep(LOCK_RETRY_MS);
  }
  try {
    return await work();
  } finally {
    // Matching the token never releases a lock that expired and was re-acquired.
    await ResourceLockModel.deleteOne({ _id: resourceId, token }).exec();
  }
}

// Half-open intervals: back-to-back slots (one ends 11:00, next starts 11:00) do not overlap.
async function hasOverlappingActive(record: NewReservationRecord): Promise<boolean> {
  const conflict: { _id: Types.ObjectId } | null = await ReservationModel.exists({
    resourceId: record.resourceId,
    status: { $in: ACTIVE_STATUSES },
    startTime: { $lt: record.endTime },
    endTime: { $gt: record.startTime },
  }).exec();
  return conflict !== null;
}

export function createMongooseReservationRepository(): ReservationRepository {
  return {
    async insertIfSlotFree(
      record: NewReservationRecord,
    ): Promise<InsertReservationResult> {
      return withResourceLock(
        record.resourceId,
        async (): Promise<InsertReservationResult> => {
          if (await hasOverlappingActive(record)) {
            return { inserted: false };
          }
          const created = await ReservationModel.create({ ...record });
          return { inserted: true, reservation: created.toObject<IReservation>() };
        },
      );
    },
    async findActiveByUser(userId: string): Promise<IReservation[]> {
      return ReservationModel.find({ userId, status: { $in: ACTIVE_STATUSES } })
        .sort({ startTime: 1 })
        .lean<IReservation[]>()
        .exec();
    },
  };
}

export const reservationRepository: ReservationRepository =
  createMongooseReservationRepository();
