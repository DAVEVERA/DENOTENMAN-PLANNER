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

interface Props { user: SessionUser; initialWeek: number; initialYear: number }

const LOCATIONS: { value: Exclude<Location, 'both'>; label: string }[] = [
  { value: 'markt',        label: 'De Notenkar (Markt)' },
  { value: 'nootmagazijn', label: 'Het Nootmagazijn' },
]

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

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
              aria-selected={location === l.value ? "true" : "false"}
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

      {/* ── Grid ── */}
      {loading ? (
        <div className="loading-row"><span className="spinner" aria-hidden="true" /> Laden…</div>
      ) : (
        <div className="plan-grid-wrap">
          <table className="plan-grid" aria-label="Planning weekoverzicht">
            <thead>
              <tr>
                <th scope="col" className="col-emp">Medewerker</th>
                {DAYS.map((day, i) => (
                  <th key={day} scope="col" className={`col-day${day === 'zaterdag' || day === 'zondag' ? ' weekend' : ''}`}>
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
                        className={`shift-cell${day === 'zaterdag' || day === 'zondag' ? ' weekend' : ''}`}
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
                      <td key={day} className={`shift-cell${day === 'zaterdag' || day === 'zondag' ? ' weekend' : ''}`}>
                        <div className="shifts-container">
                          {open.map(s => (
                            <div key={s.id} className="shift-chip open-chip"
                              data-type={s.shift_type.toLowerCase()}
                              aria-label={`Open dienst: ${s.shift_type}`}>
                              <button
                                className="open-chip-edit-btn"
                                onClick={() => setModal({ shift: s, employee: { id: 0, name: '', email: null, phone: null, contract_hours: 0, is_active: 1, user_level: 'Medewerker', team_group: null, location, hourly_rate: null }, day })}
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
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      <style jsx>{`
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
        .col-day.weekend { background: rgba(140,128,120,.06); }

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
        .shift-cell.weekend { background: rgba(140,128,120,.04); }

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
        .chip-type { font-size: .6875rem; font-weight: 700; line-height: 1.2; }
        .chip-time { font-size: .5625rem; opacity: .8; line-height: 1.2; color: var(--text-sub); }
        .chip-delete {
          border: none; background: rgba(0,0,0,.05); color: var(--text-sub);
          padding: 0 8px; font-size: 1rem; cursor: pointer; display: flex; align-items: center;
          transition: background .15s, color .15s; min-width: 28px; justify-content: center;
        }
        .chip-delete:hover { background: rgba(220,53,69,.15); color: #dc3545; }

        /* Add button — always subtly visible, fully visible on hover/focus */
        .cell-add-btn {
          width: 100%; height: 22px; border: 1px dashed var(--border);
          background: transparent; border-radius: 4px; margin-top: 3px;
          color: var(--text-muted); cursor: pointer; transition: all .15s;
          display: flex; align-items: center; justify-content: center; font-weight: 600;
          font-size: .875rem; opacity: 0;
        }
        .shift-cell:hover .cell-add-btn,
        .cell-add-btn:focus { opacity: 1; border-color: var(--brand); color: var(--brand); }

        .open-chip { background: var(--brand-light) !important; border: 1px solid var(--brand); border-style: dashed; }
        .chip-invite { font-size: .5625rem; border-radius: 3px; padding: 1px 4px; font-weight: 600; margin-top: 2px; }
        .chip-invite.pending  { background: #FFF3E0; color: #E65100; }
        .chip-invite.accepted { background: #E8F5E9; color: #2E7D32; }
        .chip-invite.declined { background: #FCE4EC; color: #B71C1C; }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-row { padding: var(--s8); text-align: center; color: var(--text-muted); font-size: .9375rem; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .week-label { min-width: unset; font-size: .875rem; }
          .plan-controls { gap: var(--s2); }
          .loc-tab { padding: 5px 8px; font-size: .75rem; }
          .col-emp { width: 80px; min-width: 72px; }
          .emp-name { font-size: .75rem; }
          /* Always show add button on touch devices */
          .cell-add-btn { opacity: 0.35; height: 28px; }
          .cell-add-btn:active { opacity: 1; }
          /* Bigger touch target for delete */
          .chip-delete { min-width: 32px; padding: 0 10px; }
          .shift-chip { min-height: 36px; }
        }

        /* Touch devices: show add button permanently */
        @media (hover: none) and (pointer: coarse) {
          .cell-add-btn { opacity: 0.35 !important; }
          .cell-add-btn:active { opacity: 1 !important; }
        }

        @media (max-width: 480px) {
          .plan-controls { flex-direction: column; align-items: stretch; }
          .loc-tabs { justify-content: center; }
          .week-nav { justify-content: center; }
          .plan-grid { min-width: 480px; }
          .col-emp { width: 70px; min-width: 60px; }
          .col-day { min-width: 55px; }
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
