import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { getSession } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm]     = useState({ username: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const r    = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    let data: { success?: boolean; message?: string }
    try {
      data = await r.json()
    } catch {
      data = { success: false, message: 'Inloggen mislukt door een serverfout.' }
    }
    setLoading(false)
    if (data.success) router.push('/')
    else setError(data.message ?? 'Onjuiste inloggegevens')
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

          <div className="forgot-row">
            <Link href="/forgot-password">
              Wachtwoord vergeten?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
            id="login-submit-btn"
          >
            {loading ? <><Spinner /> Bezig…</> : 'Inloggen'}
          </button>

        </form>

        <p className="login-footer">
          Geen toegang? Neem contact op met de beheerder.
        </p>
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
        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -6px;
        }
        .forgot-row :global(a) {
          color: #FFCF6B;
          font-size: .875rem;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color .14s;
        }
        .forgot-row :global(a:hover) { color: #fff; }
        .login-footer {
          font-size: .75rem;
          color: rgba(255,255,255,.22);
          text-align: center;
          margin: 0;
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
