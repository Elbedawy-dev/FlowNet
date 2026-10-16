import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogIn, Crown, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import { getGroupIcon } from '../../utils/groupIcons';
import Loading from '../../components/Loading';
import EmptyState from '../../components/EmptyState';

const GroupsJoined = () => {
  const navigate = useNavigate();
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
        toast.error('تعذر تحميل مجموعاتك');
      } finally {
        setLoading(false);
      }
    };
    fetchJoined();
  }, []);

  return (
    <div dir="rtl" className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 tracking-wide mb-2">
          ⚡ مجموعاتي ⚡
        </h1>
        <p className="text-gray-300 text-sm max-w-md">
          المجموعات التي تشارك فيها، يمكنك الدخول والتفاعل مع الأعضاء فوراً
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState
          title="لم تنضم بعد لأي مجموعة أو لم يتم قبول طلبك."
          description="استكشف المجموعات المتاحة وقدم طلب انضمام لتظهر هنا بمجرد قبولك."
          icon={Users}
          actionText="استعراض المجموعات المتاحة"
          onAction={() => navigate('/groups')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group._id}
              className="group relative bg-[#182034]/90 backdrop-blur border border-purple-500/20 hover:border-purple-500/40 rounded-3xl p-6 shadow-[0_0_20px_rgba(131,58,180,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between"
            >
              <div>
                {/* Top Icon & Role Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 group-hover:scale-105 transition-transform duration-300">
                    {getGroupIcon(group.icon, 'w-7 h-7 text-white')}
                  </div>

                  <div className="flex items-center gap-2">
                    {group.is_owner ? (
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-medium">
                        <Crown className="w-3 h-3" /> مالك
                      </span>
                    ) : group.is_admin ? (
                      <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-medium">
                        <Shield className="w-3 h-3" /> مشرف
                      </span>
                    ) : null}

                    <div className="text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-medium">
                      {group.members_count || 0} أعضاء
                    </div>
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

              {/* Action Button: Blue to purple */}
              <div className="pt-4 border-t border-purple-500/10">
                <button
                  type="button"
                  onClick={() => navigate(`/groups/${group._id}`)}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-md bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-indigo-950/50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>دخول المجموعة 🚀</span>
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
