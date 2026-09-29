import type { IReservation } from '../models/reservation.model';
import { ACTIVE_RESERVATION_STATUSES } from '../types/reservation';

export type InsertReservationResult =
  | { readonly inserted: true; readonly reservation: IReservation }
  | { readonly inserted: false; readonly conflictingId: string };

export interface ReservationRepository {
  /**
   * Inserts the reservation unless an active reservation for the same resource
   * overlaps its [startTime, endTime) slot. Check and insert happen atomically,
   * so concurrent requests cannot both claim one slot.
   */
  insertIfSlotFree(reservation: IReservation): Promise<InsertReservationResult>;
  findActiveByUser(userId: string): Promise<IReservation[]>;
}

function isActive(reservation: IReservation): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(reservation.status);
}

// Half-open intervals: back-to-back slots (one ends 11:00, next starts 11:00) do not overlap.
function overlaps(a: IReservation, b: IReservation): boolean {
  return (
    a.startTime.getTime() < b.endTime.getTime() &&
    b.startTime.getTime() < a.endTime.getTime()
  );
}

function copy(reservation: IReservation): IReservation {
  return {
    ...reservation,
    startTime: new Date(reservation.startTime.getTime()),
    endTime: new Date(reservation.endTime.getTime()),
  };
}

export function createInMemoryReservationRepository(): ReservationRepository {
  const reservations: IReservation[] = [];

  return {
    insertIfSlotFree(candidate: IReservation): Promise<InsertReservationResult> {
      // Synchronous between check and push, which is what makes it atomic here.
      const conflict: IReservation | undefined = reservations.find(
        (existing: IReservation): boolean =>
          existing.resourceId === candidate.resourceId &&
          isActive(existing) &&
          overlaps(existing, candidate),
      );
      if (conflict !== undefined) {
        return Promise.resolve({ inserted: false, conflictingId: conflict._id });
      }
      const stored: IReservation = copy(candidate);
      reservations.push(stored);
      return Promise.resolve({ inserted: true, reservation: copy(stored) });
    },
    findActiveByUser(userId: string): Promise<IReservation[]> {
      const matches: IReservation[] = reservations
        .filter(
          (reservation: IReservation): boolean =>
            reservation.userId === userId && isActive(reservation),
        )
        .sort(
          (a: IReservation, b: IReservation): number =>
            a.startTime.getTime() - b.startTime.getTime(),
        );
      return Promise.resolve(matches.map(copy));
    },
  };
}

export const reservationRepository: ReservationRepository =
  createInMemoryReservationRepository();
