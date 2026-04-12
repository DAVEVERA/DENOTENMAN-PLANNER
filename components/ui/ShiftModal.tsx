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
  onClose: () => void
  onSaved: () => void
}

export default function ShiftModal({ shift, employeeId, employeeName, day, week, year, location, onClose, onSaved }: Props) {
  const isNew = !shift?.id
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
    buddy:          shift?.buddy          ?? '',
    location:       shift?.location       ?? location,
    shift_category: shift?.shift_category ?? 'regular',
    is_open:        shift?.is_open        ?? 0,
    ...shift,
  })
  const [saving, setSaving] = useState(false)
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
    setSaving(true); setError('')
    const url    = isNew ? '/api/shifts' : `/api/shifts/${shift!.id}`
    const method = isNew ? 'POST' : 'PUT'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    setSaving(false)
    if (!d.success) { setError(d.message || 'Opslaan mislukt'); return }
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
                <label className="form-label" htmlFor="location">Locatie</label>
                <select id="location" className="form-control" value={form.location} onChange={e => set('location', e.target.value as Location)} title="Selecteer locatie">
                  <option value="markt">De Notenkar (Markt)</option>
                  <option value="nootmagazijn">Het Nootmagazijn</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="shift_full" className="form-checkbox-label">
                <input id="shift_full" type="checkbox" checked={fullDay} onChange={e => set('full_day', e.target.checked ? 1 : 0)} title="Hele dag dienst" />
                Hele dag
              </label>
            </div>

            {!fullDay && (
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
            )}

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="shift_category">Categorie</label>
                <select id="shift_category" className="form-control" value={form.shift_category ?? 'regular'} onChange={e => set('shift_category', e.target.value as Shift['shift_category'])} title="Selecteer categorie">
                  <option value="regular">Regulier</option>
                  <option value="extra">Extra werk</option>
                  <option value="overtime">Overwerk</option>
                  <option value="special">Bijzondere uitvraag</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="buddy">Buddy</label>
                <input id="buddy" className="form-control" placeholder="Naam collega" value={form.buddy ?? ''} onChange={e => set('buddy', e.target.value)} title="Buddy naam" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="note">Notitie</label>
              <textarea id="note" className="form-control" rows={2} value={form.note ?? ''} onChange={e => set('note', e.target.value)} placeholder="Optionele opmerking" title="Notitie" />
            </div>

            {isNew && (
              <label htmlFor="shift_open" className="form-checkbox-label">
                <input id="shift_open" type="checkbox" checked={Boolean(form.is_open)} onChange={e => set('is_open', e.target.checked ? 1 : 0)} title="Markeer als open dienst" />
                Open dienst (nog te vervullen)
              </label>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? <Spinner /> : isNew ? 'Toevoegen' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
