import { useState, useEffect } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import LocationBadge from '@/components/ui/LocationBadge'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Employee, Location } from '@/types'
import Spinner from '@/components/ui/Spinner'
import { InviteIcon } from '@/components/ui/Icons'

interface Props { user: SessionUser }

const LOCATION_OPTIONS: { value: Location | ''; label: string }[] = [
  { value: '',            label: 'Alle locaties' },
  { value: 'markt',       label: 'De Notenkar (Markt)' },
  { value: 'nootmagazijn',label: 'Het Nootmagazijn' },
  { value: 'both',        label: 'Beide' },
]

export default function EmployeesPage({ user }: Props) {
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [filter, setFilter]         = useState<Location | ''>('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [adding, setAdding]         = useState(false)
  const [newForm, setNewForm]       = useState({ name: '', email: '', phone: '', contract_hours: 24, user_level: 'Medewerker', location: 'markt' as Location, hourly_rate: '' })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [invitingId, setInvitingId] = useState<number | null>(null)
  const [inviteResult, setInviteResult] = useState<{ id: number; ok: boolean; msg: string } | null>(null)

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/employees?all=1`)
    const d = await r.json()
    setEmployees(d.success ? d.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visible = employees.filter(e => {
    if (!showInactive && !e.is_active) return false
    if (filter && e.location !== filter && !(filter !== 'both' && e.location === 'both')) return false
    return true
  })

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const r = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, hourly_rate: newForm.hourly_rate ? parseFloat(newForm.hourly_rate) : null }),
    })
    const d = await r.json()
    setSaving(false)
    if (!d.success) { setError(d.message || 'Opslaan mislukt'); return }
    setAdding(false)
    setNewForm({ name: '', email: '', phone: '', contract_hours: 24, user_level: 'Medewerker', location: 'markt', hourly_rate: '' })
    load()
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...emp, is_active: emp.is_active ? 0 : 1 }),
    })
    load()
  }

  async function sendInvite(emp: Employee) {
    if (!emp.email) { setInviteResult({ id: emp.id, ok: false, msg: 'Geen e-mailadres' }); return }
    setInvitingId(emp.id); setInviteResult(null)
    const r = await fetch(`/api/admin/employees/${emp.id}/invite`, { method: 'POST' })
    const d = await r.json()
    setInvitingId(null)
    setInviteResult({ id: emp.id, ok: d.success, msg: d.message ?? (d.success ? 'Verzonden' : 'Mislukt') })
    if (d.success) load()  // herlaad om invite_sent_at bij te werken
    setTimeout(() => setInviteResult(null), 5000)
  }

  return (
    <AdminLayout user={user} title="Medewerkers">
      <div className="page-header">
        <div className="filters">
          <label htmlFor="filter_location" className="sr-only">Locatie filter</label>
          <select
            id="filter_location"
            className="form-control form-control-sm"
            value={filter}
            onChange={e => setFilter(e.target.value as Location | '')}
            title="Filter op locatie"
          >
            {LOCATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label htmlFor="filter_inactive" className="form-checkbox-label">
            <input id="filter_inactive" type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} title="Toon ook inactieve medewerkers" />
            Toon inactief
          </label>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Medewerker</button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="add-card">
          <h4 className="add-card-title">Nieuwe medewerker</h4>
          <form onSubmit={addEmployee}>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="new_name" className="form-label required">Naam</label>
                <input id="new_name" className="form-control" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} required title="Naam medewerker" />
              </div>
              <div className="form-group">
                <label htmlFor="new_email" className="form-label">E-mail</label>
                <input id="new_email" type="email" className="form-control" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} title="E-mailadras" />
              </div>
              <div className="form-group">
                <label htmlFor="new_phone" className="form-label">Telefoon</label>
                <input id="new_phone" className="form-control" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} title="Telefoonnummer" />
              </div>
              <div className="form-group">
                <label htmlFor="new_hours" className="form-label">Contracturen/week</label>
                <input id="new_hours" type="number" className="form-control" value={newForm.contract_hours} onChange={e => setNewForm(f => ({ ...f, contract_hours: parseInt(e.target.value) || 0 }))} min={0} max={40} title="Contracturen per week" />
              </div>
              <div className="form-group">
                <label htmlFor="new_level" className="form-label">Niveau</label>
                <select id="new_level" className="form-control" value={newForm.user_level} onChange={e => setNewForm(f => ({ ...f, user_level: e.target.value }))} title="Gebruikersniveau">
                  <option>Medewerker</option>
                  <option>Senior</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="new_location" className="form-label">Locatie</label>
                <select id="new_location" className="form-control" value={newForm.location} onChange={e => setNewForm(f => ({ ...f, location: e.target.value as Location }))} title="Voorkeurslocatie">
                  <option value="markt">De Notenkar (Markt)</option>
                  <option value="nootmagazijn">Het Nootmagazijn</option>
                  <option value="both">Beide</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="new_rate" className="form-label">Uurtarief (€)</label>
                <input id="new_rate" type="number" step="0.01" className="form-control" value={newForm.hourly_rate} onChange={e => setNewForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="bijv. 13.50" title="Uurtarief in euro's" />
              </div>
            </div>
            <div className="add-card-footer">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(false)}>Annuleren</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <Spinner /> : 'Toevoegen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-row"><Spinner /> Laden…</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Naam</th>
                <th scope="col">Locatie</th>
                <th scope="col">Uren</th>
                <th scope="col">Niveau</th>
                <th scope="col">Contact</th>
                <th scope="col">Status</th>
                <th scope="col">Uitnodiging</th>
                <th scope="col" aria-label="Acties"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(emp => (
                <tr key={emp.id} className={!emp.is_active ? 'row-inactive' : ''}>
                  <th scope="row">
                    <div className="emp-name-cell">
                      <span className="fw-500">{emp.name}</span>
                    </div>
                  </th>
                  <td><LocationBadge location={emp.location} /></td>
                  <td><span className="text-sub">{emp.contract_hours}u/wk</span></td>
                  <td><span className="text-sub">{emp.user_level}</span></td>
                  <td>
                    <div className="contact-cell">
                      {emp.email && <span className="text-muted text-sm">{emp.email}</span>}
                      {emp.phone && <span className="text-muted text-sm">{emp.phone}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-pill ${emp.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {emp.is_active ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td>
                    {inviteResult?.id === emp.id ? (
                      <span className={`invite-result ${inviteResult.ok ? 'ok' : 'err'}`}>{inviteResult.msg}</span>
                    ) : emp.invite_sent_at ? (
                      <span className="invite-sent" title={new Date(emp.invite_sent_at).toLocaleString('nl-NL')}>
                        <span className="invite-dot sent" />
                        {new Date(emp.invite_sent_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </span>
                    ) : (
                      <span className="invite-none">
                        <span className="invite-dot pending" />
                        Niet verzonden
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/employees/${emp.id}`} className="btn btn-outline btn-xs">Bewerken</Link>
                      <button
                        className="btn btn-ghost btn-xs invite-btn-xs"
                        onClick={() => sendInvite(emp)}
                        disabled={invitingId === emp.id || !emp.email}
                        title={!emp.email ? 'Geen e-mailadres' : emp.invite_sent_at ? 'Opnieuw uitnodigen' : 'Uitnodiging sturen'}
                      >
                        {invitingId === emp.id ? <Spinner /> : <InviteIcon size={13} />}
                        {emp.invite_sent_at ? 'Opnieuw' : 'Uitnodigen'}
                      </button>
                      <button className="btn btn-ghost btn-xs text-muted" onClick={() => toggleActive(emp)} title={emp.is_active ? 'Deactiveren' : 'Activeren'}>
                        {emp.is_active ? 'Deact.' : 'Activeer'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="empty-row">Geen medewerkers gevonden.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: var(--s3); margin-bottom: var(--s5);
        }
        .filters { display: flex; align-items: center; gap: var(--s3); }
        .add-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
          margin-bottom: var(--s5);
        }
        .add-card-title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--s4); }
        .form-grid-3 {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s3);
        }
        .add-card-footer { display: flex; gap: var(--s2); justify-content: flex-end; margin-top: var(--s4); }

        .table-wrap {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table thead th {
          background: var(--surface-alt); padding: var(--s2) var(--s4);
          font-size: .8125rem; font-weight: 600; color: var(--text-sub);
          text-align: left; border-bottom: 1px solid var(--border);
        }
        .data-table tbody tr { border-bottom: 1px solid var(--border); }
        .data-table tbody tr:last-child { border-bottom: none; }
        .data-table td { padding: var(--s3) var(--s4); font-size: .9375rem; vertical-align: middle; }
        .row-inactive td { opacity: .5; }

        .emp-name-cell { display: flex; align-items: center; gap: var(--s2); }
        .contact-cell { display: flex; flex-direction: column; gap: 2px; }
        .row-actions { display: flex; gap: var(--s2); align-items: center; }
        .empty-row { text-align: center; color: var(--text-muted); padding: var(--s8); }
        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }

        /* Invite status */
        .invite-sent, .invite-none { display: flex; align-items: center; gap: 5px; font-size: .8125rem; white-space: nowrap; }
        .invite-sent { color: var(--text-sub); }
        .invite-none { color: var(--text-muted); }
        .invite-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .invite-dot.sent    { background: #16a34a; }
        .invite-dot.pending { background: #d97706; }
        .invite-result { font-size: .8125rem; font-weight: 600; white-space: nowrap; }
        .invite-result.ok  { color: #16a34a; }
        .invite-result.err { color: #dc2626; }
        .invite-btn-xs { display: inline-flex; align-items: center; gap: 4px; }

        @media (max-width: 768px) {
          .form-grid-3 { grid-template-columns: 1fr 1fr; }
          .data-table thead th:nth-child(3),
          .data-table tbody td:nth-child(3),
          .data-table thead th:nth-child(4),
          .data-table tbody td:nth-child(4),
          .data-table thead th:nth-child(5),
          .data-table tbody td:nth-child(5) { display: none; }
        }
        @media (max-width: 480px) {
          .form-grid-3 { grid-template-columns: 1fr; }
          .page-header { flex-direction: column; align-items: stretch; }
          .page-header .btn { width: 100%; }
          .filters { flex-direction: column; align-items: stretch; }
          .filters .form-control { width: 100%; }
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
