import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import LocationBadge from '@/components/ui/LocationBadge'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Employee, Location, Shift } from '@/types'
import { DAY_SHORT } from '@/types'

interface Props { user: SessionUser }

export default function EmployeeDetailPage({ user }: Props) {
  const router = useRouter()
  const id = parseInt(String(router.query.id))

  const [emp, setEmp]       = useState<Employee | null>(null)
  const [form, setForm]     = useState<Partial<Employee>>({})
  const [shifts, setShifts] = useState<Shift[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/employees/${id}`).then(r => r.json()),
      fetch(`/api/shifts?employee_id=${id}`).then(r => r.json()),
    ]).then(([eData, sData]) => {
      if (eData.success) { setEmp(eData.data); setForm(eData.data) }
      if (sData.success) setShifts(sData.data.slice(0, 30))
      setLoading(false)
    })
  }, [id])

  function set<K extends keyof Employee>(k: K, v: Employee[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    const r = await fetch(`/api/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    setSaving(false)
    if (!d.success) { setError(d.message || 'Opslaan mislukt'); return }
    setSaved(true)
    setEmp(d.data)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return (
    <AdminLayout user={user} title="Medewerker">
      <div className="loading-row"><span className="spinner" /> Laden…</div>
    </AdminLayout>
  )

  if (!emp) return (
    <AdminLayout user={user} title="Medewerker">
      <div className="empty-row">Medewerker niet gevonden. <Link href="/admin/employees" className="link">Terug</Link></div>
    </AdminLayout>
  )

  // Group recent shifts by week
  const byWeek: Record<string, Shift[]> = {}
  for (const s of shifts) {
    const k = `${s.year}-W${s.week_number}`
    ;(byWeek[k] ??= []).push(s)
  }
  const weekKeys = Object.keys(byWeek).sort().reverse().slice(0, 8)

  return (
    <AdminLayout user={user} title={emp.name}>
      <div className="back-link">
        <Link href="/admin/employees" className="btn btn-ghost btn-sm">‹ Terug</Link>
      </div>

      <div className="detail-grid">
        {/* ── Edit form ── */}
        <div className="detail-card">
          <h3 className="card-title">Gegevens</h3>
          <form onSubmit={save}>
            {error && <div className="alert alert-danger">{error}</div>}
            {saved && <div className="alert alert-success">Opgeslagen</div>}

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="emp_name" className="form-label required">Naam</label>
                <input id="emp_name" className="form-control" value={form.name ?? ''} onChange={e => set('name', e.target.value)} required title="Naam van de medewerker" />
              </div>
              <div className="form-group">
                <label htmlFor="emp_email" className="form-label">E-mail</label>
                <input id="emp_email" type="email" className="form-control" value={form.email ?? ''} onChange={e => set('email', e.target.value)} title="E-mailadres" />
              </div>
              <div className="form-group">
                <label htmlFor="emp_phone" className="form-label">Telefoon</label>
                <input id="emp_phone" className="form-control" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} title="Telefoonnummer" />
              </div>
              <div className="form-group">
                <label htmlFor="emp_hours" className="form-label">Contracturen/week</label>
                <input id="emp_hours" type="number" className="form-control" value={form.contract_hours ?? 0} onChange={e => set('contract_hours', parseInt(e.target.value) || 0)} min={0} max={40} title="Aantal contracturen per week" />
              </div>
              <div className="form-group">
                <label htmlFor="emp_level" className="form-label">Niveau</label>
                <select id="emp_level" className="form-control" value={form.user_level ?? 'Medewerker'} onChange={e => set('user_level', e.target.value)} title="Gebruikersniveau">
                  <option>Medewerker</option>
                  <option>Senior</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="emp_location" className="form-label">Locatie</label>
                <select id="emp_location" className="form-control" value={form.location ?? 'markt'} onChange={e => set('location', e.target.value as Location)} title="Voorkeurslocatie">
                  <option value="markt">De Notenkar (Markt)</option>
                  <option value="nootmagazijn">Het Nootmagazijn</option>
                  <option value="both">Beide</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="emp_rate" className="form-label">Uurtarief (€)</label>
                <input id="emp_rate" type="number" step="0.01" className="form-control" value={form.hourly_rate ?? ''} onChange={e => set('hourly_rate', e.target.value ? parseFloat(e.target.value) : null)} placeholder="bijv. 13.50" title="Bruto uurtarief" />
              </div>
              <div className="form-group">
                <label htmlFor="emp_team" className="form-label">Team</label>
                <input id="emp_team" className="form-control" value={form.team_group ?? ''} onChange={e => set('team_group', e.target.value || null)} placeholder="Bijv. A-team" title="Team/Groep" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="emp_active" className="form-checkbox-label">
                <input id="emp_active" type="checkbox" checked={Boolean(form.is_active)} onChange={e => set('is_active', e.target.checked ? 1 : 0)} title="Is medewerker actief?" />
                Actief
              </label>
            </div>

            <div className="form-footer">
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <span className="spinner" aria-hidden="true" /> : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Recent shifts ── */}
        <div className="detail-card">
          <h3 className="card-title">Recente diensten</h3>
          {weekKeys.length === 0 ? (
            <p className="text-muted text-sm">Geen diensten gevonden.</p>
          ) : weekKeys.map(k => (
            <div key={k} className="week-group">
              <div className="week-group-label">{k}</div>
              {byWeek[k].map(s => (
                <div key={s.id} className="shift-row">
                  <span className="shift-day">{DAY_SHORT[s.day_of_week] ?? s.day_of_week}</span>
                  <span className="shift-type-badge" data-type={s.shift_type.toLowerCase()}>{s.shift_type}</span>
                  {s.start_time && <span className="shift-time">{s.start_time.slice(0,5)}–{s.end_time?.slice(0,5)}</span>}
                  <LocationBadge location={s.location} size="xs" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-row { padding: var(--s8); color: var(--text-muted); }
        .back-link { margin-bottom: var(--s4); }
        .detail-grid { display: grid; grid-template-columns: 1fr 380px; gap: var(--s5); }
        .detail-card {
           background: var(--surface); border: 1px solid var(--border);
           border-radius: var(--radius-lg); padding: var(--s5);
        }
        .card-title { font-size: 1rem; font-weight: 600; margin: 0 0 var(--s4); }
        .form-footer { margin-top: var(--s4); }

        .week-group { margin-bottom: var(--s4); }
        .week-group-label { font-size: .75rem; font-weight: 700; color: var(--text-muted); letter-spacing: .04em; text-transform: uppercase; margin-bottom: var(--s2); }
        .shift-row { display: flex; align-items: center; gap: var(--s2); padding: 5px 0; border-bottom: 1px solid var(--border); }
        .shift-row:last-child { border-bottom: none; }
        .shift-day { width: 28px; font-size: .8125rem; font-weight: 600; color: var(--text-sub); }
        .shift-time { font-size: .8125rem; color: var(--text-muted); }

        .shift-type-badge {
          font-size: .6875rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
          text-transform: capitalize;
        }

        @media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
