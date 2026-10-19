import { useNavigate } from 'react-router-dom';
import { MapPin, Users, UserPlus, UserCheck, MessageCircle } from 'lucide-react';
import Avatar from './Avatar';
import { useLanguage } from '../context/LanguageContext';

const UserCard = ({
  user,
  isFollowing,
  onFollowToggle,
  isFollowLoading,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleProfileClick = () => {
    navigate(`/profile/${user._id}`);
  };

  const handleMessageClick = (e) => {
    e.stopPropagation();
    navigate(`/messages/${user._id}`);
  };

  const handleFollowClick = (e) => {
    e.stopPropagation();
    if (onFollowToggle) {
      onFollowToggle(user._id);
    }
  };

  return (
    <div
      onClick={handleProfileClick}
      className="bg-app-card backdrop-blur-xl border border-app hover:border-pink-500/40 rounded-3xl p-5 flex flex-col items-center text-center shadow-[0_0_25px_rgba(131,58,180,0.2)] hover:shadow-[0_0_35px_rgba(236,72,153,0.35)] hover:scale-[1.02] transition-all duration-300 cursor-pointer relative group"
    >
      <div className="relative mb-3">
        <Avatar
          src={user.profile_picture}
          name={user.full_name || user.username}
          size="xl"
          ring={true}
        />
      </div>

      <h3 className="font-bold text-app text-base truncate max-w-full hover:text-pink-400 transition-colors">
        {user.full_name || 'FlowNet User'}
      </h3>
      <p className="text-app-muted text-xs mb-2">@{user.username || 'user'}</p>

      {user.bio && (
        <p className="text-app-muted text-xs line-clamp-2 mb-3 min-h-[32px] px-2">
          {user.bio}
        </p>
      )}

      {/* Info chips */}
      <div className="flex items-center gap-2 mb-4 text-[11px] text-app-muted flex-wrap justify-center">
        {user.location && (
          <span className="flex items-center gap-1 bg-app-input px-2.5 py-1 rounded-full border border-app">
            <MapPin size={12} className="text-pink-400" />
            <span className="truncate max-w-28">{user.location}</span>
          </span>
        )}
        <span className="flex items-center gap-1 bg-app-input px-2.5 py-1 rounded-full border border-app">
          <Users size={12} className="text-indigo-400" />
          <span>{user.followers_count ?? (user.followers?.length || 0)} {t('search.followers')}</span>
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 w-full mt-auto pt-2">
        <button
          onClick={handleFollowClick}
          disabled={isFollowLoading}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-2xl text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-md ${
            isFollowing
              ? 'bg-purple-900/60 text-purple-200 border border-purple-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30'
              : 'bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
          }`}
        >
          {isFollowing ? (
            <>
              <UserCheck size={14} /> {t('search.following')}
            </>
          ) : (
            <>
              <UserPlus size={14} /> {t('search.follow')}
            </>
          )}
        </button>

        <button
          onClick={handleMessageClick}
          aria-label={t('messages.typeMessage') || 'Send message'}
          title={t('messages.typeMessage') || 'Send message'}
          className="p-2 rounded-2xl bg-app-input hover:bg-white/10 border border-app text-app transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <MessageCircle size={16} />
        </button>
      </div>
    </div>
  );
};

export default UserCard;
