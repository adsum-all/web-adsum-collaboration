import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "./api.js";

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// Load an async resource, exposing loading and error states plus a manual reload. It also
// keeps itself fresh WITHOUT a manual page refresh: it refetches when the tab regains focus /
// becomes visible and on a light interval. A background refetch keeps the current data on
// screen (no spinner flash) so a change made elsewhere appears on its own within pollMs, or
// instantly on focus.
export function useResource<T>(loader: () => Promise<T>, deps: unknown[], pollMs: number = 20000): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const hasData = useRef(false);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    if (!hasData.current) setLoading(true);
    loader()
      .then((result) => {
        if (alive) {
          setData(result);
          hasData.current = true;
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof ApiError ? err.message : "Erreur reseau");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!pollMs || pollMs <= 0 || typeof window === "undefined") return undefined;
    const refresh = (): void => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        setTick((value) => value + 1);
      }
    };
    const handle = window.setInterval(refresh, pollMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(handle);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pollMs]);

  return { data, loading, error, reload };
}
