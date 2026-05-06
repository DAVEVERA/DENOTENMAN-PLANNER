import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import TeamLayout from '@/components/layout/TeamLayout'
import type { GetServerSideProps } from 'next'
import { getSession } from '@/lib/auth'
import type { SessionUser } from '@/types'

interface Props { user: SessionUser }

const CATEGORIES = [
  'Rooster / dienst',
  'Verlof / afwezigheid',
  'Declaratie',
  'Technisch probleem',
  'Vraag over de app',
  'Overig',
]

export default function SupportPage({ user }: Props) {
  const router = useRouter()
  const [category, setCategory]     = useState('')
  const [subject, setSubject]       = useState('')
  const [description, setDesc]      = useState('')
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState(false)
  const [error, setError]           = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!subject.trim() || !description.trim()) {
      setError('Vul minimaal een onderwerp en beschrijving in.')
      return
    }
    setLoading(true)
    try {
      const res  = await fetch('/api/support-ticket', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subject, category, description }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setSubject('')
        setCategory('')
        setDesc('')
      } else {
        setError(data.message ?? 'Er ging iets mis.')
      }
    } catch {
      setError('Geen verbinding. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <TeamLayout user={user}>
      <Head>
        <title>Support – De Notenman Planner</title>
        <meta name="description" content="Stuur een support ticket naar de beheerder van de personeelsplanner." />
      </Head>

      <div className="support-wrap">
        {/* Terug-knop */}
        <button className="support-back" onClick={() => router.back()} aria-label="Terug">
          ← Terug
        </button>

        <div className="support-card">
          {/* Header */}
          <div className="support-header">
            <div className="support-icon">🎫</div>
            <div>
              <h1 className="support-title">Support ticket</h1>
              <p className="support-sub">Heb je een vraag of probleem? Stuur een bericht naar de beheerder.</p>
            </div>
          </div>

          {success ? (
            /* Bevestiging */
            <div className="support-success">
              <div className="support-success-icon">✅</div>
              <h2>Ticket verstuurd!</h2>
              <p>Je bericht is doorgestuurd naar de beheerder. Je ontvangt zo spoedig mogelijk een reactie.</p>
              <button
                className="btn btn-primary"
                onClick={() => setSuccess(false)}
              >
                Nog een ticket indienen
              </button>
            </div>
          ) : (
            /* Formulier */
            <form onSubmit={submit} className="support-form" noValidate>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="support-category">Categorie</label>
                <select
                  id="support-category"
                  className="form-control"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="">— Kies een categorie (optioneel) —</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="support-subject">Onderwerp</label>
                <input
                  id="support-subject"
                  type="text"
                  className="form-control"
                  placeholder="Korte omschrijving van je vraag of probleem"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="support-desc">Beschrijving</label>
                <textarea
                  id="support-desc"
                  className="form-control"
                  placeholder="Beschrijf je vraag of probleem zo duidelijk mogelijk. Vermeld eventueel dag, week of naam van de dienst."
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                  rows={6}
                  required
                />
              </div>

              <div className="support-sender">
                <span>Verstuurd als:</span>
                <strong>{user.display_name}</strong>
              </div>

              <button
                type="submit"
                className="btn btn-primary support-submit"
                disabled={loading}
                id="support-submit-btn"
              >
                {loading ? 'Versturen…' : '📨 Ticket versturen'}
              </button>

            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        .support-wrap {
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
        }
        .support-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: .875rem;
          color: var(--text-muted);
          margin-bottom: 20px;
          padding: 4px 0;
          transition: color .14s;
          background: none;
          border: none;
          cursor: pointer;
        }
        .support-back:hover { color: var(--text); }

        .support-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-md);
          overflow: hidden;
        }
        .support-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px 28px;
          background: linear-gradient(135deg, #1A1412 0%, #2D1F14 100%);
          border-bottom: 1px solid rgba(200,136,42,.2);
        }
        .support-icon {
          font-size: 2rem;
          line-height: 1;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .support-title {
          font-size: 1.1875rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 4px;
        }
        .support-sub {
          font-size: .875rem;
          color: rgba(255,255,255,.55);
          margin: 0;
          line-height: 1.4;
        }

        .support-form {
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .support-sender {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: .8125rem;
          color: var(--text-muted);
          padding: 10px 14px;
          background: var(--surface-alt);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .support-sender strong { color: var(--text); }
        .support-email {
          margin-left: 2px;
          color: var(--text-sub);
        }
        .support-submit {
          width: 100%;
          justify-content: center;
          height: 48px;
          font-size: 1rem;
        }

        /* Succes */
        .support-success {
          padding: 40px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
        }
        .support-success-icon { font-size: 2.5rem; }
        .support-success h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
          color: var(--success);
        }
        .support-success p {
          font-size: .9375rem;
          color: var(--text-sub);
          max-width: 340px;
          margin: 0;
          line-height: 1.5;
        }
        .support-success .btn {
          margin-top: 8px;
        }

        @media (max-width: 640px) {
          .support-header { padding: 20px; gap: 12px; }
          .support-form { padding: 20px; gap: 16px; }
          .support-success { padding: 32px 20px; }
          .support-icon { font-size: 1.5rem; }
        }
      `}</style>
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
