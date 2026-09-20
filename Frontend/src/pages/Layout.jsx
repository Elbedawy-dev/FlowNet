import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Loading from "../components/Loading";

const Layout = () => {
  const user = true;
  const [sideBarOpen, setSideBarOpen] = useState(false);

  return user ? (
    <div className="w-full flex h-screen">
      <Sidebar sideBarOpen={sideBarOpen} setSideBarOpen={setSideBarOpen} />
      <div className="flex-1 bg-slate-50">
        <Outlet />
      </div>
      {sideBarOpen ? (
        
        <X className="absolute top-3 p-2 z-100 right-3 bg-white rounded-md shadow w-10 h-10 
          text-gray-600 sm:hidden cursor-pointer"
          onClick={() => setSideBarOpen(false)} />
      ) : (
        
        <Menu className="absolute top-3 right-3 p-2 z-100 bg-[#1f2937] rounded-md shadow w-10 h-10
           text-gray-600 sm:hidden cursor-pointer" 
          onClick={() => setSideBarOpen(true)} />
      )}
    </div>
  ) : (
    <Loading />
  );
};

export default Layout;
