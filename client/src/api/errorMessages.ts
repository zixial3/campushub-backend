import type { ApiError } from './campushubApi';

/** UI copy for a failed booking, keyed on the contract's error code, never its message. */
export function describeBookingError(error: ApiError): string {
  switch (error.code) {
    case 'DOUBLE_BOOKING':
      return 'This resource is already reserved for the selected time window. Choose a different time.';
    case 'RESOURCE_UNAVAILABLE':
      return 'This resource is out of service and cannot be booked right now.';
    case 'RESOURCE_NOT_FOUND':
      return 'This resource no longer exists. Refresh the list and pick another one.';
    case 'VALIDATION_ERROR':
      return `The server rejected the booking: ${error.message}`;
    default:
      return error.message;
  }
}

export function describeCancelError(error: ApiError): string {
  if (error.code === 'RESERVATION_NOT_FOUND') {
    return 'This reservation no longer exists. Refresh your bookings.';
  }
  return error.message;
}
