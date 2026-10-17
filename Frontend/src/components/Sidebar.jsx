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
import { NavLink, Link, useLocation } from 'react-router-dom';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar = ({ sideBarOpen, setSideBarOpen }) => {
  const { signOut } = useClerk();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const location = useLocation();

  const getNavLinkClass = ({ isActive }) =>
    `w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 shrink-0 ${
      isActive
        ? 'bg-purple-100 dark:bg-purple-700/40 ring-1 ring-purple-300 dark:ring-purple-400/60 shadow-md text-purple-700 dark:text-white'
        : 'hover:bg-purple-500/10 text-app-muted hover:text-app'
    }`;

  const handleNavClick = () => {
    if (setSideBarOpen) {
      setSideBarOpen(false);
    }
  };

  return (
    <>
      <div
        className={`h-screen w-20 fixed top-0 left-0 z-40 flex flex-col items-center px-3 py-6 bg-app-sidebar backdrop-blur-xl shadow-app-glow border-r border-app transform transition-transform duration-300 ${
          sideBarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        }`}
      >
        {/* Navigation Icons */}
        <div className="flex flex-col items-center space-y-3 overflow-y-auto overflow-x-visible no-scrollbar py-2 px-1 w-full">
          <NavLink
            to="/"
            end
            onClick={handleNavClick}
            className={getNavLinkClass}
            title={t('sidebar.home')}
          >
            <Home size={22} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300" />
          </NavLink>

          <NavLink
            to="/search"
            onClick={handleNavClick}
            className={getNavLinkClass}
            title={t('sidebar.search')}
          >
            <Search size={22} className="text-pink-600 dark:text-pink-400 hover:text-pink-500 dark:hover:text-pink-300" />
          </NavLink>

          <NavLink
            to="/messages"
            onClick={handleNavClick}
            className={({ isActive }) =>
              getNavLinkClass({
                isActive: isActive || location.pathname.startsWith('/messages'),
              })
            }
            title={t('sidebar.messages')}
          >
            <MessageCircle size={22} className="text-amber-600 dark:text-yellow-400 hover:text-amber-500 dark:hover:text-yellow-300" />
          </NavLink>

          <NavLink
            to="/profile"
            onClick={handleNavClick}
            className={({ isActive }) =>
              getNavLinkClass({
                isActive: isActive || location.pathname.startsWith('/profile'),
              })
            }
            title={t('sidebar.profile')}
          >
            <User size={22} className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300" />
          </NavLink>

          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={getNavLinkClass}
            title={t('sidebar.settings')}
          >
            <Settings size={22} className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300" />
          </NavLink>

          <NavLink
            to="/connections"
            onClick={handleNavClick}
            className={getNavLinkClass}
            title={t('sidebar.connections')}
          >
            <Users size={22} className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300" />
          </NavLink>

          {/* Missing icons added after Connections */}
          <NavLink
            to="/groups"
            end
            onClick={handleNavClick}
            className={getNavLinkClass}
            title={t('sidebar.availableGroups')}
          >
            <Layers size={22} className="text-orange-600 dark:text-orange-400 hover:text-orange-500 dark:hover:text-orange-300" />
          </NavLink>

          <NavLink
            to="/groups/joined"
            onClick={handleNavClick}
            className={getNavLinkClass}
            title={t('sidebar.joinedGroups')}
          >
            <UserSquare size={22} className="text-teal-600 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300" />
          </NavLink>
        </div>

        {/* Create Post Button */}
        <Link
          to="/create-post"
          onClick={handleNavClick}
          className="flex items-center justify-center my-4 w-12 h-12 bg-linear-to-br from-indigo-500 to-purple-600 rounded-2xl hover:from-indigo-600 hover:to-purple-700 active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.7)] shrink-0"
          title={t('sidebar.createPost')}
        >
          <CirclePlus size={22} className="text-white" />
        </Link>

        {/* User Actions: Clerk UserButton + LogOut */}
        <div className="mt-auto flex flex-col items-center gap-4 pt-2 shrink-0">
          <div className="w-10 h-10 flex items-center justify-center">
            <UserButton
              appearance={{
                baseTheme: isDark ? 'dark' : undefined,
                elements: {
                  userButtonAvatarBox:
                    'w-10 h-10 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.5)] border border-purple-400',
                },
              }}
            />
          </div>
          <button
            onClick={() => signOut()}
            title={t('sidebar.logout')}
            aria-label={t('sidebar.logout')}
            className="w-10 h-10 flex items-center justify-center text-app-muted hover:text-rose-500 transition cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(244,63,94,0.5)] rounded-2xl p-1 bg-surface border border-app active:scale-95"
          >
            <span className="inline-block transform scale-x-[-1]">
              <LogOut size={16} />
            </span>
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