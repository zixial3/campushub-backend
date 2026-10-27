import type { JSX } from 'react';
import type { ApiError } from '../api/campushubApi';
import { describeCancelError } from '../api/errorMessages';
import type { Reservation } from '../api/types';
import { useCancelReservation } from '../hooks/useCancelReservation';
import { useUserReservations } from '../hooks/useUserReservations';
import { formatSlot } from '../utils/datetime';
import { ErrorBanner } from './ErrorBanner';
import styles from './UserReservations.module.css';

export interface UserReservationsProps {
  userId: string;
  /** Resource names by ID; reservations only carry the resourceId. */
  resourceNames: ReadonlyMap<string, string>;
  /** Bump to refetch, e.g. after a booking is made elsewhere on the page. */
  refreshToken: number;
}

export function UserReservations({
  userId,
  resourceNames,
  refreshToken,
}: UserReservationsProps): JSX.Element {
  const query = useUserReservations(userId, refreshToken);
  const { cancel, pendingIds, failure } = useCancelReservation();

  const handleCancel = async (reservationId: string): Promise<void> => {
    const error: ApiError | null = await cancel(reservationId);
    // A 404 means it is already gone server-side, so the list is stale too.
    if (error === null || error.code === 'RESERVATION_NOT_FOUND') {
      query.reload();
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="bookings-heading">
      <header className={styles.header}>
        <h2 id="bookings-heading" className={styles.heading}>
          My bookings
        </h2>
        <button
          type="button"
          className={styles.refresh}
          onClick={query.reload}
          disabled={query.isLoading}
        >
          {query.isLoading && query.hasLoaded ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {query.error !== null && (
        <ErrorBanner
          title={
            query.hasLoaded
              ? "Couldn't refresh your bookings"
              : "Couldn't load your bookings"
          }
          message={query.error.message}
          onRetry={query.reload}
        />
      )}

      {query.isLoading && !query.hasLoaded ? (
        <p className={styles.muted} aria-busy="true">
          Loading your bookings…
        </p>
      ) : query.hasLoaded && query.data.length === 0 ? (
        <p className={styles.empty}>
          No active bookings for {userId}. Pick a resource to book one.
        </p>
      ) : (
        <ul className={styles.list} aria-busy={query.isLoading}>
          {query.data.map((reservation: Reservation) => (
            <ReservationRow
              key={reservation.id}
              reservation={reservation}
              resourceName={
                resourceNames.get(reservation.resourceId) ?? 'Unknown resource'
              }
              isCancelling={pendingIds.has(reservation.id)}
              errorMessage={
                failure?.reservationId === reservation.id
                  ? describeCancelError(failure.error)
                  : undefined
              }
              onCancel={(): void => {
                void handleCancel(reservation.id);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ReservationRowProps {
  reservation: Reservation;
  resourceName: string;
  isCancelling: boolean;
  errorMessage: string | undefined;
  onCancel: () => void;
}

function ReservationRow({
  reservation,
  resourceName,
  isCancelling,
  errorMessage,
  onCancel,
}: ReservationRowProps): JSX.Element {
  return (
    <li className={styles.row}>
      <div className={styles.details}>
        <p className={styles.name}>{resourceName}</p>
        <p className={styles.slot}>
          {formatSlot(reservation.startTime, reservation.endTime)}
        </p>
        {errorMessage !== undefined && (
          <p className={styles.rowError} role="alert">
            {errorMessage}
          </p>
        )}
      </div>
      <span className={styles.status} data-status={reservation.status}>
        {reservation.status.toLowerCase()}
      </span>
      <button
        type="button"
        className={styles.cancel}
        onClick={onCancel}
        disabled={isCancelling}
        aria-label={`Cancel reservation for ${resourceName}`}
      >
        {isCancelling ? 'Cancelling…' : 'Cancel'}
      </button>
    </li>
  );
}
