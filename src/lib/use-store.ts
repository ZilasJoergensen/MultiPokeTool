import { useEffect, useState } from 'react';
import { subscribeStore } from './store';

/**
 * Subscribe to a slice of the user-data store. The fetcher is re-run whenever
 * the underlying store emits a matching change event.
 *
 * Returns `[value, refetch]`. `value` is undefined until the first load.
 */
export function useStoreValue<T>(
  fetcher: () => Promise<T>,
  watch: ('prefs' | 'favorites' | 'recent' | 'catches' | 'shinyHunts' | 'collection')[],
): [T | undefined, () => void] {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetcher().then((v) => {
      if (alive) setValue(v);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    const unsub = subscribeStore((evt) => {
      if (watch.includes(evt)) setTick((t) => t + 1);
    });
    // subscribeStore returns Set.delete's boolean — wrap to satisfy useEffect's
    // cleanup type (must return void).
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [value, () => setTick((t) => t + 1)];
}
