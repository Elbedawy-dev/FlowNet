import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Send,
  Image as ImageIcon,
  Users,
  Shield,
  Crown,
  Check,
  X,
  UserCheck,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';
import moment from 'moment';
import toast from 'react-hot-toast';
import { groupsApi } from '../../api/axios';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useSocket } from '../../context/SocketContext';
import Avatar from '../../components/Avatar';
import Loading from '../../components/Loading';
import { getGroupIcon } from '../../utils/groupIcons';

const GroupChat = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { socket } = useSocket();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);

  // Owner / Admin requests management
  const [showRequestsPanel, setShowRequestsPanel] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // 1. Fetch group details and messages
  useEffect(() => {
    let isMounted = true;

    const loadGroupAndChat = async () => {
      try {
        setLoading(true);
        const groupData = await groupsApi.getById(groupId);
        if (!isMounted) return;

        if (!groupData.is_member) {
          toast.error('يجب أن تكون عضواً في المجموعة للوصول إلى المحادثة');
          navigate('/groups/joined');
          return;
        }

        setGroup(groupData);

        const chatHistory = await groupsApi.getMessages(groupId);
        if (!isMounted) return;
        setMessages(chatHistory || []);
        setTimeout(() => scrollToBottom(false), 100);
      } catch (err) {
        console.warn('Failed to load group chat:', err);
        if (err.status === 403 || err.status === 404) {
          toast.error('يجب أن تكون عضواً في المجموعة للوصول إلى المحادثة');
          navigate('/groups/joined');
        } else {
          toast.error(err.message || 'حدث خطأ أثناء تحميل المحادثة');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadGroupAndChat();

    return () => {
      isMounted = false;
    };
  }, [groupId, navigate]);

  // 2. Socket: Join group room and listen for group messages
  useEffect(() => {
    if (!socket || !groupId) return;

    socket.emit('group:join', { groupId });

    const handleNewMessage = (newMsg) => {
      if (newMsg.group === groupId || newMsg.group?._id === groupId) {
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    socket.on('group:message', handleNewMessage);

    return () => {
      socket.off('group:message', handleNewMessage);
    };
  }, [socket, groupId]);

  // 3. Fetch pending requests if owner or admin opens the panel
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
    if (showRequestsPanel && (group?.is_admin || group?.owner?._id === currentUser?._id)) {
      fetchPendingRequests();
    }
  }, [showRequestsPanel, group, currentUser, fetchPendingRequests]);

  const handleAcceptRequest = async (userId) => {
    try {
      await groupsApi.acceptRequest(groupId, userId);
      setPendingRequests((prev) => prev.filter((u) => u._id !== userId));
      setGroup((prev) => ({ ...prev, members_count: (prev.members_count || 0) + 1 }));
      toast.success('تم قبول العضو بنجاح ✨');
    } catch (err) {
      toast.error(err.message || 'فشل قبول العضو');
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      await groupsApi.rejectRequest(groupId, userId);
      setPendingRequests((prev) => prev.filter((u) => u._id !== userId));
      toast.success('تم رفض الطلب');
    } catch (err) {
      toast.error(err.message || 'فشل رفض الطلب');
    }
  };

  // Handle Image Selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('حجم الصورة كبير جداً (الحد الأقصى 10MB)');
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
          full_name: currentUser?.full_name || 'أنا',
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
        prev.map((m) => (m._id === tempId ? serverMsg : m))
      );
    } catch (err) {
      toast.error(err.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  const isOwnerOrAdmin =
    group?.is_admin ||
    group?.owner?._id === currentUser?._id ||
    group?.owner === currentUser?._id;

  return (
    <div dir="rtl" className="max-w-4xl mx-auto px-2 sm:px-4 py-4 h-[calc(100vh-5rem)] flex flex-col">
      {/* Top Bar (Purple Gradient Header) */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-purple-900/90 to-[#182034] border border-purple-500/30 rounded-2xl p-4 mb-3 shadow-[0_0_25px_rgba(168,85,247,0.3)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/groups/joined')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition cursor-pointer"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-md">
            {getGroupIcon(group?.icon, 'w-5 h-5')}
          </div>

          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{group?.name || 'غرفة الدردشة'} 💬</span>
            </h1>
            <p className="text-xs text-purple-200/80 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{group?.members_count || 0} عضو</span>
            </p>
          </div>
        </div>

        {/* Requests Button (Owner/Admin View) */}
        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={() => setShowRequestsPanel(!showRequestsPanel)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              showRequestsPanel
                ? 'bg-purple-600 text-white border-purple-400'
                : 'bg-purple-950/40 border-purple-500/30 text-purple-200 hover:bg-purple-900/50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-pink-400" />
            <span>طلبات الانضمام</span>
            {pendingRequests.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Owner Pending Requests Panel */}
      {showRequestsPanel && isOwnerOrAdmin && (
        <div className="bg-[#121735]/95 border border-purple-500/30 rounded-2xl p-4 mb-3 shadow-xl shrink-0">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-500/20">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-purple-400" />
              طلبات الانضمام المعلقة
            </h3>
            <button
              onClick={() => setShowRequestsPanel(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loadingRequests ? (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">
              لا توجد طلبات انضمام جديدة حالياً.
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
              {pendingRequests.map((reqUser) => (
                <div
                  key={reqUser._id}
                  className="flex items-center justify-between p-2.5 bg-[#0e1428] rounded-xl border border-purple-500/20"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={reqUser.profile_picture}
                      name={reqUser.full_name}
                      size="sm"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">
                        {reqUser.full_name}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        @{reqUser.username}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(reqUser._id)}
                      className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                      title="قبول"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(reqUser._id)}
                      className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                      title="رفض"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#121735]/70 backdrop-blur border border-purple-500/20 rounded-2xl space-y-4 shadow-inner no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <MessageCircle className="w-12 h-12 text-purple-400/40 mb-3 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-1">
              مرحباً بك في {group?.name}! 🚀
            </h3>
            <p className="text-xs text-gray-400 max-w-sm">
              لا توجد رسائل سابقة هنا بعد. كن أول من يفتتح النقاش ويرحب بالأعضاء!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;
            const isMe = senderId === currentUser?._id;
            const senderName = isMe ? 'أنا' : msg.sender?.full_name || 'عضو';

            return (
              <div
                key={msg._id}
                className={`flex items-end gap-2.5 ${
                  isMe ? 'justify-start flex-row-reverse' : 'justify-start'
                }`}
              >
                {/* Avatar */}
                <Avatar
                  src={msg.sender?.profile_picture}
                  name={senderName}
                  size="sm"
                  className="shrink-0 mb-1"
                />

                {/* Message Bubble */}
                <div
                  className={`max-w-[78%] sm:max-w-[65%] rounded-2xl p-3 shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-br-none'
                      : 'bg-[#1b223c] border border-purple-500/20 text-gray-100 rounded-bl-none'
                  }`}
                >
                  {/* Sender Name (never raw IDs!) */}
                  {!isMe && (
                    <div className="text-xs font-bold text-pink-300 mb-1">
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
                    className={`text-[10px] mt-1 text-left ${
                      isMe ? 'text-purple-200/80' : 'text-gray-400'
                    }`}
                  >
                    {moment(msg.createdAt).format('hh:mm A')}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Media Preview before sending */}
      {mediaPreview && (
        <div className="mt-2 p-2 bg-[#121735] border border-purple-500/30 rounded-xl flex items-center justify-between w-fit gap-3">
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

      {/* Bottom Floating Bar */}
      <form
        onSubmit={handleSendMessage}
        className="mt-3 flex items-center gap-2 bg-[#182034]/90 backdrop-blur border border-purple-500/30 rounded-2xl p-2 shadow-lg"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition cursor-pointer shrink-0"
          title="إرفاق صورة"
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
          placeholder="اكتب رسالة..."
          className="flex-1 bg-transparent px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none"
        />

        <button
          type="submit"
          disabled={sending || (!text.trim() && !mediaFile)}
          className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm shadow-md transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4 rotate-180" />
              <span>إرسال</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default GroupChat;
