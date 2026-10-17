import { ArrowLeft, Sparkle, TextIcon, Upload } from "lucide-react";
import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { storiesApi } from "../api/axios";
import { useLanguage } from "../context/LanguageContext";

const StoryWindow = ({
  setShowModal,
  fetchStories,
  initialStory = null,
  onStoryUpdated,
}) => {
  const { t } = useLanguage();
  const isEdit = Boolean(initialStory);

  const bgColors = [
    "#4f46e5",
    "#7c3aed",
    "#db2777",
    "#e11d48",
    "#ca8a04",
    "#0d9488",
  ];

  const [mode, setMode] = useState(
    isEdit ? "text" : initialStory?.media_type || "text"
  );
  const [background, setBackground] = useState(
    initialStory?.background_color || bgColors[0]
  );
  const [media, setMedia] = useState(null);
  const [text, setText] = useState(initialStory?.content || "");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hiddenVideoRef = useRef(null);

  const handleMediaUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error(t("stories.invalidFile") || "Please select a valid image or video file");
      return;
    }

    if (isImage && file.size > 5 * 1024 * 1024) {
      toast.error(t("stories.imageSizeLimit") || "Image must be 5MB or less");
      return;
    }

    if (isVideo && file.size > 50 * 1024 * 1024) {
      toast.error(t("stories.videoSizeLimit") || "Video must be 50MB or less");
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    if (isVideo) {
      const tempVideo = document.createElement("video");
      tempVideo.preload = "metadata";
      tempVideo.onloadedmetadata = () => {
        URL.revokeObjectURL(tempVideo.src);
        if (tempVideo.duration > 60) {
          toast.error(
            t("stories.videoDurationLimit") || "Video must be 60 seconds or less"
          );
          setMedia(null);
          setPreviewUrl(null);
        } else {
          setMedia(file);
          setPreviewUrl(objectUrl);
          setMode("media");
        }
      };
      tempVideo.src = objectUrl;
    } else {
      setMedia(file);
      setPreviewUrl(objectUrl);
      setMode("media");
    }
  };

  const handleSaveStory = async () => {
    if (mode === "text" && !text.trim()) {
      throw new Error(
        t("stories.writeSomething") || "Please write something for your story"
      );
    }

    if (!isEdit && mode === "media" && !media) {
      throw new Error(
        t("stories.selectMedia") || "Please select an image or video"
      );
    }

    setIsSubmitting(true);
    try {
      if (isEdit) {
        const updated = await storiesApi.update(initialStory._id, {
          content: text.trim(),
          background_color: background,
        });
        if (onStoryUpdated) {
          onStoryUpdated(updated);
        }
        if (fetchStories) {
          await fetchStories();
        }
        setShowModal(false);
      } else {
        const formData = new FormData();
        formData.append("background_color", background);

        if (mode === "text") {
          formData.append("content", text.trim());
          formData.append("media_type", "text");
        } else {
          formData.append("media", media);
          if (text.trim()) {
            formData.append("content", text.trim());
          }
        }

        await storiesApi.create(formData);
        if (fetchStories) {
          await fetchStories();
        }
        setShowModal(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = () => {
    toast.promise(handleSaveStory(), {
      loading: isEdit
        ? t("common.saving") || "Updating your story..."
        : t("stories.publishing") || "Publishing your story...",
      success: isEdit
        ? t("stories.storyUpdated") || "Story updated successfully! ✨"
        : t("stories.storyCreated") || "Story published successfully! 🚀",
      error: (err) => err.message || "Failed to save story",
    });
  };

  return (
    <div className="fixed inset-0 z-110 min-h-screen bg-black/85 backdrop-blur-md text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-linear-to-b from-[#1a1f4d] via-[#12173d] to-[#0b0f3b] p-6 rounded-3xl border border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.4)]">
        {/* Header */}
        <div className="text-center mb-4 flex items-center justify-between">
          <button
            className="text-white p-2 rounded-full hover:bg-white/10 transition cursor-pointer"
            onClick={() => setShowModal(false)}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold">
            {isEdit
              ? t("stories.editStory") || "Edit Story"
              : t("stories.createStory") || "Create Story"}
          </h2>
          <span className="w-8" />
        </div>

        {/* Story Canvas */}
        <div
          className="rounded-2xl h-80 sm:h-96 flex items-center justify-center relative overflow-hidden shadow-inner border border-white/10"
          style={{ backgroundColor: mode === "text" ? background : "#0a0d24" }}
        >
          {mode === "text" && (
            <textarea
              className="bg-transparent text-white w-full h-full p-6 text-xl font-medium resize-none focus:outline-none placeholder-white/60 text-center flex items-center justify-center"
              placeholder={t("stories.writeSomething") || "What's on your mind?"}
              onChange={(e) => setText(e.target.value)}
              value={text}
              maxLength={500}
            />
          )}

          {mode === "media" && previewUrl && (
            media?.type.startsWith("image") ? (
              <img
                src={previewUrl}
                alt="Story preview"
                className="object-contain max-h-full max-w-full"
              />
            ) : (
              <video
                ref={hiddenVideoRef}
                src={previewUrl}
                controls
                className="object-contain max-h-full max-w-full"
              />
            )
          )}
        </div>

        {/* Background Colors (Text mode only) */}
        {mode === "text" && (
          <div className="flex mt-4 gap-2.5 justify-center">
            {bgColors.map((color) => (
              <button
                key={color}
                className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                  background === color
                    ? "scale-125 ring-2 ring-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setBackground(color)}
                type="button"
              />
            ))}
          </div>
        )}

        {/* Mode Toggles (Only when creating, not editing) */}
        {!isEdit && (
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setMode("text");
                setMedia(null);
                setPreviewUrl(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                mode === "text"
                  ? "bg-white text-black shadow-md font-semibold"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              <TextIcon size={16} /> {t("stories.textMode") || "Text"}
            </button>

            <label
              className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                mode === "media"
                  ? "bg-white text-black shadow-md font-semibold"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
            >
              <input
                onChange={handleMediaUpload}
                type="file"
                accept="image/*,video/*"
                className="hidden"
              />
              <Upload size={16} /> {t("stories.mediaMode") || "Photo / Video"}
            </label>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 text-white py-3 mt-4 w-full rounded-2xl font-semibold bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.5)] cursor-pointer disabled:opacity-50"
        >
          <Sparkle size={18} />
          {isSubmitting
            ? t("common.saving") || "Saving..."
            : isEdit
            ? t("common.save") || "Save Changes"
            : t("stories.createStory") || "Create Story"}
        </button>
      </div>
    </div>
  );
};

export default StoryWindow;