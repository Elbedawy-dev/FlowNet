import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Eye, MessagesSquare, CheckCheck, ImageIcon } from "lucide-react";
import moment from "moment";
import { messagesApi, usersApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useSocketEvent } from "../context/SocketContext";
import { useLanguage } from "../context/LanguageContext";
import Avatar from "../components/Avatar";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";

const Messages = () => {
  const [recentMessages, setRecentMessages] = useState([]);
  const [connections, setConnections] = useState([]);
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { t, lang } = useLanguage();

  const fetchAllData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);

      const [recentRes, networkRes, blockedRes] = await Promise.all([
        messagesApi.getRecent(isSilent ? { silent: true } : {}).catch((err) => {
          console.warn("[Messages] getRecent error:", err.message);
          return [];
        }),
        usersApi.getNetwork().catch((err) => {
          console.warn("[Messages] getNetwork error:", err.message);
          return { connections: [] };
        }),
        usersApi.getBlocked().catch((err) => {
          console.warn("[Messages] getBlocked error:", err.message);
          return [];
        }),
      ]);

      const blockedIds = new Set(
        Array.isArray(blockedRes) ? blockedRes.map((u) => u._id) : []
      );
      setBlockedUserIds(blockedIds);

      setRecentMessages(Array.isArray(recentRes) ? recentRes : []);
      setConnections(
        Array.isArray(networkRes?.connections) ? networkRes.connections : []
      );
    } catch (err) {
      console.warn("[Messages] Error loading conversations:", err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?._id) {
      fetchAllData();
    }
  }, [currentUser?._id, fetchAllData]);

  // Real-time updates via Ably
  const handleMessageUpdate = useCallback(() => {
    fetchAllData(true);
  }, [fetchAllData]);

  useSocketEvent("message:new", handleMessageUpdate);
  useSocketEvent("message:seen", handleMessageUpdate);

  // Merge (a) recent conversations with (b) connections without message history
  const mergedConversations = useMemo(() => {
    const map = new Map();

    // 1. Process recent conversations
    for (const item of recentMessages) {
      const partner = item.other_user || item.from_user_id || {};
      const partnerId = partner._id;

      if (!partnerId || blockedUserIds.has(partnerId)) continue;
      if (partnerId === currentUser?._id) continue;

      const isUnread = !item.seen && item.to_user_id === currentUser?._id;
      const isMedia = Boolean(item.media_url || item.message_type === "image");
      const previewText = item.text
        ? item.text
        : isMedia
        ? (t("messages.media") || "Media")
        : "";

      map.set(partnerId, {
        user: partner,
        lastMessage: previewText,
        lastTime: item.createdAt ? new Date(item.createdAt) : null,
        isUnread,
        hasHistory: true,
      });
    }

    // 2. Process connections who have no message history yet
    for (const conn of connections) {
      const connId = conn._id;
      if (!connId || blockedUserIds.has(connId)) continue;
      if (connId === currentUser?._id) continue;

      if (!map.has(connId)) {
        map.set(connId, {
          user: conn,
          lastMessage: "",
          lastTime: null,
          isUnread: false,
          hasHistory: false,
        });
      }
    }

    // 3. Sort: newest lastTime first; connections without history at the end
    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.hasHistory && b.hasHistory) {
        return (b.lastTime?.getTime() || 0) - (a.lastTime?.getTime() || 0);
      }
      if (a.hasHistory) return -1;
      if (b.hasHistory) return 1;
      // Both have no history: sort alphabetically
      const nameA = a.user.full_name || a.user.username || "";
      const nameB = b.user.full_name || b.user.username || "";
      return nameA.localeCompare(nameB);
    });

    return list;
  }, [recentMessages, connections, blockedUserIds, currentUser?._id, t]);

  return (
    <div className="min-h-full py-10 px-4 flex flex-col items-center text-app pb-32">
      {/* Header */}
      <div className="text-center max-w-xl mb-10">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-3 shadow-md">
          <MessagesSquare className="w-8 h-8 text-amber-600 dark:text-yellow-400" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-amber-600 via-pink-600 to-purple-600 dark:from-yellow-300 dark:via-pink-400 dark:to-purple-400">
          {t("messages.title")}
        </h1>
        <p className="text-app-muted text-sm mt-2">
          {t("messages.subtitle")}
        </p>
      </div>

      {/* Main List */}
      <div className="w-full max-w-3xl space-y-3">
        {loading ? (
          <div className="py-12">
            <Loading />
          </div>
        ) : mergedConversations.length === 0 ? (
          <EmptyState
            title={t("messages.emptyTitle") || "No conversations yet"}
            message={t("messages.emptyDesc") || "Reach out to your connections to start a spark!"}
            actionText={t("sidebar.discover") || "Discover People"}
            onAction={() => navigate("/search")}
          />
        ) : (
          mergedConversations.map(({ user, lastMessage, lastTime, isUnread, hasHistory }) => (
            <div
              key={user._id}
              onClick={() => navigate(`/messages/${user._id}`)}
              className="flex items-center justify-between p-4 rounded-3xl bg-app-card backdrop-blur-xl border border-app hover:border-purple-400/50 hover:shadow-[0_0_25px_rgba(131,58,180,0.3)] transition-all duration-300 cursor-pointer group"
            >
              {/* User Avatar & Info */}
              <div className="flex items-center gap-4 min-w-0 pe-2">
                <div className="relative shrink-0">
                  <Avatar
                    src={user.profile_picture}
                    name={user.full_name || user.username}
                    size="lg"
                    ring={isUnread}
                  />
                  {isUnread && (
                    <span className="absolute top-0 end-0 w-3.5 h-3.5 bg-emerald-500 rounded-full animate-pulse ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-app text-base group-hover:text-indigo-400 transition-colors truncate">
                      {user.full_name || "User"}
                    </h3>
                    {isUnread && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-linear-to-r from-pink-500 to-purple-600 text-white shrink-0 animate-pulse">
                        {t("notifications.newBadge") || "New"}
                      </span>
                    )}
                  </div>

                  <p className="text-app-muted text-xs truncate">
                    @{user.username || "user"}
                  </p>

                  {/* Last message preview or bio fallback */}
                  {hasHistory ? (
                    <div className="flex items-center gap-2 mt-1">
                      <p
                        className={`text-xs truncate max-w-md ${
                          isUnread
                            ? "text-purple-600 dark:text-purple-300 font-bold"
                            : "text-app-muted"
                        }`}
                      >
                        {lastMessage}
                      </p>
                      {lastTime && (
                        <span className="text-[10px] text-app-muted shrink-0">
                          • {moment(lastTime).locale(lang).fromNow()}
                        </span>
                      )}
                    </div>
                  ) : user.bio ? (
                    <p className="text-app-muted text-xs truncate mt-1 max-w-md hidden sm:block">
                      {user.bio}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/messages/${user._id}`);
                  }}
                  title={t("messages.typeMessage") || "Chat"}
                  aria-label={t("messages.typeMessage") || "Chat"}
                  className="p-2.5 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <MessageCircle size={18} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${user._id}`);
                  }}
                  title={t("messages.viewProfile") || "View Profile"}
                  aria-label={t("messages.viewProfile") || "View Profile"}
                  className="p-2.5 rounded-full bg-app-input hover:bg-white/10 border border-app text-app hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Messages;
