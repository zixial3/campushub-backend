import { useCallback, useRef, useState } from 'react';
import {
  cancelReservation,
  createReservation,
  fetchUserReservations,
  toApiError,
} from '../api/campushubApi';
import type { ApiError } from '../api/campushubApi';
import type { CreateReservationRequest, Reservation } from '../../../shared/contract';
import { useApiQuery } from './useApiQuery';

// All reservation server state lives here, so components only render it.

const NO_RESERVATIONS: Reservation[] = [];

export type CancelFailure = {
  reservationId: string;
  error: ApiError;
};

export type ReservationsState = {
  /** The user's PENDING and CONFIRMED reservations, earliest first. */
  reservations: Reservation[];
  isLoading: boolean;
  /** True once any load has succeeded, so a reload can keep showing the old list. */
  hasLoaded: boolean;
  error: ApiError | null;
  reload: () => void;
  /** Cancels, then refreshes the list. A failure is reported through `cancelFailure`. */
  cancel: (reservationId: string) => Promise<void>;
  /** IDs with a cancel request in flight, so each row tracks its own button. */
  cancellingIds: ReadonlySet<string>;
  cancelFailure: CancelFailure | null;
};

/** A user's active reservations. Bump `refreshToken` to refetch after an outside change. */
export function useReservations(userId: string, refreshToken: number): ReservationsState {
  const load = useCallback(
    (signal: AbortSignal): Promise<Reservation[]> =>
      fetchUserReservations(userId, { signal }),
    [userId],
  );
  const query = useApiQuery(load, NO_RESERVATIONS, refreshToken);
  const { reload } = query;
  const [cancellingIds, setCancellingIds] = useState<ReadonlySet<string>>(
    new Set<string>(),
  );
  const [cancelFailure, setCancelFailure] = useState<CancelFailure | null>(null);

  const cancel = useCallback(
    async (reservationId: string): Promise<void> => {
      setCancellingIds((ids: ReadonlySet<string>): ReadonlySet<string> =>
        new Set(ids).add(reservationId),
      );
      setCancelFailure(null);
      try {
        await cancelReservation(reservationId);
        reload();
      } catch (err: unknown) {
        const error: ApiError = toApiError(err);
        setCancelFailure({ reservationId, error });
        // A 404 means it is already gone server-side, so the list is stale too.
        if (error.code === 'RESERVATION_NOT_FOUND') {
          reload();
        }
      } finally {
        setCancellingIds((ids: ReadonlySet<string>): ReadonlySet<string> => {
          const next: Set<string> = new Set(ids);
          next.delete(reservationId);
          return next;
        });
      }
    },
    [reload],
  );

  return {
    reservations: query.data,
    isLoading: query.isLoading,
    hasLoaded: query.hasLoaded,
    error: query.error,
    reload,
    cancel,
    cancellingIds,
    cancelFailure,
  };
}

export type CreateReservationState = {
  /** Resolves to the new reservation, or null when it failed (see `error`). */
  submit: (payload: CreateReservationRequest) => Promise<Reservation | null>;
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
    async (payload: CreateReservationRequest): Promise<Reservation | null> => {
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
