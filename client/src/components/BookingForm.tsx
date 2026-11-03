import { useId } from 'react';
import type { FormEvent, JSX } from 'react';
import { describeBookingError } from '../api/errorMessages';
import type { Reservation, Resource } from '../../../shared/contract';
import { useBookingForm } from '../hooks/useBookingForm';
import { formatSlot } from '../utils/datetime';
import { ErrorBanner } from './ErrorBanner';
import { TimeField } from './TimeField';
import { RESOURCE_TYPE_LABELS } from './resourceLabels';
import styles from './BookingForm.module.css';

export interface BookingFormProps {
  resource: Resource;
  userId: string;
  onBooked: (reservation: Reservation) => void;
  onClose: () => void;
}

export function BookingForm({
  resource,
  userId,
  onBooked,
  onClose,
}: BookingFormProps): JSX.Element {
  const idPrefix: string = useId();
  const {
    values,
    fieldErrors,
    booked,
    earliestStart,
    isSubmitting,
    error,
    clearError,
    handleChange,
    handleSubmit,
  } = useBookingForm(resource, userId, onBooked);

  const startId: string = `${idPrefix}-start`;
  const endId: string = `${idPrefix}-end`;

  return (
    <section className={styles.panel} aria-labelledby={`${idPrefix}-heading`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{RESOURCE_TYPE_LABELS[resource.type]}</p>
          <h2 id={`${idPrefix}-heading`} className={styles.heading}>
            Book {resource.name}
          </h2>
          <p className={styles.location}>{resource.location}</p>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close booking form"
        >
          ×
        </button>
      </header>

      <form
        className={styles.form}
        noValidate
        onSubmit={(event: FormEvent<HTMLFormElement>): void => {
          void handleSubmit(event);
        }}
      >
        <div className={styles.fields}>
          <TimeField
            id={startId}
            name="start"
            label="Start"
            value={values.start}
            error={fieldErrors.start}
            min={earliestStart}
            onChange={handleChange}
          />
          <TimeField
            id={endId}
            name="end"
            label="End"
            value={values.end}
            error={fieldErrors.end}
            min={values.start}
            onChange={handleChange}
          />
        </div>

        {error !== null && (
          <ErrorBanner
            title={
              error.code === 'DOUBLE_BOOKING' ? 'Time slot unavailable' : 'Booking failed'
            }
            message={describeBookingError(error)}
            onDismiss={clearError}
          />
        )}

        {booked !== null && (
          <p className={styles.success} role="status">
            Booked {formatSlot(booked.startTime, booked.endTime)}. Status: {booked.status}
            .
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? 'Booking…' : 'Request booking'}
        </button>
      </form>
    </section>
  );
}
