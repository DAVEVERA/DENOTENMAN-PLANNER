import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { PrevIcon, NextIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import { currentWeekYear } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Employee, Day } from '@/types'
import { DAYS, DAY_SHORT, ABSENCE_TYPES } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props {
  user: SessionUser
  initialWeek: number
  initialYear: number
}

function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : ''
}

export default function IndividualView({ user, initialWeek, initialYear }: Props) {
  const [week, setWeek]             = useState(initialWeek)
  const [year, setYear]             = useState(initialYear)
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [shifts, setShifts]         = useState<Shift[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingEmp, setLoadingEmp] = useState(true)

  // Load employees on mount
  useEffect(() => {
    setLoadingEmp(true)
    fetch('/api/employees?all=1')
      .then(r => r.json())
      .then(d => {
        const active = (d.success ? d.data : []).filter((e: Employee) => e.is_active)
        setEmployees(active)
        setLoadingEmp(false)
      })
  }, [])

  // Load shifts for selected employee
  const load = useCallback(async () => {
    if (!selectedId) { setShifts([]); return }
    setLoading(true)
    const r = await fetch(`/api/shifts?week=${week}&year=${year}`)
    const d = await r.json()
    const allShifts: Shift[] = d.success ? d.data : []
    setShifts(allShifts.filter(s => s.employee_id === selectedId))
    setLoading(false)
  }, [week, year, selectedId])

  useEffect(() => { load() }, [load])

  function prevWeek() {
    if (week === 1) { setWeek(52); setYear(y => y - 1) }
    else setWeek(w => w - 1)
  }
  function nextWeek() {
    if (week === 52) { setWeek(1); setYear(y => y + 1) }
    else setWeek(w => w + 1)
  }

  function weekStartDate(w: number, y: number) {
    const jan4 = new Date(y, 0, 4)
    const dow = jan4.getDay() || 7
    const start = new Date(jan4)
    start.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7)
    return start
  }

  function dayDate(w: number, y: number, dayIndex: number) {
    const start = weekStartDate(w, y)
    start.setDate(start.getDate() + dayIndex)
    return start
  }

  const selected = employees.find(e => e.id === selectedId)

  // Compute weekly totals
  const totalShifts = shifts.filter(s => !ABSENCE_TYPES.includes(s.shift_type)).length
  const absences    = shifts.filter(s => ABSENCE_TYPES.includes(s.shift_type)).length

  return (
    <AdminLayout user={user} title="Individuele Weergave">
      {/* ── Controls ── */}
      <div className="iv-controls">
        <div className="iv-select-wrap">
          <label htmlFor="emp-select" className="iv-label">Medewerker</label>
          {loadingEmp ? (
            <Spinner />
          ) : (
            <select
              id="emp-select"
              className="form-control iv-select"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value ? parseInt(e.target.value) : '')}
            >
              <option value="">— Selecteer medewerker —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="week-nav">
          <button className="btn btn-outline btn-sm btn-icon" onClick={prevWeek} title="Vorige week" aria-label="Vorige week">
            <PrevIcon />
          </button>
          <span className="week-label">Week {week} · {year}</span>
          <button className="btn btn-outline btn-sm btn-icon" onClick={nextWeek} title="Volgende week" aria-label="Volgende week">
            <NextIcon />
          </button>
        </div>
      </div>

      {/* ── No selection ── */}
      {!selectedId && (
        <div className="iv-empty">
          <p>Kies een medewerker om het rooster te bekijken.</p>
        </div>
      )}

      {/* ── Loading ── */}
      {selectedId && loading && (
        <div className="loading-row"><Spinner /> Laden…</div>
      )}

      {/* ── Employee view ── */}
      {selectedId && !loading && (
        <>
          {/* Summary strip */}
          <div className="iv-summary">
            <div className="iv-summary-card">
              <span className="iv-summary-value">{selected?.name}</span>
              <span className="iv-summary-label">Medewerker</span>
            </div>
            <div className="iv-summary-card">
              <span className="iv-summary-value">{selected?.contract_hours ?? 0}u</span>
              <span className="iv-summary-label">Contracturen/wk</span>
            </div>
            <div className="iv-summary-card">
              <span className="iv-summary-value">{totalShifts}</span>
              <span className="iv-summary-label">Diensten</span>
            </div>
            <div className="iv-summary-card">
              <span className="iv-summary-value">{absences}</span>
              <span className="iv-summary-label">Verzuim/Verlof</span>
            </div>
          </div>

          {/* Week grid */}
          <div className="iv-grid">
            {DAYS.map((day, i) => {
              const d = dayDate(week, year, i)
              const dayShifts = shifts.filter(s => s.day_of_week === day)
              const isToday = (() => {
                const now = new Date()
                return d.getDate() === now.getDate()
                  && d.getMonth() === now.getMonth()
                  && d.getFullYear() === now.getFullYear()
              })()

              return (
                <div key={day} className={`iv-day-card${isToday ? ' today' : ''}`}>
                  <div className="iv-day-head">
                    <span className="iv-day-short">{DAY_SHORT[day]}</span>
                    <span className="iv-day-num">{d.getDate()}</span>
                  </div>
                  <div className="iv-day-body">
                    {dayShifts.length === 0 && (
                      <span className="iv-no-shift">Vrij</span>
                    )}
                    {dayShifts.map(s => (
                      <div
                        key={s.id}
                        className={`iv-shift-pill${ABSENCE_TYPES.includes(s.shift_type) ? ' absence' : ''}`}
                        data-type={s.shift_type.toLowerCase()}
                      >
                        <span className="iv-pill-type">{s.shift_type}</span>
                        {(s.start_time || s.end_time) && (
                          <span className="iv-pill-time">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</span>
                        )}
                        {s.location && (
                          <span className="iv-pill-loc">{s.location === 'markt' ? 'Markt' : 'Nootmag.'}</span>
                        )}
                        {s.note && (
                          <span className="iv-pill-note" title={s.note}>💬</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style jsx>{`
        .iv-controls {
          display: flex; align-items: flex-end; flex-wrap: wrap; gap: var(--s4);
          margin-bottom: var(--s5);
        }
        .iv-select-wrap { display: flex; flex-direction: column; gap: 4px; }
        .iv-label { font-size: .8125rem; font-weight: 600; color: var(--text-sub); }
        .iv-select { min-width: 260px; }
        .week-nav { display: flex; align-items: center; gap: var(--s2); }
        .week-label { font-size: .9375rem; font-weight: 600; min-width: 130px; text-align: center; }

        .iv-empty {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s8);
          text-align: center; color: var(--text-muted);
        }
        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }

        /* ── Summary strip ── */
        .iv-summary {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s3);
          margin-bottom: var(--s5);
        }
        .iv-summary-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s3) var(--s4);
          display: flex; flex-direction: column; gap: 2px;
        }
        .iv-summary-value { font-size: 1.125rem; font-weight: 700; color: var(--text); }
        .iv-summary-label { font-size: .75rem; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }

        /* ── Week grid ── */
        .iv-grid {
          display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--s3);
        }
        .iv-day-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
          display: flex; flex-direction: column; min-height: 120px;
          transition: border-color .15s, box-shadow .15s;
        }
        .iv-day-card.today { border-color: var(--brand); box-shadow: 0 0 0 1px var(--brand); }
        .iv-day-head {
          display: flex; align-items: baseline; gap: 4px;
          padding: var(--s2) var(--s3); background: var(--surface-alt);
          border-bottom: 1px solid var(--border);
        }
        .iv-day-short { font-size: .6875rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .iv-day-num { font-size: 1rem; font-weight: 700; }
        .iv-day-body { flex: 1; padding: var(--s2) var(--s3); display: flex; flex-direction: column; gap: 4px; }
        .iv-no-shift { font-size: .8125rem; color: var(--text-muted); font-style: italic; }

        /* ── Shift pills ── */
        .iv-shift-pill {
          border-radius: 5px; padding: 5px 8px;
          display: flex; flex-direction: column; gap: 2px;
          font-size: .8125rem;
        }
        .iv-shift-pill.absence { opacity: .7; }
        .iv-pill-type { font-weight: 700; }
        .iv-pill-time { font-size: .75rem; color: var(--text-sub); }
        .iv-pill-loc { font-size: .6875rem; color: var(--text-muted); }
        .iv-pill-note { font-size: .75rem; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .iv-grid { grid-template-columns: repeat(4, 1fr); }
          .iv-summary { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .iv-controls { flex-direction: column; align-items: stretch; }
          .iv-select { min-width: unset; width: 100%; }
          .week-nav { justify-content: center; }
          .iv-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .iv-grid { grid-template-columns: 1fr; }
          .iv-summary { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  // Only admins and managers can access individual view
  if (session.user.role === 'employee')
    return { redirect: { destination: '/me', permanent: false } }
  const { week, year } = currentWeekYear()
  return { props: { user: session.user, initialWeek: week, initialYear: year } }
}
