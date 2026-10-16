export const PostCardSkeleton = () => {
  return (
    <div className="bg-[#182034] rounded-xl p-4 space-y-4 w-full max-w-2xl animate-pulse border border-purple-500/10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-900/40" />
        <div className="space-y-2 flex-1">
          <div className="w-32 h-4 bg-purple-900/40 rounded" />
          <div className="w-24 h-3 bg-purple-900/30 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-purple-900/30 rounded" />
        <div className="w-3/4 h-4 bg-purple-900/30 rounded" />
      </div>
      <div className="w-full h-48 bg-purple-900/20 rounded-lg" />
      <div className="flex gap-6 pt-2 border-t border-gray-700/50">
        <div className="w-12 h-5 bg-purple-900/30 rounded" />
        <div className="w-12 h-5 bg-purple-900/30 rounded" />
        <div className="w-12 h-5 bg-purple-900/30 rounded" />
      </div>
    </div>
  );
};

export const UserCardSkeleton = () => {
  return (
    <div className="bg-white/5 backdrop-blur border border-purple-500/20 rounded-3xl p-5 flex flex-col items-center space-y-3 animate-pulse">
      <div className="w-20 h-20 rounded-full bg-purple-900/40" />
      <div className="w-28 h-4 bg-purple-900/40 rounded" />
      <div className="w-20 h-3 bg-purple-900/30 rounded" />
      <div className="w-full h-8 bg-purple-900/20 rounded-xl mt-2" />
    </div>
  );
};

export const MessageRowSkeleton = () => {
  return (
    <div className="flex items-center gap-3 px-4 py-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-purple-900/40 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-24 h-4 bg-purple-900/40 rounded" />
        <div className="w-36 h-3 bg-purple-900/30 rounded" />
      </div>
    </div>
  );
};

export const NotificationSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#182034]/70 border border-purple-500/10 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-purple-900/40 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-48 h-4 bg-purple-900/40 rounded" />
        <div className="w-24 h-3 bg-purple-900/20 rounded" />
      </div>
    </div>
  );
};

