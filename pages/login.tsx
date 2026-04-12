import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { getSession } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'

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
            {loading ? <><Spinner /> Bezig…</> : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (session.user) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}
