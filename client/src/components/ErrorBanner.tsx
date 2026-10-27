import type { JSX } from 'react';
import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({
  message,
  title,
  onRetry,
  onDismiss,
}: ErrorBannerProps): JSX.Element {
  return (
    <div className={styles.banner} role="alert">
      <div className={styles.text}>
        {title !== undefined && <p className={styles.title}>{title}</p>}
        <p className={styles.message}>{message}</p>
      </div>
      {(onRetry !== undefined || onDismiss !== undefined) && (
        <div className={styles.actions}>
          {onRetry !== undefined && (
            <button type="button" className={styles.action} onClick={onRetry}>
              Try again
            </button>
          )}
          {onDismiss !== undefined && (
            <button
              type="button"
              className={styles.dismiss}
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
