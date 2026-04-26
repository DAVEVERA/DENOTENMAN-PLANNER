import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, AppSettings } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

interface UserAccount {
  username: string
  role: 'admin' | 'manager' | 'employee'
  display_name: string
  employee_id: number | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Medewerker',
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: 'role-admin',
  manager: 'role-manager',
  employee: 'role-employee',
}

export default function SettingsPage({ user }: Props) {
  // ── App Settings ──
  const [form, setForm]   = useState<AppSettings>({
    accountant_email: '', accountant_name: 'Boekhouder',
    export_auto_email: false,
    location_markt_name: 'De Notenkar (Markt)',
    location_nootmagazijn_name: 'Het Nootmagazijn',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  // ── User Accounts ──
  const [accounts, setAccounts]       = useState<UserAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser]         = useState({ username: '', display_name: '', role: 'admin' as string, password: '' })
  const [userSaving, setUserSaving]   = useState(false)
  const [userError, setUserError]     = useState('')
  const [userSuccess, setUserSuccess] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.success) setForm(f => ({ ...f, ...d.data }))
    })
    loadAccounts()
  }, [])

  async function loadAccounts() {
    setLoadingAccounts(true)
    const r = await fetch('/api/admin/users')
    const d = await r.json()
    if (d.success) setAccounts(d.data)
    setLoadingAccounts(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!(await r.json()).success) { setError('Opslaan mislukt'); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function set<K extends keyof AppSettings>(k: K, v: AppSettings[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setUserSaving(true); setUserError(''); setUserSuccess('')
    if (!newUser.password || newUser.password.length < 6) {
      setUserError('Wachtwoord moet minimaal 6 tekens zijn')
      setUserSaving(false)
      return
    }
    const r = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    const d = await r.json()
    setUserSaving(false)
    if (!d.success) { setUserError(d.message || 'Aanmaken mislukt'); return }
    setUserSuccess(`Account "${newUser.username}" aangemaakt`)
    setNewUser({ username: '', display_name: '', role: 'admin', password: '' })
    setShowAddUser(false)
    loadAccounts()
    setTimeout(() => setUserSuccess(''), 4000)
  }

  async function removeUser(username: string) {
    if (!confirm(`Account "${username}" definitief verwijderen?`)) return
    const r = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
    const d = await r.json()
    if (!d.success) { setUserError(d.message || 'Verwijderen mislukt'); return }
    loadAccounts()
  }

  return (
    <AdminLayout user={user} title="Instellingen">
      <form onSubmit={save} className="settings-form">
        {error && <div className="alert alert-danger">{error}</div>}
        {saved && <div className="alert alert-success">Instellingen opgeslagen</div>}

        <div className="settings-section">
          <h3 className="settings-section-title">Boekhouding</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">E-mailadres boekhouder</label>
              <input
                type="email" className="form-control"
                value={form.accountant_email}
                onChange={e => set('accountant_email', e.target.value)}
                placeholder="boekhouder@kantoor.nl"
              />
              <span className="form-hint">Exportbestanden worden naar dit adres verstuurd.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Naam boekhouder</label>
              <input
                className="form-control"
                value={form.accountant_name}
                onChange={e => set('accountant_name', e.target.value)}
                placeholder="Boekhouder"
              />
            </div>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={Boolean(form.export_auto_email)}
              onChange={e => set('export_auto_email', e.target.checked)}
            />
            Automatisch e-mailen bij export
          </label>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">Locatienamen</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="location-markt-name">Naam Markt-locatie</label>
              <input
                id="location-markt-name"
                className="form-control"
                value={form.location_markt_name}
                onChange={e => set('location_markt_name', e.target.value)}
                placeholder="De Notenkar (Markt)"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="location-noot-name">Naam Nootmagazijn-locatie</label>
              <input
                id="location-noot-name"
                className="form-control"
                value={form.location_nootmagazijn_name}
                onChange={e => set('location_nootmagazijn_name', e.target.value)}
                placeholder="Het Nootmagazijn"
              />
            </div>
          </div>
        </div>

        <div className="form-footer">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner /> : 'Opslaan'}
          </button>
        </div>
      </form>

      {/* ══════════════════ GEBRUIKERSACCOUNTS ══════════════════ */}
      <div className="settings-form settings-accounts-section">
        <div className="settings-section">
          <div className="section-header">
            <h3 className="settings-section-title section-title-inline">
              Gebruikersaccounts
            </h3>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setShowAddUser(true); setUserError('') }}
            >
              + Account aanmaken
            </button>
          </div>

          {userSuccess && <div className="alert alert-success alert-spaced">{userSuccess}</div>}
          {userError && <div className="alert alert-danger alert-spaced">{userError}</div>}

          {/* Add user form */}
          {showAddUser && (
            <form onSubmit={addUser} className="add-user-card">
              <h4 className="add-user-title">Nieuw account</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="new-user-name" className="form-label required">Gebruikersnaam</label>
                  <input
                    id="new-user-name"
                    className="form-control"
                    value={newUser.username}
                    onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                    required
                    placeholder="bijv. jan.admin"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-user-display" className="form-label required">Weergavenaam</label>
                  <input
                    id="new-user-display"
                    className="form-control"
                    value={newUser.display_name}
                    onChange={e => setNewUser(u => ({ ...u, display_name: e.target.value }))}
                    required
                    placeholder="Jan de Vries"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-user-role" className="form-label required">Rol</label>
                  <select
                    id="new-user-role"
                    className="form-control"
                    value={newUser.role}
                    onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Medewerker</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="new-user-pw" className="form-label required">Wachtwoord</label>
                  <input
                    id="new-user-pw"
                    type="password"
                    className="form-control"
                    value={newUser.password}
                    onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                    required
                    minLength={6}
                    placeholder="min. 6 tekens"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="add-user-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddUser(false)}>Annuleren</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={userSaving}>
                  {userSaving ? <Spinner /> : 'Aanmaken'}
                </button>
              </div>
            </form>
          )}

          {/* Accounts table */}
          {loadingAccounts ? (
            <div className="loading-row"><Spinner /> Laden…</div>
          ) : (
            <div className="accounts-table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th scope="col">Gebruikersnaam</th>
                    <th scope="col">Weergavenaam</th>
                    <th scope="col">Rol</th>
                    <th scope="col" aria-label="Acties"></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(acc => (
                    <tr key={acc.username}>
                      <td className="username-cell">{acc.username}</td>
                      <td>{acc.display_name}</td>
                      <td>
                        <span className={`role-badge ${ROLE_BADGE_CLASS[acc.role] ?? ''}`}>
                          {ROLE_LABELS[acc.role] ?? acc.role}
                        </span>
                      </td>
                      <td>
                        {acc.username !== user.user_id && (
                          <button
                            className="btn btn-ghost btn-xs text-danger"
                            onClick={() => removeUser(acc.username)}
                            title="Account verwijderen"
                          >
                            Verwijderen
                          </button>
                        )}
                        {acc.username === user.user_id && (
                          <span className="text-muted text-sm">Jij</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr><td colSpan={4} className="empty-row">Geen accounts gevonden.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .settings-form { max-width: 680px; }
        .settings-section { margin-bottom: var(--s6); }
        .settings-section-title {
          font-size: .875rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
          color: var(--text-muted); margin: 0 0 var(--s4);
          padding-bottom: var(--s2); border-bottom: 1px solid var(--border);
        }
        .settings-accounts-section { margin-top: 2rem; }
        .section-title-inline { margin-bottom: 0 !important; border-bottom: none !important; padding-bottom: 0 !important; }
        .alert-spaced { margin-top: var(--s3); }
        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--s3); margin-bottom: var(--s4);
          padding-bottom: var(--s2); border-bottom: 1px solid var(--border);
        }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); margin-bottom: var(--s3); }
        .form-hint { display: block; font-size: .8125rem; color: var(--text-muted); margin-top: 4px; }
        .check-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: .9375rem; min-height: 44px; }
        .form-footer { margin-top: var(--s5); }

        /* ── Add user card ── */
        .add-user-card {
          background: var(--surface-alt); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s4);
          margin-bottom: var(--s4);
        }
        .add-user-title { font-size: .9375rem; font-weight: 600; margin: 0 0 var(--s3); }
        .add-user-footer { display: flex; gap: var(--s2); justify-content: flex-end; margin-top: var(--s3); }

        /* ── Accounts table ── */
        .accounts-table-wrap {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden; margin-top: var(--s3);
        }
        .accounts-table { width: 100%; border-collapse: collapse; }
        .accounts-table thead th {
          background: var(--surface-alt); padding: var(--s2) var(--s4);
          font-size: .8125rem; font-weight: 600; color: var(--text-sub);
          text-align: left; border-bottom: 1px solid var(--border);
        }
        .accounts-table tbody tr { border-bottom: 1px solid var(--border); }
        .accounts-table tbody tr:last-child { border-bottom: none; }
        .accounts-table td { padding: var(--s2) var(--s4); font-size: .875rem; vertical-align: middle; }
        .username-cell { font-family: monospace; font-size: .8125rem; }

        /* ── Role badges ── */
        .role-badge {
          display: inline-block; padding: 2px 8px; border-radius: 4px;
          font-size: .75rem; font-weight: 600; letter-spacing: .02em;
        }
        .role-admin    { background: rgba(220,53,69,.15); color: #ef4444; }
        .role-manager  { background: rgba(245,158,11,.15); color: #f59e0b; }
        .role-employee { background: rgba(34,197,94,.15); color: #22c55e; }

        .text-danger { color: #ef4444 !important; }
        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .empty-row { text-align: center; color: var(--text-muted); padding: var(--s8); }

        @media (max-width: 768px) {
          .settings-form { max-width: 100%; }
          .section-header { flex-direction: column; align-items: stretch; }
        }
        @media (max-width: 480px) {
          .form-grid { grid-template-columns: 1fr; }
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
