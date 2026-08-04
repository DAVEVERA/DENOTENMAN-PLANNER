import { useState, useEffect } from 'react'
import type { Shift, Employee, Location } from '@/types'
import { SHIFT_TYPES, DAYS } from '@/types'
import { CloseIcon } from '@/components/ui/Icons'
import Spinner from '@/components/ui/Spinner'

interface Props {
  shift: Partial<Shift> | null
  employeeId: number
  employeeName: string
  day: string
  week: number
  year: number
  location: Location
  userRole?: 'admin' | 'manager' | 'employee'  // AM-002: voor admin_note zichtbaarheid
  onClose: () => void
  onSaved: () => void
}

export default function ShiftModal({ shift, employeeId, employeeName, day, week, year, location, userRole, onClose, onSaved }: Props) {
  const isNew = !shift?.id
  const isAdmin = userRole === 'admin' || userRole === 'manager'
  const [form, setForm] = useState<Partial<Shift>>({
    employee_id:    employeeId,
    employee_name:  employeeName,
    day_of_week:    day as Shift['day_of_week'],
    week_number:    week,
    year,
    shift_type:     shift?.shift_type     ?? 'Ochtend',
    start_time:     shift?.start_time     ?? '',
    end_time:       shift?.end_time       ?? '',
    full_day:       shift?.full_day       ?? 0,
    note:           shift?.note           ?? '',
    admin_note:     shift?.admin_note     ?? '',   // AM-002
    open_note:      shift?.open_note      ?? null,
    open_note_author_employee_id: shift?.open_note_author_employee_id ?? null,
    opened_at:      shift?.opened_at      ?? null,
    break_minutes:  shift?.break_minutes  ?? 0,    // AM-004
    location:       shift?.location       ?? (location === 'both' ? undefined : location),
    shift_category: shift?.shift_category ?? 'regular',
    is_open:        shift?.is_open        ?? 0,
    ...shift,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const fullDay = Boolean(form.full_day)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.location || form.location === 'both') {
      setError('Kies Markt of Magazijn voor deze dienst.')
      return
    }
    setSaving(true); setError('')
    const url    = isNew ? '/api/shifts' : `/api/shifts/${shift!.id}`
    const method = isNew ? 'POST' : 'PUT'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    setSaving(false)
    if (!d.success) { setError(d.message || 'Opslaan mislukt'); return }
    onSaved(); onClose()
  }

  async function archive() {
    if (!shift?.id || !confirm('Dienst verwijderen uit het rooster? De volledige diensthistorie blijft veilig bewaard.')) return
    setDeleting(true); setError('')
    const r = await fetch(`/api/shifts/${shift.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => null)
    setDeleting(false)
    if (!r.ok || !d?.success) { setError(d?.message || 'Verwijderen mislukt'); return }
    onSaved(); onClose()
  }

  function set<K extends keyof Shift>(k: K, v: Shift[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <div 
      className="modal-overlay" 
      onClick={e => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div 
        className="modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h3 id="modal-title">{isNew ? 'Dienst toevoegen' : 'Dienst bewerken'}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Sluiten"><CloseIcon /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="employee">Medewerker</label>
                <input id="employee" className="form-control form-control-readonly" value={employeeName} readOnly title="Medewerker naam" />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="day_of_week">Dag</label>
                <select id="day_of_week" className="form-control" value={form.day_of_week} onChange={e => set('day_of_week', e.target.value as Shift['day_of_week'])} title="Selecteer dag">
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="shift_type">Type dienst</label>
                <select id="shift_type" className="form-control" value={form.shift_type} onChange={e => set('shift_type', e.target.value as Shift['shift_type'])} title="Selecteer type dienst">
                  {SHIFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="location">Locatie</label>
                <select id="location" className="form-control" value={form.location ?? ''} onChange={e => set('location', e.target.value as Location)} title="Selecteer locatie" required>
                  <option value="" disabled>Kies een locatie</option>
                  <option value="markt">Markt</option>
                  <option value="nootmagazijn">Magazijn</option>
                </select>
              </div>
            </div>

            <button
              id="shift_full"
              type="button"
              className={`full-day-toggle${fullDay ? ' active' : ''}`}
              aria-pressed={fullDay}
              onClick={() => set('full_day', fullDay ? 0 : 1)}
            >
              Hele dag
            </button>

            {!fullDay && (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="start_time">Begintijd</label>
                    <input id="start_time" type="time" className="form-control" value={form.start_time ?? ''} onChange={e => set('start_time', e.target.value)} title="Begintijd" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="end_time">Eindtijd</label>
                    <input id="end_time" type="time" className="form-control" value={form.end_time ?? ''} onChange={e => set('end_time', e.target.value)} title="Eindtijd" />
                  </div>
                </div>
                {/* AM-006: max duur waarschuwing + AM-004: pauze toggle */}
                {(() => {
                  const st = form.start_time, et = form.end_time
                  if (!st || !et) return null
                  const [sh, sm] = st.split(':').map(Number)
                  const [eh, em] = et.split(':').map(Number)
                  const durH = (eh * 60 + em - (sh * 60 + sm)) / 60
                  return (
                    <>
                      {durH > 15.5 && (
                        <div className="alert alert-danger" role="alert" style={{marginBottom: 0}}>
                          ⚠️ Maximale shiftduur is 15,5 uur (huidige duur: {durH.toFixed(1)} uur)
                        </div>
                      )}
                      {durH > 0 && (
                        <label htmlFor="shift_break" className="form-checkbox-label break-toggle">
                          <input
                            id="shift_break"
                            type="checkbox"
                            checked={(form.break_minutes ?? 0) >= 60}
                            onChange={e => set('break_minutes', e.target.checked ? 60 : 0)}
                            title="Trek 1 uur pauze af van de totaaltijd"
                          />
                          <span>－ 1 uur pauze</span>
                          {(form.break_minutes ?? 0) >= 60 && (
                            <span className="break-badge">netto {Math.max(0, durH - 1).toFixed(1)} uur</span>
                          )}
                        </label>
                      )}
                    </>
                  )
                })()}
              </>
            )}

            <div className="form-grid category-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="shift_category">Categorie</label>
                <select id="shift_category" className="form-control" value={form.shift_category ?? 'regular'} onChange={e => set('shift_category', e.target.value as Shift['shift_category'])} title="Selecteer categorie">
                  <option value="regular">Regulier</option>
                  <option value="extra">Extra werk</option>
                  <option value="overtime">Overwerk</option>
                  <option value="special">Bijzondere uitvraag</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="note">Notitie (zichtbaar voor medewerker)</label>
              <textarea id="note" className="form-control" rows={2} value={form.note ?? ''} onChange={e => set('note', e.target.value)} placeholder="Optionele opmerking" title="Notitie" />
            </div>

            {/* AM-002: admin-only notitie, nooit getoond aan medewerkers */}
            {isAdmin && (
              <div className="form-group">
                <label className="form-label" htmlFor="admin_note">
                  🔒 Admin-opmerking <span className="label-hint">(alleen zichtbaar voor admin/manager)</span>
                </label>
                <textarea id="admin_note" className="form-control admin-note-field" rows={2} value={form.admin_note ?? ''} onChange={e => set('admin_note', e.target.value)} placeholder="Interne opmerking voor beheerders…" title="Admin-opmerking" />
              </div>
            )}

            {isNew && (
              <label htmlFor="shift_open" className="form-checkbox-label">
                <input id="shift_open" type="checkbox" checked={Boolean(form.is_open)} onChange={e => set('is_open', e.target.checked ? 1 : 0)} title="Markeer als open dienst" />
                Open dienst (nog te vervullen)
              </label>
            )}
          </div>

          <div className="modal-footer shift-modal-footer">
            {!isNew && isAdmin && (
              <button type="button" className="btn btn-danger btn-sm" onClick={archive} disabled={saving || deleting}>
                {deleting ? <Spinner /> : 'Dienst verwijderen'}
              </button>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || deleting}>
              {saving ? <Spinner /> : isNew ? 'Toevoegen' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
      <style jsx>{`
        .full-day-toggle {
          min-height: 44px;
          margin-bottom: var(--s4);
          padding: 0 var(--s4);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          color: var(--text);
          font-size: .9375rem;
          font-weight: 600;
          transition: background .15s, border-color .15s, color .15s, box-shadow .15s;
        }
        .full-day-toggle:hover { border-color: var(--brand); }
        .full-day-toggle:focus-visible { outline: 3px solid rgba(200,136,42,.25); outline-offset: 2px; }
        .full-day-toggle.active {
          border-color: var(--brand);
          background: var(--brand);
          color: #fff;
          box-shadow: 0 2px 8px rgba(123,79,46,.2);
        }
        .category-grid { grid-template-columns: minmax(0, 1fr); }
        .shift-modal-footer :global(.btn-danger) { margin-right: auto; }
        @media (max-width: 480px) {
          .shift-modal-footer { flex-wrap: wrap; }
          .shift-modal-footer :global(.btn-danger) {
            width: 100%;
            margin-right: 0;
          }
        }
      `}</style>
    </div>
  )
}
