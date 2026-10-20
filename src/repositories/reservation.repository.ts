import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { isObjectIdOrHexString, mongo } from 'mongoose';
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

/** Active reservations on one resource whose time range satisfies both bounds. */
export interface ActiveReservationRange {
  readonly resourceId: Types.ObjectId;
  /** Matches reservations whose startTime is strictly before this instant. */
  readonly startsBefore: Date;
  /** Matches reservations whose endTime is strictly after this instant. */
  readonly endsAfter: Date;
}

export interface ReservationRepository {
  /**
   * Runs `work` while holding an exclusive per-resource lock, so a
   * check-then-insert inside it cannot interleave with another one on the
   * same resource.
   */
  runExclusive<T>(resourceId: Types.ObjectId, work: () => Promise<T>): Promise<T>;
  existsActiveInRange(range: ActiveReservationRange): Promise<boolean>;
  create(record: NewReservationRecord): Promise<IReservation>;
  findById(id: string): Promise<IReservation | undefined>;
  findActiveByUser(userId: string): Promise<IReservation[]>;
  /**
   * Atomically sets `status` to `to` only if the current status is one of
   * `from`. Returns the updated reservation, or undefined when the ID matches
   * nothing or the current status is not in `from`.
   */
  updateStatusIf(
    id: string,
    from: readonly ReservationStatus[],
    to: ReservationStatus,
  ): Promise<IReservation | undefined>;
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
  // A standalone mongod has no multi-document transactions, so callers
  // serialize their check-then-insert per resource with this lock instead.
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

export function createMongooseReservationRepository(): ReservationRepository {
  return {
    runExclusive: withResourceLock,
    async existsActiveInRange(range: ActiveReservationRange): Promise<boolean> {
      const found: { _id: Types.ObjectId } | null = await ReservationModel.exists({
        resourceId: range.resourceId,
        status: { $in: ACTIVE_STATUSES },
        startTime: { $lt: range.startsBefore },
        endTime: { $gt: range.endsAfter },
      }).exec();
      return found !== null;
    },
    async create(record: NewReservationRecord): Promise<IReservation> {
      const created = await ReservationModel.create({ ...record });
      return created.toObject<IReservation>();
    },
    async findById(id: string): Promise<IReservation | undefined> {
      // Opaque IDs: a malformed one is "not found", never a CastError 500.
      if (!isObjectIdOrHexString(id)) {
        return undefined;
      }
      const found: IReservation | null = await ReservationModel.findById(id)
        .lean<IReservation>()
        .exec();
      return found ?? undefined;
    },
    async findActiveByUser(userId: string): Promise<IReservation[]> {
      return ReservationModel.find({ userId, status: { $in: ACTIVE_STATUSES } })
        .sort({ startTime: 1 })
        .lean<IReservation[]>()
        .exec();
    },
    async updateStatusIf(
      id: string,
      from: readonly ReservationStatus[],
      to: ReservationStatus,
    ): Promise<IReservation | undefined> {
      if (!isObjectIdOrHexString(id)) {
        return undefined;
      }
      // One conditional write: the status check and the update cannot be
      // separated by a concurrent request.
      const updated: IReservation | null = await ReservationModel.findOneAndUpdate(
        { _id: id, status: { $in: [...from] } },
        { $set: { status: to } },
        { new: true, runValidators: true },
      )
        .lean<IReservation>()
        .exec();
      return updated ?? undefined;
    },
  };
}

export const reservationRepository: ReservationRepository =
  createMongooseReservationRepository();
