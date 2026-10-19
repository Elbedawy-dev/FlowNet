import { useState, useEffect, useRef } from "react";
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Edit3,
  Trash2,
  X,
  Image as ImageIcon,
} from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useLanguage } from "../context/LanguageContext";
import { postsApi } from "../api/axios";
import Avatar from "./Avatar";
import ConfirmModal from "./ConfirmModal";
import toast from "react-hot-toast";

const PostCard = ({ post, onDeleted, onUpdated, className = "" }) => {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { t, lang } = useLanguage();

  const [currentPost, setCurrentPost] = useState(post);
  const [likes, setLikes] = useState(
    Array.isArray(post.likes_count) ? post.likes_count : []
  );
  const [shares, setShares] = useState(post.shares_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  // Menu & Modals
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Edit form state
  const [editContent, setEditContent] = useState(post.content || "");
  const [existingImages, setExistingImages] = useState(
    Array.isArray(post.image_urls) ? post.image_urls : []
  );
  const [removedImages, setRemovedImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);

  const menuRef = useRef(null);

  // Sync when post prop updates
  useEffect(() => {
    setCurrentPost(post);
    setLikes(Array.isArray(post.likes_count) ? post.likes_count : []);
    setShares(post.shares_count || 0);
    setEditContent(post.content || "");
    setExistingImages(Array.isArray(post.image_urls) ? post.image_urls : []);
  }, [post]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const postUserId = currentPost.user?._id || currentPost.user;
  const isOwner = currentUser?._id && String(postUserId) === String(currentUser._id);
  const isLikedByMe = currentUser?._id && likes.includes(currentUser._id);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser?._id || isLiking) return;

    setIsLiking(true);
    const newLikes = isLikedByMe
      ? likes.filter((id) => id !== currentUser._id)
      : [...likes, currentUser._id];

    setLikes(newLikes);

    try {
      const res = await postsApi.like(currentPost._id);
      if (res?.likes_count) {
        setLikes(res.likes_count);
      }
    } catch (err) {
      setLikes(likes);
      toast.error(err.message || t("posts.likeFailed") || "Failed to update like");
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/post/${currentPost._id}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t("posts.postLinkCopied") || "Post link copied to clipboard! 📋");
      }
      const res = await postsApi.share(currentPost._id);
      if (res?.shares_count !== undefined) {
        setShares(res.shares_count);
      } else {
        setShares((s) => s + 1);
      }
    } catch {
      toast.error(t("posts.copyFailed") || "Could not copy link");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await toast.promise(postsApi.delete(currentPost._id), {
        loading: t("posts.deletingPost") || "Deleting post...",
        success: t("posts.postDeleted") || "Post deleted successfully",
        error: (err) => err.message || "Failed to delete post",
      });
      setIsDeleteOpen(false);
      if (onDeleted) {
        onDeleted(currentPost._id);
      }
    } catch (err) {
      console.warn("[PostCard] Delete error:", err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = () => {
    setEditContent(currentPost.content || "");
    setExistingImages(Array.isArray(currentPost.image_urls) ? currentPost.image_urls : []);
    setRemovedImages([]);
    setNewImages([]);
    setNewImagePreviews([]);
    setMenuOpen(false);
    setIsEditOpen(true);
  };

  const handleRemoveExistingImage = (url) => {
    setExistingImages((prev) => prev.filter((img) => img !== url));
    setRemovedImages((prev) => [...prev, url]);
  };

  const handleAddNewImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentTotal = existingImages.length + newImages.length;
    const availableSlots = 4 - currentTotal;

    if (availableSlots <= 0) {
      toast.error(t("posts.maxImagesReached") || "Maximum 4 images allowed per post");
      return;
    }

    const filesToAdd = files.slice(0, availableSlots);
    setNewImages((prev) => [...prev, ...filesToAdd]);

    const newPreviews = filesToAdd.map((f) => URL.createObjectURL(f));
    setNewImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveNewImage = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const trimmed = editContent.trim();
    const totalRemaining = existingImages.length + newImages.length;

    if (!trimmed && totalRemaining === 0) {
      toast.error(
        t("posts.contentOrImageRequired") ||
          "Post must contain some text or at least one image"
      );
      return;
    }

    setIsSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append("content", trimmed);

      removedImages.forEach((url) => {
        formData.append("remove_image_urls", url);
      });

      newImages.forEach((file) => {
        formData.append("images", file);
      });

      const updated = await toast.promise(
        postsApi.update(currentPost._id, formData),
        {
          loading: t("posts.updatingPost") || "Saving changes...",
          success: t("posts.postUpdated") || "Post updated successfully! ✨",
          error: (err) => err.message || "Failed to update post",
        }
      );

      setCurrentPost(updated);
      setIsEditOpen(false);
      if (onUpdated) {
        onUpdated(updated);
      }
    } catch (err) {
      console.warn("[PostCard] Update error:", err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const renderFormattedContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(#[a-zA-Z0-9_\u0600-\u06FF]+)/g);
    return parts.map((part, index) =>
      part.startsWith("#") ? (
        <span key={index} className="text-indigo-400 font-medium">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const images = Array.isArray(currentPost.image_urls) ? currentPost.image_urls : [];

  return (
    <div
      className={`bg-app-card text-app rounded-2xl shadow-md p-4 space-y-3 w-full max-w-2xl border border-app relative ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div
          onClick={() =>
            currentPost.user?._id && navigate("/profile/" + currentPost.user._id)
          }
          className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
        >
          <Avatar
            src={currentPost.user?.profile_picture}
            name={currentPost.user?.full_name || currentPost.user?.username}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-app group-hover:text-indigo-400 transition-colors truncate">
                {currentPost.user?.full_name || "FlowNet User"}
              </span>
              {currentPost.user?.is_verified && (
                <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
              )}
            </div>
            <div className="text-app-muted text-xs flex items-center gap-1 flex-wrap">
              <span>@{currentPost.user?.username || "user"}</span>
              <span>•</span>
              <span>{moment(currentPost.createdAt).locale(lang).fromNow()}</span>
              {currentPost.edited && (
                <span className="text-[11px] text-purple-400 font-normal">
                  ({t("posts.edited") || "edited"})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Owner Menu (Three dots) */}
        {isOwner && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-full hover:bg-white/10 text-app-muted hover:text-app transition-colors cursor-pointer"
              aria-label="Post actions"
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <div className="absolute end-0 top-8 z-30 w-36 bg-app-card border border-app rounded-2xl shadow-xl p-1.5 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-app hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <Edit3 size={14} className="text-indigo-400" />
                  <span>{t("common.edit") || "Edit"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setIsDeleteOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 size={14} className="text-rose-400" />
                  <span>{t("common.delete") || "Delete"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post content */}
      {currentPost.content && (
        <div className="text-app text-sm whitespace-pre-line leading-relaxed">
          {renderFormattedContent(currentPost.content)}
        </div>
      )}

      {/* Post Images Grid */}
      {images.length > 0 && (
        <div
          className={`grid gap-2 overflow-hidden rounded-xl ${
            images.length === 1
              ? "grid-cols-1"
              : images.length === 2
              ? "grid-cols-2"
              : images.length === 3
              ? "grid-cols-2"
              : "grid-cols-2"
          }`}
        >
          {images.map((img, index) => (
            <img
              key={index}
              src={img}
              alt="Post attachment"
              className={`w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity ${
                images.length === 1
                  ? "max-h-96 h-auto"
                  : images.length === 3 && index === 0
                  ? "row-span-2 h-full min-h-[160px]"
                  : "h-40 md:h-48"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                window.open(img, "_blank");
              }}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-app-muted text-sm border-t border-app pt-3">
        <div
          className="flex items-center gap-1.5 cursor-pointer hover:text-app transition-colors select-none"
          onClick={handleLike}
        >
          <Heart
            className={`w-5 h-5 transition-transform active:scale-125 ${
              isLikedByMe ? "text-red-500 fill-red-500" : "hover:text-red-400"
            }`}
          />
          <span className={isLikedByMe ? "text-red-400 font-medium" : ""}>
            {likes.length}
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 cursor-pointer hover:text-app transition-colors select-none"
          onClick={() => navigate(`/post/${currentPost._id}`)}
        >
          <MessageCircle className="w-5 h-5 hover:text-indigo-400 transition-colors" />
          <span>
            {currentPost.comments_count !== undefined
              ? currentPost.comments_count
              : currentPost.comments?.length || 0}
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 cursor-pointer hover:text-app transition-colors select-none ms-auto"
          onClick={handleShare}
          title={t("posts.shareTooltip") || "Share post"}
        >
          <Share2 className="w-5 h-5 hover:text-purple-400 transition-colors" />
          <span>{shares}</span>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("posts.deletePostConfirm") || "Delete Post"}
        message={
          t("posts.deletePostMessage") ||
          "Are you sure you want to delete this post? This action cannot be undone."
        }
        confirmText={t("common.delete") || "Delete"}
        cancelText={t("common.cancel") || "Cancel"}
        danger={true}
        isLoading={isDeleting}
      />

      {/* Edit Post Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg bg-app-card border border-app rounded-3xl p-6 shadow-2xl text-app relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-app mb-4">
              <h3 className="text-lg font-bold">
                {t("posts.editPost") || "Edit Post"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-app-muted hover:text-app p-1 rounded-full cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder={
                  t("posts.createPostPlaceholder") || "What's on your mind?"
                }
                rows={4}
                maxLength={2000}
                className="w-full p-3 rounded-2xl bg-app-input border border-app text-app placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none text-sm"
              />

              {/* Existing & New Images Preview */}
              {(existingImages.length > 0 || newImagePreviews.length > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {existingImages.map((img) => (
                    <div
                      key={img}
                      className="relative rounded-xl overflow-hidden aspect-video border border-app group"
                    >
                      <img
                        src={img}
                        alt="Post media"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingImage(img)}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                        title={t("posts.removeImage") || "Remove image"}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {newImagePreviews.map((preview, i) => (
                    <div
                      key={preview}
                      className="relative rounded-xl overflow-hidden aspect-video border border-indigo-400/50 group"
                    >
                      <img
                        src={preview}
                        alt="New media preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveNewImage(i)}
                        className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                        title={t("posts.removeImage") || "Remove image"}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Images (up to max 4) */}
              {existingImages.length + newImages.length < 4 && (
                <div>
                  <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-app bg-white/5 hover:bg-white/10 text-xs font-semibold text-app cursor-pointer transition-all w-fit">
                    <ImageIcon size={16} className="text-purple-400" />
                    <span>
                      {t("posts.addImages") || "Add Images"} (
                      {existingImages.length + newImages.length}/4)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleAddNewImages}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-app">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-app text-app hover:bg-white/5 transition cursor-pointer"
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2 rounded-xl text-xs font-semibold bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit
                    ? t("common.saving") || "Saving..."
                    : t("common.save") || "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;