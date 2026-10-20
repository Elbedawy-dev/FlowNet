import { useState, useEffect, useCallback } from "react";
import { Bell, Menu, X } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Logo from "../components/Logo";
import StoriesBar from "../components/StoriesBar";
import RecentMessages from "../components/RecentMessages";
import PostCard from "../components/PostCard";
import { PostCardSkeleton } from "../components/Skeletons";
import EmptyState from "../components/EmptyState";
import NotificationBadge from "../components/NotificationBadge";
import { postsApi } from "../api/axios";
import { useNotifications } from "../context/NotificationsContext";
import { useSocketEvent } from "../context/SocketContext";
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
  const setSideBarOpen = outletCtx?.setSideBarOpen ?? (() => { });
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

  const handlePostDeleted = useCallback((deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  }, []);

  const handlePostUpdated = useCallback((updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  }, []);

  useSocketEvent(
    "post:deleted",
    useCallback((data) => {
      const id = data?.postId || data?.id || data;
      if (id) {
        handlePostDeleted(id);
      }
    }, [handlePostDeleted])
  );

  useSocketEvent(
    "post:stats",
    useCallback((data) => {
      if (!data?.postId) return;
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== data.postId) return p;
          const updated = { ...p };
          if (data.commentsCount !== undefined) {
            updated.comments_count = data.commentsCount;
          }
          if (data.sharesCount !== undefined) {
            updated.shares_count = data.sharesCount;
          }
          return updated;
        })
      );
    }, [])
  );

  return (
    <div className="h-full overflow-y-scroll no-scrollbar py-6 pt-5 sm:pt-6 xl:pr-5 flex flex-col items-center bg-app-page text-app relative pb-32">
      {/* Top Header Bar */}
      <div className="w-[92%] max-w-6xl mb-6 z-20 rounded-3xl bg-app-card backdrop-blur-xl border border-app shadow-app-glow p-3">
        {/* Mobile Row 1 (sm:hidden): Logo (Left) and Actions (Bell + Toggle) (Right) */}
        <div dir="ltr" className="flex sm:hidden items-center justify-between w-full mb-2.5">
          <Logo
            onClick={() => navigate("/")}
            iconClassName="w-7 h-7"
            textClassName="text-lg"
          />
          <div className="flex items-center gap-2">
            <div
              onClick={() => navigate("/notifications")}
              className="relative cursor-pointer p-2 rounded-full bg-linear-to-br from-purple-600 to-pink-500 shadow-[0_0_15px_rgba(255,0,255,0.4)] hover:scale-110 active:scale-95 transition-all shrink-0"
              title={t("home.notificationsTooltip")}
            >
              <Bell className="w-4 h-4 text-white" />
              <NotificationBadge count={unreadCount} />
            </div>
            <button
              type="button"
              onClick={() => setSideBarOpen((prev) => !prev)}
              className="p-2 bg-surface text-app rounded-2xl border border-app shadow-md w-9 h-9 flex items-center justify-center cursor-pointer backdrop-blur transition-all active:scale-95"
              aria-label="Toggle menu"
            >
              {sideBarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Row 2 on Mobile / Full Row on Desktop */}
        <div dir="ltr" className="flex items-center justify-between w-full">
          {/* Desktop Logo (hidden on mobile) */}
          <div className="hidden sm:flex items-center mr-4 shrink-0">
            <Logo
              onClick={() => navigate("/")}
              iconClassName="w-8 h-8"
              textClassName="text-xl"
            />
          </div>

          <div className="flex-1 mx-0 sm:mx-6 max-w-md">
            <input
              type="text"
              dir="auto"
              placeholder={t("home.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full py-2.5 px-4 text-sm rounded-full border border-app bg-app-input text-app placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all shadow-inner"
            />
          </div>

          {/* Desktop Bell (hidden on mobile since it is in row 1) */}
          <div
            onClick={() => navigate("/notifications")}
            className="hidden sm:flex relative cursor-pointer p-2.5 rounded-full bg-linear-to-br from-purple-600 to-pink-500 shadow-[0_0_20px_rgba(255,0,255,0.5)] hover:scale-110 active:scale-95 transition-all shrink-0 ml-2"
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
        <div className="w-full max-w-2xl flex flex-col gap-6" id="feed-column">
          {/* Mobile Messages Strip (below xl) */}
          <div className="xl:hidden" id="recent-messages-mobile">
            <RecentMessages mobile={true} />
          </div>

          {loading ? (
            <div className="flex flex-col gap-6" id="feed-loading-skeletons">
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <div id="feed-first-card">
              <EmptyState
                title={t("home.noPostsTitle")}
                message={t("home.noPostsDesc")}
                actionText={t("home.createPostAction")}
                onAction={() => navigate("/create-post")}
              />
            </div>
          ) : (
            posts.map((post, idx) => (
              <div key={post._id} id={idx === 0 ? "feed-first-card" : undefined}>
                <PostCard
                  post={post}
                  onDeleted={handlePostDeleted}
                  onUpdated={handlePostUpdated}
                  className="hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] transition-all duration-300"
                />
              </div>
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

        {/* Sticky Messages Panel (xl+ screens only, perfectly aligned with feed top) */}
        <div id="recent-messages-desktop" className="max-xl:hidden sticky top-6 self-start shrink-0">
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