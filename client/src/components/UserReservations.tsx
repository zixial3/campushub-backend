import type { JSX } from 'react';
import { describeCancelError } from '../api/errorMessages';
import type { Reservation } from '../../../shared/contract';
import { useReservations } from '../hooks/useReservations';
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
  const {
    reservations,
    isLoading,
    hasLoaded,
    error,
    reload,
    cancel,
    cancellingIds,
    cancelFailure,
  } = useReservations(userId, refreshToken);

  return (
    <section className={styles.panel} aria-labelledby="bookings-heading">
      <header className={styles.header}>
        <h2 id="bookings-heading" className={styles.heading}>
          My bookings
        </h2>
        <button
          type="button"
          className={styles.refresh}
          onClick={reload}
          disabled={isLoading}
        >
          {isLoading && hasLoaded ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error !== null && (
        <ErrorBanner
          title={
            hasLoaded ? "Couldn't refresh your bookings" : "Couldn't load your bookings"
          }
          message={error.message}
          onRetry={reload}
        />
      )}

      {isLoading && !hasLoaded ? (
        <p className={styles.muted} aria-busy="true">
          Loading your bookings…
        </p>
      ) : hasLoaded && reservations.length === 0 ? (
        <p className={styles.empty}>
          No active bookings for {userId}. Pick a resource to book one.
        </p>
      ) : (
        <ul className={styles.list} aria-busy={isLoading}>
          {reservations.map((reservation: Reservation) => (
            <ReservationRow
              key={reservation.id}
              reservation={reservation}
              resourceName={
                resourceNames.get(reservation.resourceId) ?? 'Unknown resource'
              }
              isCancelling={cancellingIds.has(reservation.id)}
              errorMessage={
                cancelFailure?.reservationId === reservation.id
                  ? describeCancelError(cancelFailure.error)
                  : undefined
              }
              onCancel={(): void => {
                void cancel(reservation.id);
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
