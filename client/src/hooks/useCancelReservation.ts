import { useCallback, useState } from 'react';
import { cancelReservation, toApiError } from '../api/campushubApi';
import type { ApiError } from '../api/campushubApi';

export type CancelFailure = {
  reservationId: string;
  error: ApiError;
};

export type CancelReservationState = {
  /**
   * Resolves to null on success, or the error. Returned directly (not only via
   * `failure`) because a caller's closure still holds the pre-cancel state.
   */
  cancel: (reservationId: string) => Promise<ApiError | null>;
  /** IDs with a cancel request in flight, so each row tracks its own button. */
  pendingIds: ReadonlySet<string>;
  failure: CancelFailure | null;
};

export function useCancelReservation(): CancelReservationState {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [failure, setFailure] = useState<CancelFailure | null>(null);

  const cancel = useCallback(async (reservationId: string): Promise<ApiError | null> => {
    setPendingIds((ids: ReadonlySet<string>): ReadonlySet<string> =>
      new Set(ids).add(reservationId),
    );
    setFailure(null);
    try {
      await cancelReservation(reservationId);
      return null;
    } catch (err: unknown) {
      const error: ApiError = toApiError(err);
      setFailure({ reservationId, error });
      return error;
    } finally {
      setPendingIds((ids: ReadonlySet<string>): ReadonlySet<string> => {
        const next: Set<string> = new Set(ids);
        next.delete(reservationId);
        return next;
      });
    }
  }, []);

  return { cancel, pendingIds, failure };
}
