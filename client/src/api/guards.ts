import { RESERVATION_STATUSES, RESOURCE_TYPES } from './types';
import type {
  ErrorResponse,
  Reservation,
  ReservationStatus,
  Resource,
  ResourceType,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isResourceType(value: unknown): value is ResourceType {
  return RESOURCE_TYPES.some((type: ResourceType): boolean => type === value);
}

function isReservationStatus(value: unknown): value is ReservationStatus {
  return RESERVATION_STATUSES.some(
    (status: ReservationStatus): boolean => status === value,
  );
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

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isRecord(value) && isNonEmptyString(value.code) && typeof value.message === 'string'
  );
}
