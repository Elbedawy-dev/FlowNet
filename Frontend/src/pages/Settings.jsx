import { useState, useEffect } from 'react';
import { useClerk } from '@clerk/clerk-react';
import {
  Zap,
  User,
  Shield,
  Palette,
  Bell,
  AlertTriangle,
  Lock,
  MapPin,
  MessageSquare,
  Check,
  UserX,
  Trash2,
  PowerOff,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../api/axios';
import { useCurrentUser } from '../context/CurrentUserContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import Avatar from '../components/Avatar';
import ConfirmModal from '../components/ConfirmModal';
import Loading from '../components/Loading';

const Settings = () => {
  const { signOut } = useClerk();
  const { currentUser, refreshUser, loading: userLoading } = useCurrentUser();
  const { palette, mode, setPalette, setMode } = useTheme();
  const { lang, setLang, t } = useLanguage();

  const [activeTab, setActiveTab] = useState('general'); // general | privacy | appearance | notifications | danger

  // Form states
  const [generalForm, setGeneralForm] = useState({
    full_name: '',
    username: '',
    bio: '',
  });

  const [privacyForm, setPrivacyForm] = useState({
    is_private_account: false,
    show_location: true,
    who_can_message: 'everyone',
  });

  const [notificationsForm, setNotificationsForm] = useState({
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    requests: true,
  });

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  // Modals for Danger Zone
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [dangerLoading, setDangerLoading] = useState(false);

  // Sync initial user settings
  useEffect(() => {
    if (currentUser) {
      setGeneralForm({
        full_name: currentUser.full_name || '',
        username: currentUser.username || '',
        bio: currentUser.bio || '',
      });

      const s = currentUser.settings || {};
      setPrivacyForm({
        is_private_account: Boolean(s.privacy?.is_private_account),
        show_location: s.privacy?.show_location !== false,
        who_can_message: s.privacy?.who_can_message || 'everyone',
      });

      setNotificationsForm({
        likes: s.notifications?.likes !== false,
        comments: s.notifications?.comments !== false,
        follows: s.notifications?.follows !== false,
        messages: s.notifications?.messages !== false,
        requests: s.notifications?.requests !== false,
      });
    }
  }, [currentUser]);

  // Load blocked users when privacy tab is opened
  useEffect(() => {
    if (activeTab === 'privacy') {
      const loadBlocked = async () => {
        try {
          setLoadingBlocked(true);
          const res = await usersApi.getBlocked();
          setBlockedUsers(res || []);
        } catch (err) {
          console.warn('Failed to load blocked users:', err);
        } finally {
          setLoadingBlocked(false);
        }
      };
      loadBlocked();
    }
  }, [activeTab]);

  // General Form Submit
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await usersApi.updateMe({
        full_name: generalForm.full_name.trim(),
        username: generalForm.username.trim().toLowerCase(),
        bio: generalForm.bio.trim(),
      });
      await refreshUser();
      toast.success(t('profile.profileUpdated') || 'Profile updated successfully! ✨');
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN' || err.message?.includes('already taken')) {
        toast.error(t('profile.usernameTaken') || 'Username is already taken. Please choose another one.');
      } else {
        toast.error(err.message || 'Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  // Privacy Form Submit
  const handleSavePrivacy = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      await usersApi.updateSettings({ privacy: privacyForm });
      await refreshUser();
      toast.success(t('settings.privacy.saveButton') || 'Privacy settings saved!');
    } catch (err) {
      toast.error(err.message || 'Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  // Appearance actions (instant live preview + backend persist + toast)
  const handleSelectPalette = (newPalette) => {
    setPalette(newPalette, true);
    toast.success(t('settings.appearance.savedToast') || 'Appearance preferences updated! ✨');
  };

  const handleSelectMode = (newMode) => {
    setMode(newMode, true);
    toast.success(t('settings.appearance.savedToast') || 'Appearance preferences updated! ✨');
  };

  const handleSelectLanguage = (newLang) => {
    setLang(newLang, true);
    toast.success(t('settings.appearance.savedToast') || 'Language updated! ✨');
  };

  // Notifications Form Submit
  const handleSaveNotifications = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      await usersApi.updateSettings({ notifications: notificationsForm });
      await refreshUser();
      toast.success(t('settings.notificationsTab.saveButton') || 'Notification preferences saved!');
    } catch (err) {
      toast.error(err.message || 'Failed to save notifications');
    } finally {
      setSaving(false);
    }
  };

  // Unblock user
  const handleUnblock = async (userId) => {
    try {
      setUnblockingId(userId);
      await usersApi.unblock(userId);
      setBlockedUsers((prev) => prev.filter((u) => u._id !== userId));
      toast.success(t('settings.privacy.unblock') || 'User unblocked successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  // Deactivate Account
  const handleDeactivate = async () => {
    try {
      setDangerLoading(true);
      await usersApi.deactivate();
      toast.success(t('settings.danger.deactivateSuccess') || 'Account deactivated.');
      await signOut();
    } catch (err) {
      toast.error(err.message || 'Failed to deactivate account');
      setDangerLoading(false);
      setDeactivateModalOpen(false);
    }
  };

  // Delete Account Permanently
  const handleDeleteAccount = async () => {
    try {
      setDangerLoading(true);
      await usersApi.deleteAccount();
      toast.success(t('settings.danger.deleteSuccess') || 'Account permanently deleted.');
      await signOut();
    } catch (err) {
      toast.error(err.message || 'Failed to delete account');
      setDangerLoading(false);
      setDeleteModalOpen(false);
    }
  };

  const tabs = [
    { key: 'general', label: t('settings.tabs.general') || 'General', icon: User },
    { key: 'privacy', label: t('settings.tabs.privacy') || 'Privacy', icon: Shield },
    { key: 'appearance', label: t('settings.tabs.appearance') || 'Appearance', icon: Palette },
    { key: 'notifications', label: t('settings.tabs.notifications') || 'Notifications', icon: Bell },
    { key: 'danger', label: t('settings.tabs.danger') || 'Danger Zone', icon: AlertTriangle, danger: true },
  ];

  if (userLoading && !currentUser) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-app-page text-app">
        <Loading />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 bg-app-page text-app min-h-full pb-32">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-linear-to-tr from-amber-500/20 via-purple-500/20 to-indigo-500/20 border border-app mb-3 shadow-app-glow">
          <Zap className="w-7 h-7 text-amber-400 animate-pulse" />
        </div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-purple-300 to-indigo-300">
          {t('settings.title') || 'Settings'}
        </h1>
        <p className="text-app-muted text-sm mt-1">
          {t('settings.subtitle') || 'Customize your experience, privacy, and preferences'}
        </p>

        {/* Pill Tabs: Shrink-to-fit Container */}
        <div id="settings-tabs-container" className="inline-flex w-fit max-w-full mx-auto gap-1 p-1.5 rounded-2xl bg-app-card backdrop-blur border border-app shadow-inner overflow-x-auto no-scrollbar mt-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? tab.danger
                      ? 'bg-linear-to-r from-red-600 to-rose-700 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                      : 'bg-linear-to-r from-indigo-500 via-purple-600 to-pink-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                    : tab.danger
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                    : 'text-app-muted hover:text-app hover:bg-purple-500/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-app-card backdrop-blur border border-app rounded-3xl p-6 md:p-8 shadow-app-glow">
        {/* TAB 1: GENERAL */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveGeneral} className="space-y-6">
            <h2 className="text-xl font-bold text-app flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              {t('settings.general.title') || 'General Profile Information'}
            </h2>
            <p className="text-sm text-app-muted -mt-3">
              {t('settings.general.subtitle') || 'Update your public display identity across FlowNet'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                  {t('settings.general.fullName') || 'Full Name'}
                </label>
                <input
                  type="text"
                  value={generalForm.full_name}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, full_name: e.target.value })
                  }
                  required
                  placeholder={t('settings.general.fullName') || 'Your full name'}
                  className="w-full px-4 py-3 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                  {t('settings.general.username') || 'Username'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-purple-400 font-medium">@</span>
                  <input
                    type="text"
                    value={generalForm.username}
                    onChange={(e) =>
                      setGeneralForm({
                        ...generalForm,
                        username: e.target.value.toLowerCase().trim(),
                      })
                    }
                    required
                    placeholder="username"
                    className="w-full pl-9 pr-4 py-3 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                  {t('settings.general.bio') || 'Short Bio'}
                </label>
                <textarea
                  value={generalForm.bio}
                  onChange={(e) => setGeneralForm({ ...generalForm, bio: e.target.value })}
                  rows={3}
                  maxLength={500}
                  placeholder={t('profile.bioPlaceholder') || 'Share a short bio about yourself...'}
                  className="w-full px-4 py-3 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition resize-none"
                />
                <span className="text-xs text-app-muted text-right block mt-1">
                  {generalForm.bio.length} / 500
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-app">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold bg-linear-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {t('common.save') || 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: PRIVACY */}
        {activeTab === 'privacy' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-app flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-purple-400" />
                {t('settings.privacy.title') || 'Privacy & Safety'}
              </h2>
              <p className="text-sm text-app-muted">
                {t('settings.privacy.subtitle') || 'Control who can view your posts, reach you, and see your location'}
              </p>
            </div>

            <div className="space-y-5">
              {/* Private account toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-app rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-app text-sm">
                      {t('settings.privacy.privateAccount') || 'Private Account'}
                    </h3>
                    <p className="text-xs text-app-muted mt-0.5">
                      {t('settings.privacy.privateAccountDesc') ||
                        'Only followers and approved connections can see your posts and media.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPrivacyForm({
                      ...privacyForm,
                      is_private_account: !privacyForm.is_private_account,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    privacyForm.is_private_account ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 bg-white rounded-full transition-transform absolute top-1 ${
                      privacyForm.is_private_account ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Show location toggle */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-app rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-app text-sm">
                      {t('settings.privacy.showLocation') || 'Show Location'}
                    </h3>
                    <p className="text-xs text-app-muted mt-0.5">
                      {t('settings.privacy.showLocationDesc') ||
                        'Display your location publicly on your profile card and search results.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPrivacyForm({
                      ...privacyForm,
                      show_location: !privacyForm.show_location,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    privacyForm.show_location ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 bg-white rounded-full transition-transform absolute top-1 ${
                      privacyForm.show_location ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Who can message */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/5 border border-app rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-app text-sm">
                      {t('settings.privacy.whoCanMessage') || 'Who Can Message You'}
                    </h3>
                    <p className="text-xs text-app-muted mt-0.5">
                      {t('settings.privacy.whoCanMessageDesc') ||
                        'Restrict incoming direct messages to your accepted connections.'}
                    </p>
                  </div>
                </div>
                <select
                  value={privacyForm.who_can_message}
                  onChange={(e) =>
                    setPrivacyForm({ ...privacyForm, who_can_message: e.target.value })
                  }
                  className="px-4 py-2 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                >
                  <option value="everyone">{t('settings.privacy.everyone') || 'Everyone'}</option>
                  <option value="connections">
                    {t('settings.privacy.connectionsOnly') || 'Connections Only'}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-app">
              <button
                type="button"
                onClick={handleSavePrivacy}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold bg-linear-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {t('settings.privacy.saveButton') || 'Save Privacy Settings'}
              </button>
            </div>

            {/* Blocked Users Section */}
            <div className="pt-6 border-t border-app">
              <h3 className="text-lg font-bold text-app flex items-center gap-2 mb-3">
                <UserX className="w-5 h-5 text-rose-400" />
                {t('settings.privacy.blockedTitle') || 'Blocked Accounts'}
              </h3>
              <p className="text-xs text-app-muted mb-4">
                {t('settings.privacy.blockedDesc') ||
                  'Blocked users cannot message you, see your posts, or interact with your profile.'}
              </p>

              {loadingBlocked ? (
                <div className="py-6 flex justify-center">
                  <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="p-4 rounded-xl bg-purple-500/5 border border-app text-center text-sm text-app-muted">
                  {t('settings.privacy.noBlocked') || 'You have not blocked any users.'}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto no-scrollbar">
                  {blockedUsers.map((u) => (
                    <div
                      key={u._id}
                      className="flex items-center justify-between p-3 bg-white/5 border border-app rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={u.profile_picture} name={u.full_name} size="sm" />
                        <div>
                          <div className="font-semibold text-app text-sm">{u.full_name}</div>
                          <div className="text-xs text-app-muted">@{u.username}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblock(u._id)}
                        disabled={unblockingId === u._id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 transition cursor-pointer"
                      >
                        {unblockingId === u._id ? 'Unblocking...' : (t('settings.privacy.unblock') || 'Unblock')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: APPEARANCE */}
        {activeTab === 'appearance' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-app flex items-center gap-2 mb-1">
                <Palette className="w-5 h-5 text-purple-400" />
                {t('settings.appearance.title') || 'Appearance & Customization'}
              </h2>
              <p className="text-sm text-app-muted">
                {t('settings.appearance.subtitle') ||
                  'Personalize how FlowNet looks and feels on your devices'}
              </p>
            </div>

            <div className="space-y-7">
              {/* SECTION 1: Color Palette */}
              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-3">
                  {t('settings.appearance.paletteTitle') || 'Color Palette'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cosmic Galaxy */}
                  <div
                    onClick={() => handleSelectPalette('cosmic')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      palette === 'cosmic'
                        ? 'bg-linear-to-br from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] text-white border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)] scale-[1.02]'
                        : 'bg-white/5 border-app hover:border-purple-400/50 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">
                        {t('settings.appearance.cosmicTitle') || '🌌 Cosmic Galaxy'}
                      </span>
                      {palette === 'cosmic' && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs opacity-85 leading-relaxed">
                      {t('settings.appearance.cosmicDesc') ||
                        'Signature deep space gradient with violet glows and starlight ambiance.'}
                    </p>
                  </div>

                  {/* Midnight Stealth */}
                  <div
                    onClick={() => handleSelectPalette('midnight')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      palette === 'midnight'
                        ? 'bg-linear-to-br from-[#0b1120] via-[#111827] to-[#1e293b] text-white border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-[1.02]'
                        : 'bg-white/5 border-app hover:border-indigo-400/50 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">
                        {t('settings.appearance.midnightTitle') || '🌑 Midnight Stealth'}
                      </span>
                      {palette === 'midnight' && (
                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs opacity-85 leading-relaxed">
                      {t('settings.appearance.midnightDesc') ||
                        'Dark obsidian palette with subdued contrast for nighttime focus.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Display Mode (Light / Dark / System) */}
              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-3">
                  {t('settings.appearance.modeTitle') || 'Display Mode'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Light */}
                  <div
                    onClick={() => handleSelectMode('light')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                      mode === 'light'
                        ? 'bg-white text-slate-900 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-[1.02]'
                        : 'bg-white/5 border-app hover:border-purple-400/40 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sun className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold text-sm">
                        {t('settings.appearance.modeLight') || 'Light'}
                      </span>
                    </div>
                    {mode === 'light' && (
                      <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Dark */}
                  <div
                    onClick={() => handleSelectMode('dark')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                      mode === 'dark'
                        ? 'bg-purple-950/60 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-[1.02]'
                        : 'bg-white/5 border-app hover:border-purple-400/40 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Moon className="w-5 h-5 text-indigo-400" />
                      <span className="font-semibold text-sm">
                        {t('settings.appearance.modeDark') || 'Dark'}
                      </span>
                    </div>
                    {mode === 'dark' && (
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* System */}
                  <div
                    onClick={() => handleSelectMode('system')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between ${
                      mode === 'system'
                        ? 'bg-purple-950/60 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-[1.02]'
                        : 'bg-white/5 border-app hover:border-purple-400/40 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Monitor className="w-5 h-5 text-teal-400" />
                      <span className="font-semibold text-sm">
                        {t('settings.appearance.modeSystem') || 'System'}
                      </span>
                    </div>
                    {mode === 'system' && (
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: Interface Language */}
              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-3">
                  {t('settings.appearance.langTitle') || 'Interface Language'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* English */}
                  <div
                    onClick={() => handleSelectLanguage('en')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      lang === 'en'
                        ? 'bg-white/10 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-[1.02]'
                        : 'bg-white/5 border-app hover:border-purple-400/40 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {t('settings.appearance.langEn') || '🇺🇸 English (Default)'}
                      </span>
                      {lang === 'en' && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arabic */}
                  <div
                    onClick={() => handleSelectLanguage('ar')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      lang === 'ar'
                        ? 'bg-white/10 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-[1.02]'
                        : 'bg-white/5 border-app hover:border-purple-400/40 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        {t('settings.appearance.langAr') || '🇸🇦 العربية (Arabic)'}
                      </span>
                      {lang === 'ar' && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-app flex items-center gap-2 mb-1">
                <Bell className="w-5 h-5 text-purple-400" />
                {t('settings.notificationsTab.title') || 'Notification Preferences'}
              </h2>
              <p className="text-sm text-app-muted">
                {t('settings.notificationsTab.subtitle') ||
                  'Choose what alerts and activities ping you in real time'}
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  key: 'likes',
                  label: t('settings.notificationsTab.likes') || 'Likes & Reactions',
                  desc: t('settings.notificationsTab.likesDesc') || 'Notify when someone likes your post or media',
                },
                {
                  key: 'comments',
                  label: t('settings.notificationsTab.comments') || 'Comments',
                  desc: t('settings.notificationsTab.commentsDesc') || 'Notify when someone comments on your post',
                },
                {
                  key: 'follows',
                  label: t('settings.notificationsTab.follows') || 'New Followers',
                  desc: t('settings.notificationsTab.followsDesc') || 'Notify when someone begins following your journey',
                },
                {
                  key: 'messages',
                  label: t('settings.notificationsTab.messages') || 'Direct Messages',
                  desc: t('settings.notificationsTab.messagesDesc') || 'Notify when you receive private 1:1 messages',
                },
                {
                  key: 'requests',
                  label: t('settings.notificationsTab.requests') || 'Connection Requests',
                  desc: t('settings.notificationsTab.requestsDesc') || 'Notify when someone invites you to connect',
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 bg-white/5 border border-app rounded-2xl"
                >
                  <div>
                    <h3 className="font-semibold text-app text-sm">{item.label}</h3>
                    <p className="text-xs text-app-muted mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNotificationsForm({
                        ...notificationsForm,
                        [item.key]: !notificationsForm[item.key],
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      notificationsForm[item.key] ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 bg-white rounded-full transition-transform absolute top-1 ${
                        notificationsForm[item.key] ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 border-t border-app">
              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold bg-linear-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {t('settings.notificationsTab.saveButton') || 'Save Preferences'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: DANGER ZONE */}
        {activeTab === 'danger' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-rose-400 flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                {t('settings.danger.title') || 'Danger Zone'}
              </h2>
              <p className="text-sm text-app-muted">
                {t('settings.danger.subtitle') ||
                  'Irreversible actions regarding your FlowNet account and personal data'}
              </p>
            </div>

            <div className="space-y-4">
              {/* Deactivate Option */}
              <div className="p-5 border border-amber-500/30 bg-amber-500/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-app text-base flex items-center gap-2">
                    <PowerOff className="w-4 h-4 text-amber-400" />
                    {t('settings.danger.deactivateTitle') || 'Deactivate Account'}
                  </h3>
                  <p className="text-xs text-app-muted mt-1">
                    {t('settings.danger.deactivateDesc') ||
                      'Temporarily hide your profile, posts, and comments from feeds and searches. You can reactivate anytime.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeactivateModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition shrink-0 cursor-pointer"
                >
                  {t('settings.danger.deactivateTitle') || 'Deactivate Account'}
                </button>
              </div>

              {/* Permanent Deletion Option */}
              <div className="p-5 border border-rose-500/40 bg-rose-500/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-rose-400 text-base flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    {t('settings.danger.deleteTitle') || 'Permanently Delete Account'}
                  </h3>
                  <p className="text-xs text-app-muted mt-1">
                    {t('settings.danger.deleteDesc') ||
                      'Permanently delete your profile, posts, comments, stories, messages, and connections. This cannot be undone.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-linear-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white shadow-lg shadow-rose-950/50 transition shrink-0 cursor-pointer"
                >
                  {t('settings.danger.deleteTitle') || 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deactivate Confirm Modal */}
      <ConfirmModal
        isOpen={deactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        onConfirm={handleDeactivate}
        title={t('settings.danger.deactivateTitle') || 'Deactivate Account'}
        message={
          t('settings.danger.deactivateConfirm') ||
          'Are you sure you want to deactivate your account? Your profile and content will be hidden until you log back in.'
        }
        confirmText={t('common.confirm') || 'Deactivate'}
        danger={true}
        isLoading={dangerLoading}
      />

      {/* Delete Permanently Modal with type-to-confirm */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title={t('settings.danger.deleteTitle') || 'Permanently Delete Account'}
        message={
          t('settings.danger.deleteConfirm') ||
          'This action is PERMANENT. All your posts, photos, messages, network connections, and account data will be completely wiped.'
        }
        confirmText={t('common.delete') || 'Permanently Delete'}
        danger={true}
        isLoading={dangerLoading}
        requireInputText="DELETE"
      />
    </div>
  );
};

export default Settings;
