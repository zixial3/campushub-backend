// Mirrors components/schemas in docs/openapi.yaml, field for field.

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export type Resource = {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
};

export type Reservation = {
  id: string;
  resourceId: string;
  userId: string;
  /** UTC RFC 3339, inclusive. */
  startTime: string;
  /** UTC RFC 3339, exclusive. */
  endTime: string;
  status: ReservationStatus;
};

export type CreateReservationRequest = {
  resourceId: string;
  userId: string;
  /** RFC 3339 with an explicit offset. */
  startTime: string;
  /** RFC 3339 with an explicit offset; must be later than startTime. */
  endTime: string;
};

// The lab calls the payload CreateReservationDTO; it is the spec's CreateReservationRequest.
export type CreateReservationDTO = CreateReservationRequest;

export type ErrorResponse = {
  code: string;
  message: string;
};

/** Error codes the contract documents. */
export type KnownErrorCode =
  | 'VALIDATION_ERROR'
  | 'MALFORMED_JSON'
  | 'RESOURCE_NOT_FOUND'
  | 'RESERVATION_NOT_FOUND'
  | 'DOUBLE_BOOKING'
  | 'RESOURCE_UNAVAILABLE'
  | 'INVALID_STATUS_TRANSITION'
  | 'INTERNAL_ERROR';

/** Codes the client produces itself when there is no ErrorResponse to read. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';
