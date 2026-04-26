import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import ShiftModal from '@/components/ui/ShiftModal'
import LocationBadge from '@/components/ui/LocationBadge'
import { PrevIcon, NextIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import { currentWeekYear } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Employee, Location, Day } from '@/types'
import { DAYS, DAY_SHORT, SHIFT_TYPES } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser; initialWeek: number; initialYear: number }

const LOCATIONS: { value: Exclude<Location, 'both'>; label: string }[] = [
  { value: 'markt',        label: 'De Notenkar (Markt)' },
  { value: 'nootmagazijn', label: 'Het Nootmagazijn' },
]

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

interface InsightCard { id: string; icon: string; title: string; message: string; severity: string }

export default function AdminPlanning({ user, initialWeek, initialYear }: Props) {
  const [week, setWeek]         = useState(initialWeek)
  const [year, setYear]         = useState(initialYear)
  const [location, setLocation] = useState<Exclude<Location, 'both'>>('markt')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts]     = useState<Shift[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<{
    shift: Partial<Shift> | null
    employee: Employee
    day: Day
  } | null>(null)

  // ── Automation state ──
  const [showCopy, setShowCopy]   = useState(false)
  const [copyTarget, setCopyTarget] = useState({ week: 0, year: 0 })
  const [copyBusy, setCopyBusy]   = useState(false)
  const [copyMsg, setCopyMsg]     = useState('')
  const [showFill, setShowFill]   = useState(false)
  const [fillWeeks, setFillWeeks] = useState(4)
  const [fillBusy, setFillBusy]   = useState(false)
  const [fillMsg, setFillMsg]     = useState('')

  // ── Insights state ──
  const [insights, setInsights]     = useState<InsightCard[]>([])
  const [insightsOpen, setInsightsOpen] = useState(true)
  const [insightsLoaded, setInsightsLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [eRes, sRes] = await Promise.all([
      fetch(`/api/employees?location=${location}&active=1`),
      fetch(`/api/shifts?week=${week}&year=${year}&location=${location}`),
    ])
    const [eData, sData] = await Promise.all([eRes.json(), sRes.json()])
    setEmployees(eData.success ? eData.data : [])
    setShifts(sData.success ? sData.data : [])
    setLoading(false)
  }, [week, year, location])

  useEffect(() => { load() }, [load])

  // Load insights async after main data
  useEffect(() => {
    setInsightsLoaded(false)
    fetch(`/api/admin/insights?week=${week}&year=${year}&location=${location}`)
      .then(r => r.json())
      .then(d => { if (d.success) setInsights(d.data); setInsightsLoaded(true) })
      .catch(() => setInsightsLoaded(true))
  }, [week, year, location])

  function prevWeek() {
    if (week === 1) { setWeek(52); setYear(y => y - 1) }
    else setWeek(w => w - 1)
  }
  function nextWeek() {
    if (week === 52) { setWeek(1); setYear(y => y + 1) }
    else setWeek(w => w + 1)
  }

  function shiftsFor(empId: number, day: Day) {
    return shifts.filter(s => s.employee_id === empId && s.day_of_week === day)
  }

  function openShiftsFor(day: Day) {
    return shifts.filter(s => s.is_open === 1 && s.day_of_week === day)
  }

  async function deleteShift(id: number) {
    if (!confirm('Dienst verwijderen?')) return
    await fetch(`/api/shifts/${id}`, { method: 'DELETE' })
    load()
  }

  function weekStartDate(w: number, y: number) {
    const jan4 = new Date(y, 0, 4)
    const dayOfWeek = jan4.getDay() || 7
    const weekStart = new Date(jan4)
    weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)
    return weekStart
  }

  function dayDate(w: number, y: number, dayIndex: number) {
    const start = weekStartDate(w, y)
    start.setDate(start.getDate() + dayIndex)
    return start.getDate()
  }

  // ── Copy week handler ──
  function openCopyModal() {
    const tw = week < 52 ? week + 1 : 1
    const ty = week < 52 ? year : year + 1
    setCopyTarget({ week: tw, year: ty })
    setCopyMsg(''); setShowCopy(true)
  }

  async function executeCopy() {
    setCopyBusy(true); setCopyMsg('')
    try {
      const res = await fetch('/api/admin/planning-automation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy', sourceWeek: week, sourceYear: year, targetWeek: copyTarget.week, targetYear: copyTarget.year, location }),
      })
      const d = await res.json()
      if (d.success) {
        const r = d.data
        setCopyMsg(`✅ ${r.copied} diensten gekopieerd, ${r.skipped} overgeslagen${r.warnings?.length ? ` (${r.warnings.length} waarschuwing${r.warnings.length !== 1 ? 'en' : ''})` : ''}`)
        load()
      } else setCopyMsg(`❌ ${d.error}`)
    } catch { setCopyMsg('❌ Fout bij kopiëren') }
    setCopyBusy(false)
  }

  // ── Auto-fill handler ──
  function openFillModal() {
    setFillWeeks(4); setFillMsg(''); setShowFill(true)
  }

  async function executeFill() {
    setFillBusy(true); setFillMsg('')
    try {
      const res = await fetch('/api/admin/planning-automation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'autofill', sourceWeek: week, sourceYear: year, numberOfWeeks: fillWeeks, location }),
      })
      const d = await res.json()
      if (d.success) {
        const r = d.data
        setFillMsg(`✅ ${r.weeksProcessed} weken verwerkt: ${r.totalCopied} diensten aangemaakt, ${r.totalSkipped} overgeslagen`)
        load()
      } else setFillMsg(`❌ ${d.error}`)
    } catch { setFillMsg('❌ Fout bij auto-fill') }
    setFillBusy(false)
  }

  const openShiftCount = shifts.filter(s => s.is_open === 1).length

  return (
    <AdminLayout user={user} title="Rooster">
      {/* ── Controls ── */}
      <div className="plan-controls">
        <div className="week-nav">
          <button className="btn btn-outline btn-sm btn-icon" onClick={prevWeek} title="Vorige week" aria-label="Vorige week">
            <PrevIcon />
          </button>
          <span className="week-label">Week {week} · {year}</span>
          <button className="btn btn-outline btn-sm btn-icon" onClick={nextWeek} title="Volgende week" aria-label="Volgende week">
            <NextIcon />
          </button>
        </div>

        <div className="loc-tabs" role="tablist" aria-label="Locatie selectie">
          {LOCATIONS.map(l => (
            <button
              key={l.value}
              role="tab"
              {...(location === l.value ? { 'aria-selected': true } : { 'aria-selected': false })}
              className={`loc-tab${location === l.value ? ' active' : ''}`}
              data-loc={l.value}
              onClick={() => setLocation(l.value)}
              title={`Switch naar ${l.label}`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {openShiftCount > 0 && (
          <span className="badge badge-warning">{openShiftCount} open dienst{openShiftCount !== 1 ? 'en' : ''}</span>
        )}
      </div>

      {/* ── Action Toolbar ── */}
      <div className="action-toolbar">
        <button className="btn btn-outline btn-sm" onClick={openCopyModal} title="Kopieer deze week naar een andere week">
          📋 Kopieer week
        </button>
        <button className="btn btn-outline btn-sm" onClick={openFillModal} title="Automatisch X weken vooruit plannen">
          🔁 Auto-fill
        </button>
        {insightsLoaded && insights.length > 0 && (
          <button className="btn btn-outline btn-sm" onClick={() => setInsightsOpen(!insightsOpen)}>
            {insightsOpen ? '▼' : '▶'} Inzichten ({insights.length})
          </button>
        )}
      </div>

      {/* ── Insights Panel ── */}
      {insightsOpen && insightsLoaded && insights.length > 0 && (
        <div className="insights-panel">
          {insights.map(card => (
            <div key={card.id} className={`insight-card severity-${card.severity}`}>
              <span className="insight-icon">{card.icon}</span>
              <div className="insight-body">
                <span className="insight-title">{card.title}</span>
                <span className="insight-msg">{card.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Copy Week Modal ── */}
      {showCopy && (
        <div className="modal-overlay" onClick={() => setShowCopy(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>📋 Week kopiëren</h3>
            <p className="modal-desc">Kopieer alle diensten van week {week} ({year}) naar:</p>
            <div className="modal-fields">
              <label>Week: <input type="number" min={1} max={52} value={copyTarget.week} onChange={e => setCopyTarget(t => ({ ...t, week: +e.target.value }))} /></label>
              <label>Jaar: <input type="number" min={2024} max={2030} value={copyTarget.year} onChange={e => setCopyTarget(t => ({ ...t, year: +e.target.value }))} /></label>
            </div>
            {copyMsg && <p className="modal-msg">{copyMsg}</p>}
            <div className="modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setShowCopy(false)}>Annuleren</button>
              <button className="btn btn-primary btn-sm" onClick={executeCopy} disabled={copyBusy}>{copyBusy ? 'Bezig…' : 'Kopiëren'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auto-fill Modal ── */}
      {showFill && (
        <div className="modal-overlay" onClick={() => setShowFill(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>🔁 Auto-fill</h3>
            <p className="modal-desc">Herhaal week {week} ({year}) voor de volgende X weken:</p>
            <div className="modal-fields">
              <label>Aantal weken: <input type="number" min={1} max={12} value={fillWeeks} onChange={e => setFillWeeks(+e.target.value)} /></label>
            </div>
            {fillMsg && <p className="modal-msg">{fillMsg}</p>}
            <div className="modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setShowFill(false)}>Annuleren</button>
              <button className="btn btn-primary btn-sm" onClick={executeFill} disabled={fillBusy}>{fillBusy ? 'Bezig…' : `${fillWeeks} weken vullen`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div className="loading-row"><Spinner /> Laden…</div>
      ) : (
        <div className="plan-grid-wrap">
          <table className="plan-grid" aria-label="Planning weekoverzicht">
            <thead>
              <tr>
                <th scope="col" className="col-emp">Medewerker</th>
                {DAYS.map((day, i) => (
                  <th key={day} scope="col" className="col-day">
                    <div className="day-head">
                      <span className="day-short">{DAY_SHORT[day]}</span>
                      <span className="day-num">{dayDate(week, year, i)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="emp-row">
                  <th scope="row" className="col-emp">
                    <div className="emp-cell">
                      <span className="emp-name">{emp.name}</span>
                      {emp.location === 'both' && <LocationBadge location="both" size="xs" />}
                    </div>
                  </th>
                  {DAYS.map(day => {
                    const dayShifts = shiftsFor(emp.id, day)
                    return (
                      <td
                        key={day}
                        className="shift-cell"
                      >
                        <div className="shifts-container">
                          {dayShifts.map(s => (
                            <div
                              key={s.id}
                              className="shift-chip"
                              data-type={s.shift_type.toLowerCase()}
                            >
                              <button
                                className="shift-chip-edit-btn"
                                onClick={() => setModal({ shift: s, employee: emp, day })}
                                aria-label={`${s.shift_type} dienst van ${emp.name} bewerken`}
                              >
                                <span className="chip-type">{s.shift_type}</span>
                                {(s.start_time || s.end_time) && (
                                  <span className="chip-time">{formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                                )}
                              </button>
                              <button
                                className="chip-delete"
                                onClick={e => { e.stopPropagation(); deleteShift(s.id) }}
                                title="Dienst verwijderen"
                                aria-label="Verwijderen"
                              >×</button>
                            </div>
                          ))}
                        </div>
                        <button
                          className="cell-add-btn"
                          onClick={() => setModal({ shift: null, employee: emp, day })}
                          aria-label={`Dienst toevoegen voor ${emp.name} op ${day}`}
                          title="Dienst toevoegen"
                        >+</button>
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Open shifts row */}
              {DAYS.some(d => openShiftsFor(d).length > 0) && (
                <tr className="emp-row open-row">
                  <th scope="row" className="col-emp">
                    <div className="emp-cell">
                      <span className="emp-name text-muted">Open diensten</span>
                    </div>
                  </th>
                  {DAYS.map(day => {
                    const open = openShiftsFor(day)
                    return (
                      <td key={day} className="shift-cell">
                        <div className="shifts-container">
                          {open.map(s => (
                            <div key={s.id} className="shift-chip open-chip"
                              data-type={s.shift_type.toLowerCase()}
                              aria-label={`Open dienst: ${s.shift_type}`}>
                              <button
                                className="open-chip-edit-btn"
                                onClick={() => setModal({ shift: s, employee: { id: 0, name: '', email: null, phone: null, contract_hours: 0, is_active: 1, user_level: 'Medewerker', team_group: null, location, hourly_rate: null, invite_sent_at: null, invite_pending: null }, day })}
                                aria-label={`Bewerken: ${s.shift_type}`}
                              >
                                <span className="chip-type">{s.shift_type}</span>
                                {s.open_invite_status && (
                                  <span className={`chip-invite ${s.open_invite_status}`}>{s.open_invite_status}</span>
                                )}
                              </button>
                              <button className="chip-delete" onClick={e => { e.stopPropagation(); deleteShift(s.id) }} title="Open dienst verwijderen" aria-label="Verwijderen">×</button>
                            </div>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )}

              {employees.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    Geen medewerkers gevonden voor deze locatie.
                    <Link href="/admin/employees" className="link ml-2">Medewerkers beheren →</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile Employee Cards (≤768px) ── */}
      {!loading && (
        <div className="plan-mobile-view" aria-label="Planning weekoverzicht mobiel">
          {employees.map(emp => (
            <div key={emp.id} className="mobile-emp-card">
              <div className="mobile-emp-header">
                <span className="mobile-emp-name">{emp.name}</span>
                {emp.location === 'both' && <LocationBadge location="both" size="xs" />}
              </div>
              <div className="mobile-days-strip">
                {DAYS.map((day, i) => {
                  const dayShifts = shiftsFor(emp.id, day)
                  return (
                    <div key={day} className="mobile-day-col">
                      <div className="mobile-day-head">
                        <span className="mobile-day-short">{DAY_SHORT[day]}</span>
                        <span className="mobile-day-num">{dayDate(week, year, i)}</span>
                      </div>
                      <div className="mobile-day-shifts">
                        {dayShifts.map(s => (
                          <button
                            key={s.id}
                            className="mobile-shift-chip"
                            data-type={s.shift_type.toLowerCase()}
                            onClick={() => setModal({ shift: s, employee: emp, day })}
                            aria-label={`${s.shift_type} - ${emp.name} - ${day}. Tik om te bewerken.`}
                          >
                            <span className="mobile-chip-type">{s.shift_type.slice(0, 3)}</span>
                            {s.start_time && (
                              <span className="mobile-chip-time">{formatTime(s.start_time)}</span>
                            )}
                          </button>
                        ))}
                        <button
                          className="mobile-add-btn"
                          onClick={() => setModal({ shift: null, employee: emp, day })}
                          aria-label={`Dienst toevoegen voor ${emp.name} op ${day}`}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <div className="empty-row">
              Geen medewerkers gevonden voor deze locatie.
            </div>
          )}
        </div>
      )}

      {/* ── Shift Modal ── */}
      {modal && (
        <ShiftModal
          shift={modal.shift}
          employeeId={modal.employee.id}
          employeeName={modal.employee.name}
          day={modal.day}
          week={week}
          year={year}
          location={location}
          userRole={user.role as 'admin' | 'manager' | 'employee'}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      <style jsx>{`
        /* ── Action Toolbar ── */
        .action-toolbar {
          display: flex; align-items: center; gap: var(--s2); margin-bottom: var(--s3);
          flex-wrap: wrap;
        }

        /* ── Insights Panel ── */
        .insights-panel {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--s2); margin-bottom: var(--s4);
        }
        .insight-card {
          display: flex; align-items: flex-start; gap: var(--s2);
          padding: var(--s3); border-radius: var(--radius); border: 1px solid var(--border);
          background: var(--surface); transition: transform .15s;
        }
        .insight-card:hover { transform: translateY(-1px); }
        .severity-success { border-left: 3px solid #2E7D32; }
        .severity-warning { border-left: 3px solid #E65100; }
        .severity-danger  { border-left: 3px solid #dc3545; }
        .severity-info    { border-left: 3px solid var(--brand); }
        .insight-icon { font-size: 1.25rem; flex-shrink: 0; margin-top: 1px; }
        .insight-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .insight-title { font-size: .8125rem; font-weight: 700; }
        .insight-msg { font-size: .75rem; color: var(--text-sub); line-height: 1.4; }

        /* ── Modal ── */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 999;
          display: flex; align-items: center; justify-content: center; padding: var(--s4);
        }
        .modal-box {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: var(--s5); max-width: 420px; width: 100%;
          display: flex; flex-direction: column; gap: var(--s3);
        }
        .modal-box h3 { font-size: 1.125rem; font-weight: 600; margin: 0; }
        .modal-desc { font-size: .875rem; color: var(--text-sub); margin: 0; }
        .modal-fields { display: flex; flex-wrap: wrap; gap: var(--s3); }
        .modal-fields label {
          display: flex; flex-direction: column; gap: 4px;
          font-size: .8125rem; font-weight: 500;
        }
        .modal-fields input {
          padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius);
          background: var(--surface-alt); color: var(--text); font-size: .875rem; width: 100px;
        }
        .modal-msg { font-size: .8125rem; margin: 0; }
        .modal-actions { display: flex; justify-content: flex-end; gap: var(--s2); }

        .plan-controls {
          display: flex; align-items: center; flex-wrap: wrap; gap: var(--s3);
          margin-bottom: var(--s5);
        }
        .week-nav {
          display: flex; align-items: center; gap: var(--s2);
        }
        .week-label {
          font-size: .9375rem; font-weight: 600; min-width: 130px; text-align: center;
        }
        .loc-tabs {
          display: flex; gap: 4px;
          background: var(--surface-alt); border-radius: var(--radius);
          padding: 3px;
        }
        .loc-tab {
          padding: 6px 14px; border-radius: calc(var(--radius) - 2px);
          font-size: .875rem; font-weight: 500;
          color: var(--text-sub); transition: background .15s, color .15s;
        }
        .loc-tab.active[data-loc="markt"]        { background: var(--markt); color: #fff; }
        .loc-tab.active[data-loc="nootmagazijn"] { background: var(--noot);  color: #fff; }
        .loc-tab:not(.active):hover { background: var(--border); color: var(--text); }

        .plan-grid-wrap {
          overflow-x: auto; -webkit-overflow-scrolling: touch;
          border: 1px solid var(--border); border-radius: var(--radius-lg);
          background: var(--surface);
        }
        .plan-grid {
          width: 100%; border-collapse: collapse; min-width: 600px;
        }
        .plan-grid thead th {
          background: var(--surface-alt); font-size: .8125rem; font-weight: 600;
          color: var(--text-sub); text-align: left;
          padding: var(--s2) var(--s3); border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .col-emp { width: 120px; min-width: 90px; }
        .col-day { width: calc((100% - 120px) / 7); min-width: 72px; }
        .day-head { display: flex; align-items: baseline; gap: 4px; }
        .day-short { font-weight: 700; }
        .day-num { font-size: .75rem; color: var(--text-muted); }

        .emp-row:not(:last-child) td { border-bottom: 1px solid var(--border); }
        .emp-row:hover td { background: rgba(200,136,42,.04); }
        .open-row td { background: rgba(200,136,42,.04); }

        .col-emp { padding: var(--s2) var(--s3); vertical-align: middle; }
        .emp-cell { display: flex; align-items: center; gap: var(--s2); }
        .emp-name { font-size: .8125rem; font-weight: 500; }

        .shift-cell {
          padding: var(--s2); vertical-align: top;
          min-height: 48px; position: relative;
        }
        .shifts-container { display: flex; flex-direction: column; gap: 3px; }
        .shift-chip {
          display: flex; align-items: stretch; border-radius: 4px; border: 1px solid rgba(0,0,0,.05);
          overflow: hidden;
        }

        .shift-chip-edit-btn, .open-chip-edit-btn {
          flex: 1; border: none; background: transparent; padding: 4px 5px;
          text-align: left; display: flex; flex-direction: column; gap: 1px;
          cursor: pointer; color: inherit; font: inherit;
        }
        .shift-chip-edit-btn:hover, .open-chip-edit-btn:hover { background: rgba(0,0,0,.04); }
        .chip-type { font-size: .75rem; font-weight: 700; line-height: 1.2; }
        .chip-time { font-size: .6875rem; opacity: .8; line-height: 1.2; color: var(--text-sub); }
        .chip-delete {
          border: none; background: rgba(0,0,0,.05); color: var(--text-sub);
          padding: 0 10px; font-size: 1rem; cursor: pointer; display: flex; align-items: center;
          transition: background .15s, color .15s; min-width: 36px; min-height: 36px; justify-content: center;
        }
        .chip-delete:hover { background: rgba(220,53,69,.15); color: #dc3545; }

        /* Add button — always subtly visible, fully visible on hover/focus */
        .cell-add-btn {
          width: 100%; min-height: 28px; border: 1px dashed var(--border);
          background: transparent; border-radius: 4px; margin-top: 3px;
          color: var(--text-muted); cursor: pointer; transition: all .15s;
          display: flex; align-items: center; justify-content: center; font-weight: 600;
          font-size: .875rem; opacity: 0.25;
        }
        .shift-cell:hover .cell-add-btn,
        .cell-add-btn:focus { opacity: 1; border-color: var(--brand); color: var(--brand); }

        .open-chip { background: var(--brand-light) !important; border: 1px solid var(--brand); border-style: dashed; }
        .chip-invite { font-size: .6875rem; border-radius: 3px; padding: 1px 4px; font-weight: 600; margin-top: 2px; }
        .chip-invite.pending  { background: #FFF3E0; color: #E65100; }
        .chip-invite.accepted { background: #E8F5E9; color: #2E7D32; }
        .chip-invite.declined { background: #FCE4EC; color: #B71C1C; }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-row { padding: var(--s8); text-align: center; color: var(--text-muted); font-size: .9375rem; }

        /* ── Mobile card view ── */
        .plan-mobile-view { display: none; }

        .mobile-emp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .mobile-emp-header { display: flex; align-items: center; gap: var(--s2); padding: var(--s2) var(--s3); background: var(--surface-alt); border-bottom: 1px solid var(--border); }
        .mobile-emp-name { font-size: .875rem; font-weight: 600; flex: 1; }
        .mobile-days-strip { display: grid; grid-template-columns: repeat(7, 1fr); }
        .mobile-day-col { border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 64px; }
        .mobile-day-col:last-child { border-right: none; }
        .mobile-day-head { display: flex; flex-direction: column; align-items: center; padding: 4px 2px; background: var(--surface-alt); border-bottom: 1px solid var(--border); gap: 1px; }
        .mobile-day-short { font-size: .625rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .mobile-day-num { font-size: .75rem; font-weight: 600; }
        .mobile-day-shifts { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 3px 2px; }
        .mobile-shift-chip {
          width: 100%; min-height: 32px; border: none; border-radius: 3px;
          display: flex; flex-direction: column; align-items: flex-start;
          padding: 3px 4px; cursor: pointer; gap: 1px; font: inherit; text-align: left;
        }
        .mobile-shift-chip:active { opacity: .8; }
        .mobile-chip-type { font-size: .6875rem; font-weight: 700; line-height: 1.2; }
        .mobile-chip-time { font-size: .625rem; color: var(--text-sub); line-height: 1.2; }
        .mobile-add-btn {
          width: 100%; min-height: 32px; background: transparent;
          border: 1px dashed var(--border); border-radius: 3px;
          color: var(--text-muted); cursor: pointer; font-size: .875rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .mobile-add-btn:active { border-color: var(--brand); color: var(--brand); background: var(--brand-subtle); }

        /* ── Mobile breakpoints ── */
        @media (max-width: 768px) {
          .plan-grid-wrap { display: none; }
          .plan-mobile-view { display: flex; flex-direction: column; gap: var(--s2); }
          .week-label { min-width: unset; font-size: .875rem; }
          .plan-controls { gap: var(--s2); }
          .loc-tab { padding: 5px 8px; font-size: .75rem; }
          .chip-delete { min-width: 44px; min-height: 44px; padding: 0 12px; }
        }

        @media (hover: none) and (pointer: coarse) {
          .cell-add-btn { opacity: 0.5 !important; min-height: 36px; }
        }

        @media (max-width: 480px) {
          .plan-controls { flex-direction: column; align-items: stretch; }
          .loc-tabs { justify-content: center; }
          .week-nav { justify-content: center; }
          .mobile-chip-time { display: none; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  const { week, year } = currentWeekYear()
  return { props: { user: session.user, initialWeek: week, initialYear: year } }
}
