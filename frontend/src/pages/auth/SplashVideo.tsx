import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';

export default function SplashVideo() {
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLogin(true);
    }, 1400); // reduced from 2400ms for snappier UX

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <video
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/login1.mp4" type="video/mp4" />
        Your browser does not support video playback.
      </video>

      <div className="absolute inset-0 bg-slate-950/70" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {showLogin ? (
          <LoginPage transparent />
        ) : (
          <div className="text-center max-w-full px-4">
            <div className="flex flex-nowrap justify-center gap-4 whitespace-nowrap">
              {['Welcome', 'to', 'Atlas'].map((word, index) => (
                <span
                  key={word}
                  className="drop-word inline-block text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white font-orbitron"
                  style={{ animationDelay: `${index * 0.22}s` }}
                >
                  {word}
                </span>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-200/90">Preparing your secure workspace. Login will appear shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
}