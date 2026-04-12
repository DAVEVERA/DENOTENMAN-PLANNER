import { useState, useEffect, useCallback } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { PrevIcon, NextIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import { currentWeekYear } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Location } from '@/types'
import { DAYS, DAY_SHORT, SHIFT_TYPES } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props {
  user: SessionUser
  initialWeek: number
  initialYear: number
}

type ViewMode = 'week' | 'month' | '3months'

function weekStartDate(w: number, y: number) {
  const jan4 = new Date(y, 0, 4)
  const dow = jan4.getDay() || 7
  const start = new Date(jan4)
  start.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7)
  return start
}

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


export default function MySchedulePage({ user, initialWeek, initialYear }: Props) {
  const [view, setView]   = useState<ViewMode>('week')
  const [week, setWeek]   = useState(initialWeek)
  const [year, setYear]   = useState(initialYear)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  const numWeeks = view === 'week' ? 1 : view === 'month' ? 4 : 13

  const load = useCallback(async () => {
    if (!user.employee_id) return
    setLoading(true)
    const weeks = weeksInRange(week, year, numWeeks)
    const results = await Promise.all(
      weeks.map(w => fetch(`/api/shifts?employee_id=${user.employee_id}&week=${w.week}&year=${w.year}`).then(r => r.json())),
    )
    const all: Shift[] = results.flatMap(d => d.success ? d.data : [])
    setShifts(all)
    setLoading(false)
  }, [week, year, numWeeks, user.employee_id])

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

  const weeks = weeksInRange(week, year, numWeeks)

  const shiftsByWeek = weeks.map(wk => ({
    ...wk,
    days: DAYS.map(day => ({
      day,
      shifts: shifts.filter(s => s.week_number === wk.week && s.year === wk.year && s.day_of_week === day),
    })),
  }))

  const totalShifts = shifts.filter(s => !['Verlof','Vakantie','Verzuim'].includes(s.shift_type)).length
  const totalAbsence = shifts.filter(s => ['Verlof','Vakantie','Verzuim'].includes(s.shift_type)).length

  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  return (
    <TeamLayout user={user} location={locProp}>
      {!user.employee_id ? (
        <div className="no-emp-msg">
          <div className="no-emp-icon">👤</div>
          <div>Geen medewerker gekoppeld aan dit account.</div>
          <div className="text-muted text-sm">Neem contact op met de beheerder.</div>
        </div>
      ) : (
        <>
          {/* ── Controls ── */}
          <div className="me-controls">
            <div className="view-tabs" role="tablist" aria-label="Weergave">
              {(['week', 'month', '3months'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v ? "true" : "false"}
                  className={`view-tab${view === v ? ' active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v === 'week' ? 'Week' : v === 'month' ? 'Maand' : '3 mnd'}
                </button>
              ))}
            </div>
            <div className="period-nav">
              <button className="btn btn-outline btn-sm btn-icon" onClick={prevPeriod} title="Vorige periode" aria-label="Vorige periode">
                <PrevIcon />
              </button>
              <span className="period-label">
                {view === 'week'
                  ? `Week ${week} · ${year}`
                  : `Wk ${week}–${weeks[weeks.length-1].week} · ${year}`}
              </span>
              <button className="btn btn-outline btn-sm btn-icon" onClick={nextPeriod} title="Volgende periode" aria-label="Volgende periode">
                <NextIcon />
              </button>
              <button className="btn btn-ghost btn-sm" onClick={goToday}>Vandaag</button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="me-stats" aria-label="Overzicht statistieken">
            <div className="stat-item">
              <span className="stat-val">{totalShifts}</span>
              <span className="stat-label">diensten</span>
            </div>
            {totalAbsence > 0 && (
              <div className="stat-item">
                <span className="stat-val">{totalAbsence}</span>
                <span className="stat-label">vrije dagen</span>
              </div>
            )}
          </div>

          {/* ── Schedule ── */}
          {loading ? (
            <div className="loading-row"><Spinner /> Laden…</div>
          ) : (
            <div className="schedule">
              {shiftsByWeek.map(wk => (
                <div key={`${wk.year}-${wk.week}`} className="week-block" aria-label={`Week ${wk.week}`}>
                  {numWeeks > 1 && (
                    <div className="week-block-header">Week {wk.week} · {wk.year}</div>
                  )}
                  <div className="days-grid">
                    {wk.days.map(({ day, shifts: ds }, dayIdx) => {
                      const dateNum = (() => {
                        const start = weekStartDate(wk.week, wk.year)
                        start.setDate(start.getDate() + dayIdx)
                        return start.getDate()
                      })()
                      const isToday = (() => {
                        const now = new Date()
                        const start = weekStartDate(wk.week, wk.year)
                        start.setDate(start.getDate() + dayIdx)
                        return start.toDateString() === now.toDateString()
                      })()
                      return (
                        <div key={day} className={`day-slot${isToday ? ' today' : ''}${ds.length === 0 ? ' empty' : ''}`}
                          aria-label={`${day} ${dateNum}`}>
                          <div className="day-slot-head">
                            <span className="slot-day">{DAY_SHORT[day]}</span>
                            <span className={`slot-num${isToday ? ' today-num' : ''}`}>{dateNum}</span>
                          </div>
                          {ds.length > 0 ? ds.map(s => (
                            <div
                              key={s.id}
                              className="slot-shift"
                              data-type={s.shift_type.toLowerCase()}
                              aria-label={`${s.shift_type} dienst`}
                            >
                              <span className="slot-type">{s.shift_type}</span>
                              {s.start_time && (
                                <span className="slot-time">{s.start_time.slice(0,5)}–{s.end_time?.slice(0,5)}</span>
                              )}
                              {s.location && (
                                <span className={`slot-loc loc-${s.location}`}>
                                  {s.location === 'markt' ? 'M' : 'N'}
                                </span>
                              )}
                            </div>
                          )) : (
                            <div className="slot-empty" aria-hidden="true">–</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .no-emp-msg { text-align: center; padding: var(--s12) var(--s6); }
        .no-emp-icon { font-size: 3rem; margin-bottom: var(--s3); }

        .me-controls {
          display: flex; align-items: center; flex-wrap: wrap;
          gap: var(--s3); margin-bottom: var(--s4);
        }
        .view-tabs {
          display: flex; gap: 3px; background: var(--surface-alt);
          border-radius: var(--radius); padding: 3px;
        }
        .view-tab {
          padding: 10px 14px; min-height: 44px; border-radius: calc(var(--radius) - 2px);
          font-size: .875rem; font-weight: 500; color: var(--text-sub);
          transition: background .15s, color .15s;
          display: inline-flex; align-items: center;
        }
        .view-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }

        .period-nav { display: flex; align-items: center; gap: var(--s2); }
        .period-label { font-size: .9375rem; font-weight: 600; min-width: 150px; text-align: center; }

        .me-stats {
          display: flex; gap: var(--s5); margin-bottom: var(--s5);
          padding: var(--s3) var(--s5);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .stat-item { display: flex; flex-direction: column; gap: 1px; }
        .stat-val { font-size: 1.375rem; font-weight: 700; line-height: 1; }
        .stat-label { font-size: .75rem; color: var(--text-muted); }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }

        .week-block { margin-bottom: var(--s5); }
        .week-block-header {
          font-size: .8125rem; font-weight: 700; color: var(--text-muted);
          letter-spacing: .05em; text-transform: uppercase;
          margin-bottom: var(--s2);
        }
        .days-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--s2); }
        .day-slot {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s3);
          min-height: 80px;
        }
        .day-slot.today { border-color: var(--brand); }
        .day-slot.empty { opacity: .6; }

        .day-slot-head { display: flex; align-items: baseline; gap: 4px; margin-bottom: var(--s2); }
        .slot-day { font-size: .8125rem; font-weight: 700; color: var(--text-sub); }
        .slot-num { font-size: .875rem; color: var(--text-muted); }
        .slot-num.today-num { color: var(--brand); font-weight: 700; }

        .slot-shift {
          padding: 4px 6px; border-radius: 5px; margin-bottom: 3px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .slot-shift:not([data-type]) { background: var(--surface-alt); }

        .slot-type { font-size: .75rem; font-weight: 700; }
        .slot-time { font-size: .6875rem; color: var(--text-sub); }
        .slot-loc {
          font-size: .6875rem; font-weight: 700; align-self: flex-start;
          padding: 1px 4px; border-radius: 3px; margin-top: 1px;
        }
        .slot-loc.loc-markt        { background: rgba(44,110,73,.15); color: var(--markt); }
        .slot-loc.loc-nootmagazijn { background: rgba(123,79,46,.15); color: var(--noot); }
        .slot-empty { font-size: .875rem; color: var(--text-muted); padding: 2px 0; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .days-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 600px) {
          .me-controls { gap: var(--s2); }
          .period-label { min-width: 0; font-size: .875rem; }
          .view-tab { padding: 8px 10px; }
          .days-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 480px) {
          .me-controls { flex-direction: column; align-items: stretch; }
          .period-nav { justify-content: space-between; }
          .view-tabs { justify-content: center; }
          .days-grid { grid-template-columns: repeat(2, 1fr); }
          .day-slot { min-height: 70px; padding: var(--s2); }
        }
        @media (max-width: 340px) {
          .days-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  const { week, year } = currentWeekYear()
  return { props: { user: session.user, initialWeek: week, initialYear: year } }
}
