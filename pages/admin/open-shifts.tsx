import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Employee, Location, Day, ShiftType } from '@/types'
import { DAYS, DAY_SHORT, SHIFT_TYPES, WORK_TYPES } from '@/types'
import Spinner from '@/components/ui/Spinner'

type Tab = 'open' | 'offered'

interface Props { user: SessionUser }

const LOCATION_LABELS = { markt: 'De Notenkar', nootmagazijn: 'Nootmagazijn' }
const DAY_NL: Record<Day, string> = {
  maandag: 'Maandag', dinsdag: 'Dinsdag', woensdag: 'Woensdag',
  donderdag: 'Donderdag', vrijdag: 'Vrijdag', zaterdag: 'Zaterdag', zondag: 'Zondag',
}



interface NewShiftForm {
  day_of_week: Day
  week_number: number
  year: number
  shift_type: ShiftType
  start_time: string
  end_time: string
  location: Exclude<Location, 'both'>
  note: string
}

function currentWeek() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return { week: Math.ceil((((d.getTime() - y.getTime()) / 86400000) + 1) / 7), year: now.getFullYear() }
}

function shiftLabel(s: Shift) {
  const time = s.start_time ? `${s.start_time.slice(0,5)}–${s.end_time?.slice(0,5)}` : ''
  return `${DAY_NL[s.day_of_week] ?? s.day_of_week}, week ${s.week_number} · ${s.shift_type}${time ? ' · ' + time : ''}`
}

export default function OpenShiftsAdminPage({ user }: Props) {
  const [tab, setTab]           = useState<Tab>('open')
  const [openShifts, setOpenShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [editShift, setEditShift] = useState<Shift | null>(null)
  const { week: cw, year: cy } = currentWeek()

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const [form, setForm] = useState<NewShiftForm>({
    day_of_week:  'maandag',
    week_number:  cw,
    year:         cy,
    shift_type:   'Ochtend',
    start_time:   '',
    end_time:     '',
    location:     'markt',
    note:         '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [sr, er] = await Promise.all([
      fetch('/api/shifts/open').then(r => r.json()),
      fetch('/api/employees?all=1').then(r => r.json()),
    ])
    setOpenShifts(sr.success ? sr.data : [])
    setEmployees(er.success ? er.data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Admin-created open shifts (no employee_id)
  const adminOpen = openShifts.filter(s => !s.employee_id || s.employee_id === null)
  // Employee-offered shifts (has employee_id, is_open=1)
  const offered   = openShifts.filter(s => s.employee_id !== null && s.is_open === 1)

  const pendingCount = openShifts.filter(s => s.open_invite_status === 'pending').length

  async function createOpenShift(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch('/api/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          employee_id:   null,
          employee_name: 'Open dienst',
          full_day:      0,
          is_open:       1,
        }),
      }).then(r => r.json())
      if (!r.success) {
        showToast('❌ ' + (r.message ?? 'Fout bij aanmaken'), false)
        setSaving(false)
        return
      }
      showToast('✅ Open dienst geplaatst!')
      setShowCreate(false)
      setForm({ day_of_week: 'maandag', week_number: cw, year: cy, shift_type: 'Ochtend', start_time: '', end_time: '', location: 'markt', note: '' })
      load()
    } catch (err: any) {
      showToast('❌ Netwerkfout: ' + (err.message ?? 'Probeer opnieuw'), false)
    }
    setSaving(false)
  }

  async function editOpenShift(e: React.FormEvent) {
    e.preventDefault()
    if (!editShift) return
    setSaving(true)
    try {
      const r = await fetch('/api/shifts/open', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: editShift.id,
          day_of_week: form.day_of_week,
          week_number: form.week_number,
          year: form.year,
          shift_type: form.shift_type,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          location: form.location,
          note: form.note || null,
        }),
      }).then(r => r.json())
      if (!r.success) {
        showToast('❌ ' + (r.message ?? 'Fout bij wijzigen'), false)
        setSaving(false)
        return
      }
      showToast('✅ Open dienst gewijzigd!')
      setEditShift(null)
      load()
    } catch (err: any) {
      showToast('❌ Netwerkfout: ' + (err.message ?? 'Probeer opnieuw'), false)
    }
    setSaving(false)
  }

  async function withdrawShift(shiftId: number) {
    if (!confirm('Open dienst intrekken?')) return
    setActionId(shiftId)
    try {
      const r = await fetch('/api/shifts/open', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId }),
      }).then(r => r.json())
      if (r.success) {
        showToast('✅ Dienst ingetrokken')
      } else {
        showToast('❌ ' + (r.message ?? 'Fout bij intrekken'), false)
      }
    } catch { showToast('❌ Netwerkfout', false) }
    setActionId(null)
    load()
  }

  function openEditModal(shift: Shift) {
    setForm({
      day_of_week: shift.day_of_week,
      week_number: shift.week_number,
      year: shift.year,
      shift_type: shift.shift_type,
      start_time: shift.start_time?.slice(0, 5) ?? '',
      end_time: shift.end_time?.slice(0, 5) ?? '',
      location: (shift.location === 'both' ? 'markt' : shift.location) as Exclude<Location, 'both'>,
      note: shift.note ?? '',
    })
    setEditShift(shift)
  }

  async function approve(shiftId: number, approved: boolean) {
    setActionId(shiftId)
    try {
      const r = await fetch('/api/shifts/approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, approved }),
      }).then(r => r.json())
      if (r.success) {
        showToast(approved ? '✅ Claim goedgekeurd' : '❌ Claim afgewezen')
      } else {
        showToast('❌ ' + (r.message ?? 'Fout bij verwerken'), false)
      }
    } catch { showToast('❌ Netwerkfout', false) }
    setActionId(null)
    load()
  }

  async function deleteShift(shiftId: number) {
    if (!confirm('Open dienst verwijderen?')) return
    setActionId(shiftId)
    try {
      await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
      showToast('✅ Dienst verwijderd')
    } catch { showToast('❌ Fout bij verwijderen', false) }
    setActionId(null)
    load()
  }

  async function inviteEmployee(shiftId: number, empId: number) {
    await fetch('/api/shifts/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId, employee_id: empId }),
    })
    load()
  }

  function empName(id: number | null) {
    if (!id) return '–'
    return employees.find(e => e.id === id)?.name ?? `#${id}`
  }

  const displayList = tab === 'open' ? adminOpen : offered

  return (
    <AdminLayout user={user} title="Open diensten">

      {/* ── Toast ── */}
      {toast && (
        <div className={`os-toast ${toast.ok ? '' : 'os-toast-err'}`} role="alert">{toast.msg}</div>
      )}

      {/* ── Header ── */}
      <div className="os-header">
        <div className="os-title-row">
          <div>
            <h1 className="os-h1">Open diensten</h1>
            <p className="os-sub">Beheer open diensten en aangeboden diensten van medewerkers.</p>
          </div>
          <button className="btn btn-primary" onClick={() => {
            setForm({ day_of_week: 'maandag', week_number: cw, year: cy, shift_type: 'Ochtend', start_time: '', end_time: '', location: 'markt', note: '' })
            setShowCreate(true)
          }}>
            + Nieuwe open dienst
          </button>
        </div>

        {/* Tabs */}
        <div className="os-tabs" role="tablist">
          {([['open', 'Open diensten', adminOpen.length], ['offered', 'Aangeboden', offered.length]] as const).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              className={`os-tab${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
              aria-selected={tab === key}
            >
              {label}
              {count > 0 && (
                <span className={`os-tab-badge${pendingCount > 0 && key === tab ? ' urgent' : ''}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Nieuwe open dienst">
            <div className="modal-head">
              <h2 className="modal-title">Nieuwe open dienst plaatsen</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)} aria-label="Sluiten">✕</button>
            </div>
            <form onSubmit={createOpenShift} className="modal-body">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Week</label>
                  <input type="number" className="form-control" min={1} max={53}
                    title="Weeknummer (1–53)" placeholder="Week"
                    value={form.week_number} onChange={e => setForm(f => ({ ...f, week_number: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Jaar</label>
                  <input type="number" className="form-control" min={2024} max={2030}
                    title="Jaar" placeholder="Jaar"
                    value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Dag</label>
                  <select className="form-control" title="Dag van de week"
                    value={form.day_of_week}
                    onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value as Day }))}>
                    {DAYS.map(d => <option key={d} value={d}>{DAY_NL[d]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Type dienst</label>
                  <select className="form-control" title="Type dienst"
                    value={form.shift_type}
                    onChange={e => setForm(f => ({ ...f, shift_type: e.target.value as ShiftType }))}>
                    {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Starttijd</label>
                  <input type="time" className="form-control" title="Starttijd"
                    value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Eindtijd</label>
                  <input type="time" className="form-control" title="Eindtijd"
                    value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Locatie</label>
                <div className="loc-toggle">
                  {(['markt', 'nootmagazijn'] as const).map(loc => (
                    <button type="button" key={loc}
                      className={`loc-btn ${form.location === loc ? 'active-' + loc : ''}`}
                      onClick={() => setForm(f => ({ ...f, location: loc }))}>
                      {LOCATION_LABELS[loc]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notitie (optioneel)</label>
                <textarea className="form-control" rows={2} placeholder="Extra info voor de medewerker…"
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Annuleren</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Spinner /> : '📢 Plaatsen & melden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editShift && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditShift(null)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Open dienst bewerken">
            <div className="modal-head">
              <h2 className="modal-title">Open dienst bewerken</h2>
              <button className="modal-close" onClick={() => setEditShift(null)} aria-label="Sluiten">✕</button>
            </div>
            <form onSubmit={editOpenShift} className="modal-body">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Week</label>
                  <input type="number" className="form-control" min={1} max={53}
                    title="Weeknummer" placeholder="Week"
                    value={form.week_number} onChange={e => setForm(f => ({ ...f, week_number: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Jaar</label>
                  <input type="number" className="form-control" min={2024} max={2030}
                    title="Jaar" placeholder="Jaar"
                    value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Dag</label>
                  <select className="form-control" title="Dag van de week"
                    value={form.day_of_week}
                    onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value as Day }))}>
                    {DAYS.map(d => <option key={d} value={d}>{DAY_NL[d]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Type dienst</label>
                  <select className="form-control" title="Type dienst"
                    value={form.shift_type}
                    onChange={e => setForm(f => ({ ...f, shift_type: e.target.value as ShiftType }))}>
                    {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Starttijd</label>
                  <input type="time" className="form-control" title="Starttijd"
                    value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Eindtijd</label>
                  <input type="time" className="form-control" title="Eindtijd"
                    value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Locatie</label>
                <div className="loc-toggle">
                  {(['markt', 'nootmagazijn'] as const).map(loc => (
                    <button type="button" key={loc}
                      className={`loc-btn ${form.location === loc ? 'active-' + loc : ''}`}
                      onClick={() => setForm(f => ({ ...f, location: loc }))}>
                      {LOCATION_LABELS[loc]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notitie (optioneel)</label>
                <textarea className="form-control" rows={2} placeholder="Extra info…"
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditShift(null)}>Annuleren</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Spinner /> : '💾 Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="os-loading"><Spinner /> Laden…</div>
      ) : displayList.length === 0 ? (
        <div className="os-empty">
          <div className="os-empty-icon">{tab === 'open' ? '📋' : '🔄'}</div>
          <div className="os-empty-title">
            {tab === 'open' ? 'Geen open diensten' : 'Geen aangeboden diensten'}
          </div>
          <div className="os-empty-sub">
            {tab === 'open'
              ? 'Klik op "+ Nieuwe open dienst" om een beschikbare dienst te plaatsen.'
              : 'Medewerkers kunnen hun diensten aanbieden via hun rooster.'}
          </div>
        </div>
      ) : (
        <div className="os-list">
          {displayList.map(shift => {
            const hasClaim    = !!shift.open_invite_emp_id
            const isPending   = shift.open_invite_status === 'pending'
            const claimer     = empName(shift.open_invite_emp_id)
            const isActioning = actionId === shift.id

            return (
              <div key={shift.id} className={`os-card${isPending ? ' has-claim' : ''}`}>
                {/* Left: shift info */}
                <div className="os-card-info">
                  <div className="os-card-top">
                    <span className={`os-badge loc-${shift.location}`}>
                      {LOCATION_LABELS[shift.location as keyof typeof LOCATION_LABELS] ?? shift.location}
                    </span>
                    {tab === 'offered' && (
                      <span className="os-badge offered-badge">aangeboden door {shift.employee_name}</span>
                    )}
                    {isPending && <span className="os-badge claim-badge">⏳ Claim van {claimer}</span>}
                  </div>
                  <div className="os-card-label">{shiftLabel(shift)}</div>
                  {shift.note && <div className="os-card-note">📝 {shift.note}</div>}
                </div>

                {/* Right: actions */}
                <div className="os-card-actions">
                  {isPending ? (
                    <>
                      <div className="claim-info">
                        <span className="claim-avatar">{claimer.charAt(0).toUpperCase()}</span>
                        <span className="claim-name">{claimer} wil overnemen</span>
                      </div>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={isActioning}
                        onClick={() => approve(shift.id, true)}
                      >
                        {isActioning ? <Spinner /> : '✓ Goedkeuren'}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={isActioning}
                        onClick={() => approve(shift.id, false)}
                      >
                        Afwijzen
                      </button>
                    </>
                  ) : hasClaim ? (
                    <span className="os-badge invited-badge">Uitgenodigd: {claimer}</span>
                  ) : tab === 'open' ? (
                    <div className="invite-select">
                      <select
                        className="form-control form-control-sm"
                        title="Nodig specifiek een medewerker uit"
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) {
                            inviteEmployee(shift.id, +e.target.value)
                            e.target.value = ''
                          }
                        }}
                      >
                        <option value="">Nodig specifiek uit…</option>
                        {employees.filter(e => e.is_active).map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <button
                    className="btn btn-ghost btn-sm btn-edit"
                    onClick={() => openEditModal(shift)}
                    title="Bewerken"
                    aria-label="Dienst bewerken"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-ghost btn-sm btn-withdraw"
                    onClick={() => withdrawShift(shift.id)}
                    title="Intrekken"
                    aria-label="Dienst intrekken"
                    disabled={isActioning}
                  >
                    ⏹
                  </button>
                  <button
                    className="btn btn-ghost btn-sm btn-del"
                    onClick={() => deleteShift(shift.id)}
                    title="Verwijderen"
                    aria-label="Dienst verwijderen"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        /* ── Toast ── */
        .os-toast {
          position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
          background: #065F46; color: #fff;
          padding: 12px 24px; border-radius: 999px;
          font-size: .9375rem; font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,.25);
          z-index: 9999; white-space: nowrap;
          animation: toast-in .2s ease;
        }
        .os-toast-err { background: #991B1B; }
        @keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(-8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }

        /* ── Page header ── */
        .os-header { margin-bottom: var(--s6); }
        .os-title-row {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: var(--s4); margin-bottom: var(--s5); flex-wrap: wrap;
        }
        .os-h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
        .os-sub { font-size: .9375rem; color: var(--text-muted); margin: 0; }

        /* ── Tabs ── */
        .os-tabs { display: flex; gap: 2px; border-bottom: 2px solid var(--border); }
        .os-tab {
          padding: 10px 18px; font-size: .9375rem; font-weight: 500;
          color: var(--text-sub); border-radius: 8px 8px 0 0;
          display: flex; align-items: center; gap: 7px;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          transition: color .14s, border-color .14s;
        }
        .os-tab.active { color: var(--brand); border-color: var(--brand); }
        .os-tab-badge {
          background: var(--surface-alt); color: var(--text-sub);
          font-size: .6875rem; font-weight: 700;
          padding: 2px 7px; border-radius: 999px;
        }
        .os-tab-badge.urgent { background: #FFEDD5; color: #C2410C; }

        /* ── Loading / Empty ── */
        .os-loading { display: flex; align-items: center; gap: var(--s3); padding: var(--s10); color: var(--text-muted); }
        .os-empty { text-align: center; padding: var(--s12) var(--s6); }
        .os-empty-icon { font-size: 3rem; margin-bottom: var(--s3); }
        .os-empty-title { font-size: 1.125rem; font-weight: 600; margin-bottom: var(--s2); }
        .os-empty-sub { color: var(--text-muted); font-size: .9375rem; max-width: 420px; margin: 0 auto; }

        /* ── List ── */
        .os-list { display: flex; flex-direction: column; gap: var(--s3); }
        .os-card {
          display: flex; align-items: center; gap: var(--s4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s4) var(--s5);
          transition: box-shadow .14s;
        }
        .os-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,.06); }
        .os-card.has-claim {
          border-color: rgba(200,136,42,.35);
          background: linear-gradient(to right, rgba(200,136,42,.03), var(--surface));
        }

        .os-card-info { flex: 1; min-width: 0; }
        .os-card-top { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; align-items: center; }
        .os-card-label { font-size: 1rem; font-weight: 600; margin-bottom: 3px; }
        .os-card-note { font-size: .8125rem; color: var(--text-muted); }

        /* Badges */
        .os-badge {
          font-size: .6875rem; font-weight: 700; letter-spacing: .02em;
          padding: 3px 9px; border-radius: 999px; white-space: nowrap;
        }
        .loc-markt        { background: rgba(44,110,73,.12);  color: #2C6E49; }
        .loc-nootmagazijn { background: rgba(123,79,46,.12);  color: #7B4F2E; }
        .offered-badge    { background: rgba(124,58,237,.1);  color: #6D28D9; }
        .claim-badge      { background: rgba(200,136,42,.15); color: #92400E; }
        .invited-badge    { background: rgba(59,130,246,.1);  color: #1D4ED8; }

        /* Actions */
        .os-card-actions {
          display: flex; align-items: center; gap: var(--s2); flex-shrink: 0; flex-wrap: wrap;
        }
        .claim-info { display: flex; align-items: center; gap: 8px; margin-right: var(--s2); }
        .claim-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, var(--brand), #e9a940);
          color: #fff; font-weight: 700; font-size: .875rem;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .claim-name { font-size: .875rem; font-weight: 500; }

        .invite-select { min-width: 200px; }
        .form-control-sm { height: 36px; font-size: .875rem; padding: 6px 10px; }

        .btn-success {
          background: #059669; color: #fff; border: none;
        }
        .btn-success:hover:not(:disabled) { background: #047857; }
        .btn-edit { opacity: .5; }
        .btn-edit:hover { opacity: 1; color: var(--brand); }
        .btn-withdraw { opacity: .5; }
        .btn-withdraw:hover { opacity: 1; color: #B45309; }
        .btn-del { opacity: .5; }
        .btn-del:hover { opacity: 1; color: #DC2626; }

        /* ── Modal ── */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: var(--s4); backdrop-filter: blur(2px);
        }
        .modal-panel {
          background: var(--surface); border-radius: var(--radius-xl);
          width: 100%; max-width: 520px;
          box-shadow: 0 24px 64px rgba(0,0,0,.2);
          animation: modal-in .2s ease;
        }
        @keyframes modal-in { from { opacity:0; transform: scale(.97) translateY(8px) } to { opacity:1; transform:none } }

        .modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--s5) var(--s5) var(--s4);
          border-bottom: 1px solid var(--border);
        }
        .modal-title { font-size: 1.125rem; font-weight: 700; margin: 0; }
        .modal-close {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); font-size: .875rem;
          transition: background .14s;
        }
        .modal-close:hover { background: var(--surface-alt); }

        .modal-body { padding: var(--s5); display: flex; flex-direction: column; gap: var(--s4); }
        .modal-footer { display: flex; gap: var(--s3); justify-content: flex-end; padding-top: var(--s2); }

        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-label { font-size: .8125rem; font-weight: 600; color: var(--text-sub); }

        .loc-toggle { display: flex; gap: 6px; }
        .loc-btn {
          flex: 1; padding: 8px; border-radius: var(--radius);
          border: 2px solid var(--border); font-size: .875rem; font-weight: 500;
          color: var(--text-sub); transition: all .14s;
        }
        .loc-btn.active-markt        { border-color: #2C6E49; background: rgba(44,110,73,.08); color: #2C6E49; }
        .loc-btn.active-nootmagazijn { border-color: #7B4F2E; background: rgba(123,79,46,.08); color: #7B4F2E; }

        @media (max-width: 640px) {
          .os-title-row { flex-direction: column; }
          .os-card { flex-direction: column; align-items: stretch; }
          .os-card-actions { flex-wrap: wrap; }
          .form-row-2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  if (session.user.role === 'employee') return { redirect: { destination: '/me', permanent: false } }
  return { props: { user: session.user } }
}
