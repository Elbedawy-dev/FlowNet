import {
  Home,
  Search,
  MessageCircle,
  User,
  Settings,
  CirclePlus,
  LogOut,
  Users,
  Layers,
  UserSquare,
} from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import { UserButton, useClerk } from '@clerk/clerk-react';

const Sidebar = ({ sideBarOpen, setSideBarOpen }) => {
  const { signOut } = useClerk();

  const getNavLinkClass = ({ isActive }) =>
    `p-2.5 rounded-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center ${
      isActive
        ? 'bg-purple-600/30 ring-2 ring-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.8)]'
        : 'hover:bg-white/5 hover:shadow-[0_0_20px_rgba(0,255,255,0.6)]'
    }`;

  const handleNavClick = () => {
    if (setSideBarOpen) {
      setSideBarOpen(false);
    }
  };

  return (
    <>
      <div
        className={`h-screen w-20 fixed top-0 left-0 z-40 flex flex-col items-center py-6 bg-linear-to-b from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] backdrop-blur-xl shadow-[0_0_30px_rgba(131,58,180,0.6)] border-r border-purple-500/20 transform transition-transform duration-300 ${
          sideBarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        }`}
      >
        {/* Navigation Icons */}
        <div className="flex flex-col space-y-4 overflow-y-auto no-scrollbar py-2">
          <NavLink to="/" end onClick={handleNavClick} className={getNavLinkClass} title="Home">
            <Home size={22} className="text-indigo-400 hover:text-indigo-300" />
          </NavLink>

          <NavLink to="/search" onClick={handleNavClick} className={getNavLinkClass} title="Discover People">
            <Search size={22} className="text-pink-400 hover:text-pink-300" />
          </NavLink>

          <NavLink to="/messages" onClick={handleNavClick} className={getNavLinkClass} title="Messages">
            <MessageCircle size={22} className="text-yellow-400 hover:text-yellow-300" />
          </NavLink>

          <NavLink to="/profile" end onClick={handleNavClick} className={getNavLinkClass} title="Profile">
            <User size={22} className="text-cyan-400 hover:text-cyan-300" />
          </NavLink>

          <NavLink to="/settings" onClick={handleNavClick} className={getNavLinkClass} title="Settings">
            <Settings size={22} className="text-purple-400 hover:text-purple-300" />
          </NavLink>

          <NavLink to="/connections" onClick={handleNavClick} className={getNavLinkClass} title="Connections">
            <Users size={22} className="text-green-400 hover:text-green-300" />
          </NavLink>

          {/* Missing icons added after Connections */}
          <NavLink to="/groups" end onClick={handleNavClick} className={getNavLinkClass} title="Available Groups">
            <Layers size={22} className="text-orange-400 hover:text-orange-300" />
          </NavLink>

          <NavLink to="/groups/joined" onClick={handleNavClick} className={getNavLinkClass} title="Joined Groups">
            <UserSquare size={22} className="text-teal-400 hover:text-teal-300" />
          </NavLink>
        </div>

        {/* Create Post Button */}
        <Link
          to="/create-post"
          onClick={handleNavClick}
          className="flex items-center justify-center py-2.5 my-4 w-11 h-11 bg-linear-to-br from-indigo-500 to-purple-600 rounded-full hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.7)]"
          title="Create Post"
        >
          <CirclePlus size={22} className="text-white" />
        </Link>

        {/* User Actions: Clerk UserButton + LogOut */}
        <div className="mt-auto flex flex-col items-center gap-4 pt-2">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox:
                  'w-10 h-10 rounded-full shadow-[0_0_20px_rgba(0,255,255,0.7)] border border-purple-400',
              },
            }}
          />
          <button
            onClick={() => signOut()}
            title="Sign out"
            aria-label="Sign out"
            className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-rose-400 transition cursor-pointer shadow-[0_0_15px_rgba(255,0,255,0.5)] hover:shadow-[0_0_25px_rgba(244,63,94,0.8)] rounded-full p-1 bg-white/5 border border-purple-500/20"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {sideBarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 sm:hidden"
          onClick={() => setSideBarOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;