import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx"
import Connections from "./pages/Connections.jsx"
import Chat from "./pages/Chat.jsx"
import CreatePost from "./pages/CreatePost.jsx"
import Messages from "./pages/Messages.jsx"
import Notifications from "./pages/Notifications.jsx"
import PostDetails from "./pages/PostDetails.jsx"
import Profile from "./pages/Profile.jsx"
import Search from "./pages/Search.jsx"
import Settings from "./pages/Settings.jsx"
import Layout from "./pages/Layout.jsx"
import Login from "./pages/Login.jsx"
import {useUser} from "@clerk/clerk-react"

function App() {
  const {user} = useUser()
  return (
    <Routes>
      <Route path="/" element={!user ? <Login /> : <Layout />}>
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
      </Route>
    </Routes>
  )
}

export default App