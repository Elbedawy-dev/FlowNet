import { useEffect, useRef, useCallback } from 'react';

/**
 * Infinite scroll hook using IntersectionObserver
 * @param {Function} onLoadMore - Callback to trigger loading more items
 * @param {boolean} hasMore - Whether more items exist to load
 * @param {boolean} isLoading - Whether a load operation is already in progress
 * @returns {React.RefObject} ref to attach to the sentinel element
 */
export const useInfiniteScroll = (onLoadMore, hasMore, isLoading) => {
  const sentinelRef = useRef(null);

  const handleObserver = useCallback(
    (entries) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, isLoading]
  );

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '150px',
      threshold: 0.1,
    });

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [handleObserver]);

  return sentinelRef;
};

export default useInfiniteScroll;
