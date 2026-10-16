import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Loading from "../components/Loading";
import { useCurrentUser } from "../context/CurrentUserContext";

const Layout = () => {
  const { loading } = useCurrentUser();
  const [sideBarOpen, setSideBarOpen] = useState(false);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-linear-to-b from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f]">
        <Loading />
      </div>
    );
  }

  return (
    <div className="w-full flex h-screen bg-linear-to-b from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] text-white overflow-hidden relative">
      <Sidebar sideBarOpen={sideBarOpen} setSideBarOpen={setSideBarOpen} />
      <div className="flex-1 w-full h-full sm:pl-20 overflow-y-auto no-scrollbar">
        <Outlet />
      </div>
      {sideBarOpen ? (
        <X
          className="fixed top-4 right-4 p-2 z-50 bg-purple-900/80 text-white rounded-2xl border border-purple-500/40 shadow-lg w-10 h-10 sm:hidden cursor-pointer backdrop-blur"
          onClick={() => setSideBarOpen(false)}
        />
      ) : (
        <Menu
          className="fixed top-4 right-4 p-2 z-50 bg-purple-900/80 text-white rounded-2xl border border-purple-500/40 shadow-lg w-10 h-10 sm:hidden cursor-pointer backdrop-blur"
          onClick={() => setSideBarOpen(true)}
        />
      )}
    </div>
  );
};

export default Layout;
