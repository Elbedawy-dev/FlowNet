import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { assets } from "../assets/assets";
import { SignIn } from "@clerk/clerk-react";

const STARS = Array(15)
  .fill(0)
  .map(() => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
  }));

const Login = () => {
  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row bg-linear-to-br from-[#0b0f3b] via-[#1a1f4d] to-[#3c1f7f] overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute w-150 h-150 bg-purple-600/20 rounded-full 
        -top-25 -left-25 blur-3xl animate-pulse-slow"></div>
        <div className="absolute w-125 h-125 bg-pink-500/20 rounded-full 
        -bottom-25 -right-25 blur-3xl animate-pulse-slow"></div>
      </div>
      <div className="flex-1 w-full min-w-0 flex flex-col items-start justify-between 
      lg:p-40 p-6 md:p-10 z-10">        
      <motion.img
          src={assets.logo}
          alt=""
          className="h-12 object-contain mb-6"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        />
 
        <div>
          <div className="flex items-center gap-3 mb-6 max-md:mt-10">
            <img src={assets.group_users} className="h-8 md:h-10" />

            <div>
              <div className="flex gap-1">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 text-transparent fill-amber-400 drop-shadow-lg 
                      animate-pulse"
                    />
                  ))}
              </div>

              <p className="text-gray-300 text-sm mt-1">
                17,000+ adventurers already inside
              </p>
            </div>
          </div>

          <motion.h1
            className="text-3xl md:text-6xl font-bold bg-linear-to-r from-indigo-400 via-purple-500 
            to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(255,0,255,0.7)] 
            leading-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
          >
            Enter a world where connections sparkle and conversations shine
          </motion.h1>

          <motion.h1
            className="text-gray-400 mt-4 md:mt-6 max-w-lg text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
          >
            Step through the portal of imagination, meet kindred spirits, and
            let your messages glow with life. Every story, every whisper, every
            laugh becomes a spark in the digital sky.
          </motion.h1>
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 flex items-center justify-center p-4 sm:p-6 md:p-10 
          z-10 overflow-x-hidden">
        <motion.div
          className="w-full max-w-md min-w-0 overflow-hidden p-4 sm:p-6 md:p-8 rounded-3xl 
          bg-linear-to-br from-purple-700/20 via-indigo-800/20 to-pink-700/20 backdrop-blur-md 
          shadow-[0_0_30px_rgba(131,58,180,0.5)] 
          border border-white/10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}>
          <SignIn
            appearance={{
              baseTheme: "dark",
              variables: {
                colorPrimary: "#a78bfa",
                colorText: "#e5e7eb",
                colorBackground: "transparent",
                colorInputBackground: "rgba(15, 23, 42, 0.6)",
                colorCardBackground: "rgba(24,32,52,0.6)",
              },
              elements: {
                rootBox: "w-full max-w-full min-w-0",
                cardBox: "w-full max-w-full min-w-0 shadow-none",
                card: "w-full max-w-full min-w-0 rounded-3xl shadow-[0_0_25px_rgba(168,85,247,0.5)] border border-purple-500/20 backdrop-blur-xl",
                main: "w-full max-w-full min-w-0",
                headerTitle: "text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-xl sm:text-2xl font-bold break-words",
                headerSubtitle: "text-gray-400 break-words",
                socialButtons: "w-full",
                socialButtonsBlockButton: "w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl hover:scale-[1.02] transition-all",
                form: "w-full",
                formFieldInput: "w-full bg-[#1f264f]/60 border border-purple-500/30 rounded-xl text-white focus:ring-2 focus:ring-purple-500",
                formButtonPrimary: "w-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white font-semibold py-2 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.6)] hover:scale-[1.02] transition-all",
                footerActionLink: "text-purple-400 hover:text-pink-400",
                footer: "hidden",
              },
            }}
          />
        </motion.div>
      </div>

     {STARS.map((star, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 bg-white rounded-full opacity-50 animate-starTwinkle"
        style={{
          top: star.top,
          left: star.left,
          animationDelay: star.delay,
        }}
      ></div>
    ))}
    </div>
  );
};

export default Login;
