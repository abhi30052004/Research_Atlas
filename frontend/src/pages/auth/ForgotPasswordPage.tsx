import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

type ForgotPasswordPageProps = {
  transparent?: boolean
  backgroundVideo?: boolean
}

export default function ForgotPasswordPage({ transparent = true, backgroundVideo = true }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle')

  const containerClassName = backgroundVideo
    ? 'relative min-h-screen flex items-center justify-center lg:justify-end lg:pr-[10%] w-full p-4 font-sans fade-in'
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

  const submitButtonClassName = transparent
    ? 'w-full py-3.5 rounded-lg bg-secondary text-white font-semibold text-sm hover:bg-secondary/90 hover:-translate-y-0.5 shadow-lg shadow-secondary/20 transition duration-300 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70'
    : 'w-full py-3.5 rounded-lg bg-primary text-on-primary font-semibold text-sm hover:bg-zinc-800 hover:-translate-y-0.5 transition duration-300 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70'

  const linkClassName = transparent
    ? 'text-cyan-300 text-sm font-semibold hover:underline'
    : 'text-secondary text-sm font-semibold hover:underline'

  const backLinkClassName = transparent
    ? 'inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors'
    : 'inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors'

  const cardTextClass = transparent ? 'text-white' : 'text-on-surface'
  const subtitleTextClass = transparent ? 'text-slate-300' : 'text-on-surface-variant'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    setTimeout(() => setStatus('sent'), 1500)
  }

  return (
    <div className={containerClassName}>
      {backgroundVideo && (
        <>
          <div className="fixed inset-0 -z-20">
            <video autoPlay muted playsInline loop className="absolute inset-0 w-full h-full object-cover">
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

      <main className="w-full max-w-[420px] font-mono">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className={`text-2xl font-bold tracking-tight ${cardTextClass}`}>Atlas</span>
          </div>
        </div>

        <div className={cardClassName}>
          {status === 'sent' ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className={`text-xl font-semibold mb-2 ${cardTextClass}`}>Check your inbox</h2>
              <p className={`text-sm mb-6 ${subtitleTextClass}`}>
                We've sent a password reset link to <strong>{email}</strong>. It expires in 30 minutes.
              </p>
              <Link to="/" className={linkClassName}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className={`text-xl font-semibold mb-1 ${cardTextClass}`}>Reset your password</h1>
                <p className={`text-sm ${subtitleTextClass}`}>Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className={`text-xs font-mono font-medium uppercase tracking-wider block ${labelClassName}`}>Email Address</label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${transparent ? 'text-slate-300' : 'text-outline'}`} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      className={inputClassName}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className={submitButtonClassName}
                >
                  {status === 'loading' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending link...</>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className={backLinkClassName}>
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </main>
    </div>
  )
}
