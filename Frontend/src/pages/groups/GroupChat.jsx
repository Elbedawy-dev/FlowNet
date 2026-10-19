import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Users,
  Check,
  X,
  UserCheck,
  MessageCircle,
  MoreVertical,
  Edit3,
  Trash2,
  LogOut,
  UserMinus,
  Crown,
  Shield,
  PlusCircle,
  Code,
  BookOpen,
  Heart,
  Rocket,
  Globe,
  Sparkles,
  Star,
} from 'lucide-react';
import moment from 'moment';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useSocket } from '../../context/SocketContext';
import { useLanguage } from '../../context/LanguageContext';
import Avatar from '../../components/Avatar';
import Loading from '../../components/Loading';
import { getGroupIcon } from '../../utils/groupIcons';

const GROUP_ICONS = [
  { key: 'users', labelKey: 'groups.iconUsers', icon: Users },
  { key: 'rocket', labelKey: 'groups.iconRocket', icon: Rocket },
  { key: 'globe', labelKey: 'groups.iconGlobe', icon: Globe },
  { key: 'sparkles', labelKey: 'groups.iconSparkles', icon: Sparkles },
  { key: 'star', labelKey: 'groups.iconStar', icon: Star },
  { key: 'code', labelKey: 'groups.iconCode', icon: Code },
  { key: 'book', labelKey: 'groups.iconBook', icon: BookOpen },
  { key: 'heart', labelKey: 'groups.iconHeart', icon: Heart },
];

const GroupChat = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { socket } = useSocket();
  const { t } = useLanguage();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);

  // Menu and Modals state
  const [showMenu, setShowMenu] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Requests state
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({ name: '', description: '', icon: 'users' });
  const [editingGroup, setEditingGroup] = useState(false);
  const [editErrors, setEditErrors] = useState({});

  // Action loading states
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showMenu]);

  // 1. Fetch group details and messages
  const loadGroupAndChat = useCallback(async () => {
    try {
      setLoading(true);
      const groupData = await groupsApi.getById(groupId);

      if (!groupData.is_member) {
        toast.error(t('groups.mustBeMember'));
        navigate('/groups/joined');
        return;
      }

      setGroup(groupData);
      setEditForm({
        name: groupData.name || '',
        description: groupData.description || '',
        icon: groupData.icon || 'users',
      });

      const chatHistory = await groupsApi.getMessages(groupId);
      setMessages(chatHistory || []);
      setTimeout(() => scrollToBottom(false), 100);
    } catch (err) {
      console.warn('Failed to load group chat:', err);
      if (err.status === 403 || err.status === 404) {
        toast.error(t('groups.mustBeMember'));
        navigate('/groups/joined');
      } else {
        toast.error(err.message || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate, t]);

  useEffect(() => {
    loadGroupAndChat();
  }, [loadGroupAndChat]);

  // 2. Fetch pending requests if owner or admin
  const fetchPendingRequests = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoadingRequests(true);
      const reqs = await groupsApi.getRequests(groupId);
      setPendingRequests(reqs || []);
    } catch (err) {
      console.warn('Failed to load requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (group?.is_owner || group?.is_admin) {
      fetchPendingRequests();
    }
  }, [group?.is_owner, group?.is_admin, fetchPendingRequests]);

  // 3. Socket: Join group room and listen for real-time events
  useEffect(() => {
    if (!socket || !groupId) return;

    socket.emit('group:join', { groupId });

    const handleNewMessage = (newMsg) => {
      if (newMsg.group === groupId || newMsg.group?._id === groupId) {
        setMessages((prev) => {
          // Avoid duplicate messages if already present
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    const handleGroupUpdated = (updated) => {
      if (updated._id === groupId) {
        setGroup((prev) => (prev ? { ...prev, ...updated } : prev));
        toast.success(t('groups.groupUpdatedSuccess'));
      }
    };

    const handleGroupDeleted = (data) => {
      if (data.groupId === groupId) {
        toast.error(t('groups.groupDeletedSuccess'));
        navigate('/groups/joined');
      }
    };

    const handleMemberJoined = (data) => {
      if (data.groupId === groupId) {
        setGroup((prev) =>
          prev
            ? {
                ...prev,
                members_count: data.membersCount || (prev.members_count || 0) + 1,
              }
            : prev
        );
      }
    };

    const handleMemberLeft = (data) => {
      if (data.groupId === groupId) {
        if (data.userId === currentUser?._id) {
          navigate('/groups/joined');
        } else {
          setGroup((prev) =>
            prev
              ? {
                  ...prev,
                  members_count: Math.max(1, (prev.members_count || 1) - 1),
                  members_list: (prev.members_list || []).filter((m) => m._id !== data.userId),
                }
              : prev
          );
        }
      }
    };

    socket.on('group:message', handleNewMessage);
    socket.on('group:updated', handleGroupUpdated);
    socket.on('group:deleted', handleGroupDeleted);
    socket.on('group:member_joined', handleMemberJoined);
    socket.on('group:member_left', handleMemberLeft);

    return () => {
      socket.off('group:message', handleNewMessage);
      socket.off('group:updated', handleGroupUpdated);
      socket.off('group:deleted', handleGroupDeleted);
      socket.off('group:member_joined', handleMemberJoined);
      socket.off('group:member_left', handleMemberLeft);
      socket.emit('group:leave', { groupId });
    };
  }, [socket, groupId, navigate, currentUser?._id, t]);

  // Request actions
  const handleAcceptRequest = async (userId) => {
    try {
      await groupsApi.acceptRequest(groupId, userId);
      setPendingRequests((prev) => prev.filter((u) => u._id !== userId));
      setGroup((prev) => ({
        ...prev,
        members_count: (prev.members_count || 0) + 1,
      }));
      toast.success(t('groups.acceptedSuccess'));
      loadGroupAndChat();
    } catch (err) {
      toast.error(err.message || t('common.error'));
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      await groupsApi.rejectRequest(groupId, userId);
      setPendingRequests((prev) => prev.filter((u) => u._id !== userId));
      toast.success(t('groups.rejectedSuccess'));
    } catch (err) {
      toast.error(err.message || t('common.error'));
    }
  };

  // Remove member action
  const handleRemoveMember = async (memberId) => {
    try {
      setRemovingMemberId(memberId);
      await groupsApi.removeMember(groupId, memberId);
      setGroup((prev) => ({
        ...prev,
        members_count: Math.max(1, (prev.members_count || 1) - 1),
        members_list: (prev.members_list || []).filter((m) => m._id !== memberId),
      }));
      toast.success(t('groups.memberRemovedSuccess'));
    } catch (err) {
      toast.error(err.message || t('common.error'));
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Edit group
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = editForm.name.trim();
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 40) {
      setEditErrors({ name: t('groups.nameMinMax') || 'Name must be 3-40 characters' });
      return;
    }
    if (editForm.description && editForm.description.trim().length > 200) {
      setEditErrors({ description: t('groups.descMax') || 'Description must be <= 200 chars' });
      return;
    }

    try {
      setEditingGroup(true);
      const updated = await groupsApi.update(groupId, {
        name: trimmedName,
        description: editForm.description.trim(),
        icon: editForm.icon,
      });

      const updatedData = updated.data || updated;
      setGroup((prev) => ({ ...prev, ...updatedData }));
      toast.success(t('groups.groupUpdatedSuccess'));
      setShowEditModal(false);
      setEditErrors({});
    } catch (err) {
      toast.error(err.message || t('common.error'));
    } finally {
      setEditingGroup(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async () => {
    try {
      setDeletingGroup(true);
      await groupsApi.delete(groupId);
      toast.success(t('groups.groupDeletedSuccess'));
      navigate('/groups/joined');
    } catch (err) {
      toast.error(err.message || t('common.error'));
    } finally {
      setDeletingGroup(false);
      setShowDeleteModal(false);
    }
  };

  // Leave group
  const handleLeaveGroup = async () => {
    try {
      setLeavingGroup(true);
      await groupsApi.leave(groupId);
      toast.success(t('groups.groupLeftSuccess'));
      navigate('/groups/joined');
    } catch (err) {
      toast.error(err.message || t('common.error'));
    } finally {
      setLeavingGroup(false);
      setShowLeaveModal(false);
    }
  };

  // Handle Image Selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size is too large (max 10MB)');
        return;
      }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
  };

  // Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && !mediaFile) return;

    try {
      setSending(true);

      const formData = new FormData();
      if (trimmed) formData.append('text', trimmed);
      if (mediaFile) formData.append('image', mediaFile);

      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticMsg = {
        _id: tempId,
        group: groupId,
        sender: {
          _id: currentUser?._id,
          full_name: currentUser?.full_name || 'Me',
          username: currentUser?.username || 'me',
          profile_picture: currentUser?.profile_picture,
        },
        text: trimmed,
        media_url: mediaPreview,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setText('');
      handleRemoveMedia();
      setTimeout(() => scrollToBottom(true), 50);

      const serverMsg = await groupsApi.sendMessage(groupId, formData);

      // Replace optimistic message
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? (serverMsg.data || serverMsg) : m))
      );
    } catch (err) {
      toast.error(err.message || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  const isOwner = Boolean(group?.is_owner);
  const isOwnerOrAdmin = Boolean(group?.is_owner || group?.is_admin);

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 h-[calc(100vh-5rem)] flex flex-col">
      {/* Top Bar (Purple Gradient Header) */}
      <div className="bg-app-card/90 backdrop-blur border border-app rounded-2xl p-3 sm:p-4 mb-3 shadow-[0_0_25px_rgba(168,85,247,0.2)] flex items-center justify-between shrink-0 relative">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/groups/joined')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-app-muted hover:text-app transition cursor-pointer"
            title={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-md">
            {getGroupIcon(group?.icon, 'w-5 h-5')}
          </div>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-app flex items-center gap-2">
              <span className="line-clamp-1">{group?.name || t('groups.chatTitle')}</span>
              {isOwner && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-semibold flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> {t('groups.ownerBadge')}
                </span>
              )}
            </h1>
            <button
              type="button"
              onClick={() => setShowMembersModal(true)}
              className="text-xs text-app-muted hover:text-app transition flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>{group?.members_count || 0} {t('groups.membersCount')}</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Pending Requests Badge for Owner/Admin */}
          {isOwnerOrAdmin && pendingRequests.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRequestsModal(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 border border-pink-500/30 transition cursor-pointer flex items-center gap-1.5"
              title={t('groups.pendingRequests')}
            >
              <UserCheck className="w-4 h-4 text-pink-500" />
              <span className="font-bold">{pendingRequests.length}</span>
            </button>
          )}

          {/* Menu Dropdown Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-2 rounded-xl bg-app-input border border-app hover:border-purple-400 text-app hover:bg-white/5 transition cursor-pointer"
              aria-label="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute end-0 top-full mt-2 w-56 bg-app-card border border-app rounded-2xl shadow-2xl p-1.5 z-40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                {/* Members list */}
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    setShowMembersModal(true);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-app hover:bg-white/5 flex items-center gap-2.5 transition text-start cursor-pointer"
                >
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>{t('groups.membersList')}</span>
                </button>

                {/* Owner/Admin: Pending requests */}
                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowRequestsModal(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-app hover:bg-white/5 flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-pink-400" />
                      <span>{t('groups.pendingRequests')}</span>
                    </div>
                    {pendingRequests.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">
                        {pendingRequests.length}
                      </span>
                    )}
                  </button>
                )}

                {/* Owner/Admin: Edit group */}
                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowEditModal(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-app hover:bg-white/5 flex items-center gap-2.5 transition text-start cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4 text-indigo-400" />
                    <span>{t('groups.editGroup')}</span>
                  </button>
                )}

                <div className="my-1 border-t border-app" />

                {/* Owner: Delete group */}
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteModal(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition text-start cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('groups.deleteGroup')}</span>
                  </button>
                ) : (
                  /* Member: Leave group */
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowLeaveModal(true);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition text-start cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 rtl:rotate-180" />
                    <span>{t('groups.leaveGroup')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-app-card/40 backdrop-blur border border-app rounded-2xl space-y-4 shadow-inner no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-app-muted">
            <MessageCircle className="w-12 h-12 text-purple-400/40 mb-3 animate-pulse" />
            <h3 className="text-lg font-bold text-app mb-1">
              {group?.name}! 🚀
            </h3>
            <p className="text-xs text-app-muted max-w-sm">
              {t('messages.typeMessage')}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;
            const isMe = String(senderId) === String(currentUser?._id);
            const senderName = isMe ? (currentUser?.full_name || 'Me') : msg.sender?.full_name || 'Member';

            return (
              <div
                key={msg._id}
                className={`flex items-end gap-2.5 ${
                  isMe ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Avatar */}
                {!isMe && (
                  <Avatar
                    src={msg.sender?.profile_picture}
                    name={senderName}
                    size="sm"
                    className="shrink-0 mb-1"
                  />
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[78%] sm:max-w-[65%] rounded-2xl p-3 shadow-md ${
                    isMe
                      ? 'bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-ee-none'
                      : 'bg-app-card border border-app text-app rounded-es-none'
                  }`}
                >
                  {/* Sender Name */}
                  {!isMe && (
                    <div className="text-xs font-bold text-pink-600 dark:text-pink-400 mb-1">
                      {senderName}
                    </div>
                  )}

                  {/* Media / Image */}
                  {msg.media_url && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/30 max-h-72">
                      <img
                        src={msg.media_url}
                        alt="Shared media"
                        className="w-full h-auto object-cover max-h-72 hover:scale-105 transition cursor-pointer"
                        onClick={() => window.open(msg.media_url, '_blank')}
                      />
                    </div>
                  )}

                  {/* Text */}
                  {msg.text && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.text}
                    </p>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`text-[10px] mt-1 ${
                      isMe ? 'text-white/80 text-end' : 'text-app-muted text-start'
                    }`}
                  >
                    {moment(msg.createdAt).format('hh:mm A')}
                  </div>
                </div>

                {isMe && (
                  <Avatar
                    src={currentUser?.profile_picture}
                    name={senderName}
                    size="sm"
                    className="shrink-0 mb-1"
                  />
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Media Preview before sending */}
      {mediaPreview && (
        <div className="mt-2 p-2 bg-app-card border border-app rounded-xl flex items-center justify-between w-fit gap-3">
          <img
            src={mediaPreview}
            alt="Preview"
            className="w-12 h-12 object-cover rounded-lg border border-purple-500/30"
          />
          <button
            type="button"
            onClick={handleRemoveMedia}
            className="p-1 rounded-full bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Floating Message Input Bar */}
      <form
        onSubmit={handleSendMessage}
        className="mt-3 flex items-center gap-2 bg-app-card/90 backdrop-blur border border-app rounded-2xl p-2 shadow-lg"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl text-app-muted hover:text-app hover:bg-white/5 transition cursor-pointer shrink-0"
          title="Attach image"
        >
          <ImageIcon className="w-5 h-5 text-purple-400" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('groups.typeMessage')}
          dir="auto"
          className="flex-1 bg-transparent px-3 py-2 text-app placeholder-app-muted text-sm focus:outline-none"
        />

        <button
          type="submit"
          disabled={sending || (!text.trim() && !mediaFile)}
          className="px-5 py-2.5 rounded-xl font-semibold bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm shadow-md transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4 rtl:rotate-180" />
              <span>{t('common.send')}</span>
            </>
          )}
        </button>
      </form>

      {/* -------------------- MODALS -------------------- */}

      {/* 1. Members List Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-app-card border border-app rounded-3xl p-6 shadow-2xl text-app relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-app">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span>{t('groups.membersList')} ({group?.members_count || group?.members_list?.length || 0})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="p-1 rounded-lg text-app-muted hover:text-app"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto no-scrollbar">
              {(group?.members_list || []).map((m) => {
                const isMemberOwner = String(group?.owner?._id || group?.owner) === String(m._id);
                const isMemberAdmin = (group?.admins || []).map(String).includes(String(m._id));
                const canRemove =
                  isOwnerOrAdmin &&
                  !isMemberOwner &&
                  String(m._id) !== String(currentUser?._id);

                return (
                  <div
                    key={m._id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-app-input border border-app"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={m.profile_picture} name={m.full_name} size="md" />
                      <div>
                        <div className="text-sm font-bold text-app flex items-center gap-1.5">
                          <span>{m.full_name}</span>
                          {isMemberOwner ? (
                            <span className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 font-semibold">
                              <Crown className="w-2.5 h-2.5" /> {t('groups.ownerBadge')}
                            </span>
                          ) : isMemberAdmin ? (
                            <span className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-semibold">
                              <Shield className="w-2.5 h-2.5" /> {t('groups.adminBadge')}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                              {t('groups.memberBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-app-muted">@{m.username}</div>
                      </div>
                    </div>

                    {canRemove && (
                      <button
                        type="button"
                        disabled={removingMemberId === m._id}
                        onClick={() => handleRemoveMember(m._id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition cursor-pointer"
                        title="Remove member"
                      >
                        {removingMemberId === m._id ? (
                          <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserMinus className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. Pending Requests Modal */}
      {showRequestsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-app-card border border-app rounded-3xl p-6 shadow-2xl text-app relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-app">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-pink-400" />
                <span>{t('groups.pendingRequests')} ({pendingRequests.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRequestsModal(false)}
                className="p-1 rounded-lg text-app-muted hover:text-app"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingRequests ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="text-sm text-app-muted text-center py-8">
                {t('connections.emptyPending')}
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto no-scrollbar">
                {pendingRequests.map((u) => (
                  <div
                    key={u._id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-app-input border border-app"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={u.profile_picture} name={u.full_name} size="md" />
                      <div>
                        <div className="text-sm font-bold text-app">{u.full_name}</div>
                        <div className="text-xs text-app-muted">@{u.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(u._id)}
                        className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 transition cursor-pointer"
                        title={t('groups.accept')}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(u._id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition cursor-pointer"
                        title={t('groups.reject')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Edit Group Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-app-card border border-app rounded-3xl p-6 sm:p-8 shadow-2xl text-app relative my-8 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 mb-6 border-b border-app">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <span>{t('groups.editGroup')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-app-muted hover:text-app"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                  {t('groups.groupName')} *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => {
                    setEditForm({ ...editForm, name: e.target.value });
                    if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: null }));
                  }}
                  required
                  minLength={3}
                  maxLength={40}
                  className="w-full px-4 py-3 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex justify-between items-center mt-1 text-[11px]">
                  {editErrors.name ? (
                    <span className="text-rose-500">{editErrors.name}</span>
                  ) : (
                    <span className="text-app-muted">3-40 characters</span>
                  )}
                  <span className="text-app-muted">{editForm.name.trim().length}/40</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-muted uppercase tracking-wider mb-2">
                  {t('groups.groupIcon')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {GROUP_ICONS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = editForm.icon === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, icon: item.key })}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                          isSelected
                            ? 'bg-linear-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white border-purple-400 scale-105 shadow-md'
                            : 'bg-app-input text-app-muted border-app hover:text-app'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px]">{t(item.labelKey)}</span>
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
                  value={editForm.description}
                  onChange={(e) => {
                    setEditForm({ ...editForm, description: e.target.value });
                    if (editErrors.description)
                      setEditErrors((prev) => ({ ...prev, description: null }));
                  }}
                  rows={3}
                  maxLength={200}
                  className="w-full px-4 py-3 bg-app-input border border-app rounded-xl text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <div className="flex justify-between items-center mt-1 text-[11px]">
                  {editErrors.description ? (
                    <span className="text-rose-500">{editErrors.description}</span>
                  ) : (
                    <span className="text-app-muted">Max 200 characters</span>
                  )}
                  <span className="text-app-muted">{editForm.description.trim().length}/200</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-app text-app hover:bg-white/5 cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editingGroup || !editForm.name.trim() || editForm.name.trim().length < 3}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-linear-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-950/40 transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-2"
                >
                  {editingGroup && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{t('common.save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delete Group Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-app-card border border-rose-500/30 rounded-3xl p-6 shadow-2xl text-app relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-app mb-2">
              {t('groups.deleteGroup')}
            </h3>
            <p className="text-xs text-app-muted text-center mb-6 leading-relaxed">
              {t('groups.deleteGroupConfirm')}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-app text-app hover:bg-white/5 cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={deletingGroup}
                onClick={handleDeleteGroup}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/30 transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {deletingGroup && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{t('groups.deleteGroup')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Leave Group Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md bg-app-card border border-app rounded-3xl p-6 shadow-2xl text-app relative">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
              <LogOut className="w-6 h-6 rtl:rotate-180" />
            </div>
            <h3 className="text-lg font-bold text-center text-app mb-2">
              {t('groups.leaveGroup')}
            </h3>
            <p className="text-xs text-app-muted text-center mb-6 leading-relaxed">
              {t('groups.leaveGroupConfirm')}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-app text-app hover:bg-white/5 cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={leavingGroup}
                onClick={handleLeaveGroup}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/30 transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {leavingGroup && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{t('groups.leaveGroup')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupChat;
