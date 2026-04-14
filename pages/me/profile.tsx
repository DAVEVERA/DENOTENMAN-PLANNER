import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import TeamLayout from '@/components/layout/TeamLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, EmployeeProfile, VoorkeurPlanning, Location } from '@/types'
import { DAYS, DAY_SHORT } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

const TIJDVOORKEUR_OPTIONS = [
  { value: 'geen',    label: 'Geen voorkeur' },
  { value: 'ochtend', label: 'Ochtend' },
  { value: 'middag',  label: 'Middag' },
  { value: 'avond',   label: 'Avond' },
]

const LANDEN = [
  'Nederland', 'België', 'Duitsland', 'Polen', 'Turkije', 'Marokko',
  'Suriname', 'Indonesië', 'Antillen', 'Aruba', 'Anders',
]

export default function ProfilePage({ user }: Props) {
  const [profile, setProfile]   = useState<EmployeeProfile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile]       = useState<{ base64: string; mime: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Formulier state
  const [form, setForm] = useState({
    voornaam: '', achternaam: '', adres: '', postcode: '', stad: '',
    ice_contact: '', geboortedatum: '', geboorteplaats: '',
    land_van_herkomst: 'Nederland', bijzonderheden: '',
  })
  const [dagVoorkeur, setDagVoorkeur] = useState<Partial<Record<string, boolean>>>({})
  const [tijdvoorkeur, setTijdvoorkeur] = useState<string>('geen')
  const [voorkeurNotitie, setVoorkeurNotitie] = useState('')

  useEffect(() => {
    fetch('/api/me/profile')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const p: EmployeeProfile = d.data
          setProfile(p)
          if (p.avatar_url) setAvatarPreview(p.avatar_url)
          setForm({
            voornaam:          p.voornaam ?? '',
            achternaam:        p.achternaam ?? '',
            adres:             p.adres ?? '',
            postcode:          p.postcode ?? '',
            stad:              p.stad ?? '',
            ice_contact:       p.ice_contact ?? '',
            geboortedatum:     p.geboortedatum ?? '',
            geboorteplaats:    p.geboorteplaats ?? '',
            land_van_herkomst: p.land_van_herkomst ?? 'Nederland',
            bijzonderheden:    p.bijzonderheden ?? '',
          })
          if (p.voorkeur_planning) {
            setDagVoorkeur(p.voorkeur_planning.dagen ?? {})
            setTijdvoorkeur(p.voorkeur_planning.tijdvoorkeur ?? 'geen')
            setVoorkeurNotitie(p.voorkeur_planning.notitie ?? '')
          }
        }
        setLoading(false)
      })
  }, [])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Profielfoto mag maximaal 5 MB zijn')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, base64] = result.split(',')
      const mime = header.match(/data:([^;]+)/)?.[1] ?? ''
      setAvatarPreview(result)
      setAvatarFile({ base64, mime })
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)

    const voorkeur_planning: VoorkeurPlanning = {
      dagen:        dagVoorkeur as Partial<Record<typeof DAYS[number], boolean>>,
      tijdvoorkeur: (tijdvoorkeur as VoorkeurPlanning['tijdvoorkeur']) ?? null,
      notitie:      voorkeurNotitie || null,
    }

    const body: Record<string, unknown> = { ...form, voorkeur_planning }
    if (avatarFile) {
      body.avatar_base64 = avatarFile.base64
      body.avatar_mime   = avatarFile.mime
    }

    const r = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await r.json()
    setSaving(false)
    if (!d.success) { setError(d.message ?? 'Opslaan mislukt'); return }
    setProfile(d.data)
    setAvatarFile(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  if (loading) return (
    <TeamLayout user={user} location={locProp}>
      <div className="loading-row"><Spinner /> Profiel laden…</div>
    </TeamLayout>
  )

  if (!user.employee_id) return (
    <TeamLayout user={user} location={locProp}>
      <div className="no-emp">
        <div className="no-emp-icon">👤</div>
        <p>Geen medewerker gekoppeld aan dit account.</p>
        <p className="text-muted">Neem contact op met de beheerder.</p>
      </div>
    </TeamLayout>
  )

  const initials = [form.voornaam, form.achternaam]
    .filter(Boolean).map(s => s[0].toUpperCase()).join('') || user.display_name[0].toUpperCase()

  return (
    <TeamLayout user={user} location={locProp}>
      <div className="profile-page">

        {/* ── Header: avatar + naam ──────────────────────────────── */}
        <div className="profile-header">
          <div className="avatar-wrap">
            <div className="avatar-circle" onClick={() => fileInputRef.current?.click()} title="Profielfoto wijzigen">
              {avatarPreview
                ? <Image src={avatarPreview} alt="Profielfoto" fill sizes="96px" className="avatar-img" />
                : <span className="avatar-initials">{initials}</span>
              }
              <div className="avatar-overlay">
                <span className="avatar-overlay-text">Wijzigen</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="profile-header-info">
            <h1 className="profile-name">
              {form.voornaam || form.achternaam
                ? `${form.voornaam} ${form.achternaam}`.trim()
                : user.display_name}
            </h1>
            <p className="profile-role">{user.role === 'admin' ? 'Beheerder' : user.role === 'manager' ? 'Manager' : 'Medewerker'}</p>
            {profile?.updated_at && (
              <p className="profile-updated">
                Bijgewerkt: {new Date(profile.updated_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {saved && <div className="alert alert-success" role="status">Profiel opgeslagen!</div>}

          {/* ── Persoonlijke gegevens ──────────────────────────────────── */}
          <div className="section-card">
            <h2 className="section-title">Persoonlijke gegevens</h2>
            <div className="form-grid">

              <div className="form-group">
                <label htmlFor="voornaam" className="form-label required">Voornaam</label>
                <input id="voornaam" className="form-control" required value={form.voornaam}
                  onChange={e => setForm(f => ({ ...f, voornaam: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="achternaam" className="form-label required">Achternaam</label>
                <input id="achternaam" className="form-control" required value={form.achternaam}
                  onChange={e => setForm(f => ({ ...f, achternaam: e.target.value }))} />
              </div>

              <div className="form-group">
                <label htmlFor="geboortedatum" className="form-label">Geboortedatum</label>
                <input id="geboortedatum" type="date" className="form-control" value={form.geboortedatum}
                  onChange={e => setForm(f => ({ ...f, geboortedatum: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="geboorteplaats" className="form-label">Geboorteplaats</label>
                <input id="geboorteplaats" className="form-control" value={form.geboorteplaats}
                  onChange={e => setForm(f => ({ ...f, geboorteplaats: e.target.value }))} placeholder="bijv. Amsterdam" />
              </div>

              <div className="form-group">
                <label htmlFor="land" className="form-label">Land van herkomst</label>
                <select id="land" className="form-control" value={form.land_van_herkomst}
                  onChange={e => setForm(f => ({ ...f, land_van_herkomst: e.target.value }))}>
                  {LANDEN.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>

            </div>
          </div>

          {/* ── Contactgegevens ────────────────────────────────────────── */}
          <div className="section-card">
            <h2 className="section-title">Contactgegevens</h2>
            <div className="form-grid">

              <div className="form-group">
                <label htmlFor="adres" className="form-label">Adres (straat + huisnummer)</label>
                <input id="adres" className="form-control" value={form.adres}
                  onChange={e => setForm(f => ({ ...f, adres: e.target.value }))} placeholder="bijv. Marktstraat 12" />
              </div>
              <div className="form-group form-group-narrow">
                <label htmlFor="postcode" className="form-label">Postcode</label>
                <input id="postcode" className="form-control" value={form.postcode}
                  onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} placeholder="1234 AB" maxLength={7} />
              </div>
              <div className="form-group">
                <label htmlFor="stad" className="form-label">Woonplaats</label>
                <input id="stad" className="form-control" value={form.stad}
                  onChange={e => setForm(f => ({ ...f, stad: e.target.value }))} placeholder="bijv. Tilburg" />
              </div>

              <div className="form-group">
                <label htmlFor="ice" className="form-label">
                  ICE-contact
                  <span className="form-hint"> (In geval van nood — naam + telefoonnummer)</span>
                </label>
                <input id="ice" className="form-control" value={form.ice_contact}
                  onChange={e => setForm(f => ({ ...f, ice_contact: e.target.value }))}
                  placeholder="bijv. Jan Smits — 06-12345678" />
              </div>

            </div>
          </div>

          {/* ── Bijzonderheden ─────────────────────────────────────────── */}
          <div className="section-card">
            <h2 className="section-title">Bijzonderheden</h2>
            <div className="form-group">
              <label htmlFor="bijzonderheden" className="form-label">
                Relevante informatie
                <span className="form-hint"> (allergieën, beperkingen, opmerkingen)</span>
              </label>
              <textarea id="bijzonderheden" className="form-control textarea" rows={3}
                value={form.bijzonderheden}
                onChange={e => setForm(f => ({ ...f, bijzonderheden: e.target.value }))}
                placeholder="Vul hier in wat de werkgever over jou moet weten…" />
            </div>
          </div>

          {/* ── Planningsvoorkeur ──────────────────────────────────────── */}
          <div className="section-card">
            <h2 className="section-title">Planningsvoorkeur</h2>
            <p className="section-sub">Geef aan wanneer je het liefst werkt. Dit helpt bij het opstellen van het rooster.</p>

            <div className="form-group">
              <label className="form-label">Voorkeursdagen</label>
              <div className="days-checkboxes">
                {DAYS.map(day => (
                  <label key={day} className={`day-chip${dagVoorkeur[day] ? ' active' : ''}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={Boolean(dagVoorkeur[day])}
                      onChange={e => setDagVoorkeur(d => ({ ...d, [day]: e.target.checked }))}
                    />
                    {DAY_SHORT[day]}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="tijdvoorkeur" className="form-label">Tijdsvoorkeur</label>
                <select id="tijdvoorkeur" className="form-control" value={tijdvoorkeur}
                  onChange={e => setTijdvoorkeur(e.target.value)}>
                  {TIJDVOORKEUR_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="voorkeur-notitie" className="form-label">Aanvullende toelichting</label>
                <input id="voorkeur-notitie" className="form-control" value={voorkeurNotitie}
                  onChange={e => setVoorkeurNotitie(e.target.value)}
                  placeholder="bijv. Liefst niet op vrijdagavond" />
              </div>
            </div>
          </div>

          {/* ── Opslaan ───────────────────────────────────────────────── */}
          <div className="form-footer">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><Spinner /> Opslaan…</> : 'Profiel opslaan'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .profile-page { max-width: 760px; }

        .loading-row { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }
        .no-emp { text-align: center; padding: var(--s12); }
        .no-emp-icon { font-size: 3rem; margin-bottom: var(--s3); }

        /* ── Header ── */
        .profile-header {
          display: flex; align-items: center; gap: var(--s5);
          margin-bottom: var(--s6);
          padding: var(--s5);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .avatar-wrap { flex-shrink: 0; }
        .avatar-circle {
          position: relative; width: 88px; height: 88px;
          border-radius: 50%; overflow: hidden; cursor: pointer;
          background: var(--brand-subtle); border: 2px solid var(--border);
          display: flex; align-items: center; justify-content: center;
        }
        .avatar-circle:hover .avatar-overlay { opacity: 1; }
        .avatar-img { object-fit: cover; }
        .avatar-initials { font-size: 2rem; font-weight: 700; color: var(--brand-dark); }
        .avatar-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,.55);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .15s;
        }
        .avatar-overlay-text { color: #fff; font-size: .75rem; font-weight: 600; }

        .profile-header-info { flex: 1; min-width: 0; }
        .profile-name { margin: 0 0 3px; font-size: 1.375rem; font-weight: 700; }
        .profile-role { margin: 0 0 4px; font-size: .875rem; color: var(--text-muted); }
        .profile-updated { margin: 0; font-size: .8125rem; color: var(--text-muted); }

        /* ── Sections ── */
        .section-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
          margin-bottom: var(--s4);
        }
        .section-title {
          font-size: 1rem; font-weight: 700; color: var(--text);
          margin: 0 0 var(--s4); padding-bottom: var(--s3);
          border-bottom: 1px solid var(--border);
        }
        .section-sub { font-size: .875rem; color: var(--text-muted); margin: calc(-1 * var(--s2)) 0 var(--s4); }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group-narrow { max-width: 140px; }
        .form-label { font-size: .875rem; font-weight: 500; }
        .form-hint { font-weight: 400; color: var(--text-muted); font-size: .8125rem; }
        .textarea { resize: vertical; min-height: 80px; }

        /* ── Day chips ── */
        .days-checkboxes { display: flex; flex-wrap: wrap; gap: var(--s2); }
        .day-chip {
          cursor: pointer; padding: 8px 14px; border-radius: 20px; min-height: 40px;
          display: flex; align-items: center;
          font-size: .875rem; font-weight: 500;
          background: var(--surface-alt); border: 1px solid var(--border);
          color: var(--text-sub); transition: background .12s, color .12s, border-color .12s;
          user-select: none;
        }
        .day-chip.active {
          background: var(--brand-subtle); border-color: var(--brand);
          color: var(--brand-dark);
        }

        .form-footer { margin-top: var(--s5); display: flex; justify-content: flex-end; }

        /* ── Alerts ── */
        .alert { padding: var(--s3) var(--s4); border-radius: var(--radius); font-size: .9375rem; margin-bottom: var(--s4); }
        .alert-danger { background: var(--danger-subtle, #fef2f2); border: 1px solid var(--danger-border, #fecaca); color: var(--danger, #dc2626); }
        .alert-success { background: var(--success-subtle, #f0fdf4); border: 1px solid var(--success-border, #bbf7d0); color: var(--success, #16a34a); }

        @media (max-width: 640px) {
          .form-grid { grid-template-columns: 1fr; }
          .form-group-narrow { max-width: 100%; }
          .profile-header { gap: var(--s3); }
          .avatar-circle { width: 72px; height: 72px; }
          .profile-name { font-size: 1.2rem; }
        }
      `}</style>
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
