// Mirrors components/schemas in docs/openapi.yaml field for field.

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

// Statuses that hold a time slot; CANCELLED frees it.
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
];

export interface Resource {
  readonly id: string;
  readonly name: string;
  readonly type: ResourceType;
  readonly location: string;
  readonly isAvailable: boolean;
}

export interface Reservation {
  readonly id: string;
  readonly resourceId: string;
  readonly userId: string;
  /** RFC 3339 UTC date-time, inclusive. */
  readonly startTime: string;
  /** RFC 3339 UTC date-time, exclusive. */
  readonly endTime: string;
  readonly status: ReservationStatus;
}

export interface CreateReservationRequest {
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Query parameters of GET /resources. */
export interface ListResourcesQuery {
  readonly type?: string;
}

/** CreateReservationRequest after validation, with parsed instants. */
export interface NewReservationInput {
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: Date;
  readonly endTime: Date;
}
