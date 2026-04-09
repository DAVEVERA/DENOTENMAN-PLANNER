import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, AppSettings } from '@/types'

interface Props { user: SessionUser }

export default function SettingsPage({ user }: Props) {
  const [form, setForm]   = useState<AppSettings>({
    accountant_email: '', accountant_name: 'Boekhouder',
    export_auto_email: false,
    location_markt_name: 'De Notenkar (Markt)',
    location_nootmagazijn_name: 'Het Nootmagazijn',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.success) setForm(f => ({ ...f, ...d.data }))
    })
  }, [])

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
              <label className="form-label">Naam Markt-locatie</label>
              <input
                className="form-control"
                value={form.location_markt_name}
                onChange={e => set('location_markt_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Naam Nootmagazijn-locatie</label>
              <input
                className="form-control"
                value={form.location_nootmagazijn_name}
                onChange={e => set('location_nootmagazijn_name', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">Push notificaties (PWA)</h3>
          <div className="settings-info-box">
            <p>VAPID-sleutels worden ingesteld via omgevingsvariabelen in <code>.env.local</code>:</p>
            <code className="env-block">
              VAPID_PUBLIC_KEY=…{'\n'}
              VAPID_PRIVATE_KEY=…{'\n'}
              VAPID_SUBJECT=mailto:admin@denotenkar.nl
            </code>
            <p className="text-muted text-sm">Genereer sleutels met: <code>npx web-push generate-vapid-keys</code></p>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-section-title">E-mail (SMTP)</h3>
          <div className="settings-info-box">
            <p>SMTP-configuratie via omgevingsvariabelen in <code>.env.local</code>:</p>
            <code className="env-block">
              SMTP_HOST=smtp.gmail.com{'\n'}
              SMTP_PORT=587{'\n'}
              SMTP_USER=jouw@email.nl{'\n'}
              SMTP_PASS=app-wachtwoord{'\n'}
              SMTP_FROM=Planner &lt;planner@denotenkar.nl&gt;
            </code>
          </div>
        </div>

        <div className="form-footer">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : 'Opslaan'}
          </button>
        </div>
      </form>

      <style jsx>{`
        .settings-form { max-width: 680px; }
        .settings-section { margin-bottom: var(--s6); }
        .settings-section-title {
          font-size: .875rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
          color: var(--text-muted); margin: 0 0 var(--s4);
          padding-bottom: var(--s2); border-bottom: 1px solid var(--border);
        }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); margin-bottom: var(--s3); }
        .form-hint { display: block; font-size: .8125rem; color: var(--text-muted); margin-top: 4px; }
        .check-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: .9375rem; }
        .settings-info-box {
          background: var(--surface-alt); border: 1px solid var(--border);
          border-radius: var(--radius); padding: var(--s4);
          font-size: .875rem;
        }
        .settings-info-box p { margin: 0 0 var(--s2); }
        .env-block {
          display: block; background: var(--text); color: #e8d5b0;
          padding: var(--s3); border-radius: var(--radius);
          font-size: .8125rem; white-space: pre; margin: var(--s2) 0;
        }
        .form-footer { margin-top: var(--s5); }

        @media (max-width: 480px) { .form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
