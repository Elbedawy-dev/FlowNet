import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import moment from "moment";
import toast from "react-hot-toast";
import { postsApi } from "../api/axios";
import { useCurrentUser } from "../context/CurrentUserContext";
import { useLanguage } from "../context/LanguageContext";
import PostCard from "../components/PostCard";
import Avatar from "../components/Avatar";
import Loading from "../components/Loading";

const PostDetails = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const { t, lang } = useLanguage();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const commentsEndRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPostAndComments = async () => {
      try {
        setLoading(true);
        const [postData, commentsData] = await Promise.all([
          postsApi.getById(postId),
          postsApi.getComments(postId),
        ]);
        if (isMounted) {
          setPost(postData);
          setComments(Array.isArray(commentsData) ? commentsData : []);
        }
      } catch (err) {
        toast.error(err.message || t("posts.loadFailed") || "Could not load post details");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPostAndComments();

    return () => {
      isMounted = false;
    };
  }, [postId, t]);

  const handleAddComment = async (e) => {
    e?.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    const commentText = newComment.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic comment
    const optimisticComment = {
      _id: tempId,
      text: commentText,
      createdAt: new Date().toISOString(),
      user: {
        _id: currentUser?._id,
        full_name: currentUser?.full_name || "You",
        username: currentUser?.username || "you",
        profile_picture: currentUser?.profile_picture || "",
      },
    };

    setComments((prev) => [...prev, optimisticComment]);
    setNewComment("");
    setIsSubmitting(true);

    // Update post comments count optimistically
    setPost((p) =>
      p ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
    );

    // Scroll to new comment
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      const savedComment = await postsApi.addComment(postId, commentText);
      setComments((prev) =>
        prev.map((c) => (c._id === tempId ? savedComment : c))
      );
    } catch (err) {
      // Rollback on failure
      setComments((prev) => prev.filter((c) => c._id !== tempId));
      setPost((p) =>
        p ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p
      );
      toast.error(err.message || t("posts.commentFailed") || "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await postsApi.deleteComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setPost((p) =>
        p ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p
      );
      toast.success(t("posts.commentDeleted") || "Comment deleted");
    } catch (err) {
      toast.error(err.message || t("posts.commentDeleteFailed") || "Failed to delete comment");
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-app-page text-app">
        <Loading />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-8 text-center text-app bg-app-page min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold mb-4">
          {t("posts.notFound") || "Post not found"}
        </h2>
        <button
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold cursor-pointer"
        >
          {t("common.back") || "Return Home"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full py-8 px-4 flex flex-col items-center bg-app-page text-app pb-32">
      {/* Top Header Bar */}
      <div className="w-full max-w-2xl flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-app-card hover:bg-purple-500/10 transition-all border border-app text-app cursor-pointer"
          aria-label={t("common.back") || "Go back"}
        >
          <ArrowLeft size={20} className="rtl:rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-purple-700 via-fuchsia-600 to-pink-600 dark:from-indigo-300 dark:via-purple-300 dark:to-pink-300">
          {t("posts.postDetails") || "Post Details"}
        </h1>
      </div>

      {/* The PostCard */}
      <div className="w-full max-w-2xl mb-8">
        <PostCard
          post={post}
          onDeleted={() => navigate(-1)}
          onUpdated={(updated) => setPost(updated)}
        />
      </div>

      {/* Comments Section */}
      <div className="w-full max-w-2xl bg-app-card backdrop-blur-xl border border-app rounded-3xl p-6 shadow-app-glow">
        <h2 className="text-lg font-bold text-app mb-6 flex items-center justify-between pb-3 border-b border-app">
          <span>{t("posts.comments") || "Comments"} 💬</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-300/30">
            {comments.length}
          </span>
        </h2>

        {/* Comments List */}
        <div className="space-y-4 max-h-[480px] overflow-y-auto no-scrollbar pr-1 mb-6">
          {comments.length === 0 ? (
            <p className="text-sm text-app-muted text-center py-6">
              {t("posts.noComments") || "Be the first to leave a comment on this post!"}
            </p>
          ) : (
            comments.map((comment) => {
              const isAuthor = comment.user?._id === currentUser?._id;
              const isPostOwner = post.user?._id === currentUser?._id;

              return (
                <div
                  key={comment._id}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-app-card border border-app hover:border-purple-400/40 transition-all shadow-xs"
                >
                  <Avatar
                    src={comment.user?.profile_picture}
                    name={comment.user?.full_name || comment.user?.username}
                    size="sm"
                    onClick={() =>
                      comment.user?._id && navigate(`/profile/${comment.user._id}`)
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() =>
                            comment.user?._id &&
                            navigate(`/profile/${comment.user._id}`)
                          }
                          className="font-semibold text-xs text-app hover:text-indigo-400 transition-colors cursor-pointer"
                        >
                          {comment.user?.full_name || "User"}
                        </span>
                        <span className="text-[11px] text-app-muted">
                          @{comment.user?.username || "user"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-purple-400">
                          {moment(comment.createdAt).locale(lang).fromNow()}
                        </span>
                        {(isAuthor || isPostOwner) && (
                          <button
                            onClick={() => handleDeleteComment(comment._id)}
                            className="text-app-muted hover:text-rose-400 p-1 transition-colors cursor-pointer"
                            title={t("posts.deleteComment") || "Delete comment"}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-app mt-1 whitespace-pre-line leading-relaxed">
                      {comment.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment Input */}
        <form
          onSubmit={handleAddComment}
          className="flex items-center gap-2 pt-2 border-t border-app"
        >
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t("posts.addCommentPlaceholder") || "Add a comment..."}
            className="flex-1 py-3 px-5 text-sm rounded-full bg-app-input text-app placeholder-app-muted border border-app focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-3 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 text-white transition-all shadow-[0_0_15px_rgba(168,85,247,0.5)] disabled:opacity-40 cursor-pointer"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default PostDetails;
