import { Types } from 'mongoose';
import { ConflictError, NotFoundError, ValidationError } from '../../errors/domainErrors';
import { ReservationModel } from '../../models/Reservation.model';
import { ResourceModel } from '../../models/Resource.model';
import { ResourceLockModel } from '../../models/ResourceLock.model';
import { reservationRepository } from '../../repositories/reservation.repository';
import type { Reservation } from '../../../shared/contract';
import type { NewReservationInput } from '../../types/reservation';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  listActiveReservationsByUser,
} from '../reservation.service';

// Runs against the real repositories on the in-memory MongoDB (src/test/setup.ts),
// so the overlap query and the lock are exercised, not mocked away.

const ROOM = new Types.ObjectId('000000000000000000000101');
const PRINTER = new Types.ObjectId('000000000000000000000102');
const OUT_OF_SERVICE = new Types.ObjectId('000000000000000000000202');
const MISSING = '0000000000000000000009ff';

const TEN = '2026-12-01T10:00:00.000Z';
const ELEVEN = '2026-12-01T11:00:00.000Z';

beforeEach(async (): Promise<void> => {
  await ResourceModel.create([
    {
      _id: ROOM,
      name: 'Study Room 302',
      type: 'ROOM',
      location: 'Snell 3',
      isAvailable: true,
    },
    {
      _id: PRINTER,
      name: '3D Printer A',
      type: 'EQUIPMENT',
      location: 'EXP',
      isAvailable: true,
    },
    {
      _id: OUT_OF_SERVICE,
      name: 'Laser Cutter',
      type: 'EQUIPMENT',
      location: 'EXP',
      isAvailable: false,
    },
  ]);
});

function slot(
  start: string,
  end: string,
  overrides: Partial<NewReservationInput> = {},
): NewReservationInput {
  return {
    resourceId: ROOM.toHexString(),
    userId: 'user-456',
    startTime: new Date(start),
    endTime: new Date(end),
    ...overrides,
  };
}

/** Shifts an ISO instant by `ms` milliseconds. */
function shift(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

describe('createReservation: happy path', () => {
  it('creates a PENDING reservation and returns contract-shaped UTC strings', async (): Promise<void> => {
    const created: Reservation = await createReservation(
      slot('2026-12-01T05:00:00-05:00', '2026-12-01T06:00:00-05:00'),
    );

    expect(created).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/) as unknown,
      resourceId: ROOM.toHexString(),
      userId: 'user-456',
      startTime: TEN,
      endTime: ELEVEN,
      status: 'PENDING',
    });
    expect(await ReservationModel.countDocuments()).toBe(1);
  });

  it('allows the same slot on a different resource', async (): Promise<void> => {
    await createReservation(slot(TEN, ELEVEN));
    await expect(
      createReservation(slot(TEN, ELEVEN, { resourceId: PRINTER.toHexString() })),
    ).resolves.toMatchObject({ resourceId: PRINTER.toHexString() });
  });
});

describe('createReservation: double-booking boundaries', () => {
  beforeEach(async (): Promise<void> => {
    await createReservation(slot(TEN, ELEVEN));
  });

  it.each([
    ['exact same start and end', TEN, ELEVEN],
    [
      'starts 1 ms before the existing slot ends',
      shift(ELEVEN, -1),
      '2026-12-01T12:00:00.000Z',
    ],
    [
      'ends 1 ms after the existing slot starts',
      '2026-12-01T09:00:00.000Z',
      shift(TEN, 1),
    ],
    ['sits strictly inside the existing slot', shift(TEN, 1), shift(ELEVEN, -1)],
    ['fully contains the existing slot', shift(TEN, -1), shift(ELEVEN, 1)],
    ['same start, longer', TEN, '2026-12-01T12:00:00.000Z'],
    ['same end, earlier start', '2026-12-01T09:00:00.000Z', ELEVEN],
  ])(
    'rejects a slot that %s with DOUBLE_BOOKING',
    async (_case: string, start: string, end: string): Promise<void> => {
      const attempt: Promise<Reservation> = createReservation(slot(start, end));
      await expect(attempt).rejects.toBeInstanceOf(ConflictError);
      await expect(attempt).rejects.toMatchObject({ code: 'DOUBLE_BOOKING' });
      expect(await ReservationModel.countDocuments()).toBe(1);
    },
  );

  it.each([
    ['starts exactly when the existing slot ends', ELEVEN, '2026-12-01T12:00:00.000Z'],
    ['ends exactly when the existing slot starts', '2026-12-01T09:00:00.000Z', TEN],
  ])(
    'accepts a back-to-back slot that %s (half-open intervals)',
    async (_case: string, start: string, end: string): Promise<void> => {
      await expect(createReservation(slot(start, end))).resolves.toMatchObject({
        status: 'PENDING',
      });
    },
  );

  it('treats a CONFIRMED reservation as blocking', async (): Promise<void> => {
    const [existing] = await listActiveReservationsByUser('user-456');
    await confirmReservation(existing?.id ?? MISSING);
    await expect(createReservation(slot(TEN, ELEVEN))).rejects.toMatchObject({
      code: 'DOUBLE_BOOKING',
    });
  });

  it('frees the slot as soon as the blocking reservation is cancelled', async (): Promise<void> => {
    const [existing] = await listActiveReservationsByUser('user-456');
    await cancelReservation(existing?.id ?? MISSING);
    await expect(
      createReservation(slot(TEN, ELEVEN, { userId: 'user-789' })),
    ).resolves.toMatchObject({ userId: 'user-789', status: 'PENDING' });
  });
});

describe('createReservation: invalid input reaching the service directly', () => {
  // The HTTP validator rejects these first, but the service is also called
  // outside HTTP (scripts, future jobs), so it must enforce its own rules
  // with a domain error instead of letting Mongoose fail with a 500.
  it.each([
    ['endTime before startTime', ELEVEN, TEN],
    ['zero-length slot', TEN, TEN],
  ])(
    'rejects %s with ValidationError',
    async (_case: string, start: string, end: string): Promise<void> => {
      const attempt: Promise<Reservation> = createReservation(slot(start, end));
      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      await expect(attempt).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'endTime must be later than startTime.',
      });
      expect(await ReservationModel.countDocuments()).toBe(0);
    },
  );

  it('rejects an Invalid Date with ValidationError', async (): Promise<void> => {
    const attempt: Promise<Reservation> = createReservation({
      ...slot(TEN, ELEVEN),
      startTime: new Date('not a date'),
    });
    await expect(attempt).rejects.toBeInstanceOf(ValidationError);
    expect(await ReservationModel.countDocuments()).toBe(0);
  });
});

describe('createReservation: resource lookups', () => {
  it.each([
    ['a valid ObjectId that matches nothing', MISSING],
    ['a string that is not an ObjectId', 'res-999'],
    ['an empty string', ''],
  ])(
    'rejects %s with RESOURCE_NOT_FOUND',
    async (_case: string, resourceId: string): Promise<void> => {
      const attempt: Promise<Reservation> = createReservation(
        slot(TEN, ELEVEN, { resourceId }),
      );
      await expect(attempt).rejects.toBeInstanceOf(NotFoundError);
      await expect(attempt).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    },
  );

  it('rejects an out-of-service resource with RESOURCE_UNAVAILABLE', async (): Promise<void> => {
    await expect(
      createReservation(slot(TEN, ELEVEN, { resourceId: OUT_OF_SERVICE.toHexString() })),
    ).rejects.toMatchObject({ code: 'RESOURCE_UNAVAILABLE', kind: 'conflict' });
  });
});

describe('createReservation: concurrency and the per-resource lock', () => {
  it('lets exactly one of 20 simultaneous bookings for one slot succeed', async (): Promise<void> => {
    const attempts: PromiseSettledResult<Reservation>[] = await Promise.allSettled(
      Array.from({ length: 20 }, (_unused: unknown, i: number) =>
        createReservation(slot(TEN, ELEVEN, { userId: `racer-${i}` })),
      ),
    );

    const failures: unknown[] = attempts
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason as unknown);
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // Every loser must lose on the business rule, not on a lock timeout.
    expect(failures).toHaveLength(19);
    for (const failure of failures) {
      expect(failure).toMatchObject({ code: 'DOUBLE_BOOKING' });
    }
    expect(await ReservationModel.countDocuments()).toBe(1);
  });

  it('serialises partially overlapping slots that race each other', async (): Promise<void> => {
    const attempts = await Promise.allSettled([
      createReservation(slot(TEN, ELEVEN)),
      createReservation(slot(shift(TEN, 30 * 60_000), shift(ELEVEN, 30 * 60_000))),
    ]);
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('does not serialise bookings for different resources', async (): Promise<void> => {
    const attempts = await Promise.allSettled([
      createReservation(slot(TEN, ELEVEN)),
      createReservation(slot(TEN, ELEVEN, { resourceId: PRINTER.toHexString() })),
    ]);
    expect(attempts.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('runs the overlap check while holding the lock', async (): Promise<void> => {
    const lockHeldDuringCheck: boolean[] = [];
    const realCheck =
      reservationRepository.existsActiveInRange.bind(reservationRepository);
    const spy = jest
      .spyOn(reservationRepository, 'existsActiveInRange')
      .mockImplementation(async (range): Promise<boolean> => {
        lockHeldDuringCheck.push(
          (await ResourceLockModel.exists({ _id: ROOM })) !== null,
        );
        return realCheck(range);
      });
    try {
      await createReservation(slot(TEN, ELEVEN));
    } finally {
      spy.mockRestore();
    }
    expect(lockHeldDuringCheck).toEqual([true]);
  });

  it('releases the lock when the booking is rejected', async (): Promise<void> => {
    await createReservation(slot(TEN, ELEVEN));
    await expect(createReservation(slot(TEN, ELEVEN))).rejects.toMatchObject({
      code: 'DOUBLE_BOOKING',
    });
    expect(await ResourceLockModel.countDocuments()).toBe(0);
  });

  it('reclaims an expired lock left behind by a crashed process', async (): Promise<void> => {
    await ResourceLockModel.create({
      _id: ROOM,
      token: 'crashed-process',
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(createReservation(slot(TEN, ELEVEN))).resolves.toMatchObject({
      status: 'PENDING',
    });
  });

  it('fails fast on a database error while taking the lock, instead of retrying', async (): Promise<void> => {
    const updateOne = jest.spyOn(ResourceLockModel, 'updateOne').mockReturnValue({
      exec: jest.fn().mockRejectedValue(new Error('connection reset by peer')),
    } as unknown as ReturnType<typeof ResourceLockModel.updateOne>);
    const startedAt: number = Date.now();
    let attempts = 0;
    try {
      await expect(createReservation(slot(TEN, ELEVEN))).rejects.toThrow(
        'connection reset by peer',
      );
      // Read before mockRestore(), which also clears the recorded calls.
      attempts = updateOne.mock.calls.length;
    } finally {
      updateOne.mockRestore();
    }
    // Only a duplicate-key error means "someone else holds the lock"; any other
    // error must surface at once rather than spin for the 3-second deadline.
    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(attempts).toBe(1);
    expect(await ReservationModel.countDocuments()).toBe(0);
  });

  it('gives up with an error when a live lock is never released', async (): Promise<void> => {
    await ResourceLockModel.create({
      _id: ROOM,
      token: 'stuck-holder',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const startedAt: number = Date.now();
    await expect(createReservation(slot(TEN, ELEVEN))).rejects.toThrow(
      /Timed out waiting for booking lock/,
    );
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(3000);
    // The holder's lock is untouched: the waiter never had it to release.
    expect(await ResourceLockModel.findById(ROOM).lean()).toMatchObject({
      token: 'stuck-holder',
    });
    expect(await ReservationModel.countDocuments()).toBe(0);
  });
});

describe('listActiveReservationsByUser', () => {
  it('returns only PENDING and CONFIRMED reservations, earliest first', async (): Promise<void> => {
    const late = await createReservation(
      slot('2026-12-03T10:00:00Z', '2026-12-03T11:00:00Z'),
    );
    const early = await createReservation(
      slot('2026-12-02T10:00:00Z', '2026-12-02T11:00:00Z'),
    );
    const cancelled = await createReservation(
      slot('2026-12-01T10:00:00Z', '2026-12-01T11:00:00Z'),
    );
    await confirmReservation(late.id);
    await cancelReservation(cancelled.id);
    await createReservation(
      slot('2026-12-04T10:00:00Z', '2026-12-04T11:00:00Z', { userId: 'someone-else' }),
    );

    const list: Reservation[] = await listActiveReservationsByUser('user-456');
    expect(list.map((r) => [r.id, r.status])).toEqual([
      [early.id, 'PENDING'],
      [late.id, 'CONFIRMED'],
    ]);
  });

  it('returns an empty list for a user with no reservations', async (): Promise<void> => {
    await expect(listActiveReservationsByUser('nobody')).resolves.toEqual([]);
  });
});

describe('confirmReservation and cancelReservation', () => {
  let pending: Reservation;

  beforeEach(async (): Promise<void> => {
    pending = await createReservation(slot(TEN, ELEVEN));
  });

  it('confirms a PENDING reservation, and confirming again is a no-op', async (): Promise<void> => {
    await expect(confirmReservation(pending.id)).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
    await expect(confirmReservation(pending.id)).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
  });

  it('cancels a PENDING reservation, and cancelling again is a no-op', async (): Promise<void> => {
    await expect(cancelReservation(pending.id)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    await expect(cancelReservation(pending.id)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('cancels a CONFIRMED reservation', async (): Promise<void> => {
    await confirmReservation(pending.id);
    await expect(cancelReservation(pending.id)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('refuses to confirm a CANCELLED reservation', async (): Promise<void> => {
    await cancelReservation(pending.id);
    const attempt: Promise<Reservation> = confirmReservation(pending.id);
    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
    await expect(attempt).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Reservation ${pending.id} is CANCELLED and cannot be confirmed.`,
    });
  });

  it.each([
    ['confirm', confirmReservation],
    ['cancel', cancelReservation],
  ])(
    '%s rejects unknown and malformed IDs with RESERVATION_NOT_FOUND',
    async (
      _name: string,
      action: (id: string) => Promise<Reservation>,
    ): Promise<void> => {
      for (const id of [MISSING, 'not-an-id']) {
        await expect(action(id)).rejects.toMatchObject({ code: 'RESERVATION_NOT_FOUND' });
      }
    },
  );

  it('ends CANCELLED when a confirm and a cancel race', async (): Promise<void> => {
    const [confirmed, cancelled] = await Promise.allSettled([
      confirmReservation(pending.id),
      cancelReservation(pending.id),
    ]);

    expect(cancelled).toMatchObject({
      status: 'fulfilled',
      value: { status: 'CANCELLED' },
    });
    // Either confirm ran first and succeeded, or cancel won and confirm was refused.
    if (confirmed.status === 'rejected') {
      expect(confirmed.reason).toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    } else {
      expect(confirmed.value.status).toBe('CONFIRMED');
    }
    expect((await ReservationModel.findById(pending.id).lean())?.status).toBe(
      'CANCELLED',
    );
  });
});
