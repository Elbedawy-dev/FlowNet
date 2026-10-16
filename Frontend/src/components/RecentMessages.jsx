import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import moment from "moment";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { messagesApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useSocket } from "../context/SocketContext";
import Avatar from "./Avatar";

const RecentMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useCurrentUser();
  const { socket } = useSocket();

  const fetchRecent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await messagesApi.getRecent();
      setMessages(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn("[RecentMessages] Failed to fetch:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?._id) {
      fetchRecent();
    }
  }, [currentUser?._id, fetchRecent]);

  // Refresh recent list on new message received via socket
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = () => {
      fetchRecent();
    };
    socket.on("message:new", handleNewMessage);
    socket.on("message:seen", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:seen", handleNewMessage);
    };
  }, [socket, fetchRecent]);

  return (
    <motion.div
      className="w-72 flex flex-col text-sm bg-linear-to-b from-[#1a1f4d]/80 via-[#0f172a]/60 to-[#0b0f3b]/90 backdrop-blur-xl rounded-3xl shadow-[0_0_25px_rgba(131,58,180,0.5)] border border-purple-500/30 overflow-hidden max-h-[calc(100vh-6rem)]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="font-bold text-white px-5 py-4 border-b border-purple-500/30 bg-purple-900/15 backdrop-blur-md flex items-center justify-between">
        <span>Messages</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {messages.length}
        </span>
      </h3>

      <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-purple-500/10">
        {loading ? (
          <div className="p-6 text-center text-xs text-purple-300/70">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <MessageSquare className="w-8 h-8 text-purple-400/40 mb-2" />
            <p className="text-xs text-purple-300/70">No conversations yet</p>
          </div>
        ) : (
          messages.map((item, index) => {
            const partner = item.other_user || item.from_user_id || {};
            const isUnread = !item.seen && item.to_user_id === currentUser?._id;

            return (
              <Link
                to={`/messages/${partner._id}`}
                key={item._id || index}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-purple-700/20 hover:shadow-[0_0_20px_rgba(131,58,180,0.4)] transition-all duration-200"
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={partner.profile_picture}
                    name={partner.full_name || partner.username}
                    size="md"
                    ring={true}
                  />
                  {isUnread && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full animate-pulse ring-2 ring-[#0f172a]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-xs truncate">
                    {partner.full_name || partner.username || "User"}
                  </p>
                  <p
                    className={`text-xs truncate ${
                      isUnread ? "text-purple-200 font-semibold" : "text-purple-300/70"
                    }`}
                  >
                    {item.text ? item.text : "Photo attachment"}
                  </p>
                </div>

                <div className="flex flex-col items-end text-[10px] text-purple-400 shrink-0">
                  <span>{moment(item.createdAt).fromNow(true)}</span>
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