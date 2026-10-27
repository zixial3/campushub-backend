import { useCallback, useRef, useState } from 'react';
import { createReservation, toApiError } from '../api/campushubApi';
import type { ApiError } from '../api/campushubApi';
import type { CreateReservationDTO, Reservation } from '../api/types';

export type CreateReservationState = {
  /** Resolves to the new reservation, or null when it failed (see `error`). */
  submit: (payload: CreateReservationDTO) => Promise<Reservation | null>;
  isSubmitting: boolean;
  error: ApiError | null;
  clearError: () => void;
};

export function useCreateReservation(): CreateReservationState {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  // A ref, not state: two clicks in the same frame both see isSubmitting === false.
  const inFlight = useRef<boolean>(false);

  const submit = useCallback(
    async (payload: CreateReservationDTO): Promise<Reservation | null> => {
      if (inFlight.current) {
        return null;
      }
      inFlight.current = true;
      setIsSubmitting(true);
      setError(null);
      try {
        return await createReservation(payload);
      } catch (err: unknown) {
        setError(toApiError(err));
        return null;
      } finally {
        inFlight.current = false;
        setIsSubmitting(false);
      }
    },
    [],
  );

  const clearError = useCallback((): void => setError(null), []);

  return { submit, isSubmitting, error, clearError };
}
