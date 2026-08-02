import { useEffect, useMemo, useRef, useState } from 'react'
import { calcHoursWorked } from '@/lib/dateUtils'
import { interpretHourSubmissionResponse } from '@/lib/hour-submission-client'
import { getPlannedShiftHours } from '@/lib/shift-hours'
import type { HourConfirmationMode, Shift, TimeLog } from '@/types'
import Spinner from './Spinner'

type Step = 'choice' | 'edit' | 'review'

interface Props {
  shift: Shift
  latestLog: TimeLog | null
  onClose: () => void
  onSubmitted: (log: TimeLog) => void
}

export default function ShiftHoursModal({ shift, latestLog, onClose, onSubmitted }: Props) {
  const planned = useMemo(() => getPlannedShiftHours(shift), [shift])
  const isCorrection = latestLog?.submission_status === 'rejected'
  const [step, setStep] = useState<Step>(isCorrection ? 'edit' : 'choice')
  const [mode, setMode] = useState<HourConfirmationMode>(isCorrection ? 'adjusted' : 'confirmed')
  const [clockIn, setClockIn] = useState(
    isCorrection ? latestLog?.clock_in?.slice(0, 5) ?? planned.clock_in ?? '' : planned.clock_in ?? '',
  )
  const [clockOut, setClockOut] = useState(
    isCorrection ? latestLog?.clock_out?.slice(0, 5) ?? planned.clock_out ?? '' : planned.clock_out ?? '',
  )
  const [breakMinutes, setBreakMinutes] = useState(String(
    isCorrection ? latestLog?.break_minutes ?? planned.break_minutes : planned.break_minutes,
  ))
  const [note, setNote] = useState(isCorrection ? latestLog?.note ?? '' : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const submitLockRef = useRef(false)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  useEffect(() => {
    if (!error) return
    errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    errorRef.current?.focus({ preventScroll: true })
  }, [error])

  const workedHours = calcHoursWorked(clockIn || null, clockOut || null, Number(breakMinutes) || 0)
  const dateLabel = new Date(`${planned.log_date}T12:00:00`).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  function confirmPlannedHours() {
    setError('')
    if (!planned.clock_in || !planned.clock_out) {
      setMode('adjusted')
      setStep('edit')
      setError('De geplande tijden zijn niet volledig. Vul je werkelijke tijden in.')
      return
    }
    setClockIn(planned.clock_in)
    setClockOut(planned.clock_out)
    setBreakMinutes(String(planned.break_minutes))
    setMode('confirmed')
    setStep('review')
  }

  function reviewAdjustedHours(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const pause = Number(breakMinutes)
    if (!clockIn || !clockOut) return setError('Vul je begin- en eindtijd in.')
    if (clockOut <= clockIn) return setError('De eindtijd moet na de begintijd liggen.')
    if (!Number.isInteger(pause) || pause < 0 || pause > 480) return setError('Pauze moet tussen 0 en 480 minuten liggen.')
    if (workedHours <= 0) return setError('Controleer de tijden en pauze.')
    setMode('adjusted')
    setStep('review')
  }

  async function submit() {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSaving(true)
    setError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch('/api/hours/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          shift_id: shift.id,
          confirmation_mode: mode,
          clock_in: clockIn,
          clock_out: clockOut,
          break_minutes: Number(breakMinutes),
          note: note.trim() || null,
        }),
      })
      const text = await response.text()
      let result: unknown = null
      try {
        result = text ? JSON.parse(text) : {}
      } catch {
        // Gateway/proxy errors are not guaranteed to return JSON.
      }
      const outcome = interpretHourSubmissionResponse(response.status, result)
      if (outcome.kind === 'error') {
        setError(outcome.message)
        return
      }
      onSubmitted(outcome.data)
    } catch (err) {
      const aborted = typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError'
      setError(aborted
        ? 'Het opslaan duurt te lang. Controleer je status voordat je opnieuw probeert.'
        : 'Geen verbinding. Je invoer staat nog in dit scherm; probeer het opnieuw.')
    } finally {
      window.clearTimeout(timeout)
      submitLockRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="hours-overlay" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
      <div className="hours-modal" role="dialog" aria-modal="true" aria-labelledby="shift-hours-title">
        <header className="hours-modal-head">
          <div>
            <span className="hours-eyebrow">Uren accorderen</span>
            <h2 id="shift-hours-title">{shift.shift_type} · {dateLabel}</h2>
          </div>
          <button ref={closeRef} type="button" className="close-button" onClick={onClose} disabled={saving} aria-label="Sluiten">×</button>
        </header>

        {isCorrection && (
          <div className="rejected-alert" role="alert">
            <strong>Aanpassing gevraagd door De Noteman</strong>
            <span>{latestLog?.review_note || 'Controleer je uren en dien ze opnieuw in.'}</span>
          </div>
        )}
        {error && <div ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{error}</div>}

        {step === 'choice' && (
          <div className="choice-step">
            <div className="planned-label">Volgens je rooster</div>
            <div className="time-summary">
              <strong>{planned.clock_in ?? '—'} – {planned.clock_out ?? '—'}</strong>
              <span>{planned.break_minutes ? `${planned.break_minutes} min pauze` : 'geen pauze'} · {calcHoursWorked(planned.clock_in, planned.clock_out, planned.break_minutes).toFixed(1)} uur</span>
            </div>
            <h3>Kloppen deze uren met wat je werkelijk hebt gewerkt?</h3>
            <div className="choice-actions">
              <button type="button" className="choice-button primary-choice" onClick={confirmPlannedHours}>
                <strong>Ja, deze uren kloppen</strong>
                <span>Accordeer de geplande tijden</span>
              </button>
              <button type="button" className="choice-button" onClick={() => { setMode('adjusted'); setStep('edit'); setError('') }}>
                <strong>Nee, uren aanpassen</strong>
                <span>Vul je werkelijke tijden in</span>
              </button>
            </div>
          </div>
        )}

        {step === 'edit' && (
          <form onSubmit={reviewAdjustedHours}>
            <p className="step-copy">Vul in wat je daadwerkelijk hebt gewerkt. De geplande tijden blijven als vergelijking bewaard.</p>
            <div className="planned-inline">Rooster: {planned.clock_in ?? '—'}–{planned.clock_out ?? '—'} · {planned.break_minutes} min pauze</div>
            <div className="edit-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="shift-hours-in">Werkelijke begintijd</label>
                <input id="shift-hours-in" type="time" className="form-control" value={clockIn} onChange={event => setClockIn(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="shift-hours-out">Werkelijke eindtijd</label>
                <input id="shift-hours-out" type="time" className="form-control" value={clockOut} onChange={event => setClockOut(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="shift-hours-break">Pauze in minuten</label>
                <input id="shift-hours-break" type="number" className="form-control" min="0" max="480" inputMode="numeric" value={breakMinutes} onChange={event => setBreakMinutes(event.target.value)} />
              </div>
              <div className="form-group note-field">
                <label className="form-label" htmlFor="shift-hours-note">Toelichting (optioneel)</label>
                <textarea id="shift-hours-note" className="form-control" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Bijvoorbeeld waarom de tijden afwijken" />
              </div>
            </div>
            <div className="calculated-hours" aria-live="polite">Berekend: <strong>{workedHours.toFixed(1)} uur</strong></div>
            <div className="modal-actions">
              {!isCorrection && <button type="button" className="btn btn-outline" onClick={() => { setStep('choice'); setError('') }}>Terug</button>}
              <button type="submit" className="btn btn-primary">Aanpassingen controleren</button>
            </div>
          </form>
        )}

        {step === 'review' && (
          <div className="review-step">
            <span className={`mode-badge ${mode}`}>{mode === 'confirmed' ? 'Uren akkoord' : 'Uren aangepast'}</span>
            <h3>Controleer vóór het indienen</h3>
            <dl className="review-list">
              <div><dt>Datum</dt><dd>{dateLabel}</dd></div>
              <div><dt>Werkelijke tijd</dt><dd>{clockIn}–{clockOut}</dd></div>
              <div><dt>Pauze</dt><dd>{Number(breakMinutes) || 0} minuten</dd></div>
              <div><dt>Totaal</dt><dd><strong>{workedHours.toFixed(1)} uur</strong></dd></div>
              {note.trim() && <div><dt>Toelichting</dt><dd>{note.trim()}</dd></div>}
            </dl>
            <p className="submit-help">
              {mode === 'confirmed'
                ? 'Omdat je niets hebt gewijzigd, worden deze uren direct goedgekeurd en klaargezet voor de export.'
                : 'Deze aangepaste uren gaan naar Fedor voor de finale goedkeuring. Bij afwijzing zie je de reden en kun je opnieuw corrigeren.'}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setStep(mode === 'confirmed' ? 'choice' : 'edit')} disabled={saving}>Terug</button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? <Spinner /> : mode === 'confirmed' ? 'Uren bevestigen' : 'Klaarzetten voor Fedor'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .hours-overlay { position: fixed; inset: 0; z-index: 1100; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(26,20,18,.58); backdrop-filter: blur(4px); }
        .hours-modal { width: min(100%, 560px); max-height: calc(100dvh - 32px); overflow-y: auto; background: var(--surface); border-radius: var(--radius-xl); box-shadow: 0 24px 70px rgba(0,0,0,.28); padding: 24px; }
        .hours-modal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
        .hours-eyebrow { display: block; margin-bottom: 4px; color: var(--brand); font-size: .72rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        h2 { margin: 0; font-size: 1.25rem; line-height: 1.3; }
        h3 { margin: 20px 0 12px; font-size: 1rem; line-height: 1.45; }
        .close-button { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 50%; background: var(--surface-alt); color: var(--text); font-size: 1.5rem; line-height: 1; }
        .planned-label { color: var(--text-muted); font-size: .75rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .time-summary { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; padding: 12px 0 16px; border-bottom: 1px solid var(--border); }
        .time-summary strong { font-size: 1.5rem; }
        .time-summary span { color: var(--text-muted); font-size: .85rem; text-align: right; }
        .choice-actions { display: grid; gap: 10px; }
        .choice-button { min-height: 68px; width: 100%; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 3px; padding: 13px 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); text-align: left; }
        .choice-button:hover, .choice-button:focus-visible { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(44,110,73,.12); }
        .choice-button span { color: var(--text-muted); font-size: .8rem; }
        .primary-choice { border-color: var(--brand); background: rgba(44,110,73,.06); }
        .rejected-alert, .form-error { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; margin-bottom: 16px; border-radius: var(--radius); font-size: .875rem; }
        .rejected-alert { color: #7a271a; background: #fff2ef; border: 1px solid #f2b8ad; }
        .form-error { color: var(--danger); background: rgba(198,40,40,.08); border: 1px solid rgba(198,40,40,.25); }
        .step-copy, .submit-help { color: var(--text-sub); font-size: .9rem; line-height: 1.5; }
        .planned-inline { padding: 10px 12px; margin-bottom: 16px; border-radius: var(--radius); background: var(--surface-alt); color: var(--text-muted); font-size: .8rem; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .note-field { grid-column: 1 / -1; }
        .calculated-hours { margin-top: 14px; padding: 12px 14px; border-radius: var(--radius); background: rgba(44,110,73,.08); color: var(--text-sub); }
        .mode-badge { display: inline-flex; padding: 5px 9px; border-radius: 999px; font-size: .75rem; font-weight: 800; }
        .mode-badge.confirmed { color: #1d643f; background: rgba(44,110,73,.12); }
        .mode-badge.adjusted { color: #8a5a12; background: rgba(200,136,42,.15); }
        .review-list { margin: 0; border-top: 1px solid var(--border); }
        .review-list div { display: grid; grid-template-columns: 130px 1fr; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--border); }
        .review-list dt { color: var(--text-muted); font-size: .82rem; }
        .review-list dd { margin: 0; font-size: .9rem; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .modal-actions :global(.btn) { min-height: 44px; }
        @media (max-width: 520px) {
          .hours-overlay { align-items: flex-end; padding: 0; }
          .hours-modal { width: 100%; max-height: 94vh; max-height: 94dvh; border-radius: 20px 20px 0 0; padding: 20px 16px calc(20px + env(safe-area-inset-bottom)); }
          .time-summary { align-items: flex-start; flex-direction: column; }
          .time-summary span { text-align: left; }
          .edit-grid { grid-template-columns: 1fr; }
          .note-field { grid-column: auto; }
          .review-list div { grid-template-columns: 110px 1fr; }
          .modal-actions { flex-direction: column-reverse; }
          .modal-actions :global(.btn) { width: 100%; min-height: 48px; }
        }
      `}</style>
    </div>
  )
}
