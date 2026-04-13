import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { signIn } from 'next-auth/react'
import type { GetServerSideProps } from 'next'
import { getSession } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'

export default function LoginPage() {
  const router  = useRouter()
  const [form, setForm]     = useState({ username: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const r    = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await r.json()
    setLoading(false)
    if (data.success) router.push('/')
    else setError(data.message ?? 'Onjuiste inloggegevens')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    setError('')
    try {
      await signIn('google', { callbackUrl: '/api/auth/google-complete-redirect' })
    } catch {
      setError('Google login mislukt. Probeer het opnieuw.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">

        {/* Brand */}
        <div className="login-brand">
          <Image
            src="https://mhzmithddcdnouvlklev.supabase.co/storage/v1/object/public/Icons%20and%20Logo's/Notenman_2020_logo-300x72.png"
            alt="DeNotenman logo"
            width={240}
            height={57}
            style={{ width: 'auto', height: '52px', display: 'block', margin: '0 auto' }}
            priority
          />
          <p className="login-subtitle">Planner — inloggen</p>
        </div>

        {/* Google knop */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          {googleLoading ? (
            <><Spinner /> Verbinden…</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Doorgaan met Google
            </>
          )}
        </button>

        {/* Scheidingslijn */}
        <div className="login-divider">
          <span>of log in met gebruikersnaam</span>
        </div>

        {/* Gebruikersnaam + wachtwoord */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error" role="alert">{error}</div>
          )}

          <div className="form-group">
            <label htmlFor="username" className="form-label">Gebruikersnaam</label>
            <input
              id="username"
              className="form-control"
              type="text"
              autoFocus
              autoComplete="username"
              required
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Wachtwoord</label>
            <input
              id="password"
              className="form-control"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading || googleLoading}
          >
            {loading ? <><Spinner /> Bezig…</> : 'Inloggen'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d0a08;
          padding: 24px 16px;
        }

        .login-card {
          width: 100%;
          max-width: 380px;
          background: #1a1410;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px;
          padding: 36px 32px 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .login-brand {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding-bottom: 4px;
        }

        /* Logo is zwart op transparant — invert voor witte weergave op donkere achtergrond */
        .login-brand :global(img) {
          filter: invert(1) brightness(2);
        }

        .login-subtitle {
          font-size: .8125rem;
          color: rgba(255,255,255,.35);
          margin: 0;
          letter-spacing: .02em;
        }

        /* Google button */
        .btn-google {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          min-height: 44px;
          padding: 10px 16px;
          border-radius: 10px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.88);
          font-size: .9375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background .14s, border-color .14s, transform .1s;
        }
        .btn-google:hover:not(:disabled) {
          background: rgba(255,255,255,.1);
          border-color: rgba(255,255,255,.22);
          transform: translateY(-1px);
        }
        .btn-google:active:not(:disabled) { transform: translateY(0); }
        .btn-google:disabled { opacity: .5; cursor: not-allowed; }

        /* Divider */
        .login-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255,255,255,.22);
          font-size: .75rem;
          letter-spacing: .04em;
        }
        .login-divider::before,
        .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,.08);
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .login-error {
          background: rgba(239,68,68,.12);
          border: 1px solid rgba(239,68,68,.3);
          color: #fca5a5;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: .875rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .form-label {
          font-size: .8125rem;
          font-weight: 500;
          color: rgba(255,255,255,.55);
        }
        .form-control {
          width: 100%;
          padding: 10px 13px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 9px;
          color: #fff;
          font-size: .9375rem;
          transition: border-color .14s, background .14s;
        }
        .form-control:focus {
          outline: none;
          border-color: rgba(200,136,42,.6);
          background: rgba(255,255,255,.06);
        }
        .login-btn {
          width: 100%;
          min-height: 44px;
          margin-top: 4px;
          border-radius: 10px;
          font-size: .9375rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
      `}</style>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (session.user) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}
