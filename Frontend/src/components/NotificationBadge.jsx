import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBadge = ({ count, className = '' }) => {
  const numericCount = Number(count) || 0;

  if (numericCount <= 0) return null;

  const displayCount = numericCount > 99 ? '99+' : String(numericCount);

  return (
    <AnimatePresence>
      <motion.span
        key={numericCount}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className={`absolute -top-1.5 -end-1.5 min-w-5 h-5 px-1 bg-gradient-to-r from-red-600 to-rose-500 text-white font-extrabold text-[10px] leading-none rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.7)] ring-2 ring-[var(--app-card,#182034)] pointer-events-none select-none z-20 ${className}`}
      >
        {displayCount}
      </motion.span> 
    </AnimatePresence>
  );
};

export default memo(NotificationBadge);
