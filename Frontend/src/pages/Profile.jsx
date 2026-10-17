import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPin,
  Calendar,
  BadgeCheck,
  Edit3,
  UserPlus,
  UserCheck,
  ShieldAlert,
  UserX,
  Camera,
  X,
  Image as ImageIcon,
  Grid,
  FileText,
} from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import { usersApi, connectionsApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useLanguage } from "../context/LanguageContext";
import PostCard from "../components/PostCard";
import Avatar from "../components/Avatar";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";

const Profile = () => {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const { currentUser, refreshUser, setCurrentUser } = useCurrentUser();
  const { t } = useLanguage();

  const isOwnProfile = !profileId || profileId === currentUser?._id;
  const targetId = isOwnProfile ? currentUser?._id : profileId;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("POSTS");
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  // Edit Profile Modal States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editBio, setEditBio] = useState("");
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [coverPhotoFile, setCoverPhotoFile] = useState(null);
  const [coverPhotoPreview, setCoverPhotoPreview] = useState(null);
  const [usernameError, setUsernameError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Action loading states
  const [followLoading, setFollowLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await usersApi.getById(targetId);
      setProfile(res);

      if (isOwnProfile) {
        setEditFullName(res.full_name || "");
        setEditUsername(res.username || "");
        setEditLocation(res.location || "");
        setEditBio(res.bio || "");
      }
    } catch (err) {
      toast.error(err.message || "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [targetId, isOwnProfile]);

  const fetchUserPosts = useCallback(async (type) => {
    if (!targetId) return;
    try {
      setPostsLoading(true);
      const res = await usersApi.getPosts(targetId, type === "MEDIA" ? "media" : "posts");
      const list = Array.isArray(res) ? res : res?.items || [];
      setPosts(list);
    } catch (err) {
      console.warn("[Profile] Failed to load posts:", err.message);
    } finally {
      setPostsLoading(false);
    }
  }, [targetId]);

  const handlePostDeleted = (deletedId) => {
    setPosts((prev) => prev.filter((p) => p._id !== deletedId));
  };

  const handlePostUpdated = (updatedPost) => {
    setPosts((prev) =>
      prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
    );
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile && !profile.has_blocked_me) {
      fetchUserPosts(activeTab);
    }
  }, [profile, activeTab, fetchUserPosts]);

  const handleFollowToggle = async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    const currentlyFollowing = profile.is_following;

    // Optimistic toggle
    setProfile((prev) => ({
      ...prev,
      is_following: !currentlyFollowing,
      followers_count: Math.max(
        0,
        (prev.followers_count || 0) + (currentlyFollowing ? -1 : 1)
      ),
    }));

    try {
      if (currentlyFollowing) {
        await usersApi.unfollow(profile._id);
        toast.success(`Unfollowed @${profile.username}`);
      } else {
        await usersApi.follow(profile._id);
        toast.success(`Following @${profile.username}! ✨`);
      }
    } catch (err) {
      // Rollback
      setProfile((prev) => ({
        ...prev,
        is_following: currentlyFollowing,
      }));
      toast.error(err.message || "Failed to update follow status");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!profile) return;
    const isBlocked = profile.is_blocked_by_me;

    try {
      if (isBlocked) {
        await usersApi.unblock(profile._id);
        toast.success("User unblocked");
        setProfile((prev) => ({ ...prev, is_blocked_by_me: false }));
      } else {
        await usersApi.block(profile._id);
        toast.success("User blocked");
        setProfile((prev) => ({
          ...prev,
          is_blocked_by_me: true,
          is_following: false,
          connection_status: "none",
        }));
      }
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleConnectionRequest = async () => {
    if (!profile || connectLoading) return;
    setConnectLoading(true);

    try {
      if (profile.connection_status === "none") {
        await connectionsApi.request(profile._id);
        toast.success("Connection request sent! 🤝");
        setProfile((p) => ({ ...p, connection_status: "pending_sent" }));
      } else if (profile.connection_status === "pending_received") {
        await connectionsApi.accept(profile._id);
        toast.success("Connection accepted! 🎉");
        setProfile((p) => ({
          ...p,
          connection_status: "connected",
          connections_count: (p.connections_count || 0) + 1,
        }));
      } else if (profile.connection_status === "connected" || profile.connection_status === "pending_sent") {
        await connectionsApi.remove(profile._id);
        toast.success("Connection removed");
        setProfile((p) => ({
          ...p,
          connection_status: "none",
          connections_count: Math.max(0, (p.connections_count || 1) - 1),
        }));
      }
    } catch (err) {
      toast.error(err.message || "Connection action failed");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setUsernameError("");
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("full_name", editFullName.trim());
      formData.append("username", editUsername.trim().toLowerCase());
      formData.append("location", editLocation.trim());
      formData.append("bio", editBio.trim());

      if (profilePicFile) {
        formData.append("profile_picture", profilePicFile);
      }
      if (coverPhotoFile) {
        formData.append("cover_photo", coverPhotoFile);
      }

      const updated = await usersApi.updateMe(formData);
      setProfile(updated);
      setCurrentUser(updated);
      await refreshUser();

      setIsEditOpen(false);
      toast.success("Profile updated successfully! ✨");
    } catch (err) {
      if (err.code === "USERNAME_TAKEN") {
        setUsernameError("This username is already taken. Please choose another.");
      } else {
        toast.error(err.message || "Failed to update profile");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-white">
        <h2 className="text-xl font-bold mb-4">Profile not found</h2>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 text-sm font-semibold"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full py-6 px-4 flex flex-col items-center bg-app-page text-app pb-32">
      <div className="w-full max-w-4xl">
        {/* Cover Photo Banner */}
        <div className="relative w-full h-44 sm:h-64 rounded-3xl overflow-hidden border border-app bg-linear-to-r from-indigo-900 via-purple-900 to-pink-900 shadow-app-glow">
          {profile.cover_photo ? (
            <img
              src={profile.cover_photo}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-30">
              <ImageIcon size={48} className="text-purple-300" />
            </div>
          )}
        </div>

        {/* Profile Card Info Box */}
        <div className="relative bg-app-card backdrop-blur-xl border border-app rounded-3xl p-6 sm:p-8 mt-[-3rem] sm:mt-[-4rem] mx-2 sm:mx-4 shadow-app-glow z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
            {/* Avatar overlapping banner */}
            <div className="relative mt-[-4rem] sm:mt-[-5rem]">
              <Avatar
                src={profile.profile_picture}
                name={profile.full_name || profile.username}
                size="2xl"
                ring={true}
                className="w-28 h-28 sm:w-36 sm:h-36 ring-4 ring-purple-400/90 shadow-[0_0_30px_rgba(168,85,247,0.7)]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
              {isOwnProfile ? (
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold shadow-[0_0_15px_rgba(168,85,247,0.5)] active:scale-95 transition-all cursor-pointer"
                >
                  <Edit3 size={15} /> {t("profile.editProfile") || "Edit Profile"}
                </button>
              ) : profile.has_blocked_me ? null : (
                <>
                  {/* Follow / Unfollow */}
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-md ${
                      profile.is_following
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600 hover:text-white"
                        : "bg-linear-to-r from-red-500 to-pink-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]"
                    }`}
                  >
                    {profile.is_following ? (
                      <>
                        <UserCheck size={15} /> {t("profile.following") || "Following"}
                      </>
                    ) : (
                      <>
                        <UserPlus size={15} /> {t("profile.follow") || "Follow"}
                      </>
                    )}
                  </button>

                  {/* Connect Button */}
                  <button
                    onClick={handleConnectionRequest}
                    disabled={connectLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-app text-app text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                  >
                    {profile.connection_status === "connected"
                      ? `${t("profile.connected") || "Connected"} 🤝`
                      : profile.connection_status === "pending_sent"
                      ? `${t("profile.pending") || "Pending..."}`
                      : profile.connection_status === "pending_received"
                      ? t("profile.acceptRequest") || "Accept Request"
                      : t("profile.connect") || "Connect"}
                  </button>

                  {/* Block / Unblock Button */}
                  <button
                    onClick={handleBlockToggle}
                    className={`p-2.5 rounded-2xl text-xs font-medium transition-all active:scale-95 cursor-pointer border ${
                      profile.is_blocked_by_me
                        ? "bg-rose-600/30 border-rose-500/50 text-rose-300 hover:bg-rose-600/50"
                        : "bg-purple-950/60 border-purple-800/60 text-purple-300 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30"
                    }`}
                    title={profile.is_blocked_by_me ? (t("profile.unblock") || "Unblock user") : (t("profile.block") || "Block user")}
                  >
                    {profile.is_blocked_by_me ? (
                      <span className="flex items-center gap-1 text-rose-400">
                        <ShieldAlert size={15} /> {t("profile.unblock") || "Unblock"}
                      </span>
                    ) : (
                      <UserX size={15} />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="mt-4 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5">
              <h2 className="text-xl sm:text-2xl font-bold text-app">
                {profile.full_name || "User"}
              </h2>
              {profile.is_verified && (
                <BadgeCheck size={20} className="text-blue-400" />
              )}
            </div>
            <p className="text-app-muted text-xs sm:text-sm">
              @{profile.username || "user"}
            </p>

            {profile.bio && (
              <p className="text-app text-sm mt-3 leading-relaxed max-w-2xl whitespace-pre-line">
                {profile.bio}
              </p>
            )}

            {/* Chips Row */}
            <div className="flex items-center gap-4 mt-4 text-xs text-app-muted flex-wrap justify-center sm:justify-start">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-pink-400" />
                  <span>{profile.location}</span>
                </span>
              )}
              {profile.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} className="text-indigo-400" />
                  <span>{t("profile.joined") || "Joined"} {moment(profile.createdAt).format("MMMM YYYY")}</span>
                </span>
              )}
            </div>

            {/* Network Counts */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-app text-xs text-app-muted justify-center sm:justify-start">
              <div>
                <span className="font-bold text-app text-sm mr-1">
                  {profile.followers_count ?? (profile.followers?.length || 0)}
                </span>
                <span>{t("profile.followers") || "Followers"}</span>
              </div>
              <div>
                <span className="font-bold text-app text-sm mr-1">
                  {profile.following_count ?? (profile.following?.length || 0)}
                </span>
                <span>{t("profile.following") || "Following"}</span>
              </div>
              <div>
                <span className="font-bold text-app text-sm mr-1">
                  {profile.connections_count ?? (profile.connections?.length || 0)}
                </span>
                <span>{t("profile.connections") || "Connections"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Blocked by them notice */}
        {profile.has_blocked_me ? (
          <div className="my-10 p-8 rounded-3xl bg-pink-950/30 border border-pink-500/30 text-center">
            <p className="text-base text-pink-300 font-semibold mb-1">
              {t("profile.blockedNotice") || "This user has blocked you"}
            </p>
            <p className="text-xs text-app-muted">
              {t("profile.blockedDetails") || "User details and posts are not accessible."}
            </p>
          </div>
        ) : (
          <>
            {/* Tabs Row: POSTS | MEDIA */}
            <div className="flex items-center justify-center gap-3 mt-8 mb-6">
              <button
                onClick={() => setActiveTab("POSTS")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold tracking-wider transition-all cursor-pointer ${
                  activeTab === "POSTS"
                    ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.7)]"
                    : "bg-white/5 text-app-muted hover:bg-white/10 border border-app"
                }`}
              >
                <FileText size={15} /> {t("profile.postsTab") || "POSTS"}
              </button>

              <button
                onClick={() => setActiveTab("MEDIA")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold tracking-wider transition-all cursor-pointer ${
                  activeTab === "MEDIA"
                    ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.7)]"
                    : "bg-white/5 text-app-muted hover:bg-white/10 border border-app"
                }`}
              >
                <Grid size={15} /> {t("profile.mediaTab") || "MEDIA"}
              </button>
            </div>

            {/* Posts Content */}
            <div className="flex flex-col items-center space-y-6">
              {postsLoading ? (
                <div className="py-12">
                  <Loading className="min-h-[150px]" />
                </div>
              ) : posts.length === 0 ? (
                <EmptyState
                  title={
                    activeTab === "MEDIA"
                      ? (t("profile.noMediaTitle") || "No photos or media yet")
                      : (t("profile.noPostsTitle") || "No posts published yet")
                  }
                  message={
                    isOwnProfile
                      ? (t("profile.shareFirstPost") || "Share your first cosmic moment with the world!")
                      : (t("profile.userNoPosts") || "This user has not posted anything yet.")
                  }
                  actionText={isOwnProfile ? (t("home.createPostAction") || "Create Post") : undefined}
                  onAction={isOwnProfile ? () => navigate("/create-post") : undefined}
                />
              ) : activeTab === "MEDIA" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  {posts.map((post) =>
                    (post.image_urls || []).map((img, i) => (
                      <div
                        key={`${post._id}-${i}`}
                        onClick={() => navigate(`/post/${post._id}`)}
                        className="relative rounded-2xl overflow-hidden aspect-square border border-app group cursor-pointer"
                      >
                        <img
                          src={img}
                          alt="Post media"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ))
                  )}
                </div>
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
            </div>
          </>
        )}
      </div>

      {/* EDIT PROFILE MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-app-card border border-app rounded-3xl p-6 sm:p-8 shadow-2xl text-app relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-5 right-5 p-1 text-app-muted hover:text-app rounded-full cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300">
              {t("profile.editProfile") || "Edit Profile"}
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Cover Photo Picker */}
              <div>
                <label className="block text-xs font-semibold text-app-muted mb-1.5">
                  {t("profile.coverPhoto") || "Cover Photo"}
                </label>
                <div className="relative w-full h-28 rounded-2xl overflow-hidden border border-app group bg-white/5">
                  <img
                    src={coverPhotoPreview || profile.cover_photo || ""}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-xs font-semibold text-white transition-opacity cursor-pointer">
                    <Camera size={16} /> {t("profile.changeCover") || "Change Cover Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCoverPhotoFile(file);
                          setCoverPhotoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Profile Picture Picker */}
              <div className="flex items-center gap-4">
                <Avatar
                  src={profilePicPreview || profile.profile_picture}
                  name={editFullName || editUsername}
                  size="xl"
                  ring={true}
                />
                <label className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-app text-app hover:text-white transition cursor-pointer">
                  {t("profile.changeAvatar") || "Change Profile Picture"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setProfilePicFile(file);
                        setProfilePicPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-app-muted mb-1">
                  {t("profile.fullName") || "Full Name"}
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full py-2.5 px-4 rounded-xl bg-app-input border border-app text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  required
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-app-muted mb-1">
                  {t("profile.username") || "Username"}
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => {
                    setEditUsername(e.target.value);
                    setUsernameError("");
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl bg-app-input border ${
                    usernameError ? "border-rose-500" : "border-app"
                  } text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400`}
                  required
                />
                {usernameError && (
                  <p className="text-rose-400 text-xs mt-1">{usernameError}</p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-app-muted mb-1">
                  {t("profile.location") || "Location"}
                </label>
                <input
                  type="text"
                  value={editLocation}
                  placeholder={t("profile.locationPlaceholder") || "Enter your location"}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full py-2.5 px-4 rounded-xl bg-app-input border border-app text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-app-muted mb-1">
                  {t("profile.bio") || "Bio"}
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full py-2.5 px-4 rounded-xl bg-app-input border border-app text-app text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                  maxLength={500}
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-app">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-app text-app hover:bg-white/5 transition cursor-pointer"
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 rounded-xl text-xs font-semibold bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (t("common.saving") || "Saving...") : (t("common.save") || "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
