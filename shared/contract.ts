// TypeScript form of components/schemas in docs/openapi.yaml: the only
// declaration of the API's data types. The backend (src/) and the client
// (client/src/) both import from here, so the two sides cannot drift.
// Keep this file dependency-free: no imports, only types, enum values, and
// the type guards both sides need.

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

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
  /** RFC 3339 with an explicit offset. */
  readonly startTime: string;
  /** RFC 3339 with an explicit offset; must be later than startTime. */
  readonly endTime: string;
}

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly service: string;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}

/** Every ErrorResponse.code the server sends. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'MALFORMED_JSON'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_UNAVAILABLE'
  | 'DOUBLE_BOOKING'
  | 'RESERVATION_NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'ROUTE_NOT_FOUND'
  | 'INTERNAL_ERROR';

/**
 * The body of every failed request. The server always sends an ErrorCode;
 * the client reads `ErrorResponse<string>` so a code added to a newer server
 * still parses.
 */
export interface ErrorResponse<Code extends string = ErrorCode> {
  readonly code: Code;
  readonly message: string;
}

export function isResourceType(value: unknown): value is ResourceType {
  return RESOURCE_TYPES.some((type: ResourceType): boolean => type === value);
}

export function isReservationStatus(value: unknown): value is ReservationStatus {
  return RESERVATION_STATUSES.some(
    (status: ReservationStatus): boolean => status === value,
  );
}
