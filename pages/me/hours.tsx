import { useState, useEffect, useCallback, useMemo } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { getSession } from '@/lib/auth'
import { calcHoursWorked } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser, TimeLog, Location } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  direct:   'Ingevoerd',
  pending:  'In behandeling',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  withdrawn: 'Ingetrokken',
}
const STATUS_CLASS: Record<string, string> = {
  direct:   'badge-draft',
  pending:  'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-danger',
  withdrawn: 'badge-draft',
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function makeEmptyForm(): { log_date: string; location: Location; clock_in: string; clock_out: string; break_minutes: string; note: string } {
  const d = getToday()
  return { log_date: d, location: 'markt', clock_in: '', clock_out: '', break_minutes: '0', note: '' }
}

export default function MyHoursPage({ user }: Props) {
  const [logs, setLogs]       = useState<TimeLog[]>([])
  const [from, setFrom]       = useState(() => { const d = getToday(); return d.slice(0, 8) + '01' })
  const [to, setTo]           = useState(getToday)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(makeEmptyForm)
  const [saving, setSaving]   = useState(false)
  const [formErr, setFormErr] = useState('')
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (!user.employee_id) return
    setLoading(true)
    const r = await fetch(`/api/hours?employee_id=${user.employee_id}&from=${from}&to=${to}`)
    const d = await r.json()
    setLogs(d.success ? d.data : [])
    setLoading(false)
  }, [user.employee_id, from, to])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setFormErr('')

    if (!form.clock_in || !form.clock_out) {
      setFormErr('Vul inklok- en uitkloktijd in')
      setSaving(false)
      return
    }
    if (form.clock_out <= form.clock_in) {
      setFormErr('Uitkloktijd moet na inkloktijd liggen. Nachtdiensten worden nog niet ondersteund.')
      setSaving(false)
      return
    }

    const r = await fetch('/api/hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        log_date: form.log_date,
        location: form.location,
        clock_in: form.clock_in,
        clock_out: form.clock_out,
        break_minutes: parseInt(form.break_minutes) || 0,
        note: form.note || null,
      }),
    }).then(r => r.json())

    setSaving(false)
    if (!r.success) { setFormErr(r.message ?? 'Indienen mislukt'); return }
    showToast('Uren ingediend ter goedkeuring!')
    setForm(makeEmptyForm())
    setShowForm(false)
    setFormErr('')
    load()
  }

  async function withdraw(id: number) {
    if (!confirm('Registratie intrekken?')) return
    const r = await fetch(`/api/hours/${id}`, { method: 'DELETE' }).then(r => r.json())
    if (r.success) { showToast('Registratie ingetrokken.', true); load() }
    else showToast(r.message ?? 'Fout', false)
  }

  const finalized    = logs.filter(l => l.submission_status === 'approved' || l.submission_status === 'direct')
  const totalHours   = finalized.reduce((acc, l) => acc + calcHoursWorked(l.clock_in, l.clock_out, l.break_minutes), 0)
  const totalOvertime = finalized.reduce((acc, l) => acc + l.overtime_hours, 0)
  const pending      = logs.filter(l => l.submission_status === 'pending')
  const rejected     = logs.filter(l => l.submission_status === 'rejected')
  const rest         = logs.filter(l => l.submission_status !== 'pending' && l.submission_status !== 'rejected')

  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  return (
    <TeamLayout user={user} location={locProp}>
      {toast && (
        <div className={`hrs-toast ${toast.ok ? 'ok' : 'err'}`} role="alert">{toast.msg}</div>
      )}

      <div className="hrs-page">
        <div className="hrs-head">
          <div>
            <h1 className="hrs-h1">Mijn uren</h1>
            <p className="hrs-sub">Accordeer geplande diensten via je rooster. Registreer hier alleen losse, niet-geplande uren.</p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowForm(s => !s); setFormErr('') }}
          >
            {showForm ? 'Annuleren' : '+ Losse uren registreren'}
          </button>
        </div>

        {/* ── Formulier ── */}
        {showForm && (
          <div className="hrs-form-card">
            <h2 className="hrs-form-title">Losse uren registreren</h2>
            <form onSubmit={handleSubmit}>
              {formErr && <div className="alert alert-danger" role="alert">{formErr}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label required" htmlFor="hrs_date">Datum</label>
                  <input id="hrs_date" type="date" className="form-control"
                    value={form.log_date} onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                    max={getToday()} required />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="hrs_loc">Locatie</label>
                  <select id="hrs_loc" className="form-control" value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value as Location }))}>
                    <option value="markt">Markt</option>
                    <option value="nootmagazijn">Magazijn</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="hrs_in">Begintijd</label>
                  <input id="hrs_in" type="time" className="form-control"
                    value={form.clock_in} onChange={e => setForm(f => ({ ...f, clock_in: e.target.value }))}
                    required />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="hrs_out">Eindtijd</label>
                  <input id="hrs_out" type="time" className="form-control"
                    value={form.clock_out} onChange={e => setForm(f => ({ ...f, clock_out: e.target.value }))}
                    required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hrs_break">Pauze (minuten)</label>
                  <input id="hrs_break" type="number" className="form-control"
                    value={form.break_minutes} onChange={e => setForm(f => ({ ...f, break_minutes: e.target.value }))}
                    min="0" max="480" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hrs_note">Notitie (optioneel)</label>
                  <input id="hrs_note" className="form-control"
                    value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="bijv. extra uren of bijzonderheden" />
                </div>
              </div>

              {form.clock_in && form.clock_out && form.clock_in < form.clock_out && (
                <div className="hrs-preview">
                  Berekend: <strong>{calcHoursWorked(form.clock_in, form.clock_out, parseInt(form.break_minutes) || 0).toFixed(1)} uur</strong>
                  {parseInt(form.break_minutes) > 0 && <span> (incl. {form.break_minutes} min pauze)</span>}
                </div>
              )}

              <div className="hrs-form-footer">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? <Spinner /> : 'Indienen ter goedkeuring'}
                </button>
              </div>
            </form>
          </div>
        )}

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
            <span className="stat-val">{finalized.length}</span>
            <span className="stat-label">goedgekeurd/vastgelegd</span>
          </div>
          {totalOvertime > 0 && (
            <div className="stat-item">
              <span className="stat-val">+{totalOvertime.toFixed(1)}u</span>
              <span className="stat-label">overwerk</span>
            </div>
          )}
          {pending.length > 0 && (
            <div className="stat-item stat-pending">
              <span className="stat-val">{pending.length}</span>
              <span className="stat-label">in behandeling</span>
            </div>
          )}
        </div>

        {/* ── Log list ── */}
        {loading ? (
          <div className="loading-row"><Spinner /> Laden…</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⏱️</div>
            <div>Geen uren gevonden voor deze periode.</div>
            {!showForm && (
              <button className="btn btn-primary btn-sm empty-cta" onClick={() => setShowForm(true)}>
                Losse uren registreren
              </button>
            )}
          </div>
        ) : (
          <>
            {rejected.length > 0 && (
              <section className="hrs-section correction-section">
                <div className="hrs-sec-head">
                  <h2 className="hrs-sec-title">Aanpassing nodig</h2>
                  <span className="badge badge-danger">{rejected.length}</span>
                </div>
                <p className="correction-help">Open je rooster, kies de betreffende dienst en dien je gecorrigeerde uren opnieuw in.</p>
                <div className="log-list">
                  {rejected.map(log => <LogRow key={log.id} log={log} />)}
                </div>
              </section>
            )}

            {/* Pending submissions */}
            {pending.length > 0 && (
              <section className="hrs-section">
                <div className="hrs-sec-head">
                  <h2 className="hrs-sec-title">In behandeling</h2>
                  <span className="badge badge-pending">{pending.length}</span>
                </div>
                <div className="log-list">
                  {pending.map(log => (
                    <LogRow key={log.id} log={log} onWithdraw={withdraw} />
                  ))}
                </div>
              </section>
            )}

            {/* All other entries */}
            {rest.length > 0 && (
              <section className="hrs-section">
                <div className="hrs-sec-head">
                  <h2 className="hrs-sec-title">Urenhistorie</h2>
                  <span className="badge badge-draft">{rest.length}</span>
                </div>
                <div className="log-list">
                  {rest.map(log => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .hrs-toast {
          position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
          padding: 12px 24px; border-radius: 999px; font-weight: 600; font-size: .9375rem;
          box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 9999; white-space: nowrap;
          animation: toast-in .2s ease;
        }
        .hrs-toast.ok  { background: #1A1412; color: #fff; }
        .hrs-toast.err { background: var(--danger); color: #fff; }
        @keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(-8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }

        .hrs-page { max-width: 800px; }
        .hrs-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: var(--s3); margin-bottom: var(--s6);
        }
        .hrs-h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 4px; }
        .hrs-sub { color: var(--text-muted); margin: 0; font-size: .9375rem; }

        .hrs-form-card {
          background: var(--surface); border: 1.5px solid var(--brand);
          border-radius: var(--radius-xl); padding: var(--s5);
          margin-bottom: var(--s6);
        }
        .hrs-form-title { font-size: 1.0625rem; font-weight: 700; margin: 0 0 var(--s4); }
        .hrs-form-footer { display: flex; justify-content: flex-end; margin-top: var(--s4); }
        .hrs-preview {
          background: var(--surface-alt); border: 1px solid var(--border);
          border-radius: var(--radius); padding: var(--s3) var(--s4);
          font-size: .9375rem; color: var(--text-sub); margin-top: var(--s3);
        }

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
        .stat-pending .stat-val { color: #C8882A; }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-state { text-align: center; padding: var(--s10) var(--s6); }
        .empty-icon { font-size: 2.5rem; margin-bottom: var(--s3); }
        .empty-cta { margin-top: 12px; }

        .hrs-section { margin-bottom: var(--s6); }
        .correction-section { padding: var(--s4); border: 1px solid rgba(198,40,40,.3); border-radius: var(--radius-lg); background: rgba(198,40,40,.035); }
        .correction-help { margin: 0 0 var(--s3); color: var(--text-sub); font-size: .85rem; line-height: 1.45; }
        .hrs-sec-head {
          display: flex; align-items: center; gap: var(--s3); margin-bottom: var(--s3);
          padding-bottom: var(--s3); border-bottom: 1.5px solid var(--border);
        }
        .hrs-sec-title { font-size: 1rem; font-weight: 700; margin: 0; flex: 1; }

        .log-list { display: flex; flex-direction: column; gap: 0;
          border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }

        @media (max-width: 600px) {
          .hrs-head { flex-direction: column; }
          .hrs-page { max-width: 100%; }
          .filters { flex-direction: column; align-items: stretch; }
          .date-range { flex-wrap: wrap; }
          .date-range input { flex: 1; min-width: 120px; }
          .hours-stats { gap: var(--s4); padding: var(--s3); }
        }
      `}</style>
    </TeamLayout>
  )
}

function LogRow({ log, onWithdraw }: { log: TimeLog; onWithdraw?: (id: number) => void }) {
  const hours = calcHoursWorked(log.clock_in, log.clock_out, log.break_minutes)
  const isPending = log.submission_status === 'pending'

  return (
    <div className="log-row">
      <div className="log-main">
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
      </div>
      <div className="log-meta">
        <div className="log-loc">
          <span className={`loc-dot loc-${log.location}`} />
          {log.location === 'markt' ? 'Markt' : 'Magazijn'}
        </div>
        {log.overtime_hours > 0 && (
          <div className="log-overtime">+{log.overtime_hours}u overwerk</div>
        )}
        <span className={`badge ${STATUS_CLASS[log.submission_status] ?? 'badge-draft'}`}>
          {STATUS_LABEL[log.submission_status] ?? log.submission_status}
        </span>
        {isPending && onWithdraw && (
          <button className="btn btn-ghost btn-xs" onClick={() => onWithdraw(log.id)}>Intrekken</button>
        )}
      </div>
      {log.note && <div className="log-note">{log.note}</div>}
      {log.review_note && (
        <div className="log-review-note">
          <strong>Opmerking beheerder:</strong> {log.review_note}
        </div>
      )}

      <style jsx>{`
        .log-row {
          padding: var(--s3) var(--s4);
          background: var(--surface); border-bottom: 1px solid var(--border);
          font-size: .9375rem;
        }
        .log-row:last-child { border-bottom: none; }
        .log-row:hover { background: var(--surface-alt); }

        .log-main {
          display: flex; align-items: center; gap: var(--s3);
          flex-wrap: wrap;
        }
        .log-date { font-size: .875rem; color: var(--text-sub); min-width: 110px; }
        .time-range { font-weight: 500; }
        .break-info { font-size: .8125rem; color: var(--text-muted); }
        .log-hours { font-weight: 700; color: var(--brand); margin-left: auto; }

        .log-meta {
          display: flex; align-items: center; gap: var(--s3);
          margin-top: var(--s2); flex-wrap: wrap;
        }
        .log-loc { display: flex; align-items: center; gap: 5px; font-size: .8125rem; color: var(--text-sub); }
        .loc-dot { width: 8px; height: 8px; border-radius: 50%; }
        .loc-dot.loc-markt        { background: var(--markt); }
        .loc-dot.loc-nootmagazijn { background: var(--noot); }
        .log-overtime { font-size: .8125rem; color: var(--brand); }
        .log-note { font-size: .8125rem; color: var(--text-muted); margin-top: var(--s2); }
        .log-review-note {
          font-size: .8125rem; color: var(--text-sub); margin-top: var(--s2);
          padding: var(--s2) var(--s3); background: var(--surface-alt);
          border-radius: var(--radius); font-style: italic;
        }

        @media (max-width: 480px) {
          .log-main { gap: var(--s2); }
          .log-date { min-width: auto; flex: 1; }
        }
      `}</style>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
