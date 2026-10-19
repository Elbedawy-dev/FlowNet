import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image, X, Sparkles, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { postsApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useLanguage } from "../context/LanguageContext";
import Avatar from "../components/Avatar";

const CreatePost = () => {
  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);

  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { t } = useLanguage();

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (selectedImages.length + files.length > 4) {
      toast.error(t("posts.maxImagesNote"));
      return;
    }

    const validFiles = [];
    const newPreviews = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" is not a valid image format`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 5MB limit`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedImages((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!content.trim() && selectedImages.length === 0) {
      throw new Error(t("posts.contentOrImageRequired") || "Post cannot be completely empty");
    }

    setIsPublishing(true);
    try {
      const formData = new FormData();
      if (content.trim()) {
        formData.append("content", content.trim());
      }
      selectedImages.forEach((img) => {
        formData.append("images", img);
      });

      await postsApi.create(formData);
      navigate("/");
    } finally {
      setIsPublishing(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    toast.promise(handlePublish(), {
      loading: t("posts.publishing") || "Publishing cosmic post...",
      success: t("common.success") + " 🚀",
      error: (err) => err.message || t("common.error"),
    });
  };

  const isButtonDisabled = (!content.trim() && selectedImages.length === 0) || isPublishing;

  return (
    <div className="min-h-full py-10 px-4 flex flex-col items-center text-app pb-32">
      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-app-muted hover:text-app transition cursor-pointer p-2 rounded-xl bg-app-card border border-app"
        >
          <ArrowLeft size={18} className="rtl:rotate-180" />
          <span>{t("common.back")}</span>
        </button>
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
          {t("home.createPost")}
        </h1>
        <span className="w-16" />
      </div>

      {/* Main Creation Glass Card */}
      <div className="w-full max-w-2xl bg-app-card backdrop-blur-xl border border-app rounded-3xl p-6 sm:p-8 shadow-[0_0_35px_rgba(131,58,180,0.2)]">
        {/* User Info Header */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-app">
          <Avatar
            src={currentUser?.profile_picture}
            name={currentUser?.full_name || currentUser?.username}
            size="md"
          />
          <div>
            <p className="font-semibold text-app text-sm">
              {currentUser?.full_name || "You"}
            </p>
            <p className="text-app-muted text-xs">
              @{currentUser?.username || "user"}
            </p>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("posts.whatsOnYourMind")}
          className="w-full bg-transparent text-app placeholder-app-muted focus:outline-none text-base resize-none leading-relaxed"
          maxLength={2000}
        />

        {/* Image Previews */}
        {previews.length > 0 && (
          <div className="grid grid-cols-2 gap-3 my-4">
            {previews.map((src, index) => (
              <div
                key={index}
                className="relative rounded-2xl overflow-hidden border border-app group max-h-56"
              >
                <img
                  src={src}
                  alt={`Upload preview ${index + 1}`}
                  className="w-full h-44 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-full transition-colors backdrop-blur-sm cursor-pointer shadow-md"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex items-center justify-between pt-4 border-t border-app mt-4">
          <label className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-app-input hover:bg-white/10 border border-app text-app text-xs font-medium cursor-pointer transition-all active:scale-95 shadow-sm">
            <Image size={17} className="text-pink-400" />
            <span>{t("posts.uploadImages")} ({selectedImages.length}/4)</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={selectedImages.length >= 4}
              onChange={handleImageChange}
              className="hidden"
            />
          </label>

          <span className="text-[11px] text-app-muted">
            {content.length}/2000
          </span>
        </div>

        {/* Publish Button */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isButtonDisabled}
          className="w-full mt-6 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 bg-linear-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.5)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles size={17} />
          <span>{isPublishing ? t("common.saving") : t("home.createPost")}</span>
        </button>
      </div>
    </div>
  );
};

export default CreatePost;
