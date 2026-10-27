import { useCallback } from 'react';
import { fetchResources } from '../api/campushubApi';
import type { Resource, ResourceType } from '../api/types';
import { useApiQuery } from './useApiQuery';
import type { QueryState } from './useApiQuery';

const NO_RESOURCES: Resource[] = [];

/** Resources of one type, or all of them when `type` is undefined. */
export function useResources(type?: ResourceType): QueryState<Resource[]> {
  const load = useCallback(
    (signal: AbortSignal): Promise<Resource[]> => fetchResources(type, { signal }),
    [type],
  );
  return useApiQuery(load, NO_RESOURCES);
}
