import { useNavigate } from 'react-router-dom';
import { Compass, Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      {/* Glowing Orb & Icon */}
      <div className="relative mb-6">
        <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.5)] animate-pulse-slow">
          <Compass className="w-14 h-14 text-white" />
        </div>
      </div>

      <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-400 mb-3 tracking-tight">
        404
      </h1>

      <h2 className="text-2xl font-bold text-white mb-2">
        Lost in Deep Space?
      </h2>

      <p className="text-gray-300 text-sm max-w-md mb-8 leading-relaxed">
        The cosmic coordinates you are searching for do not exist or have drifted into a black hole.
      </p>

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 rounded-xl border border-purple-500/30 text-purple-200 hover:bg-white/5 transition flex items-center gap-2 text-sm font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>

        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white shadow-lg shadow-purple-950/50 transition flex items-center gap-2 text-sm cursor-pointer"
        >
          <Home className="w-4 h-4" />
          Cosmic Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
