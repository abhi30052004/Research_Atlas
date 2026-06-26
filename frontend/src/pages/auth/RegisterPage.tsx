import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, KeyRound, User, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { signInWithGoogle } from '../../lib/firebase'

export default function RegisterPage() {
  const navigate = useNavigate()
  const registerApi = useAuthStore((s) => s.registerApi)

  const [form, setForm] = useState({ name: '', username: '', email: '', company: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const getAuthErrorMessage = (err: any, fallback: string) => {
    if (err?.code === 'ERR_NETWORK') {
      return 'Unable to reach the server. Please check API URL/CORS configuration and try again.'
    }

    const detail = err?.response?.data?.detail
    if (Array.isArray(detail) && detail.length) {
      return detail.map((d: any) => d?.msg || String(d)).join(', ')
    }
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }
    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message
    }
    return fallback
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Full name is required.'
    if (!form.username.trim() || !/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = 'Username must be alphanumeric with underscores.'
    if (!form.email.includes('@')) e.email = 'Enter a valid email address.'
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match.'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStatus('loading')
    
    try {
      await registerApi({
        full_name: form.name,
        username: form.username,
        email: form.email,
        password: form.password
      })
      // Navigate immediately — no delay
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setStatus('idle')
      setErrors({ global: getAuthErrorMessage(err, 'Failed to register.') })
    }
  }

  const handleGoogleSignIn = async () => {
    setErrors({})
    setStatus('loading')

    try {
      await signInWithGoogle()
    } catch (err: any) {
      setStatus('idle')
      setErrors({ global: getAuthErrorMessage(err, 'Failed to sign in with Google.') })
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const containerClassName = 'relative min-h-screen w-full flex items-center justify-center lg:justify-end lg:pr-[10%] p-4 font-sans fade-in overflow-hidden'
  const mainClassName = 'relative z-10 w-full max-w-[460px] font-mono'
  const cardClassName = 'bg-slate-950/90 border border-white/20 rounded-xl p-6 shadow-2xl shadow-black/30 relative overflow-hidden text-white backdrop-blur-xl transition-all duration-700'
  const labelClassName = 'text-slate-300'
  const inputClassName = 'w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/20 transition-all placeholder:text-slate-400'
  const fieldIconClass = 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300'
  const buttonClassName = 'w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] bg-secondary text-white hover:bg-secondary/90 hover:-translate-y-0.5 shadow-lg shadow-secondary/20 disabled:opacity-70'

  const strength = (() => {
    const p = form.password
    if (!p) return 0
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    return s
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][strength]

  return (
    <div className={containerClassName}>
      <div className="fixed inset-0 -z-20">
        <video autoPlay muted playsInline loop preload="metadata" className="absolute inset-0 w-full h-full object-cover">
          <source src="/login1.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-slate-950/80" />
      </div>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <main 
        className={mainClassName}
        style={{
          opacity: 0,
          animation: 'fadeInUp 0.3s ease-out forwards'
        }}
      >
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        {/* Brand */}
        <div className="flex flex-col items-center mb-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Atlas</span>
          </div>
          <p className="text-slate-300 text-sm">Research Intelligence Platform</p>
        </div>

        <div className={cardClassName}>
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-white mb-1">Create your account</h1>
            <p className="text-slate-300 text-sm">Start synthesizing research in minutes.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-medium uppercase tracking-wider block ${labelClassName}`}>Full Name</label>
              <div className="relative">
                <User className={fieldIconClass} />
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Alex Johnson"
                  className={`${inputClassName} ${errors.name ? 'border-red-400' : ''}`}
                />
              </div>
              {errors.name && <p className="text-xs text-error">{errors.name}</p>}
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-medium uppercase tracking-wider block ${labelClassName}`}>Username</label>
              <div className="relative">
                <User className={fieldIconClass} />
                <input
                  type="text"
                  value={form.username}
                  onChange={set('username')}
                  placeholder="alex_j"
                  className={`${inputClassName} ${errors.username ? 'border-red-400' : ''}`}
                />
              </div>
              {errors.username && <p className="text-xs text-error">{errors.username}</p>}
            </div>

            {errors.global && (
              <div className="px-4 py-3 rounded-lg text-sm bg-red-500/15 border border-red-400/30 text-red-100 mb-4">
                {errors.global}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-medium uppercase tracking-wider block ${labelClassName}`}>Email Address</label>
              <div className="relative">
                <Mail className={fieldIconClass} />
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="name@company.com"
                  className={`${inputClassName} ${errors.email ? 'border-red-400' : ''}`}
                />
              </div>
              {errors.email && <p className="text-xs text-error">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-medium uppercase tracking-wider block ${labelClassName}`}>Password</label>
              <div className="relative">
                <KeyRound className={fieldIconClass} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min. 8 characters"
                  className={`${inputClassName} ${errors.password ? 'border-red-400' : ''}`}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : 'bg-surface-container-high'}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${['', 'text-red-500', 'text-yellow-600', 'text-blue-500', 'text-green-600'][strength]}`}>{strengthLabel}</span>
                </div>
              )}
              {errors.password && <p className="text-xs text-error">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className={`text-xs font-mono font-medium uppercase tracking-wider block ${labelClassName}`}>Confirm Password</label>
              <div className="relative">
                <KeyRound className={fieldIconClass} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={set('confirm')}
                  placeholder="Re-enter password"
                  className={`${inputClassName} ${errors.confirm ? 'border-red-400' : ''}`}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm && <p className="text-xs text-error">{errors.confirm}</p>}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {' '}
              <a href="#" className="text-cyan-300 hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-cyan-300 hover:underline">Privacy Policy</a>.
            </p>

            <button
              type="submit"
              disabled={status === 'loading' || status === 'success'}
              className={`${buttonClassName} ${status === 'success' ? 'bg-green-600 hover:bg-green-500' : ''}`}
            >
              {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {status === 'idle' && <><span>Create Account</span></>}
              {status === 'loading' && 'Creating account...'}
              {status === 'success' && 'Account created!'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-xs font-mono uppercase tracking-wider text-slate-300">Or sign up with</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignIn}
            disabled={status === 'loading'}
            className="w-full flex items-center justify-center gap-3 py-2.5 border border-white/20 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium active:scale-[0.98] transition duration-300 hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-on-surface-variant">
            Already have an account?{' '}
            <Link to="/" className="text-secondary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
