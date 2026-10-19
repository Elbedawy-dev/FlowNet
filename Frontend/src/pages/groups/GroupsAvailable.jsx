import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Check, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import CreateGroupModal from '../../components/CreateGroupModal';
import { getGroupIcon } from '../../utils/groupIcons';
import { useLanguage } from '../../context/LanguageContext';

const GroupsAvailable = () => {
  const { t } = useLanguage();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await groupsApi.getAvailable();
      setGroups(res || []);
    } catch (err) {
      console.warn('Failed to fetch available groups:', err);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleJoinToggle = async (group) => {
    try {
      setActionLoadingId(group._id);
      if (group.has_pending_request) {
        // Cancel request
        await groupsApi.cancelJoinRequest(group._id);
        setGroups((prev) =>
          prev.map((g) =>
            g._id === group._id ? { ...g, has_pending_request: false } : g
          )
        );
        toast.success(t('groups.requestCancelled'));
      } else {
        // Submit join request
        await groupsApi.joinRequest(group._id);
        setGroups((prev) =>
          prev.map((g) =>
            g._id === group._id ? { ...g, has_pending_request: true } : g
          )
        );
        toast.success(t('groups.requestSubmitted'));
      }
    } catch (err) {
      toast.error(err.message || t('common.error'));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header with Prominent Create Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-app">
        <div className="text-center sm:text-start">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-700 via-fuchsia-600 to-pink-600 dark:from-pink-400 dark:via-purple-300 dark:to-indigo-300 tracking-wide mb-2">
            {t('groups.availableTitle')}
          </h1>
          <p className="text-app-muted text-sm max-w-md">
            {t('groups.availableSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-6 py-3 rounded-2xl font-bold text-sm bg-linear-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-900/30 hover:shadow-purple-700/50 transition-all duration-300 active:scale-95 cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>{t('groups.createGroupAction')}</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t('groups.emptyAvailable')}
          description={t('groups.emptyAvailablePrompt')}
          icon={Users}
          actionText={t('groups.createGroupAction')}
          onAction={() => setIsCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            const isPending = Boolean(group.has_pending_request);
            const isProcessing = actionLoadingId === group._id;

            return (
              <div
                key={group._id}
                className="group relative bg-app-card backdrop-blur border border-app hover:border-purple-500/40 rounded-3xl p-6 shadow-[0_0_20px_rgba(131,58,180,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
              >
                <div>
                  {/* Top Icon & Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform duration-300">
                      {getGroupIcon(group.icon, 'w-7 h-7 text-white')}
                    </div>
                    <div className="text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-300/30 text-purple-600 dark:text-purple-300 font-medium">
                      {group.members_count || 0} {t('groups.membersCount')}
                    </div>
                  </div>

                  {/* Group Name & Description */}
                  <h3 className="text-xl font-bold text-app mb-2 group-hover:text-pink-400 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-xs text-app-muted line-clamp-3 mb-6 leading-relaxed">
                    {group.description || 'FlowNet community group.'}
                  </p>
                </div>

                {/* Action Button */}
                <div className="pt-4 border-t border-app">
                  <button
                    type="button"
                    onClick={() => handleJoinToggle(group)}
                    disabled={isProcessing}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-md ${
                      isPending
                        ? 'bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-200 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:border-rose-300 dark:hover:border-rose-500/40 hover:text-rose-700 dark:hover:text-rose-300'
                        : 'bg-linear-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white shadow-purple-950/50'
                    }`}
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isPending ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        <span>{t('groups.requestSent')}</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>{t('groups.joinRequestBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Group Creation */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => fetchGroups()}
      />
    </div>
  );
};

export default GroupsAvailable;
