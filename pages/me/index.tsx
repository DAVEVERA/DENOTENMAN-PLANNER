import { useState, useEffect, useCallback } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { PrevIcon, NextIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import { currentWeekYear, shiftWeekYear, weeksInRange } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import type { SessionUser, Shift, Location } from '@/types'
import { DAYS, DAY_SHORT, SHIFT_TYPES } from '@/types'
import Spinner from '@/components/ui/Spinner'
import ShiftHoursModal from '@/components/ui/ShiftHoursModal'
import { isShiftReadyForHourConfirmation, latestTimeLogForShift } from '@/lib/shift-hours'
import type { TimeLog } from '@/types'
import { WORK_TYPES } from '@/types'


interface Props {
  user: SessionUser
  initialWeek: number
  initialYear: number
}

type ViewMode = 'week' | 'month' | '3months'

const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function weekStartDate(w: number, y: number) {
  const jan4 = new Date(y, 0, 4)
  const dow = jan4.getDay() || 7
  const start = new Date(jan4)
  start.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7)
  return start
}

function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Returns the ISO week date range e.g. "28 apr – 4 mei 2026" */
function weekDateRange(w: number, y: number) {
  const mon = weekStartDate(w, y)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
  const yearSuffix = sun.getFullYear() !== y ? ` ${sun.getFullYear()}` : ''
  return `${fmt(mon)} – ${fmt(sun)}${yearSuffix}`
}

export default function MySchedulePage({ user, initialWeek, initialYear }: Props) {
  const router = useRouter()
  const [view, setView]   = useState<ViewMode>('week')
  const [week, setWeek]   = useState(initialWeek)
  const [year, setYear]   = useState(initialYear)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [hourLogs, setHourLogs] = useState<TimeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [offering, setOffering] = useState(false)
  const [offerNote, setOfferNote] = useState('')
  const [hourShift, setHourShift] = useState<Shift | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const numWeeks = view === 'week' ? 1 : view === 'month' ? 4 : 13

  const load = useCallback(async () => {
    if (!user.employee_id) return
    setLoading(true)
    const weeks = weeksInRange(week, year, numWeeks)
    const rangeStart = weekStartDate(weeks[0].week, weeks[0].year)
    const rangeEnd = weekStartDate(weeks[weeks.length - 1].week, weeks[weeks.length - 1].year)
    rangeEnd.setDate(rangeEnd.getDate() + 6)
    const [results, hoursResult] = await Promise.all([
      Promise.all(weeks.map(w => fetch(`/api/shifts?employee_id=${user.employee_id}&week=${w.week}&year=${w.year}`).then(r => r.json()))),
      fetch(`/api/hours?from=${isoDate(rangeStart)}&to=${isoDate(rangeEnd)}`).then(r => r.json()),
    ])
    const all: Shift[] = results.flatMap(d => d.success ? d.data : [])
    setShifts(all)
    setHourLogs(hoursResult.success ? hoursResult.data : [])
    setLoading(false)
  }, [week, year, numWeeks, user.employee_id])

  useEffect(() => { load() }, [load])

  function prevPeriod() {
    const previous = shiftWeekYear(week, year, -numWeeks)
    setWeek(previous.week)
    setYear(previous.year)
  }
  function nextPeriod() {
    const next = shiftWeekYear(week, year, numWeeks)
    setWeek(next.week)
    setYear(next.year)
  }

  function goToday() {
    const { week: cw, year: cy } = currentWeekYear()
    setWeek(cw); setYear(cy)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function offerShift(shift: Shift) {
    setOffering(true)
    const r = await fetch('/api/shifts/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shift.id, open_note: offerNote }),
    }).then(r => r.json())
    setOffering(false)
    setSelectedShift(null)
    setOfferNote('')
    if (r.success) {
      showToast('✅ Dienst aangeboden! Collega\'s ontvangen een melding.')
      load()
    } else {
      showToast('❌ ' + (r.message ?? 'Er ging iets mis'))
    }
  }

  function hourStatus(log: TimeLog | null): { label: string; className: string } | null {
    if (!log) return null
    if (log.submission_status === 'pending') return { label: 'Wacht op Fedor', className: 'pending' }
    if (log.submission_status === 'approved' && log.confirmation_mode === 'confirmed') return { label: 'Akkoord & exportklaar', className: 'approved' }
    if (log.submission_status === 'approved') return { label: 'Goedgekeurd', className: 'approved' }
    if (log.submission_status === 'rejected') return { label: 'Aanpassen', className: 'rejected' }
    if (log.submission_status === 'direct') return { label: 'Vastgelegd', className: 'approved' }
    return null
  }

  function handleHoursSubmitted(log: TimeLog) {
    setHourLogs(current => [...current, log])
    setHourShift(null)
    showToast(log.submission_status === 'approved'
      ? 'Uren zijn akkoord en staan klaar voor de export.'
      : 'Aangepaste uren staan klaar voor Fedor.')
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
      {toast && (
        <div className="me-toast" role="alert">{toast}</div>
      )}

      {/* ── Offer confirm modal ── */}
      {selectedShift && (
        <div className="offer-overlay" onClick={e => e.target === e.currentTarget && setSelectedShift(null)}>
          <div className="offer-modal" role="dialog" aria-modal="true" aria-labelledby="offer-modal-title">
            <div className="offer-modal-head">
              <span className="offer-modal-icon">🔄</span>
              <div>
                <div className="offer-modal-title" id="offer-modal-title">Dienst aanbieden</div>
                <div className="offer-modal-sub">
                  {selectedShift.shift_type} · {selectedShift.day_of_week} · week {selectedShift.week_number}
                </div>
              </div>
            </div>
            <p className="offer-modal-body">
              Wil je deze dienst aanbieden aan je collega&apos;s? Ze ontvangen een melding en kunnen hem overnemen.
              De beheerder keurt de overname goed.
            </p>
            <div className="offer-note-group">
              <label className="form-label" htmlFor="offer-note">Notitie (optioneel)</label>
              <textarea
                id="offer-note"
                className="form-control"
                rows={3}
                maxLength={1000}
                value={offerNote}
                onChange={event => setOfferNote(event.target.value)}
                placeholder="Bijvoorbeeld waarom je de dienst aanbiedt…"
              />
              <span className="offer-note-hint">Alleen zichtbaar voor jou, managers en admins.</span>
            </div>
            <div className="offer-modal-actions">
              <button className="btn btn-outline" onClick={() => { setSelectedShift(null); setOfferNote('') }}>Annuleren</button>
              <button className="btn btn-primary" disabled={offering} onClick={() => offerShift(selectedShift)}>
                {offering ? <Spinner /> : '📢 Ja, bied aan'}
              </button>
            </div>
          </div>
        </div>
      )}
      {hourShift && (
        <ShiftHoursModal
          shift={hourShift}
          latestLog={latestTimeLogForShift(hourLogs, hourShift.id)}
          onClose={() => setHourShift(null)}
          onSubmitted={handleHoursSubmitted}
        />
      )}
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
                  className={`view-tab${view === v ? ' active' : ''}`}
                  onClick={() => setView(v)}
                  {...(view === v ? { 'aria-current': 'true' } : {})}
                >
                  {v === 'week' ? 'Week' : v === 'month' ? 'Maand' : '3 mnd'}
                </button>
              ))}
            </div>
            <div className="period-nav">
              <button className="btn btn-outline btn-sm btn-icon" onClick={prevPeriod} title="Vorige periode" aria-label="Vorige periode">
                <PrevIcon />
              </button>
              <div className="period-label-wrap">
                <span className="period-label">
                  {view === 'week'
                    ? `Week ${week} · ${year}`
                    : `Wk ${week}–${weeks[weeks.length-1].week} · ${year}`}
                </span>
                {view === 'week' && (
                  <span className="period-date-range">{weekDateRange(week, year)}</span>
                )}
              </div>
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
                      const dateD = (() => {
                        const start = weekStartDate(wk.week, wk.year)
                        start.setDate(start.getDate() + dayIdx)
                        return start
                      })()
                      const dateNum = dateD.getDate()
                      const dateMonth = MONTHS_NL[dateD.getMonth()]
                      const isToday = (() => {
                        const now = new Date()
                        const start = weekStartDate(wk.week, wk.year)
                        start.setDate(start.getDate() + dayIdx)
                        return start.toDateString() === now.toDateString()
                      })()
                      return (
                        <div key={day} className={`day-slot${isToday ? ' today' : ''}${ds.length === 0 ? ' empty' : ''}`}
                          aria-label={`${day} ${dateNum} ${dateMonth}`}>
                          <div className="day-slot-head">
                            <span className="slot-day">{DAY_SHORT[day]}</span>
                            <span className={`slot-num${isToday ? ' today-num' : ''}`}>{dateNum}</span>
                            <span className="slot-month">{dateMonth}</span>
                          </div>
                          {ds.length > 0 ? ds.map(s => {
                            const isOffered = s.is_open === 1 && s.employee_id === user.employee_id
                            const readyForHours = isShiftReadyForHourConfirmation(s)
                            const latestLog = latestTimeLogForShift(hourLogs, s.id)
                            const status = hourStatus(latestLog)
                            const canOffer = !readyForHours && !isOffered && WORK_TYPES.includes(s.shift_type)
                            const canOpenHours = readyForHours && (!latestLog || latestLog.submission_status === 'rejected')
                            return (
                              <div
                                key={s.id}
                                className={`slot-shift${isOffered ? ' is-offered' : ''}${readyForHours ? ' hours-ready' : ''}${canOpenHours ? ' is-clickable' : ''}`}
                                data-type={s.shift_type.toLowerCase()}
                                aria-label={`${s.shift_type} dienst${canOpenHours ? ', uren controleren' : ''}`}
                              >
                                {canOpenHours && (
                                  <button
                                    type="button"
                                    className="hours-card-trigger"
                                    onClick={() => setHourShift(s)}
                                    aria-label={`${s.shift_type} dienst: daadwerkelijke uren controleren`}
                                  />
                                )}
                                <span className="slot-type">{s.shift_type}</span>
                                {s.start_time && (
                                  <span className="slot-time">{s.start_time.slice(0,5)}–{s.end_time?.slice(0,5)}</span>
                                )}
                                {s.location && (
                                  <span className={`slot-loc loc-${s.location}`}>
                                    {s.location === 'markt' ? 'M' : 'N'}
                                  </span>
                                )}
                                {isOffered && (
                                  <span className="slot-offered-badge">aangeboden</span>
                                )}
                                {readyForHours && !latestLog && (
                                  <span className="hours-action">Tik om uren te controleren</span>
                                )}
                                {readyForHours && latestLog?.submission_status === 'rejected' && (
                                  <span className="hours-action rejected">Tik om uren te corrigeren</span>
                                )}
                                {readyForHours && status && latestLog?.submission_status !== 'rejected' && (
                                  <span className={`hours-status ${status.className}`}>{status.label}</span>
                                )}
                                {WORK_TYPES.includes(s.shift_type) && (
                                  <div className="shift-inline-actions">
                                    <button type="button" className="discuss-action" onClick={event => {
                                      event.stopPropagation()
                                      void router.push(`/me/chat?shift=${s.id}`)
                                    }}>
                                      Bespreek
                                    </button>
                                    {canOffer && (
                                      <button type="button" className="offer-action" onClick={event => {
                                        event.stopPropagation()
                                        setOfferNote('')
                                        setSelectedShift(s)
                                      }}>
                                        Aanbieden
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          }) : (
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
        .period-label-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          min-width: 165px; text-align: center;
        }
        .period-label { font-size: .9375rem; font-weight: 600; line-height: 1.2; }
        .period-date-range {
          font-size: .6875rem; color: var(--text-muted); font-weight: 400; line-height: 1;
          white-space: nowrap;
        }

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

        .day-slot-head { display: flex; align-items: baseline; gap: 3px; flex-wrap: wrap; margin-bottom: var(--s2); }
        .slot-day { font-size: .8125rem; font-weight: 700; color: var(--text-sub); }
        .slot-num { font-size: .875rem; color: var(--text-muted); }
        .slot-num.today-num { color: var(--brand); font-weight: 700; }
        .slot-month { font-size: .6875rem; color: var(--text-muted); opacity: .7; font-style: italic; }

        .slot-shift {
          position: relative;
          padding: 4px 6px; border-radius: 5px; margin-bottom: 3px;
          display: flex; flex-direction: column; gap: 2px;
          transition: background .13s, box-shadow .13s;
        }
        .slot-shift.is-offered { opacity: .65; cursor: default; }
        .slot-shift.hours-ready { padding: 7px; box-shadow: inset 0 0 0 1px rgba(44,110,73,.2); }
        .slot-shift.is-clickable { cursor: pointer; }
        .slot-shift.is-clickable:hover { box-shadow: inset 0 0 0 2px var(--brand), 0 4px 12px rgba(44,110,73,.12); }
        .hours-card-trigger { position: absolute; inset: 0; z-index: 1; width: 100%; border-radius: inherit; }
        .hours-card-trigger:focus-visible { outline: 3px solid rgba(44,110,73,.34); outline-offset: 2px; }
        .slot-shift > :not(.hours-card-trigger) { position: relative; z-index: 2; pointer-events: none; }
        .slot-shift .shift-inline-actions { pointer-events: auto; }
        .slot-shift:not([data-type]) { background: var(--surface-alt); }
        .slot-offered-badge {
          font-size: .6rem; font-weight: 700; letter-spacing: .04em;
          text-transform: uppercase; color: #6D28D9;
          background: rgba(124,58,237,.1); padding: 1px 5px; border-radius: 3px;
          margin-top: 2px; align-self: flex-start;
        }

        .slot-type { font-size: .75rem; font-weight: 700; }
        .slot-time { font-size: .6875rem; color: var(--text-sub); }
        .slot-loc {
          font-size: .6875rem; font-weight: 700; align-self: flex-start;
          padding: 1px 4px; border-radius: 3px; margin-top: 1px;
        }
        .slot-loc.loc-markt        { background: rgba(44,110,73,.15); color: var(--markt); }
        .slot-loc.loc-nootmagazijn { background: rgba(123,79,46,.15); color: var(--noot); }
        .slot-empty { font-size: .875rem; color: var(--text-muted); padding: 2px 0; }
        .hours-action, .offer-action, .discuss-action {
          width: 100%; min-height: 44px; margin-top: 5px; padding: 9px 8px;
          border-radius: 6px; font-size: .7rem; font-weight: 800; line-height: 1.15;
        }
        .hours-action { display: flex; align-items: center; justify-content: center; background: var(--brand); color: #fff; text-align: center; }
        .hours-action.rejected { background: var(--danger); }
        .offer-action { background: transparent; border: 1px solid currentColor; color: var(--text-sub); font-weight: 600; }
        .shift-inline-actions { display: grid; width: 100%; gap: 5px; }
        .shift-inline-actions .offer-action, .shift-inline-actions .discuss-action { margin-top: 0; min-height: 44px; }
        .discuss-action { color: #245b3d; background: rgba(44,110,73,.11); }
        .hours-status { margin-top: 5px; padding: 5px 7px; border-radius: 6px; font-size: .65rem; font-weight: 800; text-align: center; }
        .hours-status.pending { color: #8a5a12; background: rgba(200,136,42,.16); }
        .hours-status.approved { color: #1d643f; background: rgba(44,110,73,.14); }

        /* ── Offer modal ── */
        .offer-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: var(--s4); backdrop-filter: blur(3px);
        }
        .offer-modal {
          background: var(--surface); border-radius: var(--radius-xl);
          padding: var(--s6); max-width: 400px; width: 100%;
          box-shadow: 0 24px 64px rgba(0,0,0,.25);
          animation: modal-in .2s ease;
        }
        @keyframes modal-in { from { opacity:0; transform:scale(.95) } to { opacity:1; transform:none } }
        .offer-modal-head { display: flex; align-items: flex-start; gap: var(--s3); margin-bottom: var(--s4); }
        .offer-modal-icon { font-size: 2rem; flex-shrink: 0; }
        .offer-modal-title { font-size: 1.125rem; font-weight: 700; }
        .offer-modal-sub { font-size: .875rem; color: var(--text-muted); margin-top: 2px; }
        .offer-modal-body { font-size: .9375rem; color: var(--text-sub); margin: 0 0 var(--s5); line-height: 1.5; }
        .offer-note-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--s5); }
        .offer-note-hint { font-size: .75rem; color: var(--text-muted); line-height: 1.4; }
        .offer-modal-actions { display: flex; gap: var(--s3); justify-content: flex-end; }

        /* ── Toast ── */
        .me-toast {
          position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
          background: var(--text); color: #fff;
          padding: 12px 24px; border-radius: 999px;
          font-size: .9375rem; font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,.25);
          z-index: 9999; white-space: nowrap;
          animation: toast-in .2s ease;
        }
        @keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(-8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .days-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 600px) {
          .me-controls { gap: var(--s2); }
          .period-label { min-width: 0; font-size: .875rem; }
          .view-tab { padding: 8px 10px; }
          .days-grid { grid-template-columns: repeat(2, 1fr); }
          .hours-action { min-height: 44px; font-size: .78rem; }
        }
        @media (max-width: 480px) {
          .me-controls { flex-direction: column; align-items: stretch; }
          .period-nav { justify-content: space-between; }
          .view-tabs { justify-content: center; }
          .days-grid { grid-template-columns: 1fr; }
          .day-slot { min-height: 70px; padding: var(--s2); }
          .slot-shift { padding: 9px; }
          .slot-type { font-size: .85rem; }
          .slot-time { font-size: .78rem; }
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
