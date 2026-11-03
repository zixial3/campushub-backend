// Backend-only reservation types. API data types live in shared/contract.ts.
import type { ReservationStatus } from '../../shared/contract';

// Statuses that hold a time slot; CANCELLED frees it.
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
];

/** Query parameters of GET /resources. */
export interface ListResourcesQuery {
  readonly type?: string;
  readonly isAvailable?: boolean;
}

/** Status a PATCH endpoint moves a reservation into. */
export type ReservationTransitionTarget = Exclude<ReservationStatus, 'PENDING'>;

/** CreateReservationRequest after validation, with parsed instants. */
export interface NewReservationInput {
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: Date;
  readonly endTime: Date;
}
