import { useState, useEffect, useCallback } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, ExpenseClaim, Location } from '@/types'
import { CLAIM_TYPES } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

const STATUS_LABEL: Record<string, string> = {
  pending:  'In behandeling',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
}
const STATUS_CLASS: Record<string, string> = {
  pending:  'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-danger',
}
const CLAIM_LABEL: Record<string, string> = {
  reiskosten: '🚗 Reiskosten',
  overuren:   '⏰ Overuren',
  overig:     '📎 Overig',
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

const EMPTY_FORM = {
  claim_type:     'reiskosten',
  amount:         '',
  description:    '',
  claim_date:     new Date().toISOString().slice(0, 10),
  reference_date: '',
}

export default function ExpensesPage({ user }: Props) {
  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  const [claims, setClaims]     = useState<ExpenseClaim[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/expenses').then(r => r.json())
    setClaims(r.success ? r.data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormErr('')
    const r = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())
    setSaving(false)
    if (!r.success) { setFormErr(r.message ?? 'Indienen mislukt'); return }
    showToast('✅ Declaratie ingediend!')
    setForm(EMPTY_FORM)
    setShowForm(false)
    load()
  }

  async function withdraw(id: number) {
    if (!confirm('Declaratie intrekken?')) return
    const r = await fetch(`/api/expenses/${id}`, { method: 'DELETE' }).then(r => r.json())
    if (r.success) { showToast('Declaratie ingetrokken.', true); load() }
    else showToast('❌ ' + (r.message ?? 'Fout'), false)
  }

  const pending  = claims.filter(c => c.status === 'pending')
  const resolved = claims.filter(c => c.status !== 'pending')

  return (
    <TeamLayout user={user} location={locProp}>
      {toast && (
        <div className={`exp-toast ${toast.ok ? 'ok' : 'err'}`} role="alert">{toast.msg}</div>
      )}

      <div className="exp-page">
        <div className="exp-head">
          <div>
            <h1 className="exp-h1">Mijn declaraties</h1>
            <p className="exp-sub">Dien reiskosten, overuren of overige declaraties in.</p>
          </div>
          <button
            id="exp-new-btn"
            className="btn btn-primary btn-sm"
            onClick={() => setShowForm(s => !s)}
          >
            {showForm ? '✕ Annuleren' : '+ Nieuwe declaratie'}
          </button>
        </div>

        {/* ── Formulier ── */}
        {showForm && (
          <div className="exp-form-card">
            <h2 className="exp-form-title">Declaratie indienen</h2>
            <form onSubmit={handleSubmit}>
              {formErr && <div className="alert alert-danger" role="alert">{formErr}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label required" htmlFor="claim_type">Type</label>
                  <select id="claim_type" className="form-control" value={form.claim_type}
                    onChange={e => setForm(f => ({ ...f, claim_type: e.target.value }))}
                    title="Type declaratie">
                    {CLAIM_TYPES.map(t => (
                      <option key={t} value={t}>{CLAIM_LABEL[t] ?? t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="claim_amount">Bedrag (€)</label>
                  <input id="claim_amount" type="number" step="0.01" min="0.01" className="form-control"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="bijv. 12.50" title="Declaratiebedrag" required />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="claim_date">Declaratiedatum</label>
                  <input id="claim_date" type="date" className="form-control"
                    value={form.claim_date} onChange={e => setForm(f => ({ ...f, claim_date: e.target.value }))}
                    title="Datum van indiening" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ref_date">Datum gewerkt/gereden</label>
                  <input id="ref_date" type="date" className="form-control"
                    value={form.reference_date} onChange={e => setForm(f => ({ ...f, reference_date: e.target.value }))}
                    title="Datum waarop de kosten zijn gemaakt" />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label required" htmlFor="claim_desc">Omschrijving</label>
                <textarea id="claim_desc" className="form-control" rows={3}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Omschrijf de declaratie (bijv. reiskosten woon-werk 12 km × 2)" title="Omschrijving" required />
              </div>
              <div className="exp-form-footer">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? <Spinner /> : 'Indienen'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="exp-loading"><Spinner /> Laden…</div>
        ) : (
          <>
            {/* ── Openstaand ── */}
            <section className="exp-section">
              <div className="exp-sec-head">
                <h2 className="exp-sec-title">In behandeling</h2>
                {pending.length > 0 && <span className="badge badge-pending">{pending.length}</span>}
              </div>
              {pending.length === 0 ? (
                <div className="exp-empty">Geen openstaande declaraties.</div>
              ) : (
                <div className="exp-list">
                  {pending.map(c => (
                    <div key={c.id} className="exp-row">
                      <div className="exp-row-type">{CLAIM_LABEL[c.claim_type] ?? c.claim_type}</div>
                      <div className="exp-row-desc">{c.description}</div>
                      <div className="exp-row-meta">
                        {new Date(c.claim_date).toLocaleDateString('nl-NL')}
                        {c.reference_date && ` · ref: ${new Date(c.reference_date).toLocaleDateString('nl-NL')}`}
                      </div>
                      <div className="exp-row-amount">{fmtEur(c.amount)}</div>
                      <span className={`badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                      <button className="btn btn-ghost btn-xs" onClick={() => withdraw(c.id)}>Intrekken</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Afgehandeld ── */}
            {resolved.length > 0 && (
              <section className="exp-section">
                <div className="exp-sec-head">
                  <h2 className="exp-sec-title">Afgehandeld</h2>
                  <span className="badge badge-draft">{resolved.length}</span>
                </div>
                <div className="exp-list">
                  {resolved.map(c => (
                    <div key={c.id} className="exp-row">
                      <div className="exp-row-type">{CLAIM_LABEL[c.claim_type] ?? c.claim_type}</div>
                      <div className="exp-row-desc">{c.description}</div>
                      <div className="exp-row-meta">
                        {new Date(c.claim_date).toLocaleDateString('nl-NL')}
                        {c.review_note && <span className="exp-review-note"> · {c.review_note}</span>}
                      </div>
                      <div className="exp-row-amount">{fmtEur(c.amount)}</div>
                      <span className={`badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {claims.length === 0 && !showForm && (
              <div className="exp-empty-state">
                <div className="exp-empty-icon">🧾</div>
                <div>Nog geen declaraties ingediend.</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                  Eerste declaratie indienen
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .exp-toast {
          position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
          padding: 12px 24px; border-radius: 999px; font-weight: 600; font-size: .9375rem;
          box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; white-space: nowrap;
          animation: toast-in .2s ease;
        }
        .exp-toast.ok  { background: #1A1412; color: #fff; }
        .exp-toast.err { background: var(--danger); color: #fff; }
        @keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(-8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }

        .exp-page { max-width: 800px; }
        .exp-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: var(--s3); margin-bottom: var(--s6);
        }
        .exp-h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 4px; }
        .exp-sub { color: var(--text-muted); margin: 0; font-size: .9375rem; }

        .exp-form-card {
          background: var(--surface); border: 1.5px solid var(--brand);
          border-radius: var(--radius-xl); padding: var(--s5);
          margin-bottom: var(--s6);
        }
        .exp-form-title { font-size: 1.0625rem; font-weight: 700; margin: 0 0 var(--s4); }
        .exp-form-footer { display: flex; justify-content: flex-end; margin-top: var(--s4); }

        .exp-loading { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }

        .exp-section { margin-bottom: var(--s7); }
        .exp-sec-head {
          display: flex; align-items: center; gap: var(--s3); margin-bottom: var(--s3);
          padding-bottom: var(--s3); border-bottom: 1.5px solid var(--border);
        }
        .exp-sec-title { font-size: 1rem; font-weight: 700; margin: 0; flex: 1; }

        .exp-empty {
          padding: var(--s5); color: var(--text-muted); font-size: .9375rem;
          background: var(--surface); border: 1px dashed var(--border);
          border-radius: var(--radius-lg); text-align: center;
        }

        .exp-list { display: flex; flex-direction: column; gap: 0;
          border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .exp-row {
          display: grid;
          grid-template-columns: 140px 1fr 160px 90px 130px 100px;
          align-items: center; gap: var(--s3);
          padding: var(--s3) var(--s4); border-bottom: 1px solid var(--border);
          background: var(--surface); font-size: .9rem;
        }
        .exp-row:last-child { border-bottom: none; }
        .exp-row:hover { background: var(--surface-alt); }
        .exp-row-type { font-weight: 600; white-space: nowrap; font-size: .85rem; }
        .exp-row-desc { color: var(--text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .exp-row-meta { font-size: .8125rem; color: var(--text-muted); }
        .exp-review-note { font-style: italic; }
        .exp-row-amount { font-weight: 700; text-align: right; white-space: nowrap; }

        .exp-empty-state {
          display: flex; flex-direction: column; align-items: center; gap: var(--s4);
          padding: var(--s10) var(--s8); text-align: center; color: var(--text-muted);
        }
        .exp-empty-icon { font-size: 3rem; }

        @media (max-width: 700px) {
          .exp-row { grid-template-columns: 1fr 1fr; row-gap: 4px; }
          .exp-row-desc { grid-column: 1 / -1; }
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
