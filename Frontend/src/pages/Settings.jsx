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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../api/axios';
import { useCurrentUser } from '../context/CurrentUserContext';
import Avatar from '../components/Avatar';
import ConfirmModal from '../components/ConfirmModal';
import Loading from '../components/Loading';

const Settings = () => {
  const { signOut } = useClerk();
  const { currentUser, refreshUser, loading: userLoading } = useCurrentUser();

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

  const [appearanceForm, setAppearanceForm] = useState({
    theme: 'cosmic',
    language: 'en',
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

      setAppearanceForm({
        theme: s.appearance?.theme || 'cosmic',
        language: s.appearance?.language || 'en',
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
      toast.success('Profile updated successfully!', {
        icon: '✨',
        style: { background: '#1a1f4d', color: '#fff', border: '1px solid rgba(168,85,247,0.4)' },
      });
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN' || err.message?.includes('already taken')) {
        toast.error('Username is already taken. Please choose another one.');
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
      toast.success('Privacy settings saved!', {
        icon: '🛡️',
        style: { background: '#1a1f4d', color: '#fff', border: '1px solid rgba(168,85,247,0.4)' },
      });
    } catch (err) {
      toast.error(err.message || 'Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  // Appearance Form Submit
  const handleSaveAppearance = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      await usersApi.updateSettings({ appearance: appearanceForm });
      await refreshUser();
      toast.success('Appearance preferences updated!', {
        icon: '🎨',
        style: { background: '#1a1f4d', color: '#fff', border: '1px solid rgba(168,85,247,0.4)' },
      });
    } catch (err) {
      toast.error(err.message || 'Failed to save appearance');
    } finally {
      setSaving(false);
    }
  };

  // Notifications Form Submit
  const handleSaveNotifications = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      await usersApi.updateSettings({ notifications: notificationsForm });
      await refreshUser();
      toast.success('Notification preferences saved!', {
        icon: '🔔',
        style: { background: '#1a1f4d', color: '#fff', border: '1px solid rgba(168,85,247,0.4)' },
      });
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
      toast.success('User unblocked successfully');
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
      toast.success('Account deactivated. Goodbye for now!');
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
      toast.success('Account permanently deleted.');
      await signOut();
    } catch (err) {
      toast.error(err.message || 'Failed to delete account');
      setDangerLoading(false);
      setDeleteModalOpen(false);
    }
  };

  const tabs = [
    { key: 'general', label: 'General', icon: User },
    { key: 'privacy', label: 'Privacy', icon: Shield },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
  ];

  if (userLoading && !currentUser) {
    return <Loading />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-purple-500/20 to-indigo-500/20 border border-purple-500/30 mb-3 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          <Zap className="w-7 h-7 text-amber-400 animate-pulse" />
        </div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-purple-300 to-indigo-300">
          Settings
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Customize your experience, privacy, and preferences
        </p>

        {/* Pill Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 p-1.5 bg-[#182034]/80 backdrop-blur border border-purple-500/20 rounded-2xl shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  isActive
                    ? tab.danger
                      ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                      : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                    : tab.danger
                    ? 'text-rose-400 hover:bg-rose-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-[#182034]/90 backdrop-blur border border-purple-500/20 rounded-3xl p-6 md:p-8 shadow-[0_0_25px_rgba(131,58,180,0.3)]">
        {/* TAB 1: GENERAL */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveGeneral} className="space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              General Profile Information
            </h2>
            <p className="text-sm text-gray-400 -mt-3">
              Update your public display identity across FlowNet
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={generalForm.full_name}
                  onChange={(e) =>
                    setGeneralForm({ ...generalForm, full_name: e.target.value })
                  }
                  required
                  placeholder="Your full name"
                  className="w-full px-4 py-3 bg-[#0e1428] border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Username
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
                    className="w-full pl-9 pr-4 py-3 bg-[#0e1428] border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Short Bio
                </label>
                <textarea
                  value={generalForm.bio}
                  onChange={(e) => setGeneralForm({ ...generalForm, bio: e.target.value })}
                  rows={3}
                  maxLength={500}
                  placeholder="Share a short bio about yourself..."
                  className="w-full px-4 py-3 bg-[#0e1428] border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none"
                />
                <span className="text-xs text-gray-400 text-right block mt-1">
                  {generalForm.bio.length} / 500
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-purple-500/20">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: PRIVACY */}
        {activeTab === 'privacy' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-purple-400" />
                Privacy & Safety
              </h2>
              <p className="text-sm text-gray-400">
                Control who can view your posts, reach you, and see your location
              </p>
            </div>

            <div className="space-y-5">
              {/* Private account toggle */}
              <div className="flex items-center justify-between p-4 bg-[#0e1428]/60 border border-purple-500/20 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Private Account</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Only followers and approved connections can see your posts and media.
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
                    privacyForm.is_private_account ? 'bg-purple-600' : 'bg-gray-700'
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
              <div className="flex items-center justify-between p-4 bg-[#0e1428]/60 border border-purple-500/20 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Show Location</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Display your location publicly on your profile card and search results.
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
                    privacyForm.show_location ? 'bg-purple-600' : 'bg-gray-700'
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#0e1428]/60 border border-purple-500/20 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">Who Can Message You</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Restrict incoming direct messages to your accepted connections.
                    </p>
                  </div>
                </div>
                <select
                  value={privacyForm.who_can_message}
                  onChange={(e) =>
                    setPrivacyForm({ ...privacyForm, who_can_message: e.target.value })
                  }
                  className="px-4 py-2 bg-[#182034] border border-purple-500/30 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="everyone">Everyone</option>
                  <option value="connections">Connections Only</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-purple-500/20">
              <button
                type="button"
                onClick={handleSavePrivacy}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Save Privacy Settings
              </button>
            </div>

            {/* Blocked Users Section */}
            <div className="pt-6 border-t border-purple-500/20">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                <UserX className="w-5 h-5 text-rose-400" />
                Blocked Accounts
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Blocked users cannot message you, see your posts, or interact with your profile.
              </p>

              {loadingBlocked ? (
                <div className="py-6 flex justify-center">
                  <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center text-sm text-gray-400">
                  You have not blocked any users.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto no-scrollbar">
                  {blockedUsers.map((u) => (
                    <div
                      key={u._id}
                      className="flex items-center justify-between p-3 bg-[#0e1428]/80 border border-purple-500/20 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar src={u.profile_picture} name={u.full_name} size="sm" />
                        <div>
                          <div className="font-semibold text-white text-sm">{u.full_name}</div>
                          <div className="text-xs text-gray-400">@{u.username}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblock(u._id)}
                        disabled={unblockingId === u._id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 transition cursor-pointer"
                      >
                        {unblockingId === u._id ? 'Unblocking...' : 'Unblock'}
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
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                <Palette className="w-5 h-5 text-purple-400" />
                Appearance & Customization
              </h2>
              <p className="text-sm text-gray-400">
                Personalize how FlowNet looks and feels on your devices
              </p>
            </div>

            <div className="space-y-6">
              {/* Theme Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  Color Theme
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setAppearanceForm({ ...appearanceForm, theme: 'cosmic' })}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      appearanceForm.theme === 'cosmic'
                        ? 'bg-gradient-to-br from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.02]'
                        : 'bg-[#0e1428] border-purple-500/20 hover:border-purple-500/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm">🌌 Cosmic Galaxy</span>
                      {appearanceForm.theme === 'cosmic' && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-300">
                      Signature deep space gradient with violet glows and starlight ambiance.
                    </p>
                  </div>

                  <div
                    onClick={() => setAppearanceForm({ ...appearanceForm, theme: 'midnight' })}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      appearanceForm.theme === 'midnight'
                        ? 'bg-gradient-to-br from-[#0a0c16] via-[#11162b] to-[#182034] border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-[1.02]'
                        : 'bg-[#0e1428] border-purple-500/20 hover:border-purple-500/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm">🌑 Midnight Stealth</span>
                      {appearanceForm.theme === 'midnight' && (
                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-300">
                      Dark obsidian palette with subdued contrast for nighttime focus.
                    </p>
                  </div>
                </div>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  Interface Language
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setAppearanceForm({ ...appearanceForm, language: 'en' })}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      appearanceForm.language === 'en'
                        ? 'bg-[#182034] border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                        : 'bg-[#0e1428] border-purple-500/20 hover:border-purple-500/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">🇺🇸 English (Default)</span>
                      {appearanceForm.language === 'en' && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                  </div>

                  <div
                    onClick={() => setAppearanceForm({ ...appearanceForm, language: 'ar' })}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      appearanceForm.language === 'ar'
                        ? 'bg-[#182034] border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                        : 'bg-[#0e1428] border-purple-500/20 hover:border-purple-500/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">🇸🇦 العربية (Arabic)</span>
                      {appearanceForm.language === 'ar' && (
                        <Check className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-purple-500/20">
              <button
                type="button"
                onClick={handleSaveAppearance}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                <Bell className="w-5 h-5 text-purple-400" />
                Notification Preferences
              </h2>
              <p className="text-sm text-gray-400">
                Choose what alerts and activities ping you in real time
              </p>
            </div>

            <div className="space-y-4">
              {[
                { key: 'likes', label: 'Likes & Reactions', desc: 'Notify when someone likes your post or media' },
                { key: 'comments', label: 'Comments', desc: 'Notify when someone comments on your post' },
                { key: 'follows', label: 'New Followers', desc: 'Notify when someone begins following your journey' },
                { key: 'messages', label: 'Direct Messages', desc: 'Notify when you receive private 1:1 messages' },
                { key: 'requests', label: 'Connection Requests', desc: 'Notify when someone invites you to connect' },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 bg-[#0e1428]/60 border border-purple-500/20 rounded-2xl"
                >
                  <div>
                    <h3 className="font-semibold text-white text-sm">{item.label}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
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
                      notificationsForm[item.key] ? 'bg-purple-600' : 'bg-gray-700'
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

            <div className="flex justify-end pt-4 border-t border-purple-500/20">
              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Save Preferences
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
                Danger Zone
              </h2>
              <p className="text-sm text-gray-400">
                Irreversible actions regarding your FlowNet account and personal data
              </p>
            </div>

            <div className="space-y-4">
              {/* Deactivate Option */}
              <div className="p-5 border border-amber-500/30 bg-amber-500/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <PowerOff className="w-4 h-4 text-amber-400" />
                    Deactivate Account
                  </h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Temporarily hide your profile, posts, and comments from feeds and searches. You can reactivate anytime.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeactivateModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition shrink-0 cursor-pointer"
                >
                  Deactivate Account
                </button>
              </div>

              {/* Permanent Deletion Option */}
              <div className="p-5 border border-rose-500/40 bg-rose-500/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-rose-300 text-base flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    Permanently Delete Account
                  </h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Permanently delete your profile, posts, comments, stories, messages, and connections. This cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white shadow-lg shadow-rose-950/50 transition shrink-0 cursor-pointer"
                >
                  Delete Account
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
        title="Deactivate Account"
        message="Are you sure you want to deactivate your account? Your profile and content will be hidden until you log back in."
        confirmText="Deactivate"
        danger={true}
        isLoading={dangerLoading}
      />

      {/* Delete Permanently Modal with type-to-confirm */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Permanently Delete Account"
        message="This action is PERMANENT. All your posts, photos, messages, network connections, and account data will be completely wiped."
        confirmText="Permanently Delete"
        danger={true}
        isLoading={dangerLoading}
        requireInputText="DELETE"
      />
    </div>
  );
};

export default Settings;
