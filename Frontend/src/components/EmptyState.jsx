import React from 'react';
import { Sparkles } from 'lucide-react';

const EmptyState = ({
  icon: Icon = Sparkles,
  title = 'No items found',
  message = 'There is nothing to display here yet.',
  actionText,
  onAction,
}) => {
  return (
    <div className="w-full flex flex-col items-center justify-center p-8 text-center bg-white/5 backdrop-blur-md rounded-3xl border border-purple-500/20 shadow-[0_0_25px_rgba(131,58,180,0.3)] my-6">
      <div className="w-16 h-16 rounded-full bg-linear-to-br from-indigo-500/20 to-purple-600/30 flex items-center justify-center border border-purple-500/30 mb-4 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
        <Icon className="w-8 h-8 text-purple-300" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-purple-200/70 max-w-sm mb-4">{message}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-medium transition-all shadow-[0_0_15px_rgba(168,85,247,0.5)] active:scale-95 cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
