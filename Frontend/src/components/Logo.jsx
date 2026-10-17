import React from 'react';

const Logo = ({
  className = '',
  iconClassName = 'w-8 h-8',
  textClassName = 'text-xl',
  showText = true,
  onClick,
}) => {
  const hasDisplay = /\b(inline-flex|flex|block|inline-block|hidden|grid)\b/.test(className);
  const baseDisplay = hasDisplay ? '' : 'inline-flex';

  return (
    <div
      onClick={onClick}
      className={`${baseDisplay} items-center gap-2.5 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`.trim()}
    >
      <div className={`relative shrink-0 flex items-center justify-center ${iconClassName}`}>
        <svg
          viewBox="0 0 33 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_10px_rgba(147,51,234,0.35)]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="flownet-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <path
            d="M0.0619184 17.0601L20.2432 0.000228012L12.4475 30.7521L12.1408 19.8491L0.0619184 17.0601Z"
            fill="url(#flownet-logo-grad)"
          />
          <path
            d="M13.798 13.2924L27.9439 17.5243L7.23363 35.2052L7.23841 35.2095L13.798 13.2924Z"
            fill="url(#flownet-logo-grad)"
            fillOpacity="0.9"
          />
        </svg>
      </div>
      {showText && (
        <span
          className={`font-bold tracking-tight bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-purple-600 dark:text-purple-400 [-webkit-text-fill-color:transparent] ${textClassName}`}
        >
          FlowNet
        </span>
      )}
    </div>
  );
};

export default Logo;
