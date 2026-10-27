import { useId, useState } from 'react';
import type { ChangeEvent, FormEvent, JSX } from 'react';
import { describeBookingError } from '../api/errorMessages';
import type { Reservation, Resource } from '../api/types';
import { useCreateReservation } from '../hooks/useCreateReservation';
import { defaultSlot, formatSlot, toLocalInputValue } from '../utils/datetime';
import { validateBooking } from '../utils/validateBooking';
import type { BookingFieldErrors, BookingFormValues } from '../utils/validateBooking';
import { ErrorBanner } from './ErrorBanner';
import { RESOURCE_TYPE_LABELS } from './resourceLabels';
import styles from './BookingForm.module.css';

export interface BookingFormProps {
  resource: Resource;
  userId: string;
  onBooked: (reservation: Reservation) => void;
  onClose: () => void;
}

function initialValues(): BookingFormValues {
  const { start, end } = defaultSlot();
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
}

export function BookingForm({
  resource,
  userId,
  onBooked,
  onClose,
}: BookingFormProps): JSX.Element {
  const idPrefix: string = useId();
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

interface TimeFieldProps {
  id: string;
  name: keyof BookingFormValues;
  label: string;
  value: string;
  error: string | undefined;
  min: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function TimeField({
  id,
  name,
  label,
  value,
  error,
  min,
  onChange,
}: TimeFieldProps): JSX.Element {
  const errorId: string = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="datetime-local"
        className={styles.input}
        value={value}
        min={min}
        required
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        onChange={onChange}
      />
      {error !== undefined && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
