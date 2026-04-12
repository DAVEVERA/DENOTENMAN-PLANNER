import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import LocationBadge from '@/components/ui/LocationBadge'
import { CloseIcon } from '@/components/ui/Icons'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, TimeLog, Employee, Location } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

function calcHours(clockIn: string | null, clockOut: string | null, brk: number) {
  if (!clockIn || !clockOut) return 0
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.max(0, (oh * 60 + om - (ih * 60 + im) - brk) / 60)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 8) + '01'

export default function HoursPage({ user }: Props) {
  const [logs, setLogs]         = useState<TimeLog[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [from, setFrom]         = useState(firstOfMonth)
  const [to, setTo]             = useState(today)
  const [empFilter, setEmpFilter] = useState('')
  const [locFilter, setLocFilter] = useState<Location | ''>('')
  const [processed, setProcessed] = useState<'' | '0' | '1'>('0')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adding, setAdding]     = useState(false)
  const [newForm, setNewForm]   = useState({
    employee_id: '', employee_name: '', log_date: today,
    location: 'markt' as Location,
    clock_in: '', clock_out: '', break_minutes: 0, overtime_hours: 0, note: '',
  })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<TimeLog>>({})
  const [filtersOpen, setFiltersOpen] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [lRes, eRes] = await Promise.all([
      fetch(`/api/hours?from=${from}&to=${to}${empFilter ? `&employee_id=${empFilter}` : ''}${locFilter ? `&location=${locFilter}` : ''}${processed !== '' ? `&is_processed=${processed}` : ''}`),
      fetch('/api/employees?all=1'),
    ])
    const [lData, eData] = await Promise.all([lRes.json(), eRes.json()])
    setLogs(lData.success ? lData.data : [])
    setEmployees(eData.success ? eData.data : [])
    setLoading(false)
  }, [from, to, empFilter, locFilter, processed])

  useEffect(() => { loadAll() }, [loadAll])

  function toggleSelect(id: number) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAll() {
    if (selected.size === logs.length) setSelected(new Set())
    else setSelected(new Set(logs.map(l => l.id)))
  }

  async function markProcessed() {
    if (!selected.size || !confirm(`${selected.size} log(s) als verwerkt markeren?`)) return
    await fetch('/api/hours/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setSelected(new Set())
    loadAll()
  }

  async function addLog(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const emp = employees.find(emp => emp.id === parseInt(newForm.employee_id))
    const r = await fetch('/api/hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        employee_id: parseInt(newForm.employee_id),
        employee_name: emp?.name ?? newForm.employee_name,
        break_minutes: parseInt(String(newForm.break_minutes)) || 0,
        overtime_hours: parseFloat(String(newForm.overtime_hours)) || 0,
      }),
    })
    setSaving(false)
    if ((await r.json()).success) {
      setAdding(false)
      setNewForm({ employee_id: '', employee_name: '', log_date: today, location: 'markt', clock_in: '', clock_out: '', break_minutes: 0, overtime_hours: 0, note: '' })
      loadAll()
    }
  }

  async function saveEdit(id: number) {
    await fetch(`/api/hours/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditId(null)
    loadAll()
  }

  async function deleteLog(id: number) {
    if (!confirm('Verwijderen?')) return
    await fetch(`/api/hours/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const totalHours = logs.reduce((acc, l) => acc + calcHours(l.clock_in, l.clock_out, l.break_minutes), 0)
  const unprocessed = logs.filter(l => !l.is_processed).length

  return (
    <AdminLayout user={user} title="Urenregistratie">
      {/* ── Filters ── */}
      <div className="hours-controls">
        <div className="filters-row">
          <div className="date-range">
            <label htmlFor="filter_from" className="sr-only">Vanaf datum</label>
            <input id="filter_from" type="date" className="form-control form-control-sm" value={from} onChange={e => setFrom(e.target.value)} title="Vanaf datum" />
            <span className="range-sep">–</span>
            <label htmlFor="filter_to" className="sr-only">Tot datum</label>
            <input id="filter_to" type="date" className="form-control form-control-sm" value={to} onChange={e => setTo(e.target.value)} title="Tot datum" />
          </div>
          <button
            className="btn btn-outline btn-sm filters-toggle"
            onClick={() => setFiltersOpen(v => !v)}
            aria-expanded={filtersOpen}
          >
            {filtersOpen ? 'Minder filters' : 'Meer filters'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Uren</button>
        </div>

        <div className={`extra-filters${filtersOpen ? ' open' : ''}`}>
          <div className="form-group-filter">
            <label htmlFor="filter_emp" className="sr-only">Medewerker filter</label>
            <select id="filter_emp" className="form-control form-control-sm" value={empFilter} onChange={e => setEmpFilter(e.target.value)} title="Filter op medewerker">
              <option value="">Alle medewerkers</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group-filter">
            <label htmlFor="filter_loc" className="sr-only">Locatie filter</label>
            <select id="filter_loc" className="form-control form-control-sm" value={locFilter} onChange={e => setLocFilter(e.target.value as Location | '')} title="Filter op locatie">
              <option value="">Alle locaties</option>
              <option value="markt">Markt</option>
              <option value="nootmagazijn">Nootmagazijn</option>
            </select>
          </div>
          <div className="form-group-filter">
            <label htmlFor="filter_proc" className="sr-only">Status filter</label>
            <select id="filter_proc" className="form-control form-control-sm" value={processed} onChange={e => setProcessed(e.target.value as any)} title="Filter op status">
              <option value="">Alle</option>
              <option value="0">Onverwerkt</option>
              <option value="1">Verwerkt</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-val">{logs.length}</span>
          <span className="summary-label">registraties</span>
        </div>
        <div className="summary-item">
          <span className="summary-val">{totalHours.toFixed(1)}u</span>
          <span className="summary-label">totaal gewerkt</span>
        </div>
        {unprocessed > 0 && (
          <div className="summary-item warn">
            <span className="summary-val">{unprocessed}</span>
            <span className="summary-label">onverwerkt</span>
          </div>
        )}
        {selected.size > 0 && (
          <button className="btn btn-primary btn-sm ml-auto" onClick={markProcessed}>
            {selected.size} verwerken
          </button>
        )}
      </div>

      {/* ── Add form ── */}
      {adding && (
        <div className="add-card">
          <h4 className="add-card-title">Uren registreren</h4>
          <form onSubmit={addLog}>
            <div className="form-grid-4">
              <div className="form-group">
                <label htmlFor="new_emp" className="form-label required">Medewerker</label>
                <select id="new_emp" className="form-control" value={newForm.employee_id} onChange={e => setNewForm(f => ({ ...f, employee_id: e.target.value }))} required title="Selecteer medewerker">
                  <option value="">Selecteer…</option>
                  {employees.filter(e => e.is_active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="new_date" className="form-label required">Datum</label>
                <input id="new_date" type="date" className="form-control" value={newForm.log_date} onChange={e => setNewForm(f => ({ ...f, log_date: e.target.value }))} required title="Datum van de dienst" />
              </div>
              <div className="form-group">
                <label htmlFor="new_loc" className="form-label">Locatie</label>
                <select id="new_loc" className="form-control" value={newForm.location} onChange={e => setNewForm(f => ({ ...f, location: e.target.value as Location }))} title="Locatie van de dienst">
                  <option value="markt">Markt</option>
                  <option value="nootmagazijn">Nootmagazijn</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="new_in" className="form-label">Inklok</label>
                <input id="new_in" type="time" className="form-control" value={newForm.clock_in} onChange={e => setNewForm(f => ({ ...f, clock_in: e.target.value }))} title="Begintijd" />
              </div>
              <div className="form-group">
                <label htmlFor="new_out" className="form-label">Uitklok</label>
                <input id="new_out" type="time" className="form-control" value={newForm.clock_out} onChange={e => setNewForm(f => ({ ...f, clock_out: e.target.value }))} title="Eindtijd" />
              </div>
              <div className="form-group">
                <label htmlFor="new_br" className="form-label">Pauze (min)</label>
                <input id="new_br" type="number" className="form-control" value={newForm.break_minutes} onChange={e => setNewForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))} min={0} title="Pauze in minuten" />
              </div>
              <div className="form-group">
                <label htmlFor="new_ov" className="form-label">Overwerk (u)</label>
                <input id="new_ov" type="number" step="0.5" className="form-control" value={newForm.overtime_hours} onChange={e => setNewForm(f => ({ ...f, overtime_hours: parseFloat(e.target.value) || 0 }))} min={0} title="Overuren in uren" />
              </div>
              <div className="form-group">
                <label htmlFor="new_note" className="form-label">Notitie</label>
                <input id="new_note" className="form-control" value={newForm.note} onChange={e => setNewForm(f => ({ ...f, note: e.target.value }))} title="Optionele notitie" />
              </div>
            </div>
            <div className="add-card-footer">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(false)}>Annuleren</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <Spinner /> : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Desktop Table ── */}
      {loading ? (
        <div className="loading-row"><Spinner /> Laden…</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="table-wrap desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <label htmlFor="select_all" className="sr-only">Alle selecteren</label>
                    <input id="select_all" type="checkbox" checked={selected.size === logs.length && logs.length > 0} onChange={selectAll} title="Alle regels selecteren" />
                  </th>
                  <th>Datum</th>
                  <th>Medewerker</th>
                  <th>Locatie</th>
                  <th>Inklok</th>
                  <th>Uitklok</th>
                  <th>Pauze</th>
                  <th>Gewerkt</th>
                  <th>Overwerk</th>
                  <th>Notitie</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className={log.is_processed ? 'processed' : ''}>
                    <td>
                      <label htmlFor={`sel_${log.id}`} className="sr-only">Regel {log.id} selecteren</label>
                      <input id={`sel_${log.id}`} type="checkbox" checked={selected.has(log.id)} onChange={() => toggleSelect(log.id)} title="Deze regel selecteren" />
                    </td>
                    {editId === log.id ? (
                      <>
                        <td><input aria-label="Wijzig datum" type="date" className="form-control form-control-xs" value={editForm.log_date ?? ''} onChange={e => setEditForm(f => ({ ...f, log_date: e.target.value }))} /></td>
                        <td className="text-sub">{log.employee_name}</td>
                        <td>
                          <select aria-label="Wijzig locatie" className="form-control form-control-xs" value={editForm.location ?? 'markt'} onChange={e => setEditForm(f => ({ ...f, location: e.target.value as Location }))}>
                            <option value="markt">Markt</option>
                            <option value="nootmagazijn">Nootmagazijn</option>
                          </select>
                        </td>
                        <td><input aria-label="Wijzig inkloktijd" type="time" className="form-control form-control-xs" value={editForm.clock_in ?? ''} onChange={e => setEditForm(f => ({ ...f, clock_in: e.target.value }))} /></td>
                        <td><input aria-label="Wijzig uitkloktijd" type="time" className="form-control form-control-xs" value={editForm.clock_out ?? ''} onChange={e => setEditForm(f => ({ ...f, clock_out: e.target.value }))} /></td>
                        <td><input aria-label="Wijzig pauze" type="number" className="form-control form-control-xs" value={editForm.break_minutes ?? 0} onChange={e => setEditForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))} /></td>
                        <td className="text-sub">{calcHours(editForm.clock_in ?? null, editForm.clock_out ?? null, editForm.break_minutes ?? 0).toFixed(1)}u</td>
                        <td><input aria-label="Wijzig overwerk" type="number" step="0.5" className="form-control form-control-xs" value={editForm.overtime_hours ?? 0} onChange={e => setEditForm(f => ({ ...f, overtime_hours: parseFloat(e.target.value) || 0 }))} /></td>
                        <td><input aria-label="Wijzig notitie" className="form-control form-control-xs" value={editForm.note ?? ''} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} /></td>
                        <td></td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-primary btn-xs" onClick={() => saveEdit(log.id)} title="Opslaan">✓</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)} title="Annuleren"><CloseIcon size={14} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{fmtDate(log.log_date)}</td>
                        <td className="fw-500">{log.employee_name}</td>
                        <td><LocationBadge location={log.location} size="xs" /></td>
                        <td className="text-sub">{log.clock_in?.slice(0,5) ?? '–'}</td>
                        <td className="text-sub">{log.clock_out?.slice(0,5) ?? '–'}</td>
                        <td className="text-sub">{log.break_minutes}m</td>
                        <td className="fw-500">{calcHours(log.clock_in, log.clock_out, log.break_minutes).toFixed(1)}u</td>
                        <td className="text-sub">{log.overtime_hours > 0 ? `+${log.overtime_hours}u` : '–'}</td>
                        <td className="text-muted text-sm">{log.note ?? ''}</td>
                        <td>
                          <span className={`badge badge-pill ${log.is_processed ? 'badge-approved' : 'badge-warning'}`}>
                            {log.is_processed ? 'Verwerkt' : 'Open'}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-ghost btn-xs" onClick={() => { setEditId(log.id); setEditForm(log) }} title="Bewerken">✏</button>
                            <button className="btn btn-ghost btn-xs text-danger" onClick={() => deleteLog(log.id)} title="Verwijderen">🗑</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={12} className="empty-row">Geen urenregistraties gevonden.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="mobile-only">
            {logs.length === 0 ? (
              <div className="empty-state-mobile">Geen urenregistraties gevonden.</div>
            ) : (
              <div className="log-cards">
                {logs.map(log => {
                  const hours = calcHours(log.clock_in, log.clock_out, log.break_minutes)
                  const isEditing = editId === log.id
                  return (
                    <div key={log.id} className={`log-card${log.is_processed ? ' processed' : ''}`}>
                      {isEditing ? (
                        <div className="log-card-edit">
                          <div className="edit-grid">
                            <div className="form-group">
                              <label className="form-label">Datum</label>
                              <input type="date" className="form-control" value={editForm.log_date ?? ''} onChange={e => setEditForm(f => ({ ...f, log_date: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Locatie</label>
                              <select className="form-control" value={editForm.location ?? 'markt'} onChange={e => setEditForm(f => ({ ...f, location: e.target.value as Location }))}>
                                <option value="markt">Markt</option>
                                <option value="nootmagazijn">Nootmagazijn</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Inklok</label>
                              <input type="time" className="form-control" value={editForm.clock_in ?? ''} onChange={e => setEditForm(f => ({ ...f, clock_in: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Uitklok</label>
                              <input type="time" className="form-control" value={editForm.clock_out ?? ''} onChange={e => setEditForm(f => ({ ...f, clock_out: e.target.value }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Pauze (min)</label>
                              <input type="number" className="form-control" value={editForm.break_minutes ?? 0} onChange={e => setEditForm(f => ({ ...f, break_minutes: parseInt(e.target.value) || 0 }))} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Notitie</label>
                              <input className="form-control" value={editForm.note ?? ''} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} />
                            </div>
                          </div>
                          <div className="edit-actions">
                            <button className="btn btn-outline btn-sm" onClick={() => setEditId(null)}>Annuleren</button>
                            <button className="btn btn-primary btn-sm" onClick={() => saveEdit(log.id)}>Opslaan</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="log-card-header">
                            <div className="log-card-name">{log.employee_name}</div>
                            <div className="log-card-actions">
                              <button className="btn btn-ghost btn-xs" onClick={() => { setEditId(log.id); setEditForm(log) }} title="Bewerken">✏</button>
                              <button className="btn btn-ghost btn-xs text-danger" onClick={() => deleteLog(log.id)} title="Verwijderen">🗑</button>
                            </div>
                          </div>
                          <div className="log-card-body">
                            <div className="log-card-date">{fmtDate(log.log_date)}</div>
                            <div className="log-card-times">
                              {log.clock_in ? `${log.clock_in.slice(0,5)} – ${log.clock_out?.slice(0,5) ?? '?'}` : 'Geen tijden'}
                              {log.break_minutes > 0 && <span className="log-card-break"> · pauze {log.break_minutes}m</span>}
                            </div>
                            <div className="log-card-hours">{hours > 0 ? `${hours.toFixed(1)}u` : '–'}</div>
                          </div>
                          <div className="log-card-footer">
                            <LocationBadge location={log.location} size="xs" />
                            {log.overtime_hours > 0 && <span className="log-card-ot">+{log.overtime_hours}u overwerk</span>}
                            <span className={`badge badge-pill ml-auto ${log.is_processed ? 'badge-approved' : 'badge-warning'}`}>
                              {log.is_processed ? 'Verwerkt' : 'Open'}
                            </span>
                          </div>
                          {log.note && <div className="log-card-note">{log.note}</div>}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        /* ── Controls ── */
        .hours-controls { margin-bottom: var(--s4); }
        .filters-row {
          display: flex; align-items: center; flex-wrap: wrap; gap: var(--s2);
          margin-bottom: var(--s2);
        }
        .date-range { display: flex; align-items: center; gap: 6px; }
        .range-sep { color: var(--text-muted); font-size: .875rem; }
        .filters-toggle { display: none; }

        .extra-filters {
          display: flex; flex-wrap: wrap; gap: var(--s2);
        }
        .form-group-filter { display: flex; }

        /* ── Summary ── */
        .summary-bar {
          display: flex; align-items: center; gap: var(--s5); flex-wrap: wrap;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s3) var(--s5);
          margin-bottom: var(--s4);
        }
        .summary-item { display: flex; flex-direction: column; gap: 1px; }
        .summary-item.warn .summary-val { color: var(--danger); }
        .summary-val { font-size: 1.25rem; font-weight: 700; line-height: 1; }
        .summary-label { font-size: .75rem; color: var(--text-muted); }
        .ml-auto { margin-left: auto; }

        /* ── Add card ── */
        .add-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
          margin-bottom: var(--s4);
        }
        .add-card-title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--s4); }
        .form-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s3); }
        .add-card-footer { display: flex; gap: var(--s2); justify-content: flex-end; margin-top: var(--s4); }

        /* ── Desktop table ── */
        .table-wrap {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow-x: auto;
        }
        .data-table { width: 100%; border-collapse: collapse; min-width: 900px; }
        .data-table thead th {
          background: var(--surface-alt); padding: var(--s2) var(--s3);
          font-size: .8125rem; font-weight: 600; color: var(--text-sub);
          text-align: left; border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .data-table tbody tr { border-bottom: 1px solid var(--border); }
        .data-table tbody tr.processed { opacity: .6; }
        .data-table tbody tr:last-child { border-bottom: none; }
        .data-table td { padding: var(--s2) var(--s3); font-size: .875rem; vertical-align: middle; }
        .row-actions { display: flex; gap: 4px; }
        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-row { text-align: center; color: var(--text-muted); padding: var(--s8); }

        /* ── Mobile card list ── */
        .mobile-only { display: none; }
        .desktop-only { display: block; }
        .empty-state-mobile { text-align: center; padding: var(--s8); color: var(--text-muted); }

        .log-cards { display: flex; flex-direction: column; gap: var(--s2); }
        .log-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .log-card.processed { opacity: .65; }
        .log-card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--s3) var(--s4) 0;
        }
        .log-card-name { font-weight: 600; font-size: .9375rem; }
        .log-card-actions { display: flex; gap: 4px; }
        .log-card-body {
          display: flex; align-items: center; gap: var(--s3);
          padding: var(--s2) var(--s4);
          flex-wrap: wrap;
        }
        .log-card-date { font-size: .875rem; color: var(--text-sub); }
        .log-card-times { font-size: .875rem; font-weight: 500; }
        .log-card-break { color: var(--text-muted); font-size: .8125rem; }
        .log-card-hours { font-size: 1.125rem; font-weight: 700; color: var(--brand); margin-left: auto; }
        .log-card-footer {
          display: flex; align-items: center; gap: var(--s2); flex-wrap: wrap;
          padding: var(--s2) var(--s4) var(--s3);
          border-top: 1px solid var(--border);
        }
        .log-card-ot { font-size: .8125rem; color: var(--brand); }
        .log-card-note { font-size: .8125rem; color: var(--text-muted); font-style: italic; padding: 0 var(--s4) var(--s3); }
        .log-card-edit { padding: var(--s4); }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); margin-bottom: var(--s3); }
        .edit-actions { display: flex; gap: var(--s2); justify-content: flex-end; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .filters-toggle { display: inline-flex; }
          .extra-filters { display: none; }
          .extra-filters.open { display: flex; flex-direction: column; gap: var(--s2); padding-top: var(--s2); }
          .form-group-filter { width: 100%; }
          .form-group-filter select { width: 100%; }
          .form-grid-4 { grid-template-columns: 1fr 1fr; }
          .desktop-only { display: none !important; }
          .mobile-only { display: block; }
          .summary-bar { gap: var(--s4); }
        }

        @media (max-width: 480px) {
          .filters-row { flex-direction: column; align-items: stretch; }
          .date-range { justify-content: stretch; }
          .date-range input { flex: 1; }
          .form-grid-4 { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
