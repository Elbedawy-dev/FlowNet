import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Eye, MessagesSquare } from "lucide-react";
import { usersApi } from "../api/axios";
import { useLanguage } from "../context/LanguageContext";
import Avatar from "../components/Avatar";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";

const Messages = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    const fetchConnections = async () => {
      try {
        setLoading(true);
        const res = await usersApi.getNetwork();
        if (isMounted) {
          setConnections(Array.isArray(res?.connections) ? res.connections : []);
        }
      } catch (err) {
        console.warn("[Messages] Failed to fetch connections:", err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchConnections();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-full py-10 px-4 flex flex-col items-center text-app pb-32">
      {/* Header */}
      <div className="text-center max-w-xl mb-10">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-3 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
          <MessagesSquare className="w-8 h-8 text-yellow-400" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400">
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
        ) : connections.length === 0 ? (
          <EmptyState
            title={t("messages.noMessages")}
            message={t("messages.noMessages")}
            actionText={t("sidebar.discover")}
            onAction={() => navigate("/search")}
          />
        ) : (
          connections.map((user) => (
            <div
              key={user._id}
              onClick={() => navigate(`/messages/${user._id}`)}
              className="flex items-center justify-between p-4 rounded-3xl bg-app-card backdrop-blur-xl border border-app hover:border-purple-400/50 hover:shadow-[0_0_25px_rgba(131,58,180,0.3)] transition-all duration-300 cursor-pointer group"
            >
              {/* User Avatar & Info */}
              <div className="flex items-center gap-4 min-w-0 pr-2">
                <Avatar
                  src={user.profile_picture}
                  name={user.full_name || user.username}
                  size="lg"
                  ring={true}
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-app text-base group-hover:text-indigo-400 transition-colors truncate">
                    {user.full_name || "User"}
                  </h3>
                  <p className="text-app-muted text-xs truncate">
                    @{user.username || "user"}
                  </p>
                  {user.bio && (
                    <p className="text-app-muted text-xs truncate mt-0.5 max-w-md hidden sm:block">
                      {user.bio}
                    </p>
                  )}
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
                  title={t("messages.typeMessage")}
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
                  title={t("messages.viewProfile")}
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
