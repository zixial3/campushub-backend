import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { ApiError } from '../api/campushubApi';
import type { Reservation, Resource } from '../../../shared/contract';
import { defaultSlot, toLocalInputValue } from '../utils/datetime';
import { validateBooking } from '../utils/validateBooking';
import type { BookingFieldErrors, BookingFormValues } from '../utils/validateBooking';
import { useCreateReservation } from './useReservations';

export type BookingFormState = {
  values: BookingFormValues;
  fieldErrors: BookingFieldErrors;
  /** The reservation this form just created, shown until the times change. */
  booked: Reservation | null;
  /** `min` for the start input, fixed when the form opens. */
  earliestStart: string;
  isSubmitting: boolean;
  error: ApiError | null;
  clearError: () => void;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function initialValues(): BookingFormValues {
  const { start, end } = defaultSlot();
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
}

/** Form state and submit flow for booking `resource` as `userId`. */
export function useBookingForm(
  resource: Resource,
  userId: string,
  onBooked: (reservation: Reservation) => void,
): BookingFormState {
  const [values, setValues] = useState<BookingFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  // Validate live only after the first submit, so the user isn't scolded mid-typing.
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);
  const [booked, setBooked] = useState<Reservation | null>(null);
  // Captured once: reading the clock during render would change `min` on every re-render.
  const [earliestStart] = useState<string>((): string => toLocalInputValue(new Date()));
  const { submit, isSubmitting, error, clearError } = useCreateReservation();

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next: BookingFormValues = {
      ...values,
      [event.target.name]: event.target.value,
    };
    setValues(next);
    setBooked(null);
    // A conflict was about the old times; once they change it no longer applies.
    clearError();
    if (hasAttempted) {
      const result = validateBooking(next);
      setFieldErrors(result.ok ? {} : result.errors);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setHasAttempted(true);
    const result = validateBooking(values);
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    // A previous success must not sit next to this attempt's error.
    setBooked(null);
    const reservation: Reservation | null = await submit({
      resourceId: resource.id,
      userId,
      startTime: result.start.toISOString(),
      endTime: result.end.toISOString(),
    });
    if (reservation !== null) {
      setBooked(reservation);
      onBooked(reservation);
    }
  };

  return {
    values,
    fieldErrors,
    booked,
    earliestStart,
    isSubmitting,
    error,
    clearError,
    handleChange,
    handleSubmit,
  };
}
