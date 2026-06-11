import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Spinner from '@/components/ui/Spinner'

export default function ResetPasswordPage() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setMessage('')
    if (form.password !== form.confirmPassword) {
      setError('De wachtwoorden komen niet overeen.')
      return
    }
    setLoading(true)
    const r = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: form.password }),
    })
    const data = await r.json().catch(() => ({ success: false, message: 'Wachtwoord herstellen mislukt.' }))
    setLoading(false)
    if (data.success) {
      setMessage('Je wachtwoord is gewijzigd. Je kunt nu inloggen.')
      setForm({ password: '', confirmPassword: '' })
    } else {
      setError(data.message ?? 'Wachtwoord herstellen mislukt.')
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <Image
            src="https://mhzmithddcdnouvlklev.supabase.co/storage/v1/object/public/Icons%20and%20Logo's/Notenman_2020_logo-300x72.png"
            alt="DeNotenman logo"
            width={240}
            height={57}
            style={{ width: 'auto', height: '52px', display: 'block', margin: '0 auto' }}
            priority
          />
          <p className="login-subtitle">Nieuw wachtwoord kiezen</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {!token && <div className="login-error" role="alert">Herstel-link ontbreekt.</div>}
          {error && <div className="login-error" role="alert">{error}</div>}
          {message && <div className="login-success" role="status">{message}</div>}

          <div className="form-group">
            <label htmlFor="password" className="form-label">Nieuw wachtwoord</label>
            <input
              id="password"
              className="form-control"
              type="password"
              autoFocus
              autoComplete="new-password"
              required
              minLength={8}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Herhaal wachtwoord</label>
            <input
              id="confirmPassword"
              className="form-control"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading || !token}>
            {loading ? <><Spinner /> Opslaan...</> : 'Wachtwoord opslaan'}
          </button>
        </form>

        <p className="login-footer">
          <Link href="/login">Terug naar inloggen</Link>
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
        .login-brand :global(img) { filter: invert(1) brightness(2); }
        .login-subtitle {
          font-size: .8125rem;
          color: rgba(255,255,255,.35);
          margin: 0;
          letter-spacing: .02em;
        }
        .login-form { display: flex; flex-direction: column; gap: 14px; }
        .login-error, .login-success {
          border-radius: 8px;
          padding: 10px 12px;
          font-size: .875rem;
        }
        .login-error {
          background: rgba(239,68,68,.12);
          border: 1px solid rgba(239,68,68,.3);
          color: #fca5a5;
        }
        .login-success {
          background: rgba(34,197,94,.12);
          border: 1px solid rgba(34,197,94,.3);
          color: #86efac;
        }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
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
        .login-footer {
          font-size: .75rem;
          color: rgba(255,255,255,.45);
          text-align: center;
          margin: 0;
        }
        .login-footer :global(a) { color: rgba(255,255,255,.65); text-decoration: none; }
        .login-footer :global(a:hover) { color: #fff; }
      `}</style>
    </div>
  )
}
