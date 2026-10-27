import { useCallback, useMemo, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import type { Resource } from './api/types';
import { BookingForm } from './components/BookingForm';
import { ResourceList } from './components/ResourceList';
import { UserReservations } from './components/UserReservations';
import { useResources } from './hooks/useResources';
import styles from './App.module.css';

// There is no authentication yet, so the student is chosen by ID (the spec's example user).
const DEFAULT_USER_ID: string = 'user-456';

export function App(): JSX.Element {
  const [userId, setUserId] = useState<string>(DEFAULT_USER_ID);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [bookingsVersion, setBookingsVersion] = useState<number>(0);
  const { data: allResources } = useResources();

  const resourceNames = useMemo(
    (): ReadonlyMap<string, string> =>
      new Map(
        allResources.map((resource: Resource): [string, string] => [
          resource.id,
          resource.name,
        ]),
      ),
    [allResources],
  );

  const handleBooked = useCallback((): void => {
    setBookingsVersion((version: number): number => version + 1);
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true" />
          <div>
            <h1 className={styles.title}>CampusHub</h1>
            <p className={styles.subtitle}>Reserve study rooms, equipment, and labs</p>
          </div>
        </div>
        <StudentSwitcher userId={userId} onChange={setUserId} />
      </header>

      <main className={styles.layout}>
        <div className={styles.primary}>
          <ResourceList
            selectedResourceId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>
        <aside className={styles.sidebar}>
          {selected !== null ? (
            <BookingForm
              key={`${selected.id}:${userId}`}
              resource={selected}
              userId={userId}
              onBooked={handleBooked}
              onClose={(): void => setSelected(null)}
            />
          ) : (
            <p className={styles.hint}>
              Choose an available resource to book a time slot.
            </p>
          )}
          <UserReservations
            key={userId}
            userId={userId}
            resourceNames={resourceNames}
            refreshToken={bookingsVersion}
          />
        </aside>
      </main>
    </div>
  );
}

interface StudentSwitcherProps {
  userId: string;
  onChange: (userId: string) => void;
}

function StudentSwitcher({ userId, onChange }: StudentSwitcherProps): JSX.Element {
  const [draft, setDraft] = useState<string>(userId);
  const trimmed: string = draft.trim();
  // Mirrors the contract's Identifier: non-empty, no whitespace, at most 128 chars.
  const isValid: boolean = /^\S{1,128}$/.test(trimmed);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isValid) {
      onChange(trimmed);
    }
  };

  return (
    <form className={styles.switcher} onSubmit={handleSubmit}>
      <label htmlFor="student-id" className={styles.switcherLabel}>
        Student ID
      </label>
      <input
        id="student-id"
        className={styles.switcherInput}
        value={draft}
        onChange={(event): void => setDraft(event.target.value)}
        aria-invalid={!isValid}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className={styles.switcherButton}
        disabled={!isValid || trimmed === userId}
      >
        Switch
      </button>
    </form>
  );
}
