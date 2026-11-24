// Test setup and assertions that go through the public API, never the database:
// "Given another student already booked it" is exactly what an API call does.

import { expect } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { Reservation, Resource } from '../../shared/contract';
import { toInstant } from './time';

const API = '/api/v1';

/** Every student ID the scenarios use; their bookings are cleared before each test. */
export const STUDENTS = ['alice', 'bob', 'carol'] as const;
export type Student = (typeof STUDENTS)[number];

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.url()} -> HTTP ${response.status()}`).toBe(true);
  return (await response.json()) as T;
}

export async function resourceId(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const resources: Resource[] = await json<Resource[]>(
    await request.get(`${API}/resources`),
  );
  const match: Resource | undefined = resources.find(
    (r: Resource): boolean => r.name === name,
  );
  if (match === undefined) {
    throw new Error(`No seeded resource named "${name}".`);
  }
  return match.id;
}

export async function activeReservations(
  request: APIRequestContext,
  student: Student,
): Promise<Reservation[]> {
  return json<Reservation[]>(await request.get(`${API}/reservations/user/${student}`));
}

export interface Booking {
  readonly resource: string;
  readonly student: Student;
  readonly date: string;
  readonly from: string;
  readonly to: string;
}

export async function reserve(
  request: APIRequestContext,
  booking: Booking,
): Promise<Reservation> {
  const response: APIResponse = await request.post(`${API}/reservations`, {
    data: {
      resourceId: await resourceId(request, booking.resource),
      userId: booking.student,
      startTime: toInstant(booking.date, booking.from),
      endTime: toInstant(booking.date, booking.to),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as Reservation;
}

/** Cancels every active booking of the scenario students, so each test starts clean. */
export async function clearBookings(request: APIRequestContext): Promise<void> {
  for (const student of STUDENTS) {
    for (const reservation of await activeReservations(request, student)) {
      const response: APIResponse = await request.patch(
        `${API}/reservations/${reservation.id}/cancel`,
      );
      expect(response.ok()).toBe(true);
    }
  }
}
