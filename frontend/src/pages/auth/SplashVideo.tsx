import { useEffect, useState } from 'react'
import LoginPage from './LoginPage'

export default function SplashVideo() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 2800)
    return () => clearTimeout(timer)
  }, [])

  const text = "Welcome to Atlas"

  return (
    <>
      <LoginPage transparent animateEntrance />
      
      {showSplash && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/20 backdrop-blur-[2px] transition-opacity duration-500">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Kaushan+Script&display=swap');
            
            @keyframes fallLetter {
              0% { transform: translateY(-100vh); opacity: 0; }
              70% { transform: translateY(15px); opacity: 1; }
              85% { transform: translateY(-5px); opacity: 1; }
              100% { transform: translateY(0); opacity: 1; }
            }
          `}</style>

          <div 
            className="flex flex-wrap justify-center" 
            style={{ fontFamily: '"Kaushan Script", cursive' }}
          >
            {text.split('').map((char, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-block',
                  width: char === ' ' ? '0.4em' : 'auto',
                  animation: 'fallLetter 0.4s ease-out forwards',
                  animationDelay: `${index * 0.04}s`,
                  opacity: 0,
                  transform: 'translateY(-100vh)',
                  textShadow: '0 8px 16px rgba(0,0,0,0.6)',
                }}
                className="text-7xl md:text-8xl text-white px-0.5"
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
