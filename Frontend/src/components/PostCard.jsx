import { useState } from "react";
import { BadgeCheck, Heart, MessageCircle, Share2 } from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "../context/CurrentUserContext";
import { postsApi } from "../api/axios";
import Avatar from "./Avatar";
import toast from "react-hot-toast";

const PostCard = ({ post, className = "" }) => {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();

  const [likes, setLikes] = useState(
    Array.isArray(post.likes_count) ? post.likes_count : []
  );
  const [shares, setShares] = useState(post.shares_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  const isLikedByMe = currentUser?._id && likes.includes(currentUser._id);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser?._id || isLiking) return;

    setIsLiking(true);
    // Optimistic toggle
    const newLikes = isLikedByMe
      ? likes.filter((id) => id !== currentUser._id)
      : [...likes, currentUser._id];

    setLikes(newLikes);

    try {
      const res = await postsApi.like(post._id);
      if (res?.likes_count) {
        setLikes(res.likes_count);
      }
    } catch (err) {
      // Rollback on error
      setLikes(likes);
      toast.error(err.message || "Failed to update like");
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/post/${post._id}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Post link copied to clipboard! 📋");
      }
      const res = await postsApi.share(post._id);
      if (res?.shares_count !== undefined) {
        setShares(res.shares_count);
      } else {
        setShares((s) => s + 1);
      }
    } catch (err) {
      toast.error("Could not copy link");
    }
  };

  // Safe hashtag rendering without raw dangerouslySetInnerHTML
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

  const images = Array.isArray(post.image_urls) ? post.image_urls : [];

  return (
    <div
      className={`bg-[#182034] text-white rounded-xl shadow-md p-4 space-y-3 w-full max-w-2xl border border-purple-500/10 ${className}`}
    >
      {/* Header */}
      <div
        onClick={() => post.user?._id && navigate("/profile/" + post.user._id)}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <Avatar
          src={post.user?.profile_picture}
          name={post.user?.full_name || post.user?.username}
          size="md"
        />
        <div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-white group-hover:text-indigo-300 transition-colors">
              {post.user?.full_name || "FlowNet User"}
            </span>
            {post.user?.is_verified && (
              <BadgeCheck className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <div className="text-gray-400 text-xs">
            @{post.user?.username || "user"} • {moment(post.createdAt).fromNow()}
          </div>
        </div>
      </div>

      {/* Post content */}
      {post.content && (
        <div className="text-gray-200 text-sm whitespace-pre-line leading-relaxed">
          {renderFormattedContent(post.content)}
        </div>
      )}

      {/* Post Images Grid */}
      {images.length > 0 && (
        <div
          className={`grid gap-2 overflow-hidden rounded-lg ${
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
              className={`w-full object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity ${
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
      <div className="flex items-center gap-6 text-gray-400 text-sm border-t border-gray-700/60 pt-3">
        <div
          className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors select-none"
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
          className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors select-none"
          onClick={() => navigate(`/post/${post._id}`)}
        >
          <MessageCircle className="w-5 h-5 hover:text-indigo-400 transition-colors" />
          <span>
            {post.comments_count !== undefined
              ? post.comments_count
              : post.comments?.length || 0}
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors select-none ml-auto"
          onClick={handleShare}
          title="Share post"
        >
          <Share2 className="w-5 h-5 hover:text-purple-400 transition-colors" />
          <span>{shares}</span>
        </div>
      </div>
    </div>
  );
};

export default PostCard;