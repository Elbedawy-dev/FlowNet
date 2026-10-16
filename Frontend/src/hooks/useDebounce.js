import { useState, useEffect } from 'react';

/**
 * Debounce a state value by specified delay (default 400ms)
 * @param {*} value
 * @param {number} delay
 * @returns {*} debouncedValue
 */
export const useDebounce = (value, delay = 400) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
