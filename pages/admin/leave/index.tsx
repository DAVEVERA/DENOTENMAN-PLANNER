import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, LeaveRequest } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

const STATUS_LABELS: Record<string, string> = {
  pending:  'In behandeling',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysDiff(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.round(ms / 86400000) + 1
}

export default function LeavePage({ user }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [filter, setFilter]     = useState<'pending' | 'approved' | 'rejected' | ''>('pending')
  const [loading, setLoading]   = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = filter ? `?status=${filter}` : ''
    const r = await fetch(`/api/leave${qs}`)
    const d = await r.json()
    setRequests(d.success ? d.data : [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function decide(id: number, decision: 'approved' | 'rejected') {
    setProcessing(id)
    await fetch(`/api/leave/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    setProcessing(null)
    load()
  }

  const pending = requests.filter(r => r.status === 'pending').length

  return (
    <AdminLayout user={user} title="Verlofaanvragen">
      <div className="page-controls">
        <div className="filter-tabs">
          {(['pending', 'approved', 'rejected', ''] as const).map(s => (
            <button
              key={String(s)}
              className={`filter-tab${filter === s ? ' active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s === '' ? 'Alles' : STATUS_LABELS[s]}
              {s === 'pending' && pending > 0 && <span className="badge-count">{pending}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-row"><Spinner /> Laden…</div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏖️</div>
          <div className="empty-text">Geen {filter ? STATUS_LABELS[filter].toLowerCase() : ''} verlofaanvragen.</div>
        </div>
      ) : (
        <div className="leave-list">
          {requests.map(req => (
            <div key={req.id} className={`leave-card status-${req.status}`}>
              <div className="leave-card-left">
                <div className="leave-employee">{req.employee_name}</div>
                <div className="leave-meta">
                  <span className="leave-type" data-type={req.leave_type.toLowerCase()}>{req.leave_type}</span>
                  <span className="leave-dates">{fmtDate(req.start_date)} – {fmtDate(req.end_date)}</span>
                  <span className="leave-days">{daysDiff(req.start_date, req.end_date)} dag{daysDiff(req.start_date, req.end_date) !== 1 ? 'en' : ''}</span>
                </div>
                {req.note && <div className="leave-note">&quot;{req.note}&quot;</div>}
                <div className="leave-submitted">Ingediend: {fmtDate(req.created_at)}</div>
                {req.reviewed_by && (
                  <div className="leave-reviewed">
                    {STATUS_LABELS[req.status]} door {req.reviewed_by}
                    {req.reviewed_at && ` op ${fmtDate(req.reviewed_at)}`}
                  </div>
                )}
              </div>
              <div className="leave-card-right">
                <span className={`status-pill status-${req.status}`}>{STATUS_LABELS[req.status]}</span>
                {req.status === 'pending' && (
                  <div className="decision-buttons">
                    <button
                      className="btn btn-success btn-sm"
                      disabled={processing === req.id}
                      onClick={() => decide(req.id, 'approved')}
                    >
                      {processing === req.id ? <Spinner /> : 'Goedkeuren'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={processing === req.id}
                      onClick={() => decide(req.id, 'rejected')}
                    >
                      Afwijzen
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .page-controls { margin-bottom: var(--s5); }
        .filter-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
        .filter-tab {
          padding: 10px 14px; min-height: 44px; border-radius: 20px;
          font-size: .875rem; font-weight: 500;
          color: var(--text-sub); background: var(--surface);
          border: 1px solid var(--border);
          display: flex; align-items: center; gap: 6px;
          transition: background .15s, border-color .15s;
        }
        .filter-tab.active { background: var(--brand); color: #fff; border-color: var(--brand); }
        .filter-tab:not(.active):hover { border-color: var(--brand); color: var(--brand); }
        .badge-count {
          background: var(--danger); color: #fff;
          font-size: .75rem; font-weight: 700;
          border-radius: 10px; padding: 2px 7px; min-width: 20px; text-align: center;
        }

        .leave-list { display: flex; flex-direction: column; gap: var(--s3); }
        .leave-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s4) var(--s5);
          display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s4);
        }
        .leave-card.status-pending  { border-left: 3px solid var(--brand); }
        .leave-card.status-approved { border-left: 3px solid #2E7D32; }
        .leave-card.status-rejected { border-left: 3px solid var(--danger); opacity: .75; }

        .leave-employee { font-size: 1rem; font-weight: 600; margin-bottom: var(--s2); }
        .leave-meta { display: flex; align-items: center; gap: var(--s3); flex-wrap: wrap; margin-bottom: var(--s2); }
        .leave-type {
          font-size: .8125rem; font-weight: 600; padding: 2px 8px; border-radius: 4px;
        }
        .leave-dates { font-size: .9375rem; }
        .leave-days { font-size: .875rem; color: var(--text-muted); }
        .leave-note { font-size: .875rem; font-style: italic; color: var(--text-sub); margin-bottom: 4px; }
        .leave-submitted, .leave-reviewed { font-size: .8125rem; color: var(--text-muted); }

        .leave-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: var(--s3); flex-shrink: 0; }
        .status-pill {
          font-size: .8125rem; font-weight: 600; padding: 3px 10px; border-radius: 20px;
        }
        .status-pill.status-pending  { background: #FFF3E0; color: #E65100; }
        .status-pill.status-approved { background: #E8F5E9; color: #2E7D32; }
        .status-pill.status-rejected { background: #FCE4EC; color: #B71C1C; }
        .decision-buttons { display: flex; gap: var(--s2); }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-state { text-align: center; padding: var(--s12) var(--s8); }
        .empty-icon { font-size: 2.5rem; margin-bottom: var(--s3); }
        .empty-text { color: var(--text-muted); font-size: .9375rem; }

        @media (max-width: 600px) {
          .leave-card { flex-direction: column; padding: var(--s3) var(--s4); }
          .leave-card-right { align-items: flex-start; flex-direction: row; flex-wrap: wrap; gap: var(--s2); }
          .decision-buttons { margin-top: 0; }
          .leave-dates { font-size: .875rem; }
        }
        @media (max-width: 480px) {
          .filter-tabs { gap: var(--s1); }
          .filter-tab { padding: 8px 12px; font-size: .8125rem; min-height: 44px; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
