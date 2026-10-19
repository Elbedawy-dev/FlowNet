import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import moment from "moment";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { messagesApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useSocket } from "../context/SocketContext";
import { useLanguage } from "../context/LanguageContext";
import Avatar from "./Avatar";

const RecentMessages = ({ mobile = false }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const { currentUser } = useCurrentUser();
  const { socket, isConnected } = useSocket();
  const { t, lang } = useLanguage();

  const fetchRecent = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await messagesApi.getRecent(isSilent ? { silent: true } : {});
      setMessages(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn("[RecentMessages] Failed to fetch:", err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?._id) {
      fetchRecent();
    }
  }, [currentUser?._id, fetchRecent]);

  // Fallback polling when socket is disconnected
  useEffect(() => {
    if (isConnected || !currentUser?._id) return;
    const interval = setInterval(() => {
      fetchRecent(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [isConnected, currentUser?._id, fetchRecent]);

  // Refresh recent list on new message received via socket
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      fetchRecent(true);
    };
    socket.on("message:new", handleNewMessage);
    socket.on("message:seen", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:seen", handleNewMessage);
    };
  }, [socket, fetchRecent]);

  const unreadCount = messages.filter(
    (item) => !item.seen && item.to_user_id === currentUser?._id
  ).length;

  // Mobile rendering (collapsible card with horizontal avatar strip & expandable list)
  if (mobile) {
    return (
      <div className="w-full rounded-2xl bg-surface-glass backdrop-blur-xl border border-app shadow-app-glow overflow-hidden">
        {/* Mobile Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <MessageSquare size={16} />
            </div>
            <span className="font-bold text-sm text-app">{t("messages.title") || "Messages"}</span>
            {unreadCount > 0 ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-linear-to-r from-pink-500 to-purple-600 text-white animate-pulse">
                {unreadCount} {t("messages.newBadge") || "new"}
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-300/30">
                {messages.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/messages"
              className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              <span>{t("messages.viewAll") || "View all"}</span>
              <ArrowRight size={12} className="rtl:rotate-180" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileExpanded((prev) => !prev)}
              className="p-1 rounded-lg text-app-muted hover:text-app hover:bg-purple-500/10 transition-colors"
              aria-label={mobileExpanded ? "Collapse messages" : "Expand messages"}
            >
              {mobileExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {/* Horizontal Avatar Strip (always visible on mobile) */}
        <div className="flex items-center gap-3 px-4 py-2.5 overflow-x-auto no-scrollbar bg-surface-strong/20">
          {loading ? (
            <div className="py-2 text-xs text-app-muted">{t("messages.loadingMessages") || "Loading messages..."}</div>
          ) : messages.length === 0 ? (
            <div className="text-xs text-app-muted py-1 flex items-center gap-2">
              <MessageSquare size={14} className="text-purple-400" />
              <span>{t("messages.emptyTitle") || "No conversations yet"}</span>
            </div>
          ) : (
            messages.map((item, index) => {
              const partner = item.other_user || item.from_user_id || {};
              const isUnread = !item.seen && item.to_user_id === currentUser?._id;

              return (
                <Link
                  to={`/messages/${partner._id}`}
                  key={item._id || index}
                  className="flex flex-col items-center gap-1 shrink-0 group focus:outline-none"
                  title={partner.full_name || partner.username || "User"}
                >
                  <div className="relative">
                    <Avatar
                      src={partner.profile_picture}
                      name={partner.full_name || partner.username}
                      size="sm"
                      ring={isUnread}
                    />
                    {isUnread && (
                      <span className="absolute top-0 end-0 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </div>
                  <span className="text-[10px] text-app-muted group-hover:text-app truncate max-w-[54px] text-center">
                    {partner.full_name?.split(" ")[0] || partner.username || "User"}
                  </span>
                </Link>
              );
            })
          )}
        </div>

        {/* Expandable Full List */}
        <AnimatePresence>
          {mobileExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-app divide-y divide-app overflow-hidden max-h-64 overflow-y-auto no-scrollbar"
            >
              {messages.map((item, index) => {
                const partner = item.other_user || item.from_user_id || {};
                const isUnread = !item.seen && item.to_user_id === currentUser?._id;

                return (
                  <Link
                    to={`/messages/${partner._id}`}
                    key={item._id || index}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-500/10 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        src={partner.profile_picture}
                        name={partner.full_name || partner.username}
                        size="sm"
                        ring={isUnread}
                      />
                      {isUnread && (
                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse ring-2 ring-white dark:ring-slate-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-app text-xs truncate">
                        {partner.full_name || partner.username || "User"}
                      </p>
                      <p className="text-xs text-app-muted truncate">
                        {item.text || "Photo attachment"}
                      </p>
                    </div>
                    <span className="text-[10px] text-app-muted shrink-0">
                      {moment(item.createdAt).fromNow(true)}
                    </span>
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Desktop sticky card rendering
  return (
    <motion.div
      className="w-72 flex flex-col text-sm bg-surface-glass backdrop-blur-xl rounded-3xl shadow-app-glow border border-app overflow-hidden max-h-[calc(100vh-6rem)]"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="font-bold text-app px-5 py-4 border-b border-app bg-surface-strong/30 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{t("messages.title") || "Messages"}</span>
          {!isConnected && (
            <span
              className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
              title="Real-time disconnected"
            />
          )}
        </div>
        {unreadCount > 0 ? (
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-linear-to-r from-pink-500 to-purple-600 text-white font-semibold shadow-sm">
            {unreadCount} {t("messages.unread") || "unread"}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-300/30">
            {messages.length}
          </span>
        )}
      </h3>

      <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-app">
        {loading ? (
          <div className="p-6 text-center text-xs text-app-muted">
            {t("messages.loadingMessages") || "Loading messages..."}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-app-muted">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-300/30 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-xs font-semibold text-app mb-1">{t("messages.emptyTitle") || "No conversations yet"}</p>
            <p className="text-[11px] text-app-muted">{t("messages.emptyDesc") || "Reach out to your connections!"}</p>
          </div>
        ) : (
          messages.map((item, index) => {
            const partner = item.other_user || item.from_user_id || {};
            const isUnread = !item.seen && item.to_user_id === currentUser?._id;

            return (
              <Link
                to={`/messages/${partner._id}`}
                key={item._id || index}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-purple-500/10 transition-all duration-200"
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={partner.profile_picture}
                    name={partner.full_name || partner.username}
                    size="md"
                    ring={isUnread}
                  />
                  {isUnread && (
                    <span className="absolute top-0 end-0 w-3 h-3 bg-emerald-500 rounded-full animate-pulse ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-app text-xs truncate">
                    {partner.full_name || partner.username || "User"}
                  </p>
                  <p
                    className={`text-xs truncate ${
                      isUnread ? "text-purple-600 dark:text-purple-300 font-semibold" : "text-app-muted"
                    }`}
                  >
                    {item.text ? item.text : (t("messages.media") || "Media")}
                  </p>
                </div>

                <div className="flex flex-col items-end text-[10px] text-app-muted shrink-0">
                  <span>{moment(item.createdAt).locale(lang).fromNow(true)}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default RecentMessages;