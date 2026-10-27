import { parseLocalInput } from './datetime';

export type BookingFormValues = {
  start: string;
  end: string;
};

export type BookingFieldErrors = {
  start?: string;
  end?: string;
};

export type BookingValidation =
  { ok: true; start: Date; end: Date } | { ok: false; errors: BookingFieldErrors };

// Lets a slot that starts "now" through even if the user took a moment to submit.
const PAST_GRACE_MS: number = 60_000;

/**
 * Client-side checks that mirror the contract (both times present, end after
 * start) plus one UX rule (no slots in the past). The server stays the
 * authority: overlaps can only be detected there.
 */
export function validateBooking(
  values: BookingFormValues,
  now: Date = new Date(),
): BookingValidation {
  const errors: BookingFieldErrors = {};
  const start: Date | null = parseLocalInput(values.start);
  const end: Date | null = parseLocalInput(values.end);

  if (start === null) {
    errors.start = 'Choose a start time.';
  } else if (start.getTime() < now.getTime() - PAST_GRACE_MS) {
    errors.start = 'Start time is in the past.';
  }

  if (end === null) {
    errors.end = 'Choose an end time.';
  } else if (start !== null && end.getTime() <= start.getTime()) {
    errors.end = 'End time must be after the start time.';
  }

  if (
    start === null ||
    end === null ||
    errors.start !== undefined ||
    errors.end !== undefined
  ) {
    return { ok: false, errors };
  }
  return { ok: true, start, end };
}
