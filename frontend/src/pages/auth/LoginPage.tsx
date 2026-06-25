import { useRef, useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, KeyRound, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { signInWithGoogle } from '../../lib/firebase'

type LoginPageProps = {
  transparent?: boolean
  backgroundVideo?: boolean
  animateEntrance?: boolean
}

export default function LoginPage({ transparent = true, backgroundVideo = true, animateEntrance = false }: LoginPageProps) {
  const navigate = useNavigate()
  const { loginApi, googleLoginApi } = useAuthStore((s) => ({ loginApi: s.loginApi, googleLoginApi: s.googleLoginApi }))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [error, setError] = useState('')
  const isSubmittingRef = useRef(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current) return
    setError('')
    if (!email || !password) { setError('Please fill in all fields.'); return }
    isSubmittingRef.current = true
    setStatus('loading')
    
    try {
      await loginApi({ email, password })
      // Navigate immediately — no delay
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setStatus('idle')
      setError(err.response?.data?.detail || 'Invalid email or password.')
    } finally {
      isSubmittingRef.current = false
    }
  }

  const handleGoogleSignIn = async () => {
    if (isSubmittingRef.current) return
    setError('')
    isSubmittingRef.current = true
    setStatus('loading')

    try {
      const user = await signInWithGoogle()
      const token = await user.getIdToken()
      await googleLoginApi(token)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setStatus('idle')
      setError(err.message || 'Failed to sign in with Google.')
    } finally {
      isSubmittingRef.current = false
    }
  }

  const containerClassName = backgroundVideo
    ? 'min-h-screen w-full flex items-center justify-center lg:justify-end lg:pr-[10%] p-4 font-sans fade-in'
    : 'min-h-screen bg-surface flex items-center justify-center lg:justify-end lg:pr-[10%] p-4 font-sans'

  const cardClassName = transparent
    ? 'bg-slate-950/90 border border-white/20 rounded-xl p-8 shadow-2xl shadow-black/30 relative overflow-hidden text-white backdrop-blur-xl transition-all duration-700 font-mono'
    : 'bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm relative overflow-hidden transition-all duration-700 font-mono'

  const labelClassName = transparent
    ? 'text-slate-300'
    : 'text-on-surface-variant'

  const inputClassName = transparent
    ? 'w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-slate-400'
    : 'w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 transition-all placeholder:text-outline'

  const linkClassName = transparent
    ? 'text-cyan-300 text-xs font-medium hover:underline'
    : 'text-secondary text-xs font-medium hover:underline'

  const dividerClassName = transparent ? 'h-px flex-1 bg-white/20' : 'h-px flex-1 bg-outline-variant'

  const googleButtonClassName = transparent
    ? 'w-full flex items-center justify-center gap-3 py-3 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium active:scale-[0.98] text-white'
    : 'w-full flex items-center justify-center gap-3 py-3 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors text-sm font-medium active:scale-[0.98]'

  const signInButtonClassName = transparent
    ? 'bg-secondary text-white hover:bg-secondary/90 hover:-translate-y-0.5 shadow-lg shadow-secondary/20 transition duration-300'
    : 'bg-primary text-on-primary hover:bg-zinc-800 hover:-translate-y-0.5 transition duration-300'

  const rememberLabelClass = transparent ? 'text-slate-300' : 'text-on-surface-variant'

  const cardTextClass = transparent ? 'text-white' : 'text-on-surface'
  const subtitleTextClass = transparent ? 'text-slate-300' : 'text-on-surface-variant'

  return (
    <div className={containerClassName}>
      {backgroundVideo && (
        <>
          <div className="fixed inset-0 -z-20">
            <video autoPlay muted playsInline loop preload="metadata" className="absolute inset-0 w-full h-full object-cover">
              <source src="/login1.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-slate-950/75" />
          </div>
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
          </div>
        </>
      )}
      {!backgroundVideo && (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        </div>
      )}

      <main 
        className="w-full max-w-[440px] font-mono"
        style={{
          opacity: 0,
          animation: animateEntrance ? 'fadeInUp 0.8s ease-out 2.4s forwards' : 'fadeInUp 0.3s ease-out forwards'
        }}
      >
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className={`text-2xl font-bold tracking-tight ${cardTextClass}`}>Atlas</span>
          </div>
          <p className={`${subtitleTextClass} text-sm`}>Research Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className={cardClassName}>
          <div className="absolute top-4 right-4 text-white/30">
            <KeyRound className="w-4 h-4 opacity-40" />
          </div>

          <div className="mb-7">
            <h1 className={`text-xl font-semibold mb-1 ${cardTextClass}`}>Welcome back</h1>
            <p className={`${subtitleTextClass} text-sm`}>Enter your credentials to access your workspace.</p>
          </div>

          {error && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${transparent ? 'bg-red-500/15 border border-red-400/30 text-red-100' : 'bg-error-container border border-error/20 text-on-error-container'}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-medium uppercase tracking-wider block ${labelClassName}`} htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${transparent ? 'text-slate-300' : 'text-outline'}`} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className={`text-xs font-mono font-medium uppercase tracking-wider 0${labelClassName}`} htmlFor="password">
                  Password
                </label>
                <Link to="/forgot-password" className={linkClassName}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${transparent ? 'text-slate-300' : 'text-outline'}`} />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={transparent
                    ? 'w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-slate-400'
                    : 'w-full pl-10 pr-12 py-3 bg-white border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 transition-all placeholder:text-outline'}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${transparent ? 'text-slate-300 hover:text-white' : 'text-outline hover:text-on-surface'} transition-colors`}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className={`w-4 h-4 rounded accent-secondary ${transparent ? 'border-white/20 bg-white/10' : 'border-outline-variant'}`}
              />
              <label htmlFor="remember" className={`text-sm ${rememberLabelClass}`}>Keep me signed in for 30 days</label>
            </div>

            <button
              type="submit"
              disabled={status === 'loading' || status === 'success'}
              className={`w-full py-3.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                status === 'success'
                  ? 'bg-green-600 text-white'
                  : signInButtonClassName
              } disabled:opacity-70`}
            >
              {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {status === 'idle' && <><span>Sign In</span></>}
              {status === 'loading' && 'Signing in...'}
              {status === 'success' && 'Authenticated!'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className={dividerClassName} />
            <span className={`text-xs font-mono uppercase tracking-wider ${transparent ? 'text-slate-300' : 'text-outline'}`}>Or continue with</span>
            <div className={dividerClassName} />
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignIn}
            disabled={status === 'loading'}
            className={googleButtonClassName}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <footer className="mt-6 text-center space-y-4">
          <p className={`text-sm ${transparent ? 'text-slate-300' : 'text-on-surface-variant'}`}>
            Don't have an account?{' '}
            <Link to="/register" className="text-cyan-300 font-semibold hover:underline">
              Create account
            </Link>
          </p>
          <div className="flex justify-center gap-5 text-xs text-outline">
            <a href="#" className="hover:text-on-surface transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-on-surface transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-on-surface transition-colors">Security</a>
          </div>
        </footer>
      </main>
    </div>
  )
}
