import type { ChangeEvent, JSX } from 'react';
import styles from './TimeField.module.css';

export interface TimeFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  error: string | undefined;
  min: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** A labelled datetime-local input with an optional inline error. */
export function TimeField({
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
