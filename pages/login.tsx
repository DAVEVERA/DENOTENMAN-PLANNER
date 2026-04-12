import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { getSession } from '@/lib/auth'

export default function LoginPage() {
  const router  = useRouter()
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
    const data = await r.json()
    setLoading(false)
    if (data.success) router.push('/')
    else setError(data.message ?? 'Onjuiste inloggegevens')
  }

  return (
<div className="login-shell">
  <div className="login-card">
    <div className="login-brand">
      <Image 
        src="https://mhzmithddcdnouvlklev.supabase.co/storage/v1/object/public/Icons%20and%20Logo's/Notenman_2020_logo-300x72.png" 
        alt="Denotenman logo" 
        width={200}
        height={200}
        style={{ width: 'auto', height: '80px', display: 'inline-block' }}
        className="login-logo"
      />
      <h1 className="login-title">Planner</h1>
    </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">{error}</div>
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
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Bezig…</> : 'Inloggen'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-shell {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: var(--bg);
          padding: var(--s6);
        }
        .login-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); padding: var(--s8);
          width: 100%; max-width: 380px;
          box-shadow: 0 4px 24px rgba(26,20,18,.08);
        }
        .login-brand { text-align: center; margin-bottom: var(--s7); }
        .login-logo { font-size: 2.5rem; margin-bottom: var(--s2); }
        .login-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
        .login-subtitle { font-size: .9375rem; color: var(--text-muted); margin: 0; }

        .login-error {
          background: #FDE8E8; border: 1px solid #FBBABA; color: #B91C1C;
          border-radius: var(--radius); padding: 10px 14px;
          font-size: .875rem; margin-bottom: var(--s4);
        }
        .login-btn { width: 100%; justify-content: center; margin-top: var(--s2); height: 44px; font-size: 1rem; }

        .login-locations {
          display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
          gap: 6px; row-gap: 4px; margin-top: var(--s6);
          font-size: .8125rem; color: var(--text-muted);
        }
        .loc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .markt-dot { background: var(--markt); }
        .noot-dot  { background: var(--noot);  }
        .loc-sep   { color: var(--border); }

        @media (max-width: 480px) {
          .login-card { padding: var(--s5); }
          .login-shell { padding: var(--s4); }
        }
        @media (max-width: 360px) {
          .login-card { padding: var(--s4); }
          .login-shell { padding: var(--s3); }
          .login-title { font-size: 1.25rem; }
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
