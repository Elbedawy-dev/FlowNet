import { useEffect, useState, useRef, useCallback } from "react";
import { BadgeCheck, X, ChevronLeft, ChevronRight } from "lucide-react";
import { storiesApi } from "../api/axios";
import Avatar from "./Avatar";

const StoryPlayer = ({
  viewStory,
  setViewStory,
  allStories = [],
  onStoryViewed,
}) => {
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);

  // Find index of current story in allStories list
  const currentIndex = allStories.findIndex(
    (s) => s._id === viewStory?._id
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
    if (viewStory?._id) {
      storiesApi.view(viewStory._id).catch(() => {});
      if (onStoryViewed) onStoryViewed(viewStory._id);
    }
  }, [viewStory?._id, onStoryViewed]);

  // Keyboard navigation: Esc, Left, Right
  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, [handleClose, handleNext, handlePrev]);

  // Timer: 10s for text/image, or video duration
  useEffect(() => {
    if (!viewStory) return;

    setProgress(0);

    if (viewStory.media_type === "video") {
      // Handled via onTimeUpdate / onEnded of <video>
      return;
    }

    const duration = 10000; // 10 seconds
    const intervalTime = 100; // tick every 100ms
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += intervalTime;
      const currentProgress = (elapsed / duration) * 100;
      if (currentProgress >= 100) {
        clearInterval(timer);
        handleNext();
      } else {
        setProgress(currentProgress);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [viewStory, handleNext]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const p =
        (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const renderContent = () => {
    switch (viewStory?.media_type) {
      case "image":
        return (
          <img
            src={viewStory.media_url}
            alt="Story"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
          />
        );
      case "video":
        return (
          <video
            ref={videoRef}
            src={viewStory.media_url}
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
            {viewStory?.content}
          </div>
        );
    }
  };

  if (!viewStory) return null;

  return (
    <div
      className="fixed inset-0 z-50 h-screen w-screen flex items-center justify-center select-none"
      style={{
        backgroundColor:
          viewStory.media_type === "text"
            ? viewStory.background_color || "#4f46e5"
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
          src={viewStory.user?.profile_picture}
          name={viewStory.user?.full_name || viewStory.user?.username}
          size="sm"
          ring={true}
        />
        <div className="text-white text-sm font-semibold flex items-center gap-1.5">
          <span>{viewStory.user?.full_name || "User"}</span>
          {viewStory.user?.is_verified && (
            <BadgeCheck size={16} className="text-blue-400" />
          )}
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        aria-label="Close story"
        className="absolute top-4 right-4 sm:right-8 z-20 text-white p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all cursor-pointer"
      >
        <X className="w-6 h-6" />
      </button>

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
    </div>
  );
};

export default StoryPlayer;