import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import ShiftModal from '@/components/ui/ShiftModal'
import LocationBadge from '@/components/ui/LocationBadge'
import { PrevIcon, NextIcon, PlusIcon, CloseIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import { currentWeekYear } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Employee, Location, Day } from '@/types'
import { DAYS, DAY_SHORT, SHIFT_TYPES, LOCATION_LABELS } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser; initialWeek: number; initialYear: number }

const LOCATIONS: { value: Location; label: string }[] = [
  { value: 'both',         label: 'Beide locaties' },
  { value: 'markt',        label: 'Markt' },
  { value: 'nootmagazijn', label: 'Magazijn' },
]

type ViewMode = 'week' | 'month' | '3months'

function weeksInRange(startWeek: number, startYear: number, numWeeks: number): { week: number; year: number }[] {
  const result = []
  let w = startWeek, y = startYear
  for (let i = 0; i < numWeeks; i++) {
    result.push({ week: w, year: y })
    w++
    if (w > 52) { w = 1; y++ }
  }
  return result
}

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}


export default function AdminPlanning({ user, initialWeek, initialYear }: Props) {
  const [view, setView]         = useState<ViewMode>('week')
  const [week, setWeek]         = useState(initialWeek)
  const [year, setYear]         = useState(initialYear)
  const [location, setLocation] = useState<Location>('both')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts]     = useState<Shift[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<{
    shift: Partial<Shift> | null
    employee: Employee
    day: Day
    week: number
    year: number
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
  const [automationLocation, setAutomationLocation] = useState<Location | ''>('')

  const numWeeks = view === 'week' ? 1 : view === 'month' ? 4 : 13

  const load = useCallback(async () => {
    setLoading(true)
    const wks = weeksInRange(week, year, numWeeks)
    const [eRes, ...sResArr] = await Promise.all([
      fetch(`/api/employees?location=${location}&active=1`),
      ...wks.map(w => fetch(`/api/shifts?week=${w.week}&year=${w.year}&location=${location}`))
    ])
    
    const eData = await eRes.json()
    const sDataArr = await Promise.all(sResArr.map(r => r.json()))
    
    setEmployees(eData.success ? eData.data : [])
    const allShifts = sDataArr.flatMap(d => d.success ? d.data : [])
    setShifts(allShifts)
    setLoading(false)
  }, [week, year, location, numWeeks])

  useEffect(() => { load() }, [load])

  function prevPeriod() {
    if (view === 'week') {
      if (week === 1) { setWeek(52); setYear(y => y - 1) } else setWeek(w => w - 1)
    } else {
      setWeek(w => { const nw = w - numWeeks; if (nw < 1) { setYear(y => y - 1); return 52 + nw }; return nw })
    }
  }
  function nextPeriod() {
    if (view === 'week') {
      if (week === 52) { setWeek(1); setYear(y => y + 1) } else setWeek(w => w + 1)
    } else {
      setWeek(w => { const nw = w + numWeeks; if (nw > 52) { setYear(y => y + 1); return nw - 52 }; return nw })
    }
  }

  function goToday() {
    const { week: cw, year: cy } = currentWeekYear()
    setWeek(cw); setYear(cy)
  }

  function shiftsFor(empId: number, day: Day, w: number, y: number) {
    return shifts.filter(s => s.employee_id === empId && s.day_of_week === day && s.week_number === w && s.year === y)
  }

  function openShiftsFor(day: Day, w: number, y: number) {
    return shifts.filter(s => s.is_open === 1 && s.day_of_week === day && s.week_number === w && s.year === y)
  }

  async function withdrawOpenShift(id: number) {
    if (!confirm('Open dienst intrekken? De dienst en inschrijfhistorie blijven veilig bewaard.')) return
    const response = await fetch('/api/shifts/open', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: id }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      alert(payload?.message ?? 'Open dienst kon niet worden ingetrokken')
      return
    }
    await load()
  }

  const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

  function weekStartDate(w: number, y: number) {
    const jan4 = new Date(y, 0, 4)
    const dayOfWeek = jan4.getDay() || 7
    const weekStart = new Date(jan4)
    weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)
    return weekStart
  }

  /** Returns { date, month } for a given week + day index (0=Mon … 6=Sun). */
  function dayInfo(w: number, y: number, dayIndex: number) {
    const d = weekStartDate(w, y)
    d.setDate(d.getDate() + dayIndex)
    return { date: d.getDate(), month: MONTHS_NL[d.getMonth()] }
  }

  /** Returns the ISO week date range formatted as "28 apr – 4 mei 2026". */
  function weekDateRange(w: number, y: number) {
    const mon = weekStartDate(w, y)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const fmt = (d: Date) => `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
    const yearSuffix = sun.getFullYear() !== y ? ` ${sun.getFullYear()}` : ''
    return `${fmt(mon)} – ${fmt(sun)}${yearSuffix}`
  }

  /** @deprecated use dayInfo() */
  function dayDate(w: number, y: number, dayIndex: number) {
    return dayInfo(w, y, dayIndex).date
  }

  // ── Copy week handler ──
  function openCopyModal() {
    const tw = week < 52 ? week + 1 : 1
    const ty = week < 52 ? year : year + 1
    setCopyTarget({ week: tw, year: ty })
    setAutomationLocation(location === 'both' ? '' : location)
    setCopyMsg(''); setShowCopy(true)
  }

  async function executeCopy() {
    if (!automationLocation) {
      setCopyMsg('Kies eerst welke locatie(s) je wilt kopieren.')
      return
    }
    setCopyBusy(true); setCopyMsg('')
    try {
      const res = await fetch('/api/admin/planning-automation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy', sourceWeek: week, sourceYear: year, targetWeek: copyTarget.week, targetYear: copyTarget.year, location: automationLocation }),
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
    setFillWeeks(4); setAutomationLocation(location === 'both' ? '' : location); setFillMsg(''); setShowFill(true)
  }

  async function executeFill() {
    if (!automationLocation) {
      setFillMsg('Kies eerst welke locatie(s) je wilt vullen.')
      return
    }
    setFillBusy(true); setFillMsg('')
    try {
      const res = await fetch('/api/admin/planning-automation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'autofill', sourceWeek: week, sourceYear: year, numberOfWeeks: fillWeeks, location: automationLocation }),
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
    <AdminLayout user={user} title="Rooster" location={location}>
      {/* ── Controls ── */}
      <div className="plan-controls">
        <div className="view-tabs" role="tablist" aria-label="Weergave">
          {(['week', 'month', '3months'] as ViewMode[]).map(v => (
            <button
              key={v}
              role="tab"
              className={`view-tab${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
              {...(view === v ? { 'aria-current': 'true' } : {})}
            >
              {v === 'week' ? 'Week' : v === 'month' ? 'Maand' : '3 mnd'}
            </button>
          ))}
        </div>
        
        <div className="week-nav">
          <button className="btn btn-outline btn-sm btn-icon" onClick={prevPeriod} title="Vorige periode" aria-label="Vorige periode">
            <PrevIcon />
          </button>
          <div className="week-label-wrap">
            <span className="week-label">
              {view === 'week'
                ? `Week ${week} · ${year}`
                : `Wk ${week}–${weeksInRange(week, year, numWeeks).slice(-1)[0].week} · ${year}`}
            </span>
            {view === 'week' && (
              <span className="week-date-range">{weekDateRange(week, year)}</span>
            )}
          </div>
          <button className="btn btn-outline btn-sm btn-icon" onClick={nextPeriod} title="Volgende periode" aria-label="Volgende periode">
            <NextIcon />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={goToday}>Vandaag</button>
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
      </div>

      {/* ── Copy Week Modal ── */}
      {showCopy && (
        <div className="modal-overlay" onClick={() => setShowCopy(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>📋 Week kopiëren</h3>
            <p className="modal-desc">Kopieer alle diensten van week {week} ({year}) naar:</p>
            <div className="modal-fields">
              <label>Week: <input type="number" min={1} max={52} value={copyTarget.week} onChange={e => setCopyTarget(t => ({ ...t, week: +e.target.value }))} /></label>
              <label>Jaar: <input type="number" min={2024} max={2030} value={copyTarget.year} onChange={e => setCopyTarget(t => ({ ...t, year: +e.target.value }))} /></label>
              <label className="scope-field">Locatie(s):
                <select value={automationLocation} onChange={e => setAutomationLocation(e.target.value as Location | '')} required>
                  <option value="" disabled>Kies locatie(s)</option>
                  {LOCATIONS.map(option => <option key={option.value} value={option.value}>{LOCATION_LABELS[option.value]}</option>)}
                </select>
              </label>
            </div>
            {copyMsg && <p className="modal-msg">{copyMsg}</p>}
            <div className="modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setShowCopy(false)}>Annuleren</button>
              <button className="btn btn-primary btn-sm" onClick={executeCopy} disabled={copyBusy || !automationLocation}>{copyBusy ? 'Bezig…' : 'Kopiëren'}</button>
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
              <label className="scope-field">Locatie(s):
                <select value={automationLocation} onChange={e => setAutomationLocation(e.target.value as Location | '')} required>
                  <option value="" disabled>Kies locatie(s)</option>
                  {LOCATIONS.map(option => <option key={option.value} value={option.value}>{LOCATION_LABELS[option.value]}</option>)}
                </select>
              </label>
            </div>
            {fillMsg && <p className="modal-msg">{fillMsg}</p>}
            <div className="modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setShowFill(false)}>Annuleren</button>
              <button className="btn btn-primary btn-sm" onClick={executeFill} disabled={fillBusy || !automationLocation}>{fillBusy ? 'Bezig…' : `${fillWeeks} weken vullen`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div className="loading-row"><Spinner /> Laden…</div>
      ) : (
        <div className="plan-grid-wrap scroll-fade-x">
          {weeksInRange(week, year, numWeeks).map((wk, wkIdx) => (
            <div key={`${wk.year}-${wk.week}`} className="admin-week-block">
              {numWeeks > 1 && (
                <div className="admin-week-header">
                  Week {wk.week} · {wk.year}
                  <span className="admin-week-dates">{weekDateRange(wk.week, wk.year)}</span>
                </div>
              )}
              <table className="plan-grid" aria-label={`Planning week ${wk.week}`}>
                <thead>
                  <tr>
                    <th scope="col" className="col-emp">Medewerker</th>
                    {DAYS.map((day, i) => {
                      const { date, month } = dayInfo(wk.week, wk.year, i)
                      return (
                        <th key={day} scope="col" className="col-day">
                          <div className="day-head">
                            <span className="day-short">{DAY_SHORT[day]}</span>
                            <span className="day-num">{date}</span>
                            <span className="day-month">{month}</span>
                          </div>
                        </th>
                      )
                    })}
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
                        const dayShifts = shiftsFor(emp.id, day, wk.week, wk.year)
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
                                    onClick={() => setModal({ shift: s, employee: emp, day, week: wk.week, year: wk.year })}
                                    aria-label={`${s.shift_type} dienst van ${emp.name} bewerken`}
                                  >
                                    <span className="chip-type">{s.shift_type}</span>
                                    {location === 'both' && <LocationBadge location={s.location} size="xs" label="short" />}
                                    {(s.start_time || s.end_time) && (
                                      <span className="chip-time">{formatTime(s.start_time)}–{formatTime(s.end_time)}</span>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              className="cell-add-btn"
                              onClick={() => setModal({ shift: null, employee: emp, day, week: wk.week, year: wk.year })}
                              aria-label={`Dienst toevoegen voor ${emp.name} op ${day}`}
                              title="Dienst toevoegen"
                            ><PlusIcon size={18} /></button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* Open shifts row */}
                  {DAYS.some(d => openShiftsFor(d, wk.week, wk.year).length > 0) && (
                    <tr className="emp-row open-row">
                      <th scope="row" className="col-emp">
                        <div className="emp-cell">
                          <span className="emp-name text-muted">Open diensten</span>
                        </div>
                      </th>
                      {DAYS.map(day => {
                        const open = openShiftsFor(day, wk.week, wk.year)
                        return (
                          <td key={day} className="shift-cell">
                            <div className="shifts-container">
                              {open.map(s => (
                                <div key={s.id} className="shift-chip open-chip"
                                  data-type={s.shift_type.toLowerCase()}
                                  aria-label={`Open dienst: ${s.shift_type}`}>
                                  <button
                                    className="open-chip-edit-btn"
                                    onClick={() => setModal({ shift: s, employee: { id: 0, name: '', email: null, phone: null, contract_hours: 0, is_active: 1, user_level: 'Medewerker', team_group: null, location, hourly_rate: null, invite_sent_at: null, invite_pending: null }, day, week: wk.week, year: wk.year })}
                                    aria-label={`Bewerken: ${s.shift_type}`}
                                  >
                                    <span className="chip-type">{s.shift_type}</span>
                                    {location === 'both' && <LocationBadge location={s.location} size="xs" label="short" />}
                                    {s.open_invite_status && (
                                      <span className={`chip-invite ${s.open_invite_status}`}>{s.open_invite_status}</span>
                                    )}
                                  </button>
                                  <button className="chip-delete" onClick={e => { e.stopPropagation(); void withdrawOpenShift(s.id) }} title="Open dienst veilig intrekken" aria-label="Open dienst intrekken"><CloseIcon size={18} /></button>
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
          ))}
        </div>
      )}

      {/* ── Mobile Employee Cards (≤768px) ── */}
      {!loading && (
        <div className="plan-mobile-view" aria-label="Planning weekoverzicht mobiel">
          {weeksInRange(week, year, numWeeks).map(wk => (
            <div key={`mob-${wk.year}-${wk.week}`} className="mobile-week-block">
              {numWeeks > 1 && (
                <div className="admin-week-header">Week {wk.week} · {wk.year}</div>
              )}
              {employees.map(emp => (
                <div key={emp.id} className="mobile-emp-card">
                  <div className="mobile-emp-header">
                    <span className="mobile-emp-name">{emp.name}</span>
                    {emp.location === 'both' && <LocationBadge location="both" size="xs" />}
                  </div>
                  <div className="mobile-days-strip">
                    {DAYS.map((day, i) => {
                      const dayShifts = shiftsFor(emp.id, day, wk.week, wk.year)
                      const { date, month } = dayInfo(wk.week, wk.year, i)
                      return (
                        <div key={day} className="mobile-day-col">
                          <div className="mobile-day-head">
                            <span className="mobile-day-short">{DAY_SHORT[day]}</span>
                            <span className="mobile-day-num">{date} {month.slice(0,3)}</span>
                          </div>
                          <div className="mobile-day-shifts">
                            {dayShifts.map(s => (
                              <button
                                key={s.id}
                                className="mobile-shift-chip"
                                data-type={s.shift_type.toLowerCase()}
                                onClick={() => setModal({ shift: s, employee: emp, day, week: wk.week, year: wk.year })}
                                aria-label={`${s.shift_type} - ${emp.name} - ${day}. Tik om te bewerken.`}
                              >
                                <span className="mobile-chip-type">{s.shift_type.slice(0, 3)}</span>
                                {location === 'both' && <LocationBadge location={s.location} size="xs" label="initial" />}
                                {s.start_time && (
                                  <span className="mobile-chip-time">{formatTime(s.start_time)}</span>
                                )}
                              </button>
                            ))}
                            <button
                              className="mobile-add-btn"
                              onClick={() => setModal({ shift: null, employee: emp, day, week: wk.week, year: wk.year })}
                              aria-label={`Dienst toevoegen voor ${emp.name} op ${day}`}
                            ><PlusIcon size={18} /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {employees.length === 0 && (
                <div className="empty-row">Geen medewerkers gevonden voor deze locatie.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Shift Modal ── */}
      {modal && (
        <ShiftModal
          shift={modal.shift}
          employeeId={modal.employee.id}
          employeeName={modal.employee.name}
          day={modal.day}
          week={modal.week}
          year={modal.year}
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
        .modal-fields input, .modal-fields select {
          padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius);
          background: var(--surface-alt); color: var(--text); font-size: .875rem; width: 100px;
        }
        .modal-fields .scope-field { flex: 1 0 100%; }
        .modal-fields .scope-field select { width: 100%; min-height: 40px; }
        .modal-msg { font-size: .8125rem; margin: 0; }
        .modal-actions { display: flex; justify-content: flex-end; gap: var(--s2); }

        .plan-controls {
          display: flex; align-items: center; flex-wrap: wrap; gap: var(--s3);
          margin-bottom: var(--s5);
        }
        .week-nav {
          display: flex; align-items: center; gap: var(--s2);
        }
        .week-label-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          min-width: 155px; text-align: center;
        }
        .week-label {
          font-size: .9375rem; font-weight: 700; line-height: 1.2;
        }
        .week-date-range {
          font-size: .6875rem; color: var(--text-muted); font-weight: 400; line-height: 1;
          white-space: nowrap;
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
        .loc-tab.active[data-loc="both"] {
          color: #fff;
          background: linear-gradient(105deg, var(--markt) 0 49%, var(--noot) 51%);
        }
        .loc-tab:not(.active):hover { background: var(--border); color: var(--text); }

        .plan-grid-wrap {
          overflow-x: auto; -webkit-overflow-scrolling: touch;
          background: transparent;
        }
        .admin-week-block { margin-bottom: var(--s6); }
        .admin-week-header {
          font-size: 1rem; font-weight: 700; margin-bottom: var(--s3);
          display: flex; align-items: baseline; gap: var(--s2);
          padding-left: var(--s2);
        }
        .admin-week-dates { font-size: .8125rem; font-weight: 400; color: var(--text-muted); }

        .plan-grid {
          width: 100%; border-collapse: collapse; min-width: 600px;
          background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .plan-grid thead th {
          background: var(--surface-alt); font-size: .8125rem; font-weight: 600;
          color: var(--text-sub); text-align: left;
          padding: var(--s2) var(--s3); border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .col-emp { width: 120px; min-width: 90px; }
        .col-day { width: calc((100% - 120px) / 7); min-width: 72px; }
        .day-head { display: flex; align-items: baseline; gap: 3px; flex-wrap: wrap; }
        .day-short { font-weight: 700; }
        .day-num { font-size: .75rem; color: var(--text-muted); }
        .day-month { font-size: .6875rem; color: var(--text-muted); opacity: .75; font-style: italic; }

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
        .mobile-days-strip { display: grid; grid-template-columns: repeat(7, minmax(44px, 1fr)); }
        .mobile-day-col { border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 64px; min-width: 44px; }
        .mobile-day-col:last-child { border-right: none; }
        .mobile-day-head { display: flex; flex-direction: column; align-items: center; padding: 4px 2px; background: var(--surface-alt); border-bottom: 1px solid var(--border); gap: 1px; }
        .mobile-day-short { font-size: .625rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .mobile-day-num { font-size: .75rem; font-weight: 600; }
        .mobile-day-shifts { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 3px 2px; }
        .mobile-shift-chip {
          width: 100%; min-height: 32px; border: none; border-radius: 3px;
          display: flex; flex-direction: column; align-items: flex-start;
          padding: 3px 4px; cursor: pointer; gap: 1px; font: inherit; text-align: left;
          min-width: 0; overflow: hidden;
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
        
        .view-tabs {
          display: flex; gap: 3px; background: var(--surface-alt);
          border-radius: var(--radius); padding: 3px;
        }
        .view-tab {
          padding: 8px 12px; border-radius: calc(var(--radius) - 2px);
          font-size: .875rem; font-weight: 500; color: var(--text-sub);
          transition: background .15s, color .15s; cursor: pointer;
          border: none; background: transparent;
        }
        .view-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        .mobile-week-block { margin-bottom: var(--s6); display: flex; flex-direction: column; gap: var(--s2); }

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

        /* 320–360px (iPhone SE-klasse): 7 kolommen passen niet meer comfortabel
           binnen de viewport zonder te comprimeren onder de tap-target-minimum.
           Laat de strip scrollen i.p.v. oneindig te knijpen — zelfde strategie
           als de desktoptabel (zie .scroll-fade-x hierboven). */
        @media (max-width: 360px) {
          .mobile-days-strip {
            grid-template-columns: repeat(7, 44px);
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
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
