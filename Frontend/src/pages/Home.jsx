import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import StoriesBar from "../components/StoriesBar";
import RecentMessages from "../components/RecentMessages";
import PostCard from "../components/PostCard";
import { PostCardSkeleton } from "../components/Skeletons";
import EmptyState from "../components/EmptyState";
import { postsApi } from "../api/axios";
import { useNotifications } from "../context/NotificationsContext";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

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

  return (
    <div className="h-full overflow-y-scroll no-scrollbar py-6 xl:pr-5 flex flex-col items-center bg-linear-to-b from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] text-white relative pb-32">
      {/* Top Header Bar */}
      <div className="w-[92%] max-w-6xl flex justify-between items-center p-3 mb-6 z-20 rounded-3xl bg-white/5 backdrop-blur-xl border border-purple-500/20 shadow-[0_0_25px_rgba(131,58,180,0.3)]">
        <img
          src={logo}
          alt="FlowNet"
          className="h-9 mr-3 hidden sm:block animate-pulse object-contain cursor-pointer"
          onClick={() => navigate("/")}
        />

        <div className="flex-1 mx-2 sm:mx-6 max-w-md">
          <input
            type="text"
            placeholder="ابحث هنا..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full py-2.5 px-4 text-sm rounded-full border border-purple-500/30 bg-[#0f172a]/70 text-white placeholder-purple-300/60 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all shadow-inner text-right"
            dir="rtl"
          />
        </div>

        <div
          onClick={() => navigate("/notifications")}
          className="relative cursor-pointer p-2.5 rounded-full bg-linear-to-br from-purple-600 to-pink-500 shadow-[0_0_20px_rgba(255,0,255,0.5)] hover:scale-110 active:scale-95 transition-all"
          title="Notifications"
        >
          <Bell className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-500 animate-pulse ring-2 ring-[#0b0f3b]" />
          )}
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
              title="No posts in the cosmic feed yet"
              message="Be the first explorer to share a spark in FlowNet!"
              actionText="Create Post"
              onAction={() => navigate("/create-post")}
            />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                className="hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] transition-all duration-300"
              />
            ))
          )}

          {/* Infinite Scroll Loading Sentinel */}
          <div ref={sentinelRef} className="py-4 text-center">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-xs text-purple-300 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                Loading more cosmic posts...
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