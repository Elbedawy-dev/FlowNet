import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogIn, Crown, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import { getGroupIcon } from '../../utils/groupIcons';
import { useLanguage } from '../../context/LanguageContext';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';

const GroupsJoined = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJoined = async () => {
      try {
        setLoading(true);
        const res = await groupsApi.getJoined();
        setGroups(res || []);
      } catch (err) {
        console.warn('Failed to load joined groups:', err);
        toast.error(t('groups.loadJoinedFailed') || 'Could not load your groups');
      } finally {
        setLoading(false);
      }
    };
    fetchJoined();
  }, [t]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 bg-app-page text-app min-h-full pb-32">
      {/* Header */}
      <div className="flex flex-col items-center mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-700 via-fuchsia-600 to-pink-600 dark:from-pink-400 dark:via-purple-300 dark:to-indigo-300 tracking-wide mb-2">
          ⚡ {t('groups.myGroupsTitle') || 'My Groups'} ⚡
        </h1>
        <p className="text-app-muted text-sm max-w-md">
          {t('groups.myGroupsSubtitle') ||
            'Communities you are part of, dive in and interact with fellow members'}
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t('groups.emptyJoinedTitle') || "You haven't joined any groups yet."}
          description={
            t('groups.emptyJoinedDesc') ||
            'Explore available groups and send a join request to see them here.'
          }
          icon={Users}
          actionText={t('groups.browseAvailable') || 'Browse Available Groups'}
          onAction={() => navigate('/groups')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group._id}
              className="group relative bg-app-card backdrop-blur border border-app hover:border-purple-400/50 rounded-3xl p-6 shadow-app-glow transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
            >
              <div>
                {/* Top Icon & Role Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform duration-300">
                    {getGroupIcon(group.icon, 'w-7 h-7 text-white')}
                  </div>

                  <div className="flex items-center gap-2">
                    {group.is_owner ? (
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-medium">
                        <Crown className="w-3 h-3" /> {t('groups.owner') || 'Owner'}
                      </span>
                    ) : group.is_admin ? (
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 font-medium">
                        <Shield className="w-3 h-3" /> {t('groups.admin') || 'Admin'}
                      </span>
                    ) : null}

                    <div className="text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-300/30 text-purple-600 dark:text-purple-300 font-medium">
                      {group.members_count || 0} {t('groups.members') || 'members'}
                    </div>
                  </div>
                </div>

                {/* Group Name & Description */}
                <h3 className="text-xl font-bold text-app mb-2 group-hover:text-pink-300 transition-colors">
                  {group.name}
                </h3>
                <p className="text-xs text-app-muted line-clamp-3 mb-6 leading-relaxed">
                  {group.description ||
                    'A wonderful collaborative group on FlowNet.'}
                </p>
              </div>

              {/* Action Button: Blue to purple */}
              <div className="pt-4 border-t border-app">
                <button
                  type="button"
                  onClick={() => navigate(`/groups/${group._id}`)}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-md bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-indigo-950/50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t('groups.enterGroup') || 'Enter Group 🚀'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupsJoined;
