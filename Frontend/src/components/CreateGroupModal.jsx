import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Check, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { groupsApi } from '../api/axios';
import { getGroupIcon } from '../utils/groupIcons';
import { useLanguage } from '../context/LanguageContext';

const ICONS = [
  { key: 'users', labelKey: 'groups.iconUsers' },
  { key: 'rocket', labelKey: 'groups.iconRocket' },
  { key: 'globe', labelKey: 'groups.iconGlobe' },
  { key: 'sparkles', labelKey: 'groups.iconSparkles' },
  { key: 'star', labelKey: 'groups.iconStar' },
  { key: 'code', labelKey: 'groups.iconCode' },
  { key: 'book', labelKey: 'groups.iconBook' },
  { key: 'heart', labelKey: 'groups.iconHeart' },
];

const CreateGroupModal = ({ isOpen, onClose, onCreated }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('users');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 3) {
      errs.name = t('groups.nameMinMax') || 'Group name must be between 3 and 40 characters';
    } else if (trimmed.length > 40) {
      errs.name = t('groups.nameMinMax') || 'Group name must be between 3 and 40 characters';
    }
    if (description && description.trim().length > 200) {
      errs.description = t('groups.descMax') || 'Description cannot exceed 200 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || loading) return;

    try {
      setLoading(true);
      const res = await groupsApi.create({
        name: name.trim(),
        description: description.trim(),
        icon,
      });

      const newGroup = res.data || res;
      toast.success(t('groups.groupCreatedSuccess') || 'Group created successfully! 🚀');

      if (onCreated) {
        onCreated(newGroup);
      }
      onClose();
      navigate(`/groups/${newGroup._id}`);
    } catch (err) {
      const msg = err.message || t('common.error');
      toast.error(msg);
      if (err.status === 409) {
        setErrors({ name: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl bg-app-card border border-app rounded-3xl p-6 sm:p-8 shadow-2xl text-app relative my-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 end-5 p-1.5 text-app-muted hover:text-app rounded-full cursor-pointer transition-colors"
            aria-label={t('common.cancel')}
          >
            <X size={20} />
          </button>

          {/* Modal Title */}
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-700 via-fuchsia-600 to-pink-600 dark:from-pink-400 dark:via-purple-300 dark:to-indigo-300">
              {t('groups.createTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-app-muted mt-1">
              {t('groups.createSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Fields Column */}
            <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-4">
              {/* Name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-app">
                    {t('groups.groupName')} *
                  </label>
                  <span className="text-[11px] text-app-muted">
                    {name.length}/40
                  </span>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  placeholder={t('groups.groupName')}
                  maxLength={40}
                  className={`w-full px-4 py-2.5 rounded-xl bg-app-input border ${
                    errors.name ? 'border-rose-500' : 'border-app'
                  } text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition`}
                  required
                />
                {errors.name && (
                  <p className="text-rose-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-app">
                    {t('groups.groupDesc')}
                  </label>
                  <span className="text-[11px] text-app-muted">
                    {description.length}/200
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
                  }}
                  placeholder={t('groups.groupDesc')}
                  maxLength={200}
                  className={`w-full px-4 py-2.5 rounded-xl bg-app-input border ${
                    errors.description ? 'border-rose-500' : 'border-app'
                  } text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none`}
                />
                {errors.description && (
                  <p className="text-rose-500 text-xs mt-1">{errors.description}</p>
                )}
              </div>

              {/* Icon Picker Grid */}
              <div>
                <label className="block text-xs font-bold text-app mb-2">
                  {t('groups.groupIcon')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ICONS.map((item) => {
                    const isSelected = icon === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setIcon(item.key)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-linear-to-tr from-indigo-500 to-purple-600 text-white border-purple-400 shadow-md scale-105'
                            : 'bg-app-input text-app-muted border-app hover:text-app hover:bg-purple-500/10'
                        }`}
                      >
                        {getGroupIcon(item.key, 'w-5 h-5')}
                        <span className="text-[10px] font-medium truncate max-w-full">
                          {t(item.labelKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-app">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-app text-app hover:bg-purple-500/10 transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading || name.trim().length < 3}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-linear-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>{t('groups.createBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Live Preview Card Column */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="text-xs font-bold text-app-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-500" />
                <span>{t('groups.livePreview')}</span>
              </div>

              <div className="flex-1 bg-app-card border border-app rounded-2xl p-5 flex flex-col justify-between shadow-md">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md">
                      {getGroupIcon(icon, 'w-6 h-6 text-white')}
                    </div>
                    <div className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-300/30 text-purple-600 dark:text-purple-300 font-medium">
                      1 {t('groups.membersCount')}
                    </div>
                  </div>

                  <h4 className="font-bold text-app text-lg truncate">
                    {name.trim() || t('groups.groupName')}
                  </h4>
                  <p className="text-xs text-app-muted line-clamp-3 mt-1 leading-relaxed">
                    {description.trim() || 'FlowNet community group.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-app mt-4">
                  <div className="w-full py-2 px-3 rounded-xl bg-app-card border border-app text-center text-xs font-semibold text-app-muted flex items-center justify-center gap-1.5">
                    <span>{t('groups.enterGroup')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateGroupModal;
