import React from 'react';

const Loading = ({ className = 'min-h-[50vh]' }) => {
  return (
    <div className={`w-full flex flex-col items-center justify-center p-8 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Gradient spinning outer ring */}
        <div className="w-14 h-14 rounded-full border-4 border-transparent border-t-purple-400 border-r-indigo-400 border-b-pink-400 animate-spin shadow-[0_0_20px_rgba(168,85,247,0.5)]" />
        
        {/* Pulsing center dot */}
        <div className="absolute w-3.5 h-3.5 rounded-full bg-linear-to-r from-pink-400 to-purple-500 animate-pulse shadow-[0_0_10px_rgba(236,72,153,0.8)]" />
      </div>
      <span className="mt-4 text-xs tracking-widest uppercase text-purple-300/80 animate-pulse">
        FlowNet
      </span>
    </div>
  );
};

export default Loading;
