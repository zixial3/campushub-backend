import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import type { Response } from 'supertest';
import { createApp } from '../../app';
import { appConfig } from '../../config/env';
import { ResourceModel } from '../../models/Resource.model';
import { resourceRepository } from '../../repositories/resource.repository';
import { isReservationStatus, isResourceType } from '../../../shared/contract';
import type { ErrorCode } from '../../../shared/contract';

// End-to-end through Express: routing, validators, controllers, services,
// repositories, the in-memory MongoDB, and errorHandler.

const app: Express = createApp();
const API = '/api/v1';

const ROOM_302 = '000000000000000000000101';
const PRINTER = '000000000000000000000102';
const LAB = '000000000000000000000103';
const ROOM_115 = '000000000000000000000104';
const LASER = '000000000000000000000202';
const MISSING = '0000000000000000000009ff';

beforeEach(async (): Promise<void> => {
  await ResourceModel.create([
    {
      _id: new Types.ObjectId(ROOM_302),
      name: 'Study Room 302',
      type: 'ROOM',
      location: 'Snell 3',
      isAvailable: true,
    },
    {
      _id: new Types.ObjectId(PRINTER),
      name: '3D Printer A',
      type: 'EQUIPMENT',
      location: 'EXP',
      isAvailable: true,
    },
    {
      _id: new Types.ObjectId(LAB),
      name: 'Chemistry Lab B',
      type: 'LAB',
      location: 'Hurtig 210',
      isAvailable: true,
    },
    {
      _id: new Types.ObjectId(ROOM_115),
      name: 'Group Study 115',
      type: 'ROOM',
      location: 'Snell 1',
      isAvailable: true,
    },
    {
      _id: new Types.ObjectId(LASER),
      name: 'Laser Cutter',
      type: 'EQUIPMENT',
      location: 'EXP',
      isAvailable: false,
    },
  ]);
});

interface Payload {
  [key: string]: unknown;
}

function booking(overrides: Payload = {}): Payload {
  return {
    resourceId: ROOM_302,
    userId: 'user-456',
    startTime: '2026-12-01T10:00:00Z',
    endTime: '2026-12-01T11:00:00Z',
    ...overrides,
  };
}

function post(body: unknown): Promise<Response> {
  return request(app)
    .post(`${API}/reservations`)
    .send(body as object);
}

function idsOf(res: Response): string[] {
  return (res.body as { id: string }[]).map((item) => item.id);
}

function expectError(res: Response, status: number, code: ErrorCode): void {
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ code, message: expect.any(String) as unknown });
}

describe('GET /health', () => {
  it('returns 200 with the HealthReport shape', async (): Promise<void> => {
    const res: Response = await request(app).get(`${API}/health`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      service: expect.any(String) as unknown,
      uptimeSeconds: expect.any(Number) as unknown,
      timestamp: expect.stringMatching(/Z$/) as unknown,
    });
  });
});

describe('GET /resources', () => {
  it('returns every resource as contract-shaped JSON, ordered by id', async (): Promise<void> => {
    const res: Response = await request(app).get(`${API}/resources`);
    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([ROOM_302, PRINTER, LAB, ROOM_115, LASER]);
    for (const resource of res.body as Record<string, unknown>[]) {
      expect(Object.keys(resource).sort()).toEqual([
        'id',
        'isAvailable',
        'location',
        'name',
        'type',
      ]);
      expect(isResourceType(resource['type'])).toBe(true);
    }
  });

  it.each([
    ['type=ROOM', [ROOM_302, ROOM_115]],
    ['type=LAB', [LAB]],
    ['isAvailable=false', [LASER]],
    ['isAvailable=true', [ROOM_302, PRINTER, LAB, ROOM_115]],
    ['type=EQUIPMENT&isAvailable=true', [PRINTER]],
    ['type=EQUIPMENT&isAvailable=false', [LASER]],
    // A well-formed but unknown type matches nothing; it is not an error.
    ['type=STUDY_ROOM', []],
    ['type=room', []],
  ])('filters with ?%s', async (query: string, expected: string[]): Promise<void> => {
    const res: Response = await request(app).get(`${API}/resources?${query}`);
    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual(expected);
  });

  it.each([
    'type=',
    'type=ROOM&type=LAB',
    'isAvailable=yes',
    'isAvailable=TRUE',
    'isAvailable=1',
    'isAvailable=',
  ])('rejects ?%s with 400 VALIDATION_ERROR', async (query: string): Promise<void> => {
    expectError(
      await request(app).get(`${API}/resources?${query}`),
      400,
      'VALIDATION_ERROR',
    );
  });
});

describe('POST /reservations', () => {
  it('returns 201 Created with the stored reservation', async (): Promise<void> => {
    const res: Response = await post(
      booking({
        startTime: '2026-12-01T05:00:00-05:00',
        endTime: '2026-12-01T06:00:00-05:00',
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/) as unknown,
      resourceId: ROOM_302,
      userId: 'user-456',
      startTime: '2026-12-01T10:00:00.000Z',
      endTime: '2026-12-01T11:00:00.000Z',
      status: 'PENDING',
    });
  });

  it('returns 409 DOUBLE_BOOKING for the same slot and for an overlap', async (): Promise<void> => {
    expect((await post(booking())).status).toBe(201);
    expectError(await post(booking({ userId: 'user-789' })), 409, 'DOUBLE_BOOKING');
    expectError(
      await post(
        booking({
          startTime: '2026-12-01T10:59:59.999Z',
          endTime: '2026-12-01T12:00:00Z',
        }),
      ),
      409,
      'DOUBLE_BOOKING',
    );
  });

  it('accepts a back-to-back slot', async (): Promise<void> => {
    expect((await post(booking())).status).toBe(201);
    expect(
      (
        await post(
          booking({ startTime: '2026-12-01T11:00:00Z', endTime: '2026-12-01T12:00:00Z' }),
        )
      ).status,
    ).toBe(201);
  });

  it('returns 409 RESOURCE_UNAVAILABLE for an out-of-service resource', async (): Promise<void> => {
    expectError(await post(booking({ resourceId: LASER })), 409, 'RESOURCE_UNAVAILABLE');
  });

  it.each([MISSING, 'res-999'])(
    'returns 404 RESOURCE_NOT_FOUND for resourceId %s',
    async (resourceId: string): Promise<void> => {
      expectError(await post(booking({ resourceId })), 404, 'RESOURCE_NOT_FOUND');
    },
  );

  it('lets exactly one of 10 concurrent HTTP bookings succeed', async (): Promise<void> => {
    const results: Response[] = await Promise.all(
      Array.from({ length: 10 }, (_unused: unknown, i: number) =>
        post(booking({ userId: `racer-${i}` })),
      ),
    );
    const statuses: number[] = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, ...Array<number>(9).fill(409)]);
  });
});

describe('POST /reservations: payload fuzzing', () => {
  it.each(['resourceId', 'userId', 'startTime', 'endTime'])(
    'rejects a payload missing %s',
    async (field: string): Promise<void> => {
      const body: Payload = booking();
      delete body[field];
      const res: Response = await post(body);
      expectError(res, 400, 'VALIDATION_ERROR');
      expect((res.body as { message: string }).message).toBe(`${field} is required.`);
    },
  );

  // Each case asserts the message too, so it cannot pass because some other
  // rule happened to reject the request first.
  it.each([
    [
      'an unknown property',
      { status: 'CONFIRMED' },
      'Request body has unknown properties: status.',
    ],
    [
      'a numeric userId',
      { userId: 123 },
      'userId is required and must be a non-empty string.',
    ],
    [
      'a null resourceId',
      { resourceId: null },
      'resourceId is required and must be a non-empty string.',
    ],
    [
      'an empty userId',
      { userId: '' },
      'userId is required and must be a non-empty string.',
    ],
    [
      'a userId with whitespace',
      { userId: 'user 456' },
      'userId must be at most 128 characters with no whitespace.',
    ],
    [
      'a 129-character userId',
      { userId: 'u'.repeat(129) },
      'userId must be at most 128 characters with no whitespace.',
    ],
    [
      'a numeric startTime',
      { startTime: 1_764_583_200_000 },
      'startTime must be an ISO 8601 date-time',
    ],
    [
      'a startTime object',
      { startTime: { $gt: '' } },
      'startTime must be an ISO 8601 date-time',
    ],
  ])(
    'rejects %s',
    async (_case: string, overrides: Payload, message: string): Promise<void> => {
      const res: Response = await post(booking(overrides));
      expectError(res, 400, 'VALIDATION_ERROR');
      expect((res.body as { message: string }).message).toContain(message);
    },
  );

  it.each([
    ['date only', '2026-12-01'],
    ['no offset (local time)', '2026-12-01T10:00:00'],
    ['space instead of T', '2026-12-01 10:00:00Z'],
    ['Feb 30', '2026-02-30T10:00:00Z'],
    ['Feb 29 in a non-leap year', '2027-02-29T10:00:00Z'],
    ['month 13', '2026-13-01T10:00:00Z'],
    ['hour 24', '2026-12-01T24:00:00Z'],
    ['leap second', '2026-12-31T23:59:60Z'],
    ['offset hour 24', '2026-12-01T10:00:00+24:00'],
    ['two-digit year', '26-12-01T10:00:00Z'],
    ['free text', 'tomorrow at 10'],
    ['empty string', ''],
    ['trailing garbage', '2026-12-01T10:00:00Zjunk'],
  ])(
    'rejects startTime with %s',
    async (_case: string, startTime: string): Promise<void> => {
      // endTime far in the future: a lenient parser that rolled Feb 30 over to
      // March would then produce a valid range and be caught here, instead of
      // the request failing on the range rule and passing for the wrong reason.
      const res: Response = await post(
        booking({ startTime, endTime: '2099-01-01T00:00:00Z' }),
      );
      expectError(res, 400, 'VALIDATION_ERROR');
      expect((res.body as { message: string }).message).toContain(
        'startTime must be an ISO 8601 date-time',
      );
    },
  );

  it.each([
    ['Feb 29 in a leap year', '2028-02-29T10:00:00Z', '2028-02-29T11:00:00Z'],
    ['lowercase t and z', '2026-12-01t10:00:00z', '2026-12-01t11:00:00z'],
    ['fractional seconds', '2026-12-01T10:00:00.123456Z', '2026-12-01T11:00:00.5Z'],
  ])(
    'accepts a valid edge format: %s',
    async (_case: string, startTime: string, endTime: string): Promise<void> => {
      expect((await post(booking({ startTime, endTime }))).status).toBe(201);
    },
  );

  it.each([
    ['negative range', '2026-12-01T11:00:00Z', '2026-12-01T10:00:00Z'],
    ['zero-length range', '2026-12-01T10:00:00Z', '2026-12-01T10:00:00Z'],
    // Same instant written in two offsets is still zero length.
    ['zero length across offsets', '2026-12-01T10:00:00Z', '2026-12-01T05:00:00-05:00'],
  ])(
    'rejects a %s',
    async (_case: string, startTime: string, endTime: string): Promise<void> => {
      const res: Response = await post(booking({ startTime, endTime }));
      expectError(res, 400, 'VALIDATION_ERROR');
      expect((res.body as { message: string }).message).toBe(
        'endTime must be later than startTime.',
      );
    },
  );

  it.each([
    ['truncated JSON', '{"resourceId":'],
    ['a JSON null', 'null'],
    ['a bare string', '"booking"'],
  ])(
    'rejects %s as MALFORMED_JSON',
    async (_case: string, raw: string): Promise<void> => {
      const res: Response = await request(app)
        .post(`${API}/reservations`)
        .set('Content-Type', 'application/json')
        .send(raw);
      expectError(res, 400, 'MALFORMED_JSON');
    },
  );

  it.each([
    ['a JSON array', []],
    ['an empty object', {}],
  ])(
    'rejects %s as VALIDATION_ERROR',
    async (_case: string, body: unknown): Promise<void> => {
      expectError(await post(body), 400, 'VALIDATION_ERROR');
    },
  );

  it('rejects a non-JSON content type', async (): Promise<void> => {
    const res: Response = await request(app)
      .post(`${API}/reservations`)
      .set('Content-Type', 'text/plain')
      .send('hello');
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('rejects a body over the 100 kB JSON limit with a 400, not a 500', async (): Promise<void> => {
    expectError(
      await post(booking({ userId: 'u'.repeat(150_000) })),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('never answers 500 and always matches the contract across 300 random mutations', async (): Promise<void> => {
    // Seeded PRNG (mulberry32), so a failure reproduces with the same cases.
    let seed = 0x5eed;
    const random = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t: number = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T =>
      items[Math.floor(random() * items.length)] as T;
    const values: readonly unknown[] = [
      undefined,
      null,
      '',
      ' ',
      0,
      -1,
      1e21,
      true,
      [],
      {},
      'x'.repeat(300),
      '\u0000',
      '😀',
      ROOM_302,
      LASER,
      MISSING,
      'not-an-id',
      '2026-12-01T10:00:00Z',
      '2026-12-01T09:00:00-01:00',
      '2026-02-30T10:00:00Z',
      '1970-01-01T00:00:00Z',
      '9999-12-31T23:59:59Z',
      '2026-12-01',
    ];
    const fields: readonly string[] = [
      'resourceId',
      'userId',
      'startTime',
      'endTime',
      'status',
      '__proto__',
    ];
    const allowed: ReadonlySet<number> = new Set([201, 400, 404, 409]);

    for (let i = 0; i < 300; i += 1) {
      const body: Payload = booking({
        startTime: `2027-01-01T${String(i % 24).padStart(2, '0')}:00:00Z`,
        endTime: `2027-01-01T${String(i % 24).padStart(2, '0')}:30:00Z`,
      });
      const mutations: number = 1 + Math.floor(random() * 3);
      for (let m = 0; m < mutations; m += 1) {
        const field: string = pick(fields);
        const value: unknown = pick(values);
        if (value === undefined) {
          delete body[field];
        } else {
          body[field] = value;
        }
      }
      const res: Response = await post(body);
      const context = `case ${i}: ${JSON.stringify(body)} -> ${res.status} ${JSON.stringify(res.body)}`;
      expect({ context, ok: allowed.has(res.status) }).toEqual({ context, ok: true });
      if (res.status === 201) {
        expect(isReservationStatus((res.body as { status: unknown }).status)).toBe(true);
      } else {
        expect(res.body).toEqual({
          code: expect.stringMatching(/^[A-Z][A-Z0-9_]*$/) as unknown,
          message: expect.any(String) as unknown,
        });
      }
    }
  });
});

describe('GET /reservations/user/{userId}', () => {
  it("returns the user's active reservations, earliest first", async (): Promise<void> => {
    const late: Response = await post(
      booking({ startTime: '2026-12-02T10:00:00Z', endTime: '2026-12-02T11:00:00Z' }),
    );
    const early: Response = await post(booking());
    const res: Response = await request(app).get(`${API}/reservations/user/user-456`);
    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([
      (early.body as { id: string }).id,
      (late.body as { id: string }).id,
    ]);
  });

  it('returns an empty list for a user with no reservations', async (): Promise<void> => {
    const res: Response = await request(app).get(`${API}/reservations/user/nobody`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects a userId containing whitespace', async (): Promise<void> => {
    expectError(
      await request(app).get(`${API}/reservations/user/a%20b`),
      400,
      'VALIDATION_ERROR',
    );
  });
});

describe('PATCH /reservations/{id}/confirm and /cancel', () => {
  let id: string;

  beforeEach(async (): Promise<void> => {
    id = ((await post(booking())).body as { id: string }).id;
  });

  it('confirms, then cancels, and the cancelled slot can be booked again', async (): Promise<void> => {
    const confirmed: Response = await request(app).patch(
      `${API}/reservations/${id}/confirm`,
    );
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toMatchObject({ id, status: 'CONFIRMED' });

    const cancelled: Response = await request(app).patch(
      `${API}/reservations/${id}/cancel`,
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ id, status: 'CANCELLED' });

    expect((await post(booking({ userId: 'user-789' }))).status).toBe(201);
  });

  it('returns 409 INVALID_STATUS_TRANSITION when confirming a cancelled reservation', async (): Promise<void> => {
    await request(app).patch(`${API}/reservations/${id}/cancel`);
    expectError(
      await request(app).patch(`${API}/reservations/${id}/confirm`),
      409,
      'INVALID_STATUS_TRANSITION',
    );
  });

  it.each(['confirm', 'cancel'])(
    '%s returns 404 for unknown and malformed IDs, 400 for whitespace',
    async (action: string): Promise<void> => {
      expectError(
        await request(app).patch(`${API}/reservations/${MISSING}/${action}`),
        404,
        'RESERVATION_NOT_FOUND',
      );
      expectError(
        await request(app).patch(`${API}/reservations/not-an-id/${action}`),
        404,
        'RESERVATION_NOT_FOUND',
      );
      expectError(
        await request(app).patch(`${API}/reservations/a%20b/${action}`),
        400,
        'VALIDATION_ERROR',
      );
    },
  );
});

describe('routing and unexpected errors', () => {
  it.each([
    ['an unknown path', 'get', `${API}/nope`],
    [
      'a known path with the wrong method',
      'get',
      `${API}/reservations/${MISSING}/cancel`,
    ],
    ['a path outside the API prefix', 'get', '/resources'],
  ])(
    'returns 404 ROUTE_NOT_FOUND for %s',
    async (_case: string, _method: string, path: string): Promise<void> => {
      expectError(await request(app).get(path), 404, 'ROUTE_NOT_FOUND');
    },
  );

  describe('when a dependency fails unexpectedly', () => {
    beforeEach((): void => {
      jest.spyOn(console, 'error').mockImplementation((): void => undefined);
      jest
        .spyOn(resourceRepository, 'findAll')
        .mockRejectedValue(new Error('connection reset by peer'));
    });

    afterEach((): void => {
      jest.restoreAllMocks();
    });

    it('returns 500 INTERNAL_ERROR with the detail outside production', async (): Promise<void> => {
      const res: Response = await request(app).get(`${API}/resources`);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'connection reset by peer',
      });
    });

    it('hides the detail in production', async (): Promise<void> => {
      jest.replaceProperty(appConfig, 'nodeEnv', 'production');
      const res: Response = await request(app).get(`${API}/resources`);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    });
  });
});
