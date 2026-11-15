// A small helper so every screen loads data the same way:
//   const { data, error, retry } = useAsync(() => getSomething(), [dependency]);
// data = null while loading, error = true if it failed, retry() = try again.
import { DependencyList, useEffect, useState } from "react";

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false; // ignore the answer if the screen closed meanwhile
    setData(null);
    setError(false);
    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { data, error, retry: () => setAttempt((a) => a + 1) };
}
