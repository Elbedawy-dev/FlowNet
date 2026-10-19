import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Compass, Search as SearchIcon } from "lucide-react";
import toast from "react-hot-toast";
import { usersApi } from "../api/axios";
import { useDebounce } from "../hooks/useDebounce";
import { useLanguage } from "../context/LanguageContext";
import UserCard from "../components/UserCard";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";

const Search = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState({});

  const debouncedQuery = useDebounce(query, 400);

  // Sync search query with URL param
  useEffect(() => {
    if (debouncedQuery) {
      setSearchParams({ q: debouncedQuery });
    } else {
      setSearchParams({});
    }
  }, [debouncedQuery, setSearchParams]);

  const searchUsers = useCallback(async (q) => {
    try {
      setLoading(true);
      const res = await usersApi.search(q, 1, 30);
      const userList = Array.isArray(res) ? res : res?.items || [];
      setUsers(userList);

      // Track following status
      const map = {};
      userList.forEach((u) => {
        map[u._id] = Boolean(u.is_following);
      });
      setFollowingMap(map);
    } catch (err) {
      console.warn("[Search] Search error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    searchUsers(debouncedQuery);
  }, [debouncedQuery, searchUsers]);

  const handleFollowToggle = async (userId) => {
    const isCurrentlyFollowing = Boolean(followingMap[userId]);

    // Optimistic toggle
    setFollowingMap((prev) => ({
      ...prev,
      [userId]: !isCurrentlyFollowing,
    }));

    try {
      if (isCurrentlyFollowing) {
        await usersApi.unfollow(userId);
      } else {
        await usersApi.follow(userId);
      }
    } catch (err) {
      // Rollback on error
      setFollowingMap((prev) => ({
        ...prev,
        [userId]: isCurrentlyFollowing,
      }));
      toast.error(err.message || t("common.error"));
    }
  };

  return (
    <div className="min-h-full py-10 px-4 flex flex-col items-center text-app pb-32">
      {/* Header Title */}
      <div className="text-center max-w-xl mb-8">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-pink-500/10 border border-pink-500/30 mb-3 shadow-md">
          <Compass className="w-8 h-8 text-pink-600 dark:text-pink-400 animate-pulse" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-700 via-fuchsia-600 to-pink-600 dark:from-pink-400 dark:via-purple-300 dark:to-indigo-300">
          {t("search.title")}
        </h1>
        <p className="text-app-muted text-sm mt-2">
          {t("search.subtitle")}
        </p>
      </div>

      {/* Glass Search Bar */}
      <div className="w-full max-w-2xl relative mb-10">
        <div className="relative flex items-center">
          <SearchIcon className="absolute start-4 w-5 h-5 text-app-muted pointer-events-none" />
          <input
            type="text"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full ps-12 pe-4 py-3.5 text-sm sm:text-base rounded-full bg-app-card border border-app text-app placeholder-app-muted backdrop-blur-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all shadow-[0_0_25px_rgba(131,58,180,0.15)] text-start"
          />
        </div>
      </div>

      {/* Results Section */}
      <div className="w-full max-w-6xl">
        {loading ? (
          <div className="py-16">
            <Loading className="min-h-[200px]" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title={t("search.noUsers")}
            message={t("search.noUsers")}
            actionText={query ? t("common.cancel") : undefined}
            onAction={query ? () => setQuery("") : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((u) => (
              <UserCard
                key={u._id}
                user={u}
                isFollowing={followingMap[u._id]}
                onFollowToggle={handleFollowToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
