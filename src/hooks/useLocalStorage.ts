import { useState, useCallback, useEffect } from "react";

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
) {
  const serialize = options?.serialize || JSON.stringify;
  const deserialize = options?.deserialize || JSON.parse;

  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return deserialize(item);
    } catch {
      return defaultValue;
    }
  });

  // Listen for changes in localStorage from other windows/tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = deserialize(e.newValue);
          setState(newValue);
          console.log(`[useLocalStorage] Auto-synced "${key}" from other window`);
        } catch (error) {
          console.error(`[useLocalStorage] Error parsing updated value for "${key}":`, error);
        }
      }
    };

    // Storage event only fires when localStorage changes in OTHER windows/tabs
    window.addEventListener('storage', handleStorageChange);

    // Also poll for changes in same window (storage event doesn't fire for same window)
    const pollInterval = setInterval(() => {
      try {
        const item = localStorage.getItem(key);
        if (item !== null) {
          const currentValue = deserialize(item);
          // Only update if value actually changed
          if (JSON.stringify(currentValue) !== JSON.stringify(state)) {
            setState(currentValue);
            console.log(`[useLocalStorage] Auto-synced "${key}" from same window`);
          }
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 500); // Poll every 500ms

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [key, deserialize]);

  const setValue = useCallback(
    (value: T | ((prevState: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(state) : value;
        setState(valueToStore);
        localStorage.setItem(key, serialize(valueToStore));
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serialize]
  );

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setState(defaultValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultValue]);

  return [state, setValue, remove] as const;
}
