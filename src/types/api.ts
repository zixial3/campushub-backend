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

/** components/schemas/ErrorResponse in docs/openapi.yaml. */
export interface ErrorResponse {
  readonly code: ErrorCode;
  readonly message: string;
}
