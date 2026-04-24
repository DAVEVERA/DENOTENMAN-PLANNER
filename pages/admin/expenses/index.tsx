import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, ExpenseClaim } from '@/types'
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

export default function AdminExpensesPage({ user }: Props) {
  const [claims, setClaims]         = useState<ExpenseClaim[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilter]   = useState<string>('pending')
  const [reviewing, setReviewing]   = useState<ExpenseClaim | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const qs = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
    const r  = await fetch(`/api/expenses${qs}`).then(r => r.json())
    setClaims(r.success ? r.data : [])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  async function approve(id: number) {
    setSaving(true)
    const r = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', review_note: reviewNote }),
    }).then(r => r.json())
    setSaving(false)
    if (r.success) { showToast('✅ Goedgekeurd'); setReviewing(null); setReviewNote(''); load() }
    else showToast('❌ ' + (r.message ?? 'Fout'), false)
  }

  async function reject(id: number) {
    if (!reviewNote.trim()) { alert('Voer een reden in voor afwijzing.'); return }
    setSaving(true)
    const r = await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', review_note: reviewNote }),
    }).then(r => r.json())
    setSaving(false)
    if (r.success) { showToast('Afgewezen.', false); setReviewing(null); setReviewNote(''); load() }
    else showToast('❌ ' + (r.message ?? 'Fout'), false)
  }

  async function exportCsv() {
    const all = await fetch('/api/expenses').then(r => r.json())
    const rows: ExpenseClaim[] = all.success ? all.data : []
    const header = 'ID;Medewerker;Type;Bedrag;Omschrijving;Datum;Referentiedatum;Status;Beoordeeld door;Beoordeeld op;Opmerking'
    const lines = rows.map(c => [
      c.id, c.employee_name, c.claim_type, c.amount.toString().replace('.', ','),
      `"${c.description.replace(/"/g, '""')}"`,
      c.claim_date, c.reference_date ?? '',
      c.status, c.reviewed_by ?? '', c.reviewed_at ? new Date(c.reviewed_at).toLocaleDateString('nl-NL') : '',
      `"${(c.review_note ?? '').replace(/"/g, '""')}"`,
    ].join(';'))
    const csv = [header, ...lines].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `declaraties-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalApproved = claims
    .filter(c => c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <AdminLayout user={user} title="Declaraties">
      {toast && (
        <div className={`adm-exp-toast ${toast.ok ? 'ok' : 'err'}`} role="alert">{toast.msg}</div>
      )}

      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Declaraties</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '.9375rem' }}>
            Beheer en verwerk ingediende declaraties van medewerkers.
          </p>
        </div>
        <div className="page-actions">
          <button id="admin-exp-export" className="btn btn-outline btn-sm" onClick={exportCsv}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* ── Statistieken ── */}
      <div className="adm-exp-stats">
        {[
          { label: 'In behandeling', val: claims.filter(c => c.status === 'pending').length,  cls: 'stat-pending' },
          { label: 'Goedgekeurd',    val: claims.filter(c => c.status === 'approved').length, cls: 'stat-approved' },
          { label: 'Afgewezen',      val: claims.filter(c => c.status === 'rejected').length, cls: 'stat-rejected' },
          { label: 'Totaal goedgek.',val: fmtEur(totalApproved),                                cls: 'stat-amount' },
        ].map(s => (
          <div key={s.label} className={`adm-exp-stat ${s.cls}`}>
            <div className="stat-val">{s.val}</div>
            <div className="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter ── */}
      <div className="toolbar" style={{ marginBottom: 'var(--s4)' }}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
          <button
            key={s}
            id={`exp-filter-${s}`}
            className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'Alles' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* ── Tabel ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', padding: 'var(--s8)', color: 'var(--text-muted)' }}>
          <Spinner /> Laden…
        </div>
      ) : claims.length === 0 ? (
        <div style={{ padding: 'var(--s8)', textAlign: 'center', color: 'var(--text-muted)' }}>
          Geen declaraties gevonden.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table" aria-label="Declaraties overzicht">
            <thead>
              <tr>
                <th>Medewerker</th>
                <th>Type</th>
                <th>Omschrijving</th>
                <th>Datum</th>
                <th style={{ textAlign: 'right' }}>Bedrag</th>
                <th>Status</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id}>
                  <td className="fw-500">{c.employee_name}</td>
                  <td>{CLAIM_LABEL[c.claim_type] ?? c.claim_type}</td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.description}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(c.claim_date).toLocaleDateString('nl-NL')}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtEur(c.amount)}</td>
                  <td><span className={`badge ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                  <td>
                    {c.status === 'pending' ? (
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => { setReviewing(c); setReviewNote('') }}
                      >
                        Beoordelen
                      </button>
                    ) : (
                      <span style={{ fontSize: '.8125rem', color: 'var(--text-muted)' }}>
                        {c.reviewed_by ?? '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Review modal ── */}
      {reviewing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReviewing(null)} role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rev-title">
            <div className="modal-header">
              <h3 id="rev-title">Declaratie beoordelen</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setReviewing(null)} aria-label="Sluiten">✕</button>
            </div>
            <div className="modal-body">
              <div className="adm-rev-detail">
                <div><span className="rev-lbl">Medewerker</span><span>{reviewing.employee_name}</span></div>
                <div><span className="rev-lbl">Type</span><span>{CLAIM_LABEL[reviewing.claim_type]}</span></div>
                <div><span className="rev-lbl">Bedrag</span><strong>{fmtEur(reviewing.amount)}</strong></div>
                <div><span className="rev-lbl">Datum</span><span>{new Date(reviewing.claim_date).toLocaleDateString('nl-NL')}</span></div>
                <div className="rev-full"><span className="rev-lbl">Omschrijving</span><span>{reviewing.description}</span></div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="review_note">Opmerking (verplicht bij afwijzen)</label>
                <textarea id="review_note" className="form-control" rows={3}
                  value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  placeholder="Bijv. 'Reiskosten worden vergoed via salarisstrook'" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setReviewing(null)}>Annuleren</button>
              <button className="btn btn-danger btn-sm" disabled={saving} onClick={() => reject(reviewing.id)}>
                {saving ? <Spinner /> : '✕ Afwijzen'}
              </button>
              <button className="btn btn-success btn-sm" disabled={saving} onClick={() => approve(reviewing.id)}>
                {saving ? <Spinner /> : '✓ Goedkeuren'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .adm-exp-toast {
          position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
          padding: 12px 24px; border-radius: 999px; font-weight: 600; font-size: .9375rem;
          box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; white-space: nowrap;
        }
        .adm-exp-toast.ok  { background: #1A1412; color: #fff; }
        .adm-exp-toast.err { background: var(--danger); color: #fff; }

        .adm-exp-stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s3);
          margin-bottom: var(--s5);
        }
        .adm-exp-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s4);
          border-top: 3px solid var(--border-strong);
        }
        .stat-pending  { border-top-color: #C8882A; }
        .stat-approved { border-top-color: #2C6E49; }
        .stat-rejected { border-top-color: var(--danger); }
        .stat-amount   { border-top-color: #1976D2; }
        .stat-val { font-size: 1.5rem; font-weight: 800; line-height: 1; }
        .stat-lbl { font-size: .8125rem; color: var(--text-muted); margin-top: 4px; }

        .adm-rev-detail {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3);
          background: var(--surface-alt); border-radius: var(--radius); padding: var(--s4);
        }
        .adm-rev-detail > div { display: flex; flex-direction: column; gap: 2px; }
        .rev-full { grid-column: 1 / -1; }
        .rev-lbl { font-size: .75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

        @media (max-width: 700px) {
          .adm-exp-stats { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  if (session.user.role === 'employee') return { redirect: { destination: '/me', permanent: false } }
  return { props: { user: session.user } }
}
