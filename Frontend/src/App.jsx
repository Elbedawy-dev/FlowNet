import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Connections from "./pages/Connections.jsx";
import Chat from "./pages/Chat.jsx";
import CreatePost from "./pages/CreatePost.jsx";
import Messages from "./pages/Messages.jsx";
import Notifications from "./pages/Notifications.jsx";
import PostDetails from "./pages/PostDetails.jsx";
import Profile from "./pages/Profile.jsx";
import Search from "./pages/Search.jsx";
import Settings from "./pages/Settings.jsx";
import Layout from "./pages/Layout.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import GroupsAvailable from "./pages/groups/GroupsAvailable.jsx";
import GroupsJoined from "./pages/groups/GroupsJoined.jsx";
import GroupChat from "./pages/groups/GroupChat.jsx";
import GroupCreate from "./pages/groups/GroupCreate.jsx";
import { useUser } from "@clerk/clerk-react";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { useCurrentUser } from "./context/CurrentUserContext.jsx";
import { useTheme } from "./context/ThemeContext.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";

function App() {
  const { user } = useUser();
  const { currentUser } = useCurrentUser();
  const { setPalette, setMode } = useTheme();
  const { setLang } = useLanguage();

  useEffect(() => {
    if (currentUser?.settings?.appearance) {
      const { theme, mode, language } = currentUser.settings.appearance;
      if (theme) setPalette(theme, false);
      if (mode) setMode(mode, false);
      if (language) setLang(language, false);
    }
  }, [currentUser, setPalette, setMode, setLang]);

  if (!user) {
    return (
      <>
        <Toaster />
        <Login />
      </>
    );
  }

  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:userId" element={<Chat />} />
          <Route path="connections" element={<Connections />} />
          <Route path="search" element={<Search />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/:profileId" element={<Profile />} />
          <Route path="create-post" element={<CreatePost />} />
          <Route path="settings" element={<Settings />} />
          <Route path="post/:postId" element={<PostDetails />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="groups" element={<GroupsAvailable />} />
          <Route path="groups/joined" element={<GroupsJoined />} />
          <Route path="groups/:groupId" element={<GroupChat />} />
          <Route path="groups/create" element={<GroupCreate />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;