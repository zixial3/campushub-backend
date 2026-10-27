import { useCallback, useEffect, useState } from 'react';
import { isAbortError, toApiError } from '../api/campushubApi';
import type { ApiError } from '../api/campushubApi';

export type QueryState<T> = {
  data: T;
  isLoading: boolean;
  error: ApiError | null;
  /** True once any load has succeeded, so a reload can keep showing the old data. */
  hasLoaded: boolean;
  reload: () => void;
};

/**
 * Runs `load` on mount and whenever `load` or `refreshKey` changes.
 * `load` must be memoised (useCallback), or it re-runs every render.
 */
export function useApiQuery<T>(
  load: (signal: AbortSignal) => Promise<T>,
  initialData: T,
  refreshKey: unknown = null,
): QueryState<T> {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [reloadCount, setReloadCount] = useState<number>(0);

  useEffect((): (() => void) => {
    const controller: AbortController = new AbortController();

    const run = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const result: T = await load(controller.signal);
        // A newer request superseded this one; its result must not overwrite newer state.
        if (controller.signal.aborted) {
          return;
        }
        setData(result);
        setHasLoaded(true);
      } catch (err: unknown) {
        if (!isAbortError(err) && !controller.signal.aborted) {
          setError(toApiError(err));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    // run() catches every rejection itself, so nothing can float unhandled.
    void run();
    return (): void => controller.abort();
  }, [load, refreshKey, reloadCount]);

  const reload = useCallback((): void => {
    setReloadCount((count: number): number => count + 1);
  }, []);

  return { data, isLoading, error, hasLoaded, reload };
}
