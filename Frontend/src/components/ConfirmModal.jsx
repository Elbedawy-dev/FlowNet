import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  isLoading = false,
  requireInputText = '',
}) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmDisabled =
    isLoading || (requireInputText && inputValue.trim() !== requireInputText);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-md bg-app-card border border-app rounded-2xl p-6 shadow-2xl text-app relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 end-4 text-app-muted hover:text-app p-1 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                danger
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/30'
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-app">{title}</h3>
            </div>
          </div>

          <p className="text-sm text-app-muted mb-4 leading-relaxed">
            {message}
          </p>

          {requireInputText && (
            <div className="mb-6">
              <label className="block text-xs text-rose-600 dark:text-rose-300 mb-1.5 font-medium">
                Type <span className="font-mono font-bold underline">{requireInputText}</span> to confirm:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Type ${requireInputText}`}
                className="w-full px-3.5 py-2.5 bg-app-input border border-rose-400 dark:border-rose-500/40 rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition placeholder-app-muted"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-sm border border-app text-app hover:bg-purple-500/10 transition cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isConfirmDisabled}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition active:scale-95 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                danger
                  ? 'bg-linear-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white shadow-rose-950/50'
                  : 'bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-purple-950/50'
              }`}
            >
              {isLoading ? 'Processing...' : confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmModal;
