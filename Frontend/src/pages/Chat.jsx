import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Image as ImageIcon, X, ShieldAlert, Check, CheckCheck, Trash2, MoreVertical } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import { messagesApi, usersApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useSocketEvent } from "../context/SocketContext";
import Avatar from "../components/Avatar";
import Loading from "../components/Loading";
import { useLanguage } from "../context/LanguageContext";

const Chat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { t } = useLanguage();

  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [loading, setLoading] = useState(true);

  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchConversation = useCallback(async () => {
    try {
      setLoading(true);
      const res = await messagesApi.getConversation(userId, null, 50);
      setMessages(Array.isArray(res?.messages) ? res.messages : []);
      setOtherUser(res?.other_user || null);
      setBlockedByThem(Boolean(res?.blocked_by_them));
      setBlockedByMe(Boolean(res?.blocked_by_me));

      setTimeout(() => scrollToBottom("auto"), 150);
    } catch (err) {
      if (err.code === "BLOCKED_BY_USER") {
        setBlockedByThem(true);
      } else if (err.code === "MESSAGING_RESTRICTED") {
        toast.error(t("messages.connectionsOnly") || "This user only accepts messages from their connections");
      } else {
        toast.error(err.message || t("messages.loadChatFailed") || "Failed to load chat");
      }
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Real-time Ably events
  const handleNewMessage = useCallback(
    (msg) => {
      // Check if message belongs to this conversation
      const isFromTarget = msg.from_user_id === userId && msg.to_user_id === currentUser?._id;
      const isFromMe = msg.from_user_id === currentUser?._id && msg.to_user_id === userId;

      if (isFromTarget || isFromMe) {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m._id === msg._id)) return prev;

          // If this is my own message, replace matching optimistic temp message
          if (isFromMe) {
            const tempIdx = prev.findIndex(
              (m) =>
                String(m._id).startsWith("temp-") &&
                m.from_user_id === currentUser?._id &&
                m.to_user_id === userId &&
                m.text === msg.text
            );
            if (tempIdx !== -1) {
              const next = [...prev];
              next[tempIdx] = msg;
              return next;
            }
          }

          return [...prev, msg];
        });
        setTimeout(() => scrollToBottom("smooth"), 100);

        // Mark as seen immediately if incoming
        if (isFromTarget) {
          messagesApi.markSeen(userId).catch(() => {});
        }
      }
    },
    [userId, currentUser?._id]
  );

  const handleMessageSeen = useCallback(
    (data) => {
      if (data.seen_by === userId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.from_user_id === currentUser?._id ? { ...m, seen: true } : m
          )
        );
      }
    },
    [userId, currentUser?._id]
  );

  const handleMessageDeleted = useCallback((data) => {
    if (!data?.messageId) return;
    setMessages((prev) => {
      if (data.scope === "everyone") {
        return prev.map((m) =>
          m._id === data.messageId
            ? { ...m, is_unsent: true, text: "", media_url: "" }
            : m
        );
      }
      return prev.filter((m) => m._id !== data.messageId);
    });
  }, []);

  const handleConversationDeleted = useCallback(
    (data) => {
      if (data?.with === userId) {
        setMessages([]);
      }
    },
    [userId]
  );

  useSocketEvent("message:new", handleNewMessage);
  useSocketEvent("message:seen", handleMessageSeen);
  useSocketEvent("message:deleted", handleMessageDeleted);
  useSocketEvent("conversation:deleted", handleConversationDeleted);

  const handleDeleteMessage = async (messageId, scope = "me") => {
    setActiveMenuMsgId(null);
    try {
      setMessages((prev) => {
        if (scope === "everyone") {
          return prev.map((m) =>
            m._id === messageId ? { ...m, is_unsent: true, text: "", media_url: "" } : m
          );
        }
        return prev.filter((m) => m._id !== messageId);
      });
      await messagesApi.deleteMessage(messageId, scope);
      toast.success(t("messages.messageDeleted") || "Message deleted");
    } catch (err) {
      toast.error(err.message || t("common.error") || "Failed to delete message");
    }
  };

  const handleDeleteConversation = async () => {
    if (!window.confirm(t("messages.deleteConversationConfirm") || "Are you sure you want to delete this chat?")) {
      return;
    }
    try {
      setMessages([]);
      await messagesApi.deleteConversation(userId);
      toast.success(t("messages.conversationCleared") || "Chat cleared");
    } catch (err) {
      toast.error(err.message || t("common.error") || "Failed to clear chat");
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("messages.selectImage") || "Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("messages.imageSizeLimit") || "Image size must be 5MB or less");
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isSending) return;

    const textToSend = inputText.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic message
    const optimisticMessage = {
      _id: tempId,
      from_user_id: currentUser?._id,
      to_user_id: userId,
      text: textToSend,
      media_url: imagePreview,
      message_type: selectedImage ? "image" : "text",
      seen: false,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");
    const fileToUpload = selectedImage;
    removeSelectedImage();
    setIsSending(true);
    setTimeout(() => scrollToBottom("smooth"), 50);

    try {
      let res;
      if (fileToUpload) {
        const formData = new FormData();
        if (textToSend) formData.append("text", textToSend);
        formData.append("image", fileToUpload);
        res = await messagesApi.send(userId, formData);
      } else {
        res = await messagesApi.send(userId, { text: textToSend });
      }

      setMessages((prev) => {
        if (prev.some((m) => m._id === res._id)) {
          return prev.filter((m) => m._id !== tempId);
        }
        return prev.map((m) => (m._id === tempId ? res : m));
      });
    } catch (err) {
      // Rollback optimistic message
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      if (err.code === "BLOCKED_BY_USER") {
        setBlockedByThem(true);
      } else if (err.code === "MESSAGING_RESTRICTED") {
        toast.error(t("messages.connectionsOnly") || "This user only accepts messages from their connections");
      } else {
        toast.error(err.message || t("messages.sendFailed") || "Failed to send message");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleUnblockUser = async () => {
    try {
      await usersApi.unblock(userId);
      setBlockedByMe(false);
      toast.success(t("profile.userUnblocked") || "User unblocked");
      fetchConversation();
    } catch (err) {
      toast.error(err.message || t("messages.unblockFailed") || "Failed to unblock user");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  // IF BLOCKED BY THEM: Show Arabic blocked notice
  if (blockedByThem) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-lg p-8 rounded-3xl bg-app-card border border-pink-500/30 shadow-[0_0_40px_rgba(236,72,153,0.35)] backdrop-blur-xl">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.4)]">
            <span className="text-3xl">😢</span>
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-200 to-indigo-200 mb-4">
            {t("messages.blockedTitle")}
          </h2>
          <p className="text-base text-app-muted leading-relaxed mb-6 font-medium">
            {t("messages.blockedDesc")}
          </p>
          <button
            onClick={() => navigate("/messages")}
            className="px-6 py-2.5 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-semibold shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            {t("sidebar.messages")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col text-app relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-app-card/85 backdrop-blur-xl border-b border-app shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/messages")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-app-muted hover:text-app transition-all cursor-pointer"
            title={t("common.back")}
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
          </button>

          <div
            onClick={() => navigate(`/profile/${userId}`)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <Avatar
              src={otherUser?.profile_picture}
              name={otherUser?.full_name || otherUser?.username}
              size="md"
            />
            <div>
              <h3 className="font-bold text-sm text-app group-hover:text-indigo-400 transition-colors">
                {otherUser?.full_name || "User"}
              </h3>
              <p className="text-[11px] text-app-muted">
                @{otherUser?.username || "user"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleDeleteConversation}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-app-muted hover:text-red-400 transition-all cursor-pointer"
              title={t("messages.deleteConversation") || "Delete chat"}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Blocked by Me Banner */}
      {blockedByMe && (
        <div className="bg-rose-950/80 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-200 backdrop-blur-md z-20">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-400" />
            <span>{t("messages.blockedByMeTitle")}</span>
          </div>
          <button
            onClick={handleUnblockUser}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition active:scale-95 cursor-pointer"
          >
            {t("messages.unblock")}
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-purple-300/60">
            <Avatar
              src={otherUser?.profile_picture}
              name={otherUser?.full_name}
              size="xl"
              className="mb-3 opacity-80"
            />
            <p className="text-sm font-medium">{t("messages.sayHello", { name: otherUser?.full_name || "your friend" })}</p>
            <p className="text-xs text-app-muted mt-1">{t("messages.encryptedNotice")}</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.from_user_id === currentUser?._id;
            const prevMsg = messages[index - 1];
            const isDifferentDay =
              !prevMsg ||
              !moment(msg.createdAt).isSame(moment(prevMsg.createdAt), "day");

            return (
              <div key={msg._id || index} className="space-y-2">
                {/* Date separator */}
                {isDifferentDay && (
                  <div className="flex items-center justify-center my-4">
                    <span className="text-[11px] text-app-muted bg-app-card border border-app px-3 py-0.5 rounded-full shadow-xs">
                      {moment(msg.createdAt).calendar(null, {
                        sameDay: "[Today]",
                        lastDay: "[Yesterday]",
                        lastWeek: "dddd, MMMM D",
                        sameElse: "MMMM D, YYYY",
                      })}
                    </span>
                  </div>
                )}

                {/* Bubble row */}
                <div
                  className={`flex items-end gap-2 ${
                    isMe ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isMe && (
                    <Avatar
                      src={otherUser?.profile_picture}
                      name={otherUser?.full_name}
                      size="xs"
                      className="mb-1"
                    />
                  )}

                  <div className="relative group/msg flex items-center">
                    {!isMe && !msg.is_unsent && !String(msg._id).startsWith("temp-") && (
                      <div className="relative order-last ms-1">
                        <button
                          type="button"
                          onClick={() => setActiveMenuMsgId(activeMenuMsgId === msg._id ? null : msg._id)}
                          className="opacity-0 group-hover/msg:opacity-100 p-1 rounded-full hover:bg-white/10 text-app-muted hover:text-app transition-opacity cursor-pointer"
                          title={t("common.more") || "More"}
                        >
                          <MoreVertical size={13} />
                        </button>
                        {activeMenuMsgId === msg._id && (
                          <div className="absolute z-30 bottom-full mb-1 start-0 min-w-36 py-1 bg-app-card border border-app rounded-xl shadow-xl backdrop-blur-md text-xs">
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg._id, "me")}
                              className="w-full text-start px-3 py-1.5 hover:bg-white/10 text-app flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 size={12} className="text-red-400" />
                              <span>{t("messages.deleteForMe") || "Delete for me"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {isMe && !msg.is_unsent && !String(msg._id).startsWith("temp-") && (
                      <div className="relative order-first me-1">
                        <button
                          type="button"
                          onClick={() => setActiveMenuMsgId(activeMenuMsgId === msg._id ? null : msg._id)}
                          className="opacity-0 group-hover/msg:opacity-100 p-1 rounded-full hover:bg-white/10 text-app-muted hover:text-app transition-opacity cursor-pointer"
                          title={t("common.more") || "More"}
                        >
                          <MoreVertical size={13} />
                        </button>
                        {activeMenuMsgId === msg._id && (
                          <div className="absolute z-30 bottom-full mb-1 end-0 min-w-40 py-1 bg-app-card border border-app rounded-xl shadow-xl backdrop-blur-md text-xs">
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg._id, "me")}
                              className="w-full text-start px-3 py-1.5 hover:bg-white/10 text-app flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 size={12} className="text-red-400" />
                              <span>{t("messages.deleteForMe") || "Delete for me"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg._id, "everyone")}
                              className="w-full text-start px-3 py-1.5 hover:bg-white/10 text-pink-400 flex items-center gap-2 cursor-pointer"
                            >
                              <span>🚫</span>
                              <span>{t("messages.unsendForEveryone") || "Unsend for everyone"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[78%] sm:max-w-[65%] rounded-3xl p-3.5 shadow-md ${
                        isMe
                          ? "bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-ee-xs shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                          : "bg-app-card text-app rounded-es-xs border border-app"
                      } ${msg.is_unsent ? "opacity-75 italic" : ""}`}
                    >
                      {msg.is_unsent ? (
                        <p className="text-xs opacity-80 flex items-center gap-1.5 py-1">
                          <span>🚫</span>
                          <span>{t("messages.unsentPlaceholder") || "This message was unsent"}</span>
                        </p>
                      ) : (
                        <>
                          {/* Media attachment */}
                          {msg.media_url && (
                            <div className="mb-2 rounded-2xl overflow-hidden cursor-pointer">
                              <img
                                src={msg.media_url}
                                alt="Message attachment"
                                onClick={() => setViewingImage(msg.media_url)}
                                className="max-h-60 w-full object-cover rounded-2xl hover:opacity-95 transition"
                              />
                            </div>
                          )}

                          {/* Text */}
                          {msg.text && (
                            <p className="text-sm whitespace-pre-line break-words leading-relaxed">
                              {msg.text}
                            </p>
                          )}
                        </>
                      )}

                      {/* Timestamp & seen indicator */}
                      <div
                        className={`flex items-center gap-1 text-[10px] mt-1 ${
                          isMe ? "text-purple-200 justify-end" : "text-app-muted justify-start"
                        }`}
                      >
                        <span>{moment(msg.createdAt).format("h:mm A")}</span>
                        {isMe && !msg.is_unsent && (
                          <span>
                            {msg.seen ? (
                              <CheckCheck size={13} className="text-cyan-300" />
                            ) : (
                              <Check size={13} className="text-purple-200" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isMe && (
                    <Avatar
                      src={currentUser?.profile_picture}
                      name={currentUser?.full_name}
                      size="xs"
                      className="mb-1"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview Chip */}
      {imagePreview && (
        <div className="px-4 py-2 bg-app-card border-t border-app flex items-center gap-3">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Upload preview"
              className="w-16 h-16 object-cover rounded-xl border border-purple-500/40"
            />
            <button
              onClick={removeSelectedImage}
              className="absolute -top-1 -end-1 bg-rose-600 text-white rounded-full p-0.5 shadow cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
          <span className="text-xs text-purple-300">{t("messages.imageAttached") || "Image attached. Ready to send!"}</span>
        </div>
      )}

      {/* Bottom Floating Input Bar */}
      {!blockedByThem && (
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-app-card/90 backdrop-blur-md border-t border-app flex items-center gap-2"
        >
          <label className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-purple-300 hover:text-white transition cursor-pointer border border-app">
            <ImageIcon size={19} />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </label>

          <input
            type="text"
            dir="auto"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t("messages.typeMessage")}
            disabled={blockedByMe}
            className="flex-1 py-3 px-5 text-sm rounded-full bg-app-input text-app placeholder-app-muted border border-app focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all text-start"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedImage) || isSending || blockedByMe}
            className="p-3 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 text-white transition-all shadow-[0_0_15px_rgba(168,85,247,0.5)] disabled:opacity-40 cursor-pointer"
          >
            <Send size={18} className="rtl:rotate-180" />
          </button>
        </form>
      )}

      {/* Fullscreen Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setViewingImage(null)}
        >
          <img
            src={viewingImage}
            alt="Fullscreen"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default Chat;
