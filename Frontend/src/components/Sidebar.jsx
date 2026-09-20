import { Home, Search, MessageCircle, User, Settings, CirclePlus, LogOut, 
    Users, SidebarOpen }
from "lucide-react";
import { Link } from "react-router-dom";
import { UserButton, useClerk } from "@clerk/clerk-react";

const Sidebar = ({sideBarOpen, setSideBarOpen}) => {
    const user = ""
    const {signOut} = useClerk()
  return (
    <>
    <div className={`h-screen w-20 fixed top-0 left-0 z-40 flex flex-col items-center
    py-6 space-y-6 bg-linear-to-b from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f]
    backdrop-blur-xl shadow-[0_0_30px_rgba(131,58,180,0.6)]
    border-r border-purple-500/20 transform transition-transform duration-300
    ${sideBarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}`}>
      <div className="flex flex-col space-y-10">
        <Link to="/" className="p-2 rounded-full transition-all duration-300
        hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]">
          <Home size={24} className="text-indigo-400 hover:text-indigo-300 transition-all" />
        </Link>
        <Link to="/search" className="p-2 rounded-full transition-all duration-300
        hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]">
          <Search size={24} className="text-pink-400 hover:text-pink-300 transition-all" />
        </Link>
        <Link to="/messages" className="p-2 rounded-full transition-all duration-300
        hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]">
          <MessageCircle size={24} className="text-yellow-400 hover:text-yellow-300 transition-all" />
        </Link>
        <Link to="/profile" className="p-2 rounded-full transition-all duration-300
        hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]">
          <User size={24} className="text-cyan-400 hover:text-cyan-300 transition-all" />
        </Link>
        <Link to="/settings" className="p-2 rounded-full transition-all duration-300
        hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]">
          <Settings size={24} className="text-purple-400 hover:text-purple-300 transition-all" />
        </Link>
        <Link to="/connections" className="p-2 rounded-full transition-all duration-300
        hover:scale-110 hover:shadow-[0_0_20px_rgba(0,255,255,0.9)]">
          <Users size={24} className="text-green-400 hover:text-green-300 transition-all" />
        </Link>
      </div>

      <Link to="/create-post" className="flex items-center
        justify-center py-2.5 mt-10 w-12 h-12 bg-linear-to-br from-indigo-500 to-purple-600
        rounded-full hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition shadow-[0_0_20px_rgba(0,255,255,0.8)]">
        <CirclePlus size={24} className="w-6 h-6 text-white" />
      </Link>

      {/* User Actions */}
      <div className="mt-auto flex flex-col items-center gap-4 mb-4">
        <UserButton
          appearance={{
            elements: {
            userButtonAvatarBox:
                "w-10 h-10 rounded-full shadow-[0_0_20px_rgba(0,255,255,0.7)] border border-purple-400",
            },
          }}/>
        <LogOut onClick={signOut}
        className="w-6 h-6 text-gray-300 hover:text-white transition cursor-pointer
        shadow-[0_0_15px_rgba(255,0,255,0.7)] hover:shadow-[0_0_25px_rgba(255,0,255,1)]
        rounded-full p-1" />
      </div>

    </div>
      {sideBarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 sm:hidden"
        onClick={() => setSideBarOpen(false)}>
        </div>
      )}
    </>
  )
};

export default Sidebar;