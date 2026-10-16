import { useState, useEffect } from 'react';
import { Users, UserPlus, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';
import { getGroupIcon } from '../../utils/groupIcons';

const GroupsAvailable = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await groupsApi.getAvailable();
      setGroups(res || []);
    } catch (err) {
      console.warn('Failed to fetch available groups:', err);
      toast.error('تعذر تحميل المجموعات المتاحة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

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
        toast.success('تم إلغاء طلب الانضمام');
      } else {
        // Submit join request
        await groupsApi.joinRequest(group._id);
        setGroups((prev) =>
          prev.map((g) =>
            g._id === group._id ? { ...g, has_pending_request: true } : g
          )
        );
        toast.success('تم إرسال طلب الانضمام بنجاح ✨');
      }
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div dir="rtl" className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 tracking-wide mb-2">
          ⚡ المجموعات المتاحة ⚡
        </h1>
        <p className="text-gray-300 text-sm max-w-md">
          استكشف مجتمعات فلونت المميزة وانضم إلى النقاشات والاهتمامات المشتركة
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState
          title="لا توجد مجموعات متاحة حالياً"
          description="جميع المجموعات انضممت إليها بالفعل أو لم يتم إنشاء مجموعات جديدة بعد."
          icon={Users}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            const isPending = Boolean(group.has_pending_request);
            const isProcessing = actionLoadingId === group._id;

            return (
              <div
                key={group._id}
                className="group relative bg-[#182034]/90 backdrop-blur border border-purple-500/20 hover:border-purple-500/40 rounded-3xl p-6 shadow-[0_0_20px_rgba(131,58,180,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
              >
                <div>
                  {/* Top Icon & Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform duration-300">
                      {getGroupIcon(group.icon, 'w-7 h-7 text-white')}
                    </div>
                    <div className="text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium">
                      {group.members_count || 0} أعضاء
                    </div>
                  </div>

                  {/* Group Name & Description */}
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-pink-300 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-xs text-gray-400 line-clamp-3 mb-6 leading-relaxed">
                    {group.description || 'مجموعة تفاعلية رائعة تجمع الأعضاء على فلونت.'}
                  </p>
                </div>

                {/* Action Button */}
                <div className="pt-4 border-t border-purple-500/10">
                  <button
                    type="button"
                    onClick={() => handleJoinToggle(group)}
                    disabled={isProcessing}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-md ${
                      isPending
                        ? 'bg-purple-950/60 border border-purple-500/40 text-purple-200 hover:bg-rose-950/50 hover:border-rose-500/40 hover:text-rose-300'
                        : 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white shadow-purple-950/50'
                    }`}
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : isPending ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>تم إرسال الطلب (إلغاء)</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>طلب الانضمام ✨</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupsAvailable;
