import { useState, useEffect } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, LeaveRequest, Location } from '@/types'

interface Props { user: SessionUser }

const STATUS_LABELS: Record<string, string> = {
  pending:  'In behandeling',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysDiff(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
}

const today = new Date().toISOString().slice(0, 10)

export default function MyLeavePage({ user }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({
    leave_type: 'Verlof' as 'Verlof' | 'Vakantie' | 'Verzuim',
    start_date: today, end_date: today, note: '',
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/leave')
    const d = await r.json()
    setRequests(d.success ? d.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.end_date < form.start_date) { setError('Einddatum moet na startdatum zijn'); return }
    setSaving(true); setError(''); setSuccess('')
    const r = await fetch('/api/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    setSaving(false)
    if (!d.success) { setError(d.message || 'Indienen mislukt'); return }
    setSuccess('Verlofaanvraag ingediend! De beheerder neemt zo snel mogelijk een beslissing.')
    setShowForm(false)
    setForm({ leave_type: 'Verlof', start_date: today, end_date: today, note: '' })
    load()
  }

  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  return (
    <TeamLayout user={user} location={locProp}>
      <div className="leave-page">
        <div className="leave-header">
          <h1 className="page-title">Verlof aanvragen</h1>
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              + Nieuwe aanvraag
            </button>
          )}
        </div>

        {success && <div className="alert alert-success">{success}</div>}

        {/* ── Request form ── */}
        {showForm && (
          <div className="request-form-card">
            <h3 className="form-card-title">Verlof aanvragen</h3>
            <form onSubmit={submit}>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label required" htmlFor="leave-type">Type</label>
                  <select id="leave-type" className="form-control" value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value as any }))}>
                    <option value="Verlof">Verlof</option>
                    <option value="Vakantie">Vakantie</option>
                    <option value="Verzuim">Verzuim/Ziek</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="leave-start">Startdatum</label>
                  <input type="date" id="leave-start" className="form-control" value={form.start_date} min={today} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="leave-end">Einddatum</label>
                  <input type="date" id="leave-end" className="form-control" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="leave-note">Toelichting</label>
                <textarea id="leave-note" className="form-control" rows={3} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Optionele toelichting…" />
              </div>
              {form.start_date && form.end_date && form.end_date >= form.start_date && (
                <div className="duration-hint">
                  Duur: <strong>{daysDiff(form.start_date, form.end_date)} dag{daysDiff(form.start_date, form.end_date) !== 1 ? 'en' : ''}</strong>
                </div>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>Annuleren</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Indienen'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── History ── */}
        <div className="history-section">
          <h2 className="history-title">Mijn aanvragen</h2>
          {loading ? (
            <div className="loading-row"><span className="spinner" /> Laden…</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏖️</div>
              <div>Nog geen verlofaanvragen ingediend.</div>
            </div>
          ) : (
            <div className="request-list">
              {requests.map(req => (
                <div key={req.id} className={`req-card status-${req.status}`}>
                  <div className="req-left">
                    <div className="req-type-dates">
                      <span className={`req-type type-${req.leave_type.toLowerCase()}`}>{req.leave_type}</span>
                      <span className="req-dates">{fmtDate(req.start_date)} – {fmtDate(req.end_date)}</span>
                      <span className="req-days">{daysDiff(req.start_date, req.end_date)} dag{daysDiff(req.start_date, req.end_date) !== 1 ? 'en' : ''}</span>
                    </div>
                    {req.note && <div className="req-note">&quot;{req.note}&quot;</div>}
                    <div className="req-meta">Ingediend op {fmtDate(req.created_at)}</div>
                  </div>
                  <div className="req-right">
                    <span className={`status-badge status-${req.status}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                    {req.reviewed_at && (
                      <span className="review-date">{fmtDate(req.reviewed_at)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .leave-page { max-width: 720px; }
        .leave-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--s5);
        }
        .page-title { font-size: 1.375rem; font-weight: 700; margin: 0; }

        .request-form-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
          margin-bottom: var(--s5);
        }
        .form-card-title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--s4); }
        .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--s3); }
        .duration-hint { font-size: .875rem; color: var(--text-sub); margin-bottom: var(--s3); }
        .form-actions { display: flex; gap: var(--s2); justify-content: flex-end; margin-top: var(--s4); }

        .history-section { margin-top: var(--s2); }
        .history-title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--s3); }
        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s6); color: var(--text-muted); }
        .empty-state { text-align: center; padding: var(--s10) var(--s6); }
        .empty-icon { font-size: 2.5rem; margin-bottom: var(--s3); }

        .request-list { display: flex; flex-direction: column; gap: var(--s3); }
        .req-card {
          display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s4) var(--s5);
        }
        .req-card.status-pending  { border-left: 3px solid var(--brand); }
        .req-card.status-approved { border-left: 3px solid #2E7D32; }
        .req-card.status-rejected { border-left: 3px solid var(--danger); opacity: .75; }

        .req-type-dates { display: flex; align-items: center; gap: var(--s3); flex-wrap: wrap; margin-bottom: var(--s2); }
        .req-type { font-size: .8125rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
        .type-verlof   { background: var(--shift-verlof); }
        .type-vakantie { background: var(--shift-vakantie); }
        .type-verzuim  { background: var(--shift-verzuim); }
        .req-dates { font-size: .9375rem; }
        .req-days { font-size: .875rem; color: var(--text-muted); }
        .req-note { font-size: .875rem; font-style: italic; color: var(--text-sub); margin-bottom: 4px; }
        .req-meta { font-size: .8125rem; color: var(--text-muted); }

        .req-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .status-badge { font-size: .8125rem; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
        .status-badge.status-pending  { background: #FFF3E0; color: #E65100; }
        .status-badge.status-approved { background: #E8F5E9; color: #2E7D32; }
        .status-badge.status-rejected { background: #FCE4EC; color: #B71C1C; }
        .review-date { font-size: .75rem; color: var(--text-muted); }

        @media (max-width: 600px) {
          .form-row-3 { grid-template-columns: 1fr; }
          .req-card { flex-direction: column; padding: var(--s3) var(--s4); }
          .req-right { align-items: flex-start; flex-direction: row; flex-wrap: wrap; gap: var(--s2); }
          .req-dates { font-size: .875rem; }
          .leave-page { max-width: 100%; }
        }
        @media (max-width: 480px) {
          .leave-header { flex-wrap: wrap; gap: var(--s3); }
          .page-title { font-size: 1.125rem; }
        }
      `}</style>
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  if (!session.user.employee_id) return { redirect: { destination: '/me', permanent: false } }
  return { props: { user: session.user } }
}
