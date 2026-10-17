import { useEffect, useState, useRef, useCallback } from "react";
import {
  BadgeCheck,
  X,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit3,
  Trash2,
} from "lucide-react";
import { storiesApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useLanguage } from "../context/LanguageContext";
import Avatar from "./Avatar";
import ConfirmModal from "./ConfirmModal";
import StoryWindow from "./StoryWindow";
import toast from "react-hot-toast";

const StoryPlayer = ({
  viewStory,
  setViewStory,
  allStories = [],
  onStoryViewed,
  onStoryDeleted,
  onStoryUpdated,
}) => {
  const { currentUser } = useCurrentUser();
  const { t } = useLanguage();

  const [currentStory, setCurrentStory] = useState(viewStory);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const menuRef = useRef(null);

  // Modals & Menu
  const [menuOpen, setMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync currentStory when viewStory prop changes
  useEffect(() => {
    setCurrentStory(viewStory);
    setProgress(0);
    setMenuOpen(false);
    setIsConfirmDeleteOpen(false);
    setIsEditing(false);
  }, [viewStory]);

  const isPaused = menuOpen || isConfirmDeleteOpen || isEditing;

  // Pause video if paused
  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused]);

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

  const storyUserId = currentStory?.user?._id || currentStory?.user;
  const isOwner =
    currentUser?._id && String(storyUserId) === String(currentUser._id);

  // Find index of current story in allStories list
  const currentIndex = allStories.findIndex(
    (s) => s._id === currentStory?._id
  );

  const handleClose = useCallback(() => {
    setViewStory(null);
  }, [setViewStory]);

  const handleNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < allStories.length - 1) {
      setViewStory(allStories[currentIndex + 1]);
    } else {
      handleClose();
    }
  }, [currentIndex, allStories, setViewStory, handleClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setViewStory(allStories[currentIndex - 1]);
    }
  }, [currentIndex, allStories, setViewStory]);

  // Mark story as viewed via API
  useEffect(() => {
    if (currentStory?._id) {
      storiesApi.view(currentStory._id).catch(() => {});
      if (onStoryViewed) onStoryViewed(currentStory._id);
    }
  }, [currentStory?._id, onStoryViewed]);

  // Keyboard navigation: Esc, Left, Right
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isPaused) return;
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, handleNext, handlePrev, isPaused]);

  // Timer: 10s for text/image, or video duration
  useEffect(() => {
    if (!currentStory) return;
    if (isPaused) return; // Pause timer while menu or modal is open

    if (currentStory.media_type === "video") {
      // Handled via onTimeUpdate / onEnded of <video>
      return;
    }

    const duration = 10000; // 10 seconds
    const intervalTime = 100; // tick every 100ms

    const timer = setInterval(() => {
      setProgress((prev) => {
        const nextVal = prev + (intervalTime / duration) * 100;
        if (nextVal >= 100) {
          clearInterval(timer);
          handleNext();
          return 100;
        }
        return nextVal;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentStory, handleNext, isPaused]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const p =
        (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleDeleteStory = async () => {
    setIsDeleting(true);
    try {
      await toast.promise(storiesApi.delete(currentStory._id), {
        loading: t("common.saving") || "Deleting story...",
        success: t("stories.storyDeleted") || "Story deleted successfully",
        error: (err) => err.message || "Failed to delete story",
      });
      setIsConfirmDeleteOpen(false);
      handleClose();
      if (onStoryDeleted) {
        onStoryDeleted(currentStory._id);
      }
    } catch (err) {
      console.warn("[StoryPlayer] Delete error:", err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderContent = () => {
    switch (currentStory?.media_type) {
      case "image":
        return (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          />
        );
      case "video":
        return (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleNext}
            autoPlay
            playsInline
            className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
          />
        );
      case "text":
      default:
        return (
          <div className="w-full h-full min-h-[400px] flex items-center justify-center p-8 text-white text-3xl font-bold text-center leading-relaxed max-w-lg">
            {currentStory?.content}
          </div>
        );
    }
  };

  if (!currentStory) return null;

  return (
    <div
      className="fixed inset-0 z-50 h-screen w-screen flex items-center justify-center select-none"
      style={{
        backgroundColor:
          currentStory.media_type === "text"
            ? currentStory.background_color || "#4f46e5"
            : "#050716",
      }}
    >
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-white/20 z-20">
        <div
          className="h-full bg-linear-to-r from-pink-400 to-indigo-400 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(236,72,153,0.8)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* User Info Header */}
      <div className="absolute top-4 left-4 sm:left-8 z-20 flex items-center gap-3 p-2 px-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
        <Avatar
          src={currentStory.user?.profile_picture}
          name={currentStory.user?.full_name || currentStory.user?.username}
          size="sm"
          ring={true}
        />
        <div className="text-white text-sm font-semibold flex items-center gap-1.5">
          <span>{currentStory.user?.full_name || "User"}</span>
          {currentStory.user?.is_verified && (
            <BadgeCheck size={16} className="text-blue-400" />
          )}
        </div>
      </div>

      {/* Top Right Actions (Owner Menu + Close Button) */}
      <div className="absolute top-4 right-4 sm:right-8 z-20 flex items-center gap-2">
        {isOwner && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Story options"
              className="text-white p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all cursor-pointer"
            >
              <MoreHorizontal className="w-6 h-6" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 z-30 w-36 bg-[#182034] border border-purple-500/30 rounded-2xl shadow-2xl p-1.5 backdrop-blur-xl text-white">
                {currentStory.media_type === "text" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setIsEditing(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-indigo-300"
                  >
                    <Edit3 size={14} className="text-indigo-400" />
                    <span>{t("common.edit") || "Edit"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setIsConfirmDeleteOpen(true);
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

        {/* Close Button */}
        <button
          onClick={handleClose}
          aria-label="Close story"
          className="text-white p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Prev / Next Click Zones */}
      <div
        onClick={handlePrev}
        className="absolute left-0 top-0 w-1/3 h-full z-10 cursor-pointer flex items-center justify-start pl-4 opacity-0 hover:opacity-100 transition-opacity"
      >
        {currentIndex > 0 && (
          <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur">
            <ChevronLeft size={28} />
          </div>
        )}
      </div>

      <div
        onClick={handleNext}
        className="absolute right-0 top-0 w-1/3 h-full z-10 cursor-pointer flex items-center justify-end pr-4 opacity-0 hover:opacity-100 transition-opacity"
      >
        <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur">
          <ChevronRight size={28} />
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-1 max-w-[90vw] max-h-[90vh] flex items-center justify-center p-4">
        {renderContent()}
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDeleteStory}
        title={t("stories.deleteStoryConfirm") || "Delete Story"}
        message={
          t("stories.deleteStoryMessage") ||
          "Are you sure you want to delete this story? This cannot be undone."
        }
        confirmText={t("common.delete") || "Delete"}
        cancelText={t("common.cancel") || "Cancel"}
        danger={true}
        isLoading={isDeleting}
      />

      {/* Edit Story Window */}
      {isEditing && (
        <StoryWindow
          setShowModal={setIsEditing}
          initialStory={currentStory}
          onStoryUpdated={(updated) => {
            setCurrentStory(updated);
            if (onStoryUpdated) {
              onStoryUpdated(updated);
            }
          }}
          fetchStories={onStoryUpdated}
        />
      )}
    </div>
  );
};

export default StoryPlayer;