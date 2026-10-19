export const PostCardSkeleton = () => {
  return (
    <div className="bg-app-card text-app rounded-2xl shadow-md p-4 space-y-4 w-full max-w-2xl border border-app">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full skeleton-shimmer shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="w-32 h-4 rounded skeleton-shimmer" />
          <div className="w-24 h-3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 rounded skeleton-shimmer" />
        <div className="w-3/4 h-4 rounded skeleton-shimmer" />
      </div>
      <div className="w-full h-48 rounded-xl skeleton-shimmer" />
      <div className="flex gap-6 pt-2 border-t border-app">
        <div className="w-12 h-5 rounded skeleton-shimmer" />
        <div className="w-12 h-5 rounded skeleton-shimmer" />
        <div className="w-12 h-5 rounded skeleton-shimmer" />
      </div>
    </div>
  );
};

export const UserCardSkeleton = () => {
  return (
    <div className="bg-app-card text-app rounded-2xl border border-app shadow-md p-5 flex flex-col items-center space-y-3">
      <div className="w-20 h-20 rounded-full skeleton-shimmer" />
      <div className="w-28 h-4 rounded skeleton-shimmer" />
      <div className="w-20 h-3 rounded skeleton-shimmer" />
      <div className="w-full h-8 rounded-xl skeleton-shimmer mt-2" />
    </div>
  );
};

export const MessageRowSkeleton = () => {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-10 h-10 rounded-full skeleton-shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-24 h-4 rounded skeleton-shimmer" />
        <div className="w-36 h-3 rounded skeleton-shimmer" />
      </div>
    </div>
  );
};

export const NotificationSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-app-card text-app border border-app shadow-md">
      <div className="w-10 h-10 rounded-full skeleton-shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-48 h-4 rounded skeleton-shimmer" />
        <div className="w-24 h-3 rounded skeleton-shimmer" />
      </div>
    </div>
  );
};

export const StoriesSkeleton = () => {
  return (
    <div className="flex items-center gap-4 py-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="w-14 h-14 rounded-full skeleton-shimmer ring-2 ring-purple-400/20" />
          <div className="w-12 h-2.5 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
};

export const ChatSkeleton = () => {
  return (
    <div className="p-4 space-y-4 w-full">
      <div className="flex gap-2 items-end">
        <div className="w-8 h-8 rounded-full skeleton-shimmer shrink-0" />
        <div className="w-48 h-12 rounded-2xl skeleton-shimmer" />
      </div>
      <div className="flex justify-end">
        <div className="w-40 h-10 rounded-2xl skeleton-shimmer" />
      </div>
      <div className="flex gap-2 items-end">
        <div className="w-8 h-8 rounded-full skeleton-shimmer shrink-0" />
        <div className="w-64 h-16 rounded-2xl skeleton-shimmer" />
      </div>
    </div>
  );
};

export const ProfileSkeleton = () => {
  return (
    <div className="bg-app-card text-app rounded-3xl border border-app shadow-md p-6 space-y-4 w-full max-w-3xl">
      <div className="w-full h-36 rounded-2xl skeleton-shimmer" />
      <div className="flex items-end gap-4 -mt-14 px-4">
        <div className="w-24 h-24 rounded-full skeleton-shimmer ring-4 ring-app-card shrink-0" />
        <div className="space-y-2 mb-2 flex-1">
          <div className="w-40 h-5 rounded skeleton-shimmer" />
          <div className="w-28 h-3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="space-y-2 pt-4">
        <div className="w-full h-3 rounded skeleton-shimmer" />
        <div className="w-2/3 h-3 rounded skeleton-shimmer" />
      </div>
    </div>
  );
};

export const GroupCardSkeleton = () => {
  return (
    <div className="bg-app-card text-app rounded-2xl border border-app shadow-md p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl skeleton-shimmer shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="w-32 h-4 rounded skeleton-shimmer" />
          <div className="w-20 h-3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="w-full h-3 rounded skeleton-shimmer" />
      <div className="w-full h-8 rounded-xl skeleton-shimmer mt-2" />
    </div>
  );
};

export const SettingsSkeleton = () => {
  return (
    <div className="bg-app-card text-app rounded-2xl border border-app shadow-md p-6 space-y-4 w-full max-w-xl">
      <div className="w-40 h-5 rounded skeleton-shimmer" />
      <div className="w-64 h-3 rounded skeleton-shimmer" />
      <div className="w-full h-10 rounded-xl skeleton-shimmer mt-4" />
      <div className="w-full h-10 rounded-xl skeleton-shimmer" />
    </div>
  );
};
