import { useCallback } from 'react';
import { fetchUserReservations } from '../api/campushubApi';
import type { Reservation } from '../api/types';
import { useApiQuery } from './useApiQuery';
import type { QueryState } from './useApiQuery';

const NO_RESERVATIONS: Reservation[] = [];

/** A user's active reservations. Bump `refreshToken` to refetch after an outside change. */
export function useUserReservations(
  userId: string,
  refreshToken: number,
): QueryState<Reservation[]> {
  const load = useCallback(
    (signal: AbortSignal): Promise<Reservation[]> =>
      fetchUserReservations(userId, { signal }),
    [userId],
  );
  return useApiQuery(load, NO_RESERVATIONS, refreshToken);
}
