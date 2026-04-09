import { useState, useEffect, useCallback } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, TimeLog, Location } from '@/types'

interface Props { user: SessionUser }

function calcHours(clockIn: string | null, clockOut: string | null, brk: number) {
  if (!clockIn || !clockOut) return 0
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.max(0, (oh * 60 + om - (ih * 60 + im) - brk) / 60)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 8) + '01'

export default function MyHoursPage({ user }: Props) {
  const [logs, setLogs]       = useState<TimeLog[]>([])
  const [from, setFrom]       = useState(firstOfMonth)
  const [to, setTo]           = useState(today)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user.employee_id) return
    setLoading(true)
    const r = await fetch(`/api/hours?employee_id=${user.employee_id}&from=${from}&to=${to}`)
    const d = await r.json()
    setLogs(d.success ? d.data : [])
    setLoading(false)
  }, [user.employee_id, from, to])

  useEffect(() => { load() }, [load])

  const totalHours   = logs.reduce((acc, l) => acc + calcHours(l.clock_in, l.clock_out, l.break_minutes), 0)
  const totalOvertime = logs.reduce((acc, l) => acc + l.overtime_hours, 0)
  const processed    = logs.filter(l => l.is_processed).length

  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  return (
    <TeamLayout user={user} location={locProp}>
      <div className="hours-page">
        <h1 className="page-title">Mijn uren</h1>

        {/* ── Filters ── */}
        <div className="filters">
          <div className="date-range">
            <label htmlFor="filter_from" className="sr-only">Vanaf datum</label>
            <input id="filter_from" type="date" className="form-control form-control-sm" value={from} onChange={e => setFrom(e.target.value)} />
            <span className="range-sep">–</span>
            <label htmlFor="filter_to" className="sr-only">Tot datum</label>
            <input id="filter_to" type="date" className="form-control form-control-sm" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-outline btn-sm" onClick={load}>Ophalen</button>
        </div>

        {/* ── Stats ── */}
        <div className="hours-stats">
          <div className="stat-item">
            <span className="stat-val">{totalHours.toFixed(1)}u</span>
            <span className="stat-label">gewerkt</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">{logs.length}</span>
            <span className="stat-label">registraties</span>
          </div>
          {totalOvertime > 0 && (
            <div className="stat-item">
              <span className="stat-val">+{totalOvertime.toFixed(1)}u</span>
              <span className="stat-label">overwerk</span>
            </div>
          )}
          <div className="stat-item">
            <span className="stat-val">{processed}/{logs.length}</span>
            <span className="stat-label">verwerkt</span>
          </div>
        </div>

        {/* ── Log list ── */}
        {loading ? (
          <div className="loading-row"><span className="spinner" /> Laden…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⏱️</div>
            <div>Geen uren gevonden voor deze periode.</div>
          </div>
        ) : (
          <div className="log-list">
            {logs.map(log => {
              const hours = calcHours(log.clock_in, log.clock_out, log.break_minutes)
              return (
                <div key={log.id} className="log-row">
                  <div className="log-date">{fmtDate(log.log_date)}</div>
                  <div className="log-times">
                    {log.clock_in ? (
                      <span className="time-range">
                        {log.clock_in.slice(0,5)} – {log.clock_out?.slice(0,5) ?? '?'}
                        {log.break_minutes > 0 && <span className="break-info"> (pauze {log.break_minutes}m)</span>}
                      </span>
                    ) : (
                      <span className="text-muted">Geen tijden</span>
                    )}
                  </div>
                  <div className="log-hours">{hours > 0 ? `${hours.toFixed(1)}u` : '–'}</div>
                  <div className="log-loc">
                    <span className={`loc-dot loc-${log.location}`} />
                    {log.location === 'markt' ? 'Markt' : 'Nootmagazijn'}
                  </div>
                  {log.overtime_hours > 0 && (
                    <div className="log-overtime">+{log.overtime_hours}u overwerk</div>
                  )}
                  {log.note && <div className="log-note">{log.note}</div>}
                  <div className="log-status">
                    <span className={`proc-dot ${log.is_processed ? 'done' : 'open'}`} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .hours-page { max-width: 680px; }
        .page-title { font-size: 1.375rem; font-weight: 700; margin: 0 0 var(--s4); }

        .filters { display: flex; align-items: center; gap: var(--s3); margin-bottom: var(--s4); flex-wrap: wrap; }
        .date-range { display: flex; align-items: center; gap: 6px; }
        .range-sep { color: var(--text-muted); }

        .hours-stats {
          display: flex; gap: var(--s5);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s3) var(--s5);
          margin-bottom: var(--s5); flex-wrap: wrap;
        }
        .stat-item { display: flex; flex-direction: column; gap: 1px; }
        .stat-val { font-size: 1.375rem; font-weight: 700; line-height: 1; }
        .stat-label { font-size: .75rem; color: var(--text-muted); }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-state { text-align: center; padding: var(--s10) var(--s6); }
        .empty-icon { font-size: 2.5rem; margin-bottom: var(--s3); }

        .log-list { display: flex; flex-direction: column; gap: 1px; }
        .log-row {
          display: grid; grid-template-columns: 120px 1fr auto auto auto auto;
          align-items: center; gap: var(--s3);
          padding: var(--s3) var(--s4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius);
          font-size: .9375rem;
        }
        .log-row + .log-row { margin-top: 3px; }
        .log-date { font-size: .875rem; color: var(--text-sub); }
        .time-range { font-weight: 500; }
        .break-info { font-size: .8125rem; color: var(--text-muted); }
        .log-hours { font-weight: 700; color: var(--brand); min-width: 36px; text-align: right; }
        .log-loc { display: flex; align-items: center; gap: 5px; font-size: .8125rem; color: var(--text-sub); }
        .loc-dot { width: 8px; height: 8px; border-radius: 50%; }
        .loc-dot.loc-markt        { background: var(--markt); }
        .loc-dot.loc-nootmagazijn { background: var(--noot); }
        .log-overtime { font-size: .8125rem; color: var(--brand); }
        .log-note { font-size: .8125rem; color: var(--text-muted); grid-column: 2 / span 3; }
        .log-status { display: flex; justify-content: flex-end; }
        .proc-dot { width: 8px; height: 8px; border-radius: 50%; }
        .proc-dot.done { background: #4CAF50; }
        .proc-dot.open { background: var(--border); }

        @media (max-width: 600px) {
          .log-row { grid-template-columns: 1fr auto auto; gap: var(--s2); padding: var(--s3); }
          .log-loc, .log-overtime, .log-note { display: none; }
          .log-date { font-size: .8125rem; }
        }
        @media (max-width: 480px) {
          .filters { flex-direction: column; align-items: stretch; }
          .date-range { flex-wrap: wrap; }
          .date-range input { flex: 1; min-width: 120px; }
          .hours-stats { gap: var(--s4); padding: var(--s3); }
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
