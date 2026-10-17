import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Star, MessageCircle, UserX, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { usersApi, connectionsApi } from "../api/axios";
import { useLanguage } from "../context/LanguageContext";
import Avatar from "../components/Avatar";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";

const Connections = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("followers");
  const [network, setNetwork] = useState({
    followers: [],
    following: [],
    pending: [],
    connections: [],
    counts: { followers: 0, following: 0, pending: 0, connections: 0 },
  });
  const [loading, setLoading] = useState(true);

  const fetchNetwork = useCallback(async () => {
    try {
      setLoading(true);
      const res = await usersApi.getNetwork();
      setNetwork({
        followers: res?.followers || [],
        following: res?.following || [],
        pending: res?.pending || [],
        connections: res?.connections || [],
        counts: res?.counts || { followers: 0, following: 0, pending: 0, connections: 0 },
      });
    } catch (err) {
      console.warn("[Network] Error loading network:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  const handleUnfollow = async (userId) => {
    try {
      await usersApi.unfollow(userId);
      setNetwork((prev) => ({
        ...prev,
        following: prev.following.filter((u) => u._id !== userId),
        counts: { ...prev.counts, following: Math.max(0, prev.counts.following - 1) },
      }));
      toast.success(t("connections.unfollow") + " " + t("common.success"));
    } catch (err) {
      toast.error(err.message || t("common.error"));
    }
  };

  const handleAcceptPending = async (userId) => {
    try {
      await connectionsApi.accept(userId);
      toast.success(t("common.success"));
      fetchNetwork();
    } catch (err) {
      toast.error(err.message || t("common.error"));
    }
  };

  const handleRejectPending = async (userId) => {
    try {
      await connectionsApi.reject(userId);
      setNetwork((prev) => ({
        ...prev,
        pending: prev.pending.filter((p) => p.from_user?._id !== userId),
        counts: { ...prev.counts, pending: Math.max(0, prev.counts.pending - 1) },
      }));
      toast.success(t("common.success"));
    } catch (err) {
      toast.error(err.message || t("common.error"));
    }
  };

  const tabs = [
    {
      id: "followers",
      label: t("connections.followers"),
      count: network.counts.followers,
      activeClass: "bg-linear-to-r from-purple-600 to-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]",
    },
    {
      id: "following",
      label: t("connections.following"),
      count: network.counts.following,
      activeClass: "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]",
    },
    {
      id: "pending",
      label: t("connections.pending"),
      count: network.counts.pending,
      activeClass: "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]",
    },
    {
      id: "connections",
      label: t("connections.connections"),
      count: network.counts.connections,
      activeClass: "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]",
    },
  ];

  const currentList =
    activeTab === "followers"
      ? network.followers
      : activeTab === "following"
      ? network.following
      : activeTab === "pending"
      ? network.pending
      : network.connections;

  return (
    <div className="min-h-full py-10 px-4 flex flex-col items-center text-app pb-32">
      {/* Header Title */}
      <div className="text-center max-w-xl mb-8">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
          <Star className="w-8 h-8 text-amber-400 fill-amber-400/20 animate-pulse" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-indigo-300">
          {t("connections.title")}
        </h1>
        <p className="text-app-muted text-sm mt-2">
          {t("connections.subtitle")}
        </p>
      </div>

      {/* 4 Pill Tabs */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center mb-10 max-w-3xl">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? tab.activeClass
                  : "bg-app-card text-app-muted hover:text-app border border-app"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  isActive ? "bg-white/20 text-white font-bold" : "bg-app-input text-app-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid Content */}
      <div className="w-full max-w-6xl">
        {loading ? (
          <div className="py-12">
            <Loading />
          </div>
        ) : currentList.length === 0 ? (
          <EmptyState
            title={`No ${activeTab} yet`}
            message={
              activeTab === "pending"
                ? t("connections.emptyPending")
                : activeTab === "following"
                ? t("connections.emptyFollowing")
                : activeTab === "followers"
                ? t("connections.emptyFollowers")
                : t("connections.emptyConnections")
            }
            actionText={activeTab !== "pending" ? t("sidebar.discover") : undefined}
            onAction={activeTab !== "pending" ? () => navigate("/search") : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentList.map((item) => {
              // In pending tab, item has { _id, from_user: { _id, full_name, username, profile_picture }, createdAt }
              const user = activeTab === "pending" ? item.from_user || item : item;

              return (
                <div
                  key={item._id || user._id}
                  className="bg-app-card backdrop-blur-xl border border-app hover:border-purple-400/40 rounded-3xl p-6 flex flex-col items-center text-center shadow-[0_0_25px_rgba(131,58,180,0.2)] hover:shadow-[0_0_35px_rgba(168,85,247,0.35)] transition-all duration-300 relative group"
                >
                  <Avatar
                    src={user.profile_picture}
                    name={user.full_name || user.username}
                    size="xl"
                    ring={true}
                    onClick={() => user._id && navigate(`/profile/${user._id}`)}
                    className="mb-3"
                  />

                  <h3
                    onClick={() => user._id && navigate(`/profile/${user._id}`)}
                    className="font-bold text-app text-base hover:text-indigo-400 transition-colors cursor-pointer truncate max-w-full"
                  >
                    {user.full_name || "User"}
                  </h3>
                  <p className="text-app-muted text-xs mb-2">@{user.username || "user"}</p>

                  <p className="text-app-muted text-xs line-clamp-2 min-h-[32px] mb-4 px-2">
                    {user.bio ? `${user.bio.slice(0, 75)}...` : "FlowNet community explorer ✨"}
                  </p>

                  {/* Actions depending on Tab */}
                  <div className="w-full flex items-center gap-2 mt-auto pt-2 border-t border-app">
                    {activeTab === "pending" ? (
                      <>
                        <button
                          onClick={() => handleAcceptPending(user._id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md active:scale-95 transition cursor-pointer"
                        >
                          <Check size={14} /> {t("connections.accept")}
                        </button>
                        <button
                          onClick={() => handleRejectPending(user._id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-app-input hover:bg-rose-600/30 text-rose-300 border border-app text-xs font-semibold active:scale-95 transition cursor-pointer"
                        >
                          <X size={14} /> {t("connections.reject")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => user._id && navigate(`/profile/${user._id}`)}
                          className="flex-1 py-2 px-3 rounded-2xl bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold shadow-md active:scale-95 transition cursor-pointer"
                        >
                          {t("connections.viewProfile")}
                        </button>

                        {activeTab === "following" && (
                          <button
                            onClick={() => handleUnfollow(user._id)}
                            className="p-2 rounded-2xl bg-app-input hover:bg-rose-500/20 text-app-muted hover:text-rose-400 border border-app transition cursor-pointer"
                            title={t("connections.unfollow")}
                          >
                            <UserX size={15} />
                          </button>
                        )}

                        {activeTab === "connections" && (
                          <button
                            onClick={() => user._id && navigate(`/messages/${user._id}`)}
                            className="p-2 rounded-2xl bg-linear-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md transition cursor-pointer"
                            title={t("connections.message")}
                          >
                            <MessageCircle size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Connections;
