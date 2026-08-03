import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import TeamLayout from '@/components/layout/TeamLayout'
import LocationBadge from '@/components/ui/LocationBadge'
import OccupancyBar from '@/components/ui/OccupancyBar'
import { PrevIcon, NextIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import { currentWeekYear } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Employee, Location } from '@/types'
import { DAYS, DAY_SHORT, LOCATION_LABELS } from '@/types'
import Spinner from '@/components/ui/Spinner'
import { isScheduleLocation } from '@/lib/schedule-view'
import DashboardWidgetLayout from '@/components/dashboard/DashboardWidgetLayout'
import ReleaseUpdatesWidget from '@/components/release/ReleaseUpdatesWidget'
import { openReleaseUpdates } from '@/lib/release-updates'

interface Props {
  user: SessionUser
  location: Location
  initialWeek: number
  initialYear: number
}

type TeamDashboardWidget = 'updates'
const TEAM_DASHBOARD_WIDGETS: TeamDashboardWidget[] = ['updates']

function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : ''
}

const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function weekDateRange(w: number, y: number) {
  const jan4 = new Date(y, 0, 4)
  const dow = jan4.getDay() || 7
  const mon = new Date(jan4)
  mon.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
  return `${fmt(mon)} – ${fmt(sun)}`
}

function getFullDayDate(w: number, y: number, dayIndex: number): Date {
  const jan4 = new Date(y, 0, 4)
  const dow = jan4.getDay() || 7
  const start = new Date(jan4)
  start.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7 + dayIndex)
  return start
}

export default function TeamView({ user, location, initialWeek, initialYear }: Props) {
  const router = useRouter()
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


  function dayDate(w: number, y: number, dayIndex: number) {
    const d = getFullDayDate(w, y, dayIndex)
    return d.getDate()
  }

  const shiftsForDay = (day: string) => shifts.filter(s => s.day_of_week === day && !s.is_open)
  const occupancyForDay = (day: string) => {
    const dayShifts = shiftsForDay(day)
    const uniqueEmployees = (items: Shift[]) => new Set(items.map(shift => shift.employee_id)).size
    return {
      total:   uniqueEmployees(dayShifts),
      ochtend: uniqueEmployees(dayShifts.filter(s => s.shift_type === 'Ochtend')),
      middag:  uniqueEmployees(dayShifts.filter(s => s.shift_type === 'Middag')),
      avond:   uniqueEmployees(dayShifts.filter(s => s.shift_type === 'Avond')),
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
          <div className="week-label-wrap">
            <span className="week-label">Week {week} · {year}</span>
            <span className="week-date-sub">{weekDateRange(week, year)}</span>
          </div>
          <button className="btn btn-outline btn-sm btn-icon" onClick={nextWeek} title="Volgende week" aria-label="Volgende week">
            <NextIcon />
          </button>
        </div>
        <div className="loc-label" data-location={location}>
          {LOCATION_LABELS[location]}
        </div>
      </div>

      {location === 'both' && (
        <DashboardWidgetLayout<TeamDashboardWidget>
          storageKey={`team-dashboard-layout:${user.user_id}`}
          defaultOrder={TEAM_DASHBOARD_WIDGETS}
          widgets={[
            {
              id: 'updates',
              label: 'Nieuw in de planner',
              fullWidth: true,
              content: (
                <ReleaseUpdatesWidget
                  onOpen={openReleaseUpdates}
                />
              ),
            },
          ]}
          emptyText="Je hebt nu geen widgets boven je rooster."
        />
      )}

      {loading ? (
        <div className="loading-row"><Spinner /> Laden…</div>
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
                      <span className="day-mon">{MONTHS_NL[getFullDayDate(week, year, i).getMonth()]}</span>
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
                          {location === 'both' && <LocationBadge location={s.location} size="xs" label="short" />}
                          <span className="day-shift-name">{s.employee_name}</span>
                          {(s.start_time || s.end_time) && (
                            <span className="day-shift-time">
                              {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                            </span>
                          )}
                          <button type="button" className="day-shift-chat" onClick={() => void router.push(`/me/chat?shift=${s.id}`)}>
                            Bespreek
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Mobile employee cards (<1024px) — aanvulling op de dagkaarten hierboven,
                zelfde patroon als pages/admin/index.tsx .mobile-emp-card ── */}
          <div className="team-mobile-grid" aria-label="Weekoverzicht medewerkers mobiel">
            <h2 className="grid-title">Weekoverzicht medewerkers</h2>
            {employees.map(emp => (
              <div key={emp.id} className="mobile-emp-card">
                <div className="mobile-emp-header">
                  <span className="mobile-emp-name">{emp.name}</span>
                </div>
                <div className="mobile-days-strip">
                  {DAYS.map((day, i) => {
                    const empShifts = shifts.filter(s => s.employee_id === emp.id && s.day_of_week === day)
                    const date = dayDate(week, year, i)
                    return (
                      <div key={day} className="mobile-day-col">
                        <div className="mobile-day-head">
                          <span className="mobile-day-short">{DAY_SHORT[day]}</span>
                          <span className="mobile-day-num">{date}</span>
                        </div>
                        <div className="mobile-day-shifts">
                          {empShifts.map(s => (
                            <div
                              key={s.id}
                              className="mobile-shift-chip"
                              data-type={s.shift_type.toLowerCase()}
                              aria-label={`${s.shift_type} - ${emp.name} - ${day}`}
                            >
                              <span className="mobile-chip-type">{s.shift_type.slice(0, 3)}</span>
                              {location === 'both' && <LocationBadge location={s.location} size="xs" label="initial" />}
                              {s.start_time && <span className="mobile-chip-time">{fmtTime(s.start_time)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {employees.length === 0 && (
              <div className="empty-row">Geen medewerkers voor deze locatie.</div>
            )}
          </div>

          {/* ── Full employee grid (desktop) ── */}
          <div className="team-grid-section">
            <h2 className="grid-title">Weekoverzicht medewerkers</h2>
            <div className="team-grid-wrap scroll-fade-x">
              <table className="team-grid" aria-label="Medewerker planning overzicht">
                <thead>
                  <tr>
                    <th scope="col" className="col-emp">Medewerker</th>
                    {DAYS.map((day, i) => (
                      <th key={day} scope="col" className="col-day">
                        <span className="day-short">{DAY_SHORT[day]}</span>
                        <span className="day-num"> {dayDate(week, year, i)}</span>
                        <span className="day-col-mon"> {MONTHS_NL[getFullDayDate(week, year, i).getMonth()]}</span>
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
                                {location === 'both' && <LocationBadge location={s.location} size="xs" label="short" />}
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
        .week-label-wrap { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 150px; }
        .week-label { font-size: .9375rem; font-weight: 600; text-align: center; }
        .week-date-sub { font-size: .6875rem; color: var(--text-muted); text-align: center; }
        .loc-label { font-size: .9375rem; font-weight: 600; }
        .loc-label[data-location="nootmagazijn"] { color: var(--noot); }
        .loc-label[data-location="markt"]        { color: var(--markt); }
        .loc-label[data-location="both"] {
          color: var(--text);
          padding-left: 12px;
          border-left: 4px solid var(--markt);
          box-shadow: -2px 0 0 var(--noot);
        }

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
        .day-mon { font-size: .6875rem; color: var(--text-muted); }
        .day-count { font-size: .8125rem; font-weight: 600; color: var(--text-sub); background: var(--surface-alt); padding: 1px 6px; border-radius: 4px; }

        .day-expand { margin-top: var(--s3); border-top: 1px solid var(--border); padding-top: var(--s2); }
        .day-shift-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
        .day-shift-chip {
          font-size: .75rem; font-weight: 600; padding: 3px 7px; border-radius: 3px; white-space: nowrap;
        }
        .day-shift-chip:not([data-type]) { background: var(--surface-alt); }

        .day-shift-name { font-size: .8125rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .day-shift-time { font-size: .6875rem; color: var(--text-muted); white-space: nowrap; }
        .day-shift-chat { min-height: 44px; margin-left: auto; padding: 8px 10px; color: var(--brand); background: rgba(44,110,73,.1); border-radius: 8px; font-size: .7rem; font-weight: 700; }

        /* ── Mobile employee cards (<1024px) ── */
        .team-mobile-grid { display: none; }
        .mobile-emp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: var(--s2); }
        .mobile-emp-header { display: flex; align-items: center; gap: var(--s2); padding: var(--s2) var(--s3); background: var(--surface-alt); border-bottom: 1px solid var(--border); }
        .mobile-emp-name { font-size: .875rem; font-weight: 600; flex: 1; }
        .mobile-days-strip { display: grid; grid-template-columns: repeat(7, minmax(44px, 1fr)); }
        .mobile-day-col { border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 56px; min-width: 44px; }
        .mobile-day-col:last-child { border-right: none; }
        .mobile-day-head { display: flex; flex-direction: column; align-items: center; padding: 4px 2px; background: var(--surface-alt); border-bottom: 1px solid var(--border); gap: 1px; }
        .mobile-day-short { font-size: .625rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
        .mobile-day-num { font-size: .75rem; font-weight: 600; }
        .mobile-day-shifts { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 3px 2px; }
        .mobile-shift-chip { border-radius: 3px; padding: 3px 4px; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; overflow: hidden; }
        .mobile-chip-type { font-size: .6875rem; font-weight: 700; line-height: 1.2; }
        .mobile-chip-time { font-size: .625rem; color: var(--text-sub); line-height: 1.2; }

        /* ── Grid ── */
        .team-grid-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--s5); }
        .grid-title { margin-bottom: var(--s4); font-size: 1.125rem; }
        .team-grid-wrap { overflow-x: auto; }
        .team-grid { width: 100%; border-collapse: collapse; min-width: 600px; }
        .team-grid th, .team-grid td { padding: var(--s2) var(--s3); text-align: left; border-bottom: 1px solid var(--border); }
        .team-grid thead th { background: var(--surface-alt); font-size: .75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .col-emp { width: 160px; font-weight: 500; }
        .day-col-mon { font-size: .6875rem; font-weight: 400; color: var(--text-muted); text-transform: lowercase; }
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
          .team-mobile-grid { display: flex; flex-direction: column; gap: var(--s2); margin-bottom: var(--s6); }
        }
        /* 320–360px: laat de dagenstrip scrollen i.p.v. oneindig te comprimeren
           (zelfde strategie als pages/admin/index.tsx .mobile-days-strip). */
        @media (max-width: 360px) {
          .mobile-days-strip {
            grid-template-columns: repeat(7, 44px);
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
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

  const loc = String(params?.location ?? 'both')
  if (!isScheduleLocation(loc))
    return { redirect: { destination: '/team/both', permanent: false } }

  const { week, year } = currentWeekYear()
  return { props: { user: session.user, location: loc, initialWeek: week, initialYear: year } }
}
