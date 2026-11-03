import { isReservationStatus, isResourceType } from '../../../shared/contract';
import type { ErrorResponse, Reservation, Resource } from '../../../shared/contract';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isResource(value: unknown): value is Resource {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isResourceType(value.type) &&
    isNonEmptyString(value.location) &&
    typeof value.isAvailable === 'boolean'
  );
}

export function isReservation(value: unknown): value is Reservation {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.resourceId) &&
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.startTime) &&
    isNonEmptyString(value.endTime) &&
    isReservationStatus(value.status)
  );
}

// ErrorResponse<string>: an error code added to a newer server must still parse.
export function isErrorResponse(value: unknown): value is ErrorResponse<string> {
  return (
    isRecord(value) && isNonEmptyString(value.code) && typeof value.message === 'string'
  );
}
