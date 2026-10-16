import { useState } from 'react';

const COLORS = [
  'bg-emerald-600',
  'bg-indigo-600',
  'bg-purple-600',
  'bg-pink-600',
  'bg-cyan-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-blue-600',
];

const getColorForName = (name) => {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
};

const SIZES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
  '2xl': 'w-28 h-28 text-4xl',
};

const Avatar = ({
  src,
  name = 'User',
  size = 'md',
  className = '',
  ring = true,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeClass = SIZES[size] || SIZES.md;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const bgColor = getColorForName(name);

  const ringClass = ring
    ? 'ring-2 ring-purple-400/80 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
    : '';

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImageError(true)}
        onClick={onClick}
        className={`rounded-full object-cover shrink-0 select-none ${sizeClass} ${ringClass} ${className} ${
          onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''
        }`}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none ${bgColor} ${sizeClass} ${ringClass} ${className} ${
        onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''
      }`}
    >
      {initial}
    </div>
  );
};

export default Avatar;
