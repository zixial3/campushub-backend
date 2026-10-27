import { useState } from 'react';
import type { JSX } from 'react';
import { RESOURCE_TYPES } from '../api/types';
import type { Resource, ResourceType } from '../api/types';
import { useResources } from '../hooks/useResources';
import { ErrorBanner } from './ErrorBanner';
import { RESOURCE_TYPE_LABELS } from './resourceLabels';
import styles from './ResourceList.module.css';

type TypeFilter = ResourceType | 'ALL';

const FILTERS: readonly TypeFilter[] = ['ALL', ...RESOURCE_TYPES];

const FILTER_LABELS: Readonly<Record<TypeFilter, string>> = {
  ALL: 'All',
  ROOM: 'Rooms',
  EQUIPMENT: 'Equipment',
  LAB: 'Labs',
};

const SKELETON_COUNT: number = 4;

export interface ResourceListProps {
  selectedResourceId: string | null;
  onSelect: (resource: Resource) => void;
}

export function ResourceList({
  selectedResourceId,
  onSelect,
}: ResourceListProps): JSX.Element {
  const [filter, setFilter] = useState<TypeFilter>('ALL');
  const {
    data: resources,
    isLoading,
    error,
    hasLoaded,
    reload,
  } = useResources(filter === 'ALL' ? undefined : filter);

  return (
    <section className={styles.panel} aria-labelledby="resources-heading">
      <header className={styles.header}>
        <h2 id="resources-heading" className={styles.heading}>
          Campus resources
        </h2>
        <div className={styles.filters} role="group" aria-label="Filter by type">
          {FILTERS.map((value: TypeFilter) => (
            <button
              key={value}
              type="button"
              className={styles.filter}
              aria-pressed={filter === value}
              onClick={(): void => setFilter(value)}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
      </header>

      {error !== null ? (
        <ErrorBanner
          title="Couldn't load resources"
          message={error.message}
          onRetry={reload}
        />
      ) : isLoading && !hasLoaded ? (
        <ul className={styles.grid} aria-busy="true" aria-label="Loading resources">
          {Array.from({ length: SKELETON_COUNT }, (_: unknown, index: number) => (
            <li key={index} className={`${styles.card} ${styles.skeleton}`} />
          ))}
        </ul>
      ) : resources.length === 0 ? (
        <p className={styles.empty}>No resources match this filter.</p>
      ) : (
        <ul className={styles.grid} aria-busy={isLoading}>
          {resources.map((resource: Resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              isSelected={resource.id === selectedResourceId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ResourceCardProps {
  resource: Resource;
  isSelected: boolean;
  onSelect: (resource: Resource) => void;
}

function ResourceCard({
  resource,
  isSelected,
  onSelect,
}: ResourceCardProps): JSX.Element {
  return (
    <li className={styles.card} data-selected={isSelected}>
      <div className={styles.cardTop}>
        <span className={styles.type}>{RESOURCE_TYPE_LABELS[resource.type]}</span>
        <span className={resource.isAvailable ? styles.available : styles.unavailable}>
          {resource.isAvailable ? 'Available' : 'Out of service'}
        </span>
      </div>
      <h3 className={styles.name}>{resource.name}</h3>
      <p className={styles.location}>{resource.location}</p>
      <button
        type="button"
        className={styles.book}
        disabled={!resource.isAvailable}
        aria-pressed={isSelected}
        onClick={(): void => onSelect(resource)}
      >
        {!resource.isAvailable ? 'Unavailable' : isSelected ? 'Selected' : 'Book'}
      </button>
    </li>
  );
}
