import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Users, Rocket, Globe, Sparkles, Star, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import { getGroupIcon } from '../../utils/groupIcons';
import Loading from '../../components/Loading';

const GroupCreate = () => {
  const navigate = useNavigate();
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isFeatureDisabled, setIsFeatureDisabled] = useState(false);

  const [form, setForm] = useState({
    name: '',
    icon: 'users',
    description: '',
  });

  const fetchMyGroups = async () => {
    try {
      setLoading(true);
      const res = await groupsApi.getMine();
      setMyGroups(res || []);
    } catch (err) {
      console.warn('Failed to load my groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      setCreating(true);
      const newGroup = await groupsApi.create({
        name: form.name.trim(),
        icon: form.icon,
        description: form.description.trim(),
      });

      toast.success('تم إنشاء المجموعة بنجاح! 🚀');
      setForm({ name: '', icon: 'users', description: '' });
      fetchMyGroups();
      navigate(`/groups/${newGroup._id}`);
    } catch (err) {
      if (err.code === 'FEATURE_DISABLED' || err.status === 403) {
        setIsFeatureDisabled(true);
        toast.error('إنشاء المجموعات متوقف حالياً');
      } else {
        toast.error(err.message || 'فشل إنشاء المجموعة');
      }
    } finally {
      setCreating(false);
    }
  };

  const icons = [
    { key: 'users', label: 'مستخدمون', icon: Users },
    { key: 'rocket', label: 'صاروخ', icon: Rocket },
    { key: 'globe', label: 'كوكب', icon: Globe },
    { key: 'sparkles', label: 'بريق', icon: Sparkles },
    { key: 'star', label: 'نجم', icon: Star },
  ];

  return (
    <div dir="rtl" className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-300 tracking-wide mb-2">
          إنشاء مجموعاتك +
        </h1>
        <p className="text-gray-300 text-sm">
          أطلق مجتمعك الخاص واجمع المهتمين بمجالك في فضاء فلونت
        </p>
      </div>

      {/* Feature Disabled Calm Notice */}
      {isFeatureDisabled ? (
        <div className="p-6 bg-[#182034]/90 border border-amber-500/30 rounded-3xl text-center shadow-[0_0_25px_rgba(245,158,11,0.15)] mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">إنشاء المجموعات متوقف حالياً</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-4">
            نعمل على ترقية ميزات المجموعات لتوفير تجربة استثنائية. يمكنك حالياً الانضمام للمجموعات المتاحة والمشاركة في المحادثات.
          </p>
          <button
            onClick={() => navigate('/groups')}
            className="px-5 py-2.5 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 text-white text-sm transition cursor-pointer"
          >
            تصفح المجموعات المتاحة
          </button>
        </div>
      ) : (
        /* Create Form Card */
        <div className="bg-[#182034]/90 backdrop-blur border border-purple-500/20 rounded-3xl p-6 md:p-8 shadow-[0_0_25px_rgba(131,58,180,0.2)] mb-10">
          <form onSubmit={handleCreateGroup} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                اسم المجموعة
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                maxLength={100}
                placeholder="اسم المجموعة"
                className="w-full px-4 py-3 bg-[#0e1428] border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                أيقونة المجموعة
              </label>
              <div className="grid grid-cols-5 gap-3">
                {icons.map((item) => {
                  const Icon = item.icon;
                  const isSelected = form.icon === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setForm({ ...form, icon: item.key })}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-105'
                          : 'bg-[#0e1428] text-gray-400 border-purple-500/20 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                وصف المجموعة (اختياري)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="عن ماذا تدور هذه المجموعة؟"
                className="w-full px-4 py-3 bg-[#0e1428] border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={creating || !form.name.trim()}
                className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm shadow-lg shadow-emerald-950/50 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PlusCircle className="w-5 h-5" />
                )}
                <span>إنشاء</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List of my groups */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span>المجموعات التي أديرها ({myGroups.length})</span>
        </h2>

        {loading ? (
          <Loading />
        ) : myGroups.length === 0 ? (
          <div className="p-6 bg-[#182034]/60 border border-purple-500/10 rounded-2xl text-center text-sm text-gray-400">
            لم تقم بإنشاء أي مجموعة بعد.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myGroups.map((g) => (
              <div
                key={g._id}
                onClick={() => navigate(`/groups/${g._id}`)}
                className="p-4 bg-[#182034]/80 hover:bg-[#182034] border border-purple-500/20 hover:border-purple-500/40 rounded-2xl flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-white">
                    {getGroupIcon(g.icon, 'w-5 h-5')}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{g.name}</h3>
                    <p className="text-xs text-gray-400">
                      {g.members?.length || g.members_count || 1} أعضاء
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-400 rotate-180" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupCreate;
