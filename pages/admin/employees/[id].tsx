import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import LocationBadge from '@/components/ui/LocationBadge'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Employee, Location, Shift, EmployeeDocument, EmployeeProfile, DocType } from '@/types'
import { DAY_SHORT, DAYS, DAY_SHORT as DAY_LABELS } from '@/types'
import Spinner from '@/components/ui/Spinner'
import { InviteIcon } from '@/components/ui/Icons'

const DOC_TYPE_LABELS: Record<DocType, string> = {
  legitimatie:         'Legitimatie',
  arbeidsovereenkomst: 'Arbeidsovereenkomst',
  overig:              'Overig',
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props { user: SessionUser }

type Tab = 'gegevens' | 'profiel' | 'documenten'

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

  const [tab, setTab]            = useState<Tab>('gegevens')
  const [profile, setProfile]    = useState<EmployeeProfile | null>(null)
  const [docs, setDocs]          = useState<EmployeeDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  const [inviting, setInviting]     = useState(false)
  const [inviteMsg, setInviteMsg]   = useState('')
  const [inviteError, setInviteError] = useState('')

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

  const loadProfile = useCallback(async () => {
    setProfileLoading(true)
    const r = await fetch(`/api/admin/employees/${id}/profile`)
    const d = await r.json()
    if (d.success) setProfile(d.data)
    setProfileLoading(false)
  }, [id])

  const loadDocs = useCallback(async () => {
    setDocsLoading(true)
    const r = await fetch(`/api/admin/employees/${id}/documents`)
    const d = await r.json()
    if (d.success) setDocs(d.data)
    setDocsLoading(false)
  }, [id])

  useEffect(() => {
    if (tab === 'profiel' && !profile) loadProfile()
    if (tab === 'documenten' && docs.length === 0) loadDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loadProfile, loadDocs])

  async function handleInvite() {
    setInviting(true); setInviteMsg(''); setInviteError('')
    const r = await fetch(`/api/admin/employees/${id}/invite`, { method: 'POST' })
    const d = await r.json()
    setInviting(false)
    if (!d.success) { setInviteError(d.message ?? 'Verzenden mislukt'); return }
    setInviteMsg('Uitnodiging verzonden!')
    // Herlaad medewerker om invite_sent_at bij te werken
    fetch(`/api/employees/${id}`).then(r => r.json()).then(d => { if (d.success) setEmp(d.data) })
    setTimeout(() => setInviteMsg(''), 5000)
  }

  async function handleDeleteDoc(docId: number) {
    if (!confirm('Verwijder dit document?')) return
    await fetch(`/api/admin/employees/${id}/documents?docId=${docId}`, { method: 'DELETE' })
    loadDocs()
  }

  async function openDoc(doc: EmployeeDocument) {
    const url = doc.download_url
    if (url) { window.open(url, '_blank', 'noopener'); return }
    const r = await fetch(`/api/me/documents/${doc.id}`)
    const d = await r.json()
    if (d.data?.url) window.open(d.data.url, '_blank', 'noopener')
  }

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
      <div className="loading-row"><Spinner /> Laden…</div>
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

      {/* ── Uitnodiging banner ── */}
      <div className="invite-section">
        <div className="invite-info">
          <div className="invite-status">
            <span className={`invite-dot ${emp.invite_sent_at ? 'sent' : 'pending'}`} />
            {emp.invite_sent_at
              ? `Uitnodiging verzonden op ${new Date(emp.invite_sent_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'Nog geen uitnodiging verzonden'}
          </div>
          {!emp.email && (
            <span className="no-email-warning">Voeg eerst een e-mailadres toe om een uitnodiging te sturen</span>
          )}
        </div>
        <button
          className="btn btn-outline btn-sm invite-btn"
          onClick={handleInvite}
          disabled={inviting || !emp.email}
          title={!emp.email ? 'Voeg eerst een e-mailadres toe' : emp.invite_sent_at ? 'Opnieuw uitnodiging sturen' : 'Uitnodiging sturen'}
        >
          {inviting ? <Spinner /> : <InviteIcon size={15} />}
          {inviting ? 'Verzenden…' : emp.invite_sent_at ? 'Opnieuw uitnodigen' : 'Uitnodiging sturen'}
        </button>
      </div>
      {inviteMsg   && <div className="alert alert-success">{inviteMsg}</div>}
      {inviteError && <div className="alert alert-danger">{inviteError}</div>}

      {/* ── Tabs ── */}
      <div className="tabs" role="tablist">
        {(['gegevens', 'profiel', 'documenten'] as Tab[]).map(t => (
          <button key={t} role="tab" 
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="detail-grid">
        {/* ── TAB: Gegevens ── */}
        {tab === 'gegevens' && (<>
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
                {saving ? <Spinner /> : 'Opslaan'}
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
        </>)}

        {/* ── TAB: Profiel ── */}
        {tab === 'profiel' && (
        <div className="detail-card full-width">
          <h3 className="card-title">Profiel van {emp.name}</h3>
          {profileLoading ? (
            <div className="loading-row"><Spinner /> Laden…</div>
          ) : !profile ? (
            <p className="text-muted text-sm">Geen profiel ingevuld.</p>
          ) : (
            <div className="profile-view">
              {profile.avatar_url && (
                <div className="avatar-admin">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.avatar_url} alt="Profielfoto" className="avatar-img" />
                </div>
              )}
              <div className="profile-grid">
                {[
                  ['Voornaam',         profile.voornaam],
                  ['Achternaam',       profile.achternaam],
                  ['Geboortedatum',    profile.geboortedatum ? new Date(profile.geboortedatum + 'T00:00:00').toLocaleDateString('nl-NL') : null],
                  ['Geboorteplaats',   profile.geboorteplaats],
                  ['Land van herkomst',profile.land_van_herkomst],
                  ['Adres',            profile.adres],
                  ['Postcode',         profile.postcode],
                  ['Woonplaats',       profile.stad],
                  ['ICE-contact',      profile.ice_contact],
                  ['Bijzonderheden',   profile.bijzonderheden],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={String(label)} className="profile-field">
                    <span className="pf-label">{label}</span>
                    <span className="pf-value">{String(value)}</span>
                  </div>
                ))}
              </div>
              {profile.voorkeur_planning && (
                <div className="voorkeur-section">
                  <div className="pf-label">Planningsvoorkeur</div>
                  <div className="voorkeur-dagen">
                    {DAYS.map(d => (
                      <span key={d} className={`day-chip ${profile.voorkeur_planning?.dagen[d] ? 'active' : ''}`}>
                        {DAY_LABELS[d]}
                      </span>
                    ))}
                  </div>
                  {profile.voorkeur_planning.tijdvoorkeur && profile.voorkeur_planning.tijdvoorkeur !== 'geen' && (
                    <span className="tijdvoorkeur">{profile.voorkeur_planning.tijdvoorkeur}</span>
                  )}
                  {profile.voorkeur_planning.notitie && (
                    <p className="voorkeur-notitie">{profile.voorkeur_planning.notitie}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* ── TAB: Documenten ── */}
        {tab === 'documenten' && (
        <div className="detail-card full-width">
          <h3 className="card-title">Documenten van {emp.name}</h3>
          <div className="docs-security-note">
            <span>🔒</span> Documenten zijn beveiligd. Links verlopen automatisch na 1 uur.
          </div>
          {docsLoading ? (
            <div className="loading-row"><Spinner /> Laden…</div>
          ) : docs.length === 0 ? (
            <p className="text-muted text-sm">Geen documenten geüpload.</p>
          ) : (
            <div className="doc-list">
              {docs.map(doc => (
                <div key={doc.id} className="doc-row">
                  <div className="doc-badge">{DOC_TYPE_LABELS[doc.doc_type]}</div>
                  <div className="doc-info">
                    <span className="doc-name">{doc.filename}</span>
                    <span className="doc-meta">
                      {new Date(doc.uploaded_at).toLocaleDateString('nl-NL')}
                      {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                      {doc.notes ? ` · ${doc.notes}` : ''}
                    </span>
                  </div>
                  <div className="doc-actions">
                    <button className="btn btn-outline btn-xs" onClick={() => openDoc(doc)}>Bekijken</button>
                    <button className="btn btn-ghost btn-xs text-danger" onClick={() => handleDeleteDoc(doc.id)}>Verwijderen</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

      </div>

      <style jsx>{`
        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s6); color: var(--text-muted); }
        .empty-row { padding: var(--s8); color: var(--text-muted); }
        .back-link { margin-bottom: var(--s4); }

        /* Invite banner */
        .invite-section {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
          gap: var(--s3); padding: var(--s3) var(--s4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); margin-bottom: var(--s4);
        }
        .invite-info { display: flex; flex-direction: column; gap: 3px; }
        .invite-status { display: flex; align-items: center; gap: var(--s2); font-size: .875rem; font-weight: 500; }
        .invite-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .invite-dot.sent    { background: #16a34a; }
        .invite-dot.pending { background: #d97706; }
        .no-email-warning { font-size: .8125rem; color: var(--text-muted); }
        .invite-btn { display: inline-flex; align-items: center; gap: 6px; }

        /* Alerts */
        .alert { padding: var(--s3) var(--s4); border-radius: var(--radius); margin-bottom: var(--s4); font-size: .9375rem; }
        .alert-danger  { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
        .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }

        /* Tabs */
        .tabs { display: flex; gap: 3px; margin-bottom: var(--s4); background: var(--surface-alt); border-radius: var(--radius); padding: 3px; width: fit-content; }
        .tab-btn {
          padding: 8px 16px; border-radius: calc(var(--radius) - 2px); min-height: 36px;
          font-size: .875rem; font-weight: 500; color: var(--text-sub);
          transition: background .14s, color .14s;
        }
        .tab-btn.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }

        .detail-grid { display: grid; grid-template-columns: 1fr 380px; gap: var(--s5); }
        .detail-card {
           background: var(--surface); border: 1px solid var(--border);
           border-radius: var(--radius-lg); padding: var(--s5);
        }
        .detail-card.full-width { grid-column: 1 / -1; }
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

        /* Profile view */
        .profile-view {}
        .avatar-admin { margin-bottom: var(--s4); }
        .avatar-img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); }
        .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); margin-bottom: var(--s4); }
        .profile-field { display: flex; flex-direction: column; gap: 2px; }
        .pf-label { font-size: .75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
        .pf-value { font-size: .9375rem; color: var(--text); }

        .voorkeur-section { margin-top: var(--s4); padding-top: var(--s4); border-top: 1px solid var(--border); }
        .voorkeur-dagen { display: flex; flex-wrap: wrap; gap: var(--s2); margin-top: var(--s2); }
        .day-chip { padding: 4px 10px; border-radius: 12px; font-size: .8125rem; font-weight: 500; background: var(--surface-alt); border: 1px solid var(--border); color: var(--text-muted); }
        .day-chip.active { background: var(--brand-subtle); border-color: var(--brand); color: var(--brand-dark); }
        .tijdvoorkeur { display: inline-block; margin-top: var(--s2); padding: 3px 10px; border-radius: 10px; font-size: .8125rem; background: var(--surface-alt); color: var(--text-sub); }
        .voorkeur-notitie { margin-top: var(--s2); font-size: .875rem; color: var(--text-sub); font-style: italic; }

        /* Documents */
        .docs-security-note { display: flex; align-items: center; gap: var(--s2); font-size: .8125rem; color: var(--text-muted); margin-bottom: var(--s4); }
        .doc-list { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
        .doc-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s3) var(--s4); border-bottom: 1px solid var(--border); }
        .doc-row:last-child { border-bottom: none; }
        .doc-badge { flex-shrink: 0; padding: 2px 8px; border-radius: 10px; font-size: .75rem; font-weight: 700; background: var(--brand-subtle); color: var(--brand-dark); white-space: nowrap; }
        .doc-info { flex: 1; min-width: 0; }
        .doc-name { display: block; font-size: .9375rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .doc-meta { font-size: .8125rem; color: var(--text-muted); }
        .doc-actions { display: flex; gap: var(--s2); flex-shrink: 0; }
        .text-danger { color: #dc2626; }

        @media (max-width: 900px) {
          .detail-grid { grid-template-columns: 1fr; }
          .profile-grid { grid-template-columns: 1fr; }
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
