import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import TeamLayout from '@/components/layout/TeamLayout'
import OccupancyBar from '@/components/ui/OccupancyBar'
import { PrevIcon, NextIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import { currentWeekYear } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Employee, Location } from '@/types'
import { DAYS, DAY_SHORT, LOCATION_LABELS } from '@/types'

interface Props {
  user: SessionUser
  location: Exclude<Location, 'both'>
  initialWeek: number
  initialYear: number
}

function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : ''
}


export default function TeamView({ user, location, initialWeek, initialYear }: Props) {
  const [week, setWeek]   = useState(initialWeek)
  const [year, setYear]   = useState(initialYear)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [expandDay, setExpandDay] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [sRes, eRes] = await Promise.all([
      fetch(`/api/shifts?week=${week}&year=${year}&location=${location}`),
      fetch(`/api/employees?location=${location}&active=1`),
    ])
    const [sData, eData] = await Promise.all([sRes.json(), eRes.json()])
    setShifts(sData.success ? sData.data : [])
    setEmployees(eData.success ? eData.data : [])
    setLoading(false)
  }, [week, year, location])

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
    return start.getDate()
  }

  const shiftsForDay = (day: string) => shifts.filter(s => s.day_of_week === day && !s.is_open)
  const occupancyForDay = (day: string) => {
    const dayShifts = shiftsForDay(day)
    return {
      total:   dayShifts.length,
      ochtend: dayShifts.filter(s => s.shift_type === 'Ochtend').length,
      middag:  dayShifts.filter(s => s.shift_type === 'Middag').length,
      avond:   dayShifts.filter(s => s.shift_type === 'Avond').length,
    }
  }

  return (
    <TeamLayout user={user} location={location}>
      {/* ── Week nav ── */}
      <div className="team-controls">
        <div className="week-nav">
          <button className="btn btn-outline btn-sm btn-icon" onClick={prevWeek} title="Vorige week" aria-label="Vorige week">
            <PrevIcon />
          </button>
          <span className="week-label">Week {week} · {year}</span>
          <button className="btn btn-outline btn-sm btn-icon" onClick={nextWeek} title="Volgende week" aria-label="Volgende week">
            <NextIcon />
          </button>
        </div>
        <div className="loc-label" data-location={location}>
          {LOCATION_LABELS[location]}
        </div>
      </div>

      {loading ? (
        <div className="loading-row"><span className="spinner" aria-hidden="true" /> Laden…</div>
      ) : (
        <>
          {/* ── Occupancy overview cards ── */}
          <div className="occ-overview" aria-label="Dagoverzicht">
            {DAYS.map((day, i) => {
              const occ  = occupancyForDay(day)
              const date = dayDate(week, year, i)
              const isExpanded = expandDay === day
              const dayShifts  = shiftsForDay(day)
              return (
                <div
                  key={day}
                  className={`day-card${isExpanded ? ' expanded' : ''}`}
                  onClick={() => setExpandDay(isExpanded ? null : day)}
                  onKeyDown={e => e.key === 'Enter' && setExpandDay(isExpanded ? null : day)}
                  role="button"
                  tabIndex={0}
                  {...(isExpanded ? { 'aria-expanded': true } : { 'aria-expanded': false })}
                  aria-label={`${day} ${date}: ${occ.total} medewerkers`}
                >
                  <div className="day-card-head">
                    <div className="day-info">
                      <span className="day-short">{DAY_SHORT[day]}</span>
                      <span className="day-num">{date}</span>
                    </div>
                    <span className="day-count">{occ.total}</span>
                  </div>
                  <OccupancyBar
                    ochtend={occ.ochtend}
                    middag={occ.middag}
                    avond={occ.avond}
                    total={occ.total}
                    max={employees.length || 8}
                  />

                  {isExpanded && dayShifts.length > 0 && (
                    <div className="day-expand" onClick={e => e.stopPropagation()}>
                      {dayShifts.map(s => (
                        <div key={s.id} className="day-shift-row">
                          <div
                            className="day-shift-chip"
                            data-type={s.shift_type.toLowerCase()}
                          >
                            {s.shift_type}
                          </div>
                          <span className="day-shift-name">{s.employee_name}</span>
                          {(s.start_time || s.end_time) && (
                            <span className="day-shift-time">
                              {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Full employee grid (desktop) ── */}
          <div className="team-grid-section">
            <h2 className="grid-title">Weekoverzicht medewerkers</h2>
            <div className="team-grid-wrap">
              <table className="team-grid" aria-label="Medewerker planning overzicht">
                <thead>
                  <tr>
                    <th scope="col" className="col-emp">Medewerker</th>
                    {DAYS.map((day, i) => (
                      <th key={day} scope="col" className="col-day">
                        <span className="day-short">{DAY_SHORT[day]}</span>
                        <span className="day-num"> {dayDate(week, year, i)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <th scope="row" className="col-emp emp-name-cell">{emp.name}</th>
                      {DAYS.map(day => {
                        const empShifts = shifts.filter(s => s.employee_id === emp.id && s.day_of_week === day)
                        return (
                          <td key={day} className={`shift-cell${day === 'zaterdag' || day === 'zondag' ? ' weekend' : ''}`}>
                            {empShifts.map(s => (
                              <div
                                key={s.id}
                                className="shift-pill"
                                data-type={s.shift_type.toLowerCase()}
                                aria-label={`${s.shift_type} dienst`}
                              >
                                <span>{s.shift_type}</span>
                                {(s.start_time) && <span className="pill-time">{fmtTime(s.start_time)}</span>}
                              </div>
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty-row">Geen medewerkers voor deze locatie.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .team-controls {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: var(--s3); margin-bottom: var(--s5);
        }
        .week-nav { display: flex; align-items: center; gap: var(--s2); }
        .week-label { font-size: .9375rem; font-weight: 600; min-width: 140px; text-align: center; }
        .loc-label { font-size: .9375rem; font-weight: 600; }
        .loc-label[data-location="nootmagazijn"] { color: var(--noot); }
        .loc-label[data-location="markt"]        { color: var(--markt); }

        /* ── Occupancy cards ── */
        .occ-overview { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--s3); margin-bottom: var(--s6); }
        .day-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: var(--s3); cursor: pointer; transition: transform .15s, border-color .15s, box-shadow .15s;
          display: flex; flex-direction: column; gap: var(--s2); min-height: 72px;
        }
        .day-card:hover { transform: translateY(-2px); border-color: var(--brand); box-shadow: var(--shadow-md); }
        .day-card.expanded { box-shadow: var(--shadow-md); border-color: var(--brand); }

        .day-card-head { display: flex; align-items: center; justify-content: space-between; }
        .day-info { display: flex; align-items: baseline; gap: 4px; }
        .day-short { font-size: .75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .day-num { font-size: 1.125rem; font-weight: 700; color: var(--text); }
        .day-count { font-size: .8125rem; font-weight: 600; color: var(--text-sub); background: var(--surface-alt); padding: 1px 6px; border-radius: 4px; }

        .day-expand { margin-top: var(--s3); border-top: 1px solid var(--border); padding-top: var(--s2); }
        .day-shift-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
        .day-shift-chip {
          font-size: .75rem; font-weight: 600; padding: 3px 7px; border-radius: 3px; white-space: nowrap;
        }
        .day-shift-chip:not([data-type]) { background: var(--surface-alt); }

        .day-shift-name { font-size: .8125rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .day-shift-time { font-size: .6875rem; color: var(--text-muted); white-space: nowrap; }

        /* ── Grid ── */
        .team-grid-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--s5); }
        .grid-title { margin-bottom: var(--s4); font-size: 1.125rem; }
        .team-grid-wrap { overflow-x: auto; }
        .team-grid { width: 100%; border-collapse: collapse; min-width: 600px; }
        .team-grid th, .team-grid td { padding: var(--s2) var(--s3); text-align: left; border-bottom: 1px solid var(--border); }
        .team-grid thead th { background: var(--surface-alt); font-size: .75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .col-emp { width: 160px; font-weight: 500; }
        .shift-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 6px; border-radius: 4px; margin-bottom: 2px;
          font-size: .75rem; font-weight: 600;
        }
        .shift-pill:not([data-type]) { background: var(--surface-alt); }

        .pill-time { font-size: .6875rem; color: var(--text-sub); }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-row { text-align: center; color: var(--text-muted); padding: var(--s8); }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .occ-overview { grid-template-columns: repeat(4, 1fr); }
          .team-grid-section { display: none; }
        }
        @media (max-width: 768px) {
          .week-label { min-width: 0; font-size: .875rem; }
          .team-controls { flex-wrap: wrap; gap: var(--s2); }
        }
        @media (max-width: 600px) {
          .occ-overview { grid-template-columns: repeat(2, 1fr); }
          .day-card.expanded { grid-column: span 1; }
          .day-num { font-size: 1rem; }
        }
        @media (max-width: 480px) {
          .occ-overview { grid-template-columns: repeat(2, 1fr); }
          .team-controls { flex-direction: column; align-items: stretch; }
          .week-nav { justify-content: center; }
        }
        @media (max-width: 360px) {
          .occ-overview { grid-template-columns: 1fr; }
        }
      `}</style>
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res, params }) => {
  const session  = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }

  const loc = String(params?.location ?? 'markt')
  if (loc !== 'markt' && loc !== 'nootmagazijn')
    return { redirect: { destination: '/team/markt', permanent: false } }

  const { week, year } = currentWeekYear()
  return { props: { user: session.user, location: loc, initialWeek: week, initialYear: year } }
}
