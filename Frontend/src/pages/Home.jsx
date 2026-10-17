import { useState, useEffect, useCallback } from "react";
import { Bell, Menu, X } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import logo from "../assets/logo.png";
import StoriesBar from "../components/StoriesBar";
import RecentMessages from "../components/RecentMessages";
import PostCard from "../components/PostCard";
import { PostCardSkeleton } from "../components/Skeletons";
import EmptyState from "../components/EmptyState";
import NotificationBadge from "../components/NotificationBadge";
import { postsApi } from "../api/axios";
import { useNotifications } from "../context/NotificationsContext";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useLanguage } from "../context/LanguageContext";

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const navigate = useNavigate();
  const outletCtx = useOutletContext();
  const sideBarOpen = outletCtx?.sideBarOpen ?? false;
  const setSideBarOpen = outletCtx?.setSideBarOpen ?? (() => {});
  const { unreadCount } = useNotifications();
  const { t } = useLanguage();

  const fetchInitialPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await postsApi.getFeed("global", null, 20);
      const items = Array.isArray(res) ? res : res?.items || [];
      setPosts(items);
      setNextCursor(res?.next_cursor || null);
      setHasMore(Boolean(res?.has_more));
    } catch (err) {
      console.warn("[Home] Failed to load feed:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (!hasMore || loadingMore || !nextCursor) return;

    try {
      setLoadingMore(true);
      const res = await postsApi.getFeed("global", nextCursor, 20);
      const newItems = Array.isArray(res) ? res : res?.items || [];
      setPosts((prev) => [...prev, ...newItems]);
      setNextCursor(res?.next_cursor || null);
      setHasMore(Boolean(res?.has_more));
    } catch (err) {
      console.warn("[Home] Failed to load more posts:", err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextCursor]);

  const sentinelRef = useInfiniteScroll(loadMorePosts, hasMore, loadingMore);

  useEffect(() => {
    fetchInitialPosts();
  }, [fetchInitialPosts]);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter" && searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  };

  return (
    <div className="h-full overflow-y-scroll no-scrollbar py-6 pt-5 sm:pt-6 xl:pr-5 flex flex-col items-center bg-app-page text-app relative pb-32">
      {/* Top Header Bar */}
      <div className="w-[92%] max-w-6xl mb-6 z-20 rounded-3xl bg-app-card backdrop-blur-xl border border-app shadow-app-glow p-3">
        {/* Mobile Row 1 (sm:hidden): Logo + FlowNet (Left) and Toggle (Right) */}
        <div className="flex sm:hidden items-center justify-between w-full mb-3">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img src={logo} alt="FlowNet" className="h-8 object-contain animate-pulse" />
            <span className="font-bold text-lg tracking-tight bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              FlowNet
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSideBarOpen((prev) => !prev)}
            className="relative z-50 p-2 bg-purple-900/80 text-white rounded-2xl border border-purple-500/40 shadow-lg w-10 h-10 flex items-center justify-center cursor-pointer backdrop-blur transition-all active:scale-95"
            aria-label="Toggle menu"
          >
            {sideBarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Row 2 on Mobile / Full Row on Desktop */}
        <div className="flex items-center justify-between w-full">
          {/* Desktop Logo */}
          <img
            src={logo}
            alt="FlowNet"
            className="h-9 mr-3 hidden sm:block animate-pulse object-contain cursor-pointer"
            onClick={() => navigate("/")}
          />

          <div className="flex-1 mx-1 sm:mx-6 max-w-md">
            <input
              type="text"
              placeholder={t("home.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full py-2.5 px-4 text-sm rounded-full border border-app bg-app-input text-app placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all shadow-inner"
            />
          </div>

          <div
            onClick={() => navigate("/notifications")}
            className="relative cursor-pointer p-2.5 rounded-full bg-linear-to-br from-purple-600 to-pink-500 shadow-[0_0_20px_rgba(255,0,255,0.5)] hover:scale-110 active:scale-95 transition-all shrink-0 ml-2"
            title={t("home.notificationsTooltip")}
          >
            <Bell className="w-5 h-5 text-white" />
            <NotificationBadge count={unreadCount} />
          </div>
        </div>
      </div>

      {/* Main Content: Feed + Recent Messages */}
      <div className="flex items-start justify-center xl:gap-8 w-full max-w-6xl px-4">
        {/* Posts Feed Column */}
        <div className="w-full max-w-2xl space-y-6">
          {loading ? (
            <div className="space-y-6">
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              title={t("home.noPostsTitle")}
              message={t("home.noPostsDesc")}
              actionText={t("home.createPostAction")}
              onAction={() => navigate("/create-post")}
            />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onDeleted={handlePostDeleted}
                onUpdated={handlePostUpdated}
                className="hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] transition-all duration-300"
              />
            ))
          )}

          {/* Infinite Scroll Loading Sentinel */}
          <div ref={sentinelRef} className="py-4 text-center">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-xs text-purple-300 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                {t("home.loadingMore")}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Messages Panel (xl+ screens only) */}
        <div className="max-xl:hidden sticky top-6 self-start shrink-0">
          <RecentMessages />
        </div>
      </div>

      {/* Stories Bar fixed to bottom */}
      <StoriesBar />

      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 bg-linear-to-br from-purple-600/10 via-pink-500/5 to-indigo-400/5 mix-blend-overlay -z-10" />
    </div>
  );
};

export default Home;