import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Users,
  Rocket,
  Globe,
  Sparkles,
  Star,
  Code,
  BookOpen,
  Heart,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import { getGroupIcon } from '../../utils/groupIcons';
import Loading from '../../components/Loading';
import { useLanguage } from '../../context/LanguageContext';

const ICONS = [
  { key: 'users', labelKey: 'groups.iconUsers', icon: Users },
  { key: 'rocket', labelKey: 'groups.iconRocket', icon: Rocket },
  { key: 'globe', labelKey: 'groups.iconGlobe', icon: Globe },
  { key: 'sparkles', labelKey: 'groups.iconSparkles', icon: Sparkles },
  { key: 'star', labelKey: 'groups.iconStar', icon: Star },
  { key: 'code', labelKey: 'groups.iconCode', icon: Code },
  { key: 'book', labelKey: 'groups.iconBook', icon: BookOpen },
  { key: 'heart', labelKey: 'groups.iconHeart', icon: Heart },
];

const GroupCreate = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState({});

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

  const validate = () => {
    const errs = {};
    const trimmed = form.name.trim();
    if (!trimmed || trimmed.length < 3) {
      errs.name = t('groups.nameMinMax') || 'Group name must be between 3 and 40 characters';
    } else if (trimmed.length > 40) {
      errs.name = t('groups.nameMinMax') || 'Group name must be between 3 and 40 characters';
    }
    if (form.description && form.description.trim().length > 200) {
      errs.description = t('groups.descMax') || 'Description cannot exceed 200 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!validate() || creating) return;

    try {
      setCreating(true);
      const res = await groupsApi.create({
        name: form.name.trim(),
        icon: form.icon,
        description: form.description.trim(),
      });

      const newGroup = res.data || res;
      toast.success(t('groups.groupCreatedSuccess') || 'Group created successfully! 🚀');
      setForm({ name: '', icon: 'users', description: '' });
      fetchMyGroups();
      navigate(`/groups/${newGroup._id}`);
    } catch (err) {
      const msg = err.message || t('common.error');
      toast.error(msg);
      if (err.status === 409) {
        setErrors({ name: msg });
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-emerald-600 via-teal-600 to-indigo-600 dark:from-emerald-400 dark:via-teal-300 dark:to-indigo-300 tracking-wide mb-2">
          {t('groups.createTitle')}
        </h1>
        <p className="text-app-muted text-sm">
          {t('groups.createSubtitle')}
        </p>
      </div>

      {/* Main Grid: Form + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Create Form Card */}
        <div className="lg:col-span-7 bg-app-card backdrop-blur border border-app rounded-3xl p-6 md:p-8 shadow-[0_0_25px_rgba(131,58,180,0.2)]">
          <form onSubmit={handleCreateGroup} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                {t('groups.groupName')} *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                }}
                required
                minLength={3}
                maxLength={40}
                placeholder={t('groups.groupName')}
                className="w-full px-4 py-3 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
              <div className="flex justify-between items-center mt-1 text-[11px]">
                {errors.name ? (
                  <span className="text-rose-500 font-medium">{errors.name}</span>
                ) : (
                  <span className="text-app-muted">3-40 characters</span>
                )}
                <span className="text-app-muted">{form.name.trim().length}/40</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                {t('groups.groupIcon')}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5">
                {ICONS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = form.icon === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setForm({ ...form, icon: item.key })}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-linear-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white border-purple-400 shadow-lg shadow-purple-900/40 scale-105'
                          : 'bg-app-input text-app-muted border-app hover:text-app hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium text-center line-clamp-1">
                        {t(item.labelKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                {t('groups.groupDesc')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => {
                  setForm({ ...form, description: e.target.value });
                  if (errors.description) setErrors((prev) => ({ ...prev, description: null }));
                }}
                rows={3}
                maxLength={200}
                placeholder={t('groups.groupDesc')}
                className="w-full px-4 py-3 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none"
              />
              <div className="flex justify-between items-center mt-1 text-[11px]">
                {errors.description ? (
                  <span className="text-rose-500 font-medium">{errors.description}</span>
                ) : (
                  <span className="text-app-muted">Max 200 characters</span>
                )}
                <span className="text-app-muted">{form.description.trim().length}/200</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={creating || !form.name.trim() || form.name.trim().length < 3}
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-linear-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {creating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PlusCircle className="w-5 h-5" />
                )}
                <span>{t('groups.createBtn')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
            {t('groups.livePreview') || 'Live Preview'}
          </label>
          <div className="bg-app-card backdrop-blur border border-app rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-[320px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40">
                  {getGroupIcon(form.icon, 'w-7 h-7 text-white')}
                </div>
                <div className="text-xs px-3 py-1 rounded-full bg-purple-500/10 border border-purple-300/30 text-purple-600 dark:text-purple-300 font-medium">
                  1 {t('groups.membersCount')}
                </div>
              </div>

              <h3 className="text-xl font-bold text-app mb-2">
                {form.name.trim() || t('groups.groupName')}
              </h3>
              <p className="text-xs text-app-muted line-clamp-3 leading-relaxed">
                {form.description.trim() || t('groups.groupDesc')}
              </p>
            </div>

            <div className="pt-4 border-t border-app">
              <div className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-center bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 text-white opacity-90 cursor-default">
                {t('groups.enterGroup')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List of my groups */}
      <div>
        <h2 className="text-xl font-bold text-app mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span>{t('groups.myManagedGroups')} ({myGroups.length})</span>
        </h2>

        {loading ? (
          <Loading />
        ) : myGroups.length === 0 ? (
          <div className="p-6 bg-app-card border border-app rounded-2xl text-center text-sm text-app-muted">
            {t('groups.emptyJoined')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myGroups.map((g) => (
              <div
                key={g._id}
                onClick={() => navigate(`/groups/${g._id}`)}
                className="p-4 bg-app-card hover:border-purple-500/40 border border-app rounded-2xl flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-white">
                    {getGroupIcon(g.icon, 'w-5 h-5')}
                  </div>
                  <div>
                    <h3 className="font-bold text-app text-sm">{g.name}</h3>
                    <p className="text-xs text-app-muted">
                      {g.members_count || g.members?.length || 1} {t('groups.membersCount')}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-400 rtl:rotate-180" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupCreate;
