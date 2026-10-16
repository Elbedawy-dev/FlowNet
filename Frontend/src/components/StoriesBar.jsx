import { Plus } from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StoryWindow from "./StoryWindow";
import StoryPlayer from "./StoryPlayer";
import { storiesApi } from "../api/axios";
import Avatar from "./Avatar";

const StoriesBar = () => {
  const [stories, setStories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [viewStory, setViewStory] = useState(null);

  const fetchStories = useCallback(async () => {
    try {
      const res = await storiesApi.getAll();
      setStories(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn("[StoriesBar] Failed to load stories:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Group stories by user so each user has one avatar bubble (showing their most recent story)
  const groupedStories = useMemo(() => {
    const map = new Map();
    for (const story of stories) {
      const userId = story.user?._id;
      if (userId && !map.has(userId)) {
        map.set(userId, story);
      }
    }
    return Array.from(map.values());
  }, [stories]);

  return (
    <>
      {/* Stories Bar fixed to bottom */}
      <div className="fixed bottom-0 left-0 w-full bg-linear-to-t from-[#0b0f3b] via-[#1a1f4d]/90 to-transparent backdrop-blur-xl border-t border-purple-500/20 z-30 pb-3 pt-2 h-24">
        <div className="flex items-center space-x-5 overflow-x-auto no-scrollbar px-6 sm:pl-28">
          {/* Create Story Button */}
          <motion.div
            onClick={() => setShowModal(true)}
            className="shrink-0 flex flex-col items-center cursor-pointer select-none"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <div className="w-13 h-13 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:shadow-[0_0_30px_rgba(236,72,153,0.8)] transition-all border-2 border-white/20">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <p className="text-[11px] text-white mt-1 font-semibold tracking-wide">
              Story
            </p>
          </motion.div>

          {/* Grouped User Story Bubbles */}
          {groupedStories.map((story) => (
            <motion.div
              key={story._id}
              className="shrink-0 flex flex-col items-center cursor-pointer select-none"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 200 }}
              onClick={() => setViewStory(story)}
            >
              <Avatar
                src={story.user?.profile_picture}
                name={story.user?.full_name || story.user?.username}
                size="lg"
                ring={true}
                className="ring-2 ring-purple-400 p-0.5 border-2 border-transparent hover:border-pink-400 transition-colors"
              />
              <p className="text-[11px] text-purple-200 mt-1 truncate max-w-16 text-center">
                {story.user?.username || "User"}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Create Story Modal */}
      {showModal && (
        <StoryWindow
          setShowModal={setShowModal}
          fetchStories={fetchStories}
        />
      )}

      {/* Fullscreen Story Viewer */}
      <AnimatePresence>
        {viewStory && (
          <StoryPlayer
            viewStory={viewStory}
            setViewStory={setViewStory}
            allStories={stories}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default StoriesBar;