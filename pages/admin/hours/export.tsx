import { useState, useEffect } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Employee, Location } from '@/types'

interface Props { user: SessionUser }

const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 8) + '01'

const FORMAT_OPTIONS = [
  { value: 'csv',   label: 'CSV',   icon: '📋', desc: 'Universeel, opent in Excel' },
  { value: 'excel', label: 'Excel', icon: '📊', desc: '.xlsx bestand' },
  { value: 'pdf',   label: 'PDF',   icon: '📄', desc: 'Kant-en-klaar rapport' },
  { value: 'json',  label: 'JSON',  icon: '🔧', desc: 'Machineleesbaar' },
]

export default function ExportPage({ user }: Props) {
  const [from, setFrom]         = useState(firstOfMonth)
  const [to, setTo]             = useState(today)
  const [format, setFormat]     = useState('excel')
  const [location, setLocation] = useState<Location | ''>('')
  const [empFilter, setEmpFilter] = useState('')
  const [processed, setProcessed] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]   = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [accountantEmail, setAccountantEmail] = useState('')

  useEffect(() => {
    fetch('/api/employees?all=1').then(r => r.json()).then(d => setEmployees(d.data ?? []))
    fetch('/api/settings').then(r => r.json()).then(d => setAccountantEmail(d.data?.accountant_email ?? ''))
  }, [])

  async function doExport() {
    setLoading(true); setEmailSent(false); setEmailError('')
    const body: Record<string, unknown> = { format, from, to, email: sendEmail }
    if (location)   body.location    = location
    if (empFilter)  body.employee_id = empFilter
    if (processed !== '') body.is_processed = processed

    const r = await fetch('/api/hours/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (sendEmail) {
      const sent = r.headers.get('X-Email-Sent') === '1'
      setLoading(false)
      if (sent) {
        setEmailSent(true)
      } else {
        setEmailError('E-mail verzenden mislukt. Controleer de SMTP-instellingen in de beheerinstellingen.')
      }
      return
    }

    const blob = await r.blob()
    const ext  = format === 'excel' ? 'xlsx' : format
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `uren-${from}-${to}.${ext}`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <AdminLayout user={user} title="Exporteren">
      <div className="export-layout">
        {/* ── Options ── */}
        <div className="export-card">
          <h3 className="section-title">Periode</h3>
          <div className="date-range">
            <div className="form-group">
              <label className="form-label" htmlFor="export-from">Van</label>
              <input type="date" id="export-from" className="form-control" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="export-to">Tot</label>
              <input type="date" id="export-to" className="form-control" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          <h3 className="section-title">Filters</h3>
          <div className="filter-row">
            <div className="form-group">
              <label className="form-label" htmlFor="filter-employee">Medewerker</label>
              <select id="filter-employee" className="form-control" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
                <option value="">Alle medewerkers</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filter-location">Locatie</label>
              <select id="filter-location" className="form-control" value={location} onChange={e => setLocation(e.target.value as Location | '')}>
                <option value="">Alle locaties</option>
                <option value="markt">De Notenkar (Markt)</option>
                <option value="nootmagazijn">Het Nootmagazijn</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filter-status">Status</label>
              <select id="filter-status" className="form-control" value={processed} onChange={e => setProcessed(e.target.value)}>
                <option value="">Alle</option>
                <option value="0">Onverwerkt</option>
                <option value="1">Verwerkt</option>
              </select>
            </div>
          </div>

          <h3 className="section-title">Formaat</h3>
          <div className="format-grid">
            {FORMAT_OPTIONS.map(f => (
              <label key={f.value} className={`format-btn${format === f.value ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="export-format"
                  value={f.value}
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                  className="sr-only"
                />
                <span className="format-icon">{f.icon}</span>
                <span className="format-label">{f.label}</span>
                <span className="format-desc">{f.desc}</span>
              </label>
            ))}
          </div>

          <h3 className="section-title">Verzenden</h3>
          <label className="check-label">
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
            <span>Stuur naar boekhouder{accountantEmail && ` (${accountantEmail})`}</span>
          </label>
          {sendEmail && !accountantEmail && (
            <div className="alert alert-warning mt-2">
              Geen boekhouder e-mailadres ingesteld. <Link href="/admin/settings" className="link">Instellen →</Link>
            </div>
          )}

          {emailSent && (
            <div className="alert alert-success mt-3">
              Export verzonden naar {accountantEmail}
            </div>
          )}
          {emailError && (
            <div className="alert alert-danger mt-3">
              {emailError}
            </div>
          )}

          <div className="export-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={doExport}
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" /> Genereren…</>
              ) : sendEmail ? (
                '📤 Exporteren & verzenden'
              ) : (
                '⬇ Downloaden'
              )}
            </button>
          </div>
        </div>

        {/* ── Quick presets ── */}
        <div className="presets-card">
          <h3 className="section-title">Snelle selectie</h3>
          {[
            { label: 'Deze maand', from: today.slice(0,8)+'01', to: today },
            { label: 'Vorige maand', ...prevMonth() },
            { label: 'Dit kwartaal', ...thisQuarter() },
          ].map(p => (
            <button
              type="button"
              key={p.label}
              className="preset-btn"
              onClick={() => { setFrom(p.from); setTo(p.to) }}
            >
              {p.label}
              <span className="preset-range">{p.from} – {p.to}</span>
            </button>
          ))}

          <div className="export-info">
            <h4>Info</h4>
            <ul>
              <li>CSV / Excel openen in elke spreadsheet-app</li>
              <li>PDF is kant-en-klaar voor afdrukken</li>
              <li>JSON voor koppeling met externe systemen</li>
              <li>E-mail stuurt direct naar de ingestelde boekhouder</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .export-layout { display: grid; grid-template-columns: 1fr 300px; gap: var(--s5); }
        .export-card, .presets-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
        }
        .section-title { font-size: .875rem; font-weight: 700; color: var(--text-muted); letter-spacing: .05em; text-transform: uppercase; margin: 0 0 var(--s3); }
        .section-title + * { }
        .export-card .section-title { margin-top: var(--s5); }
        .export-card .section-title:first-child { margin-top: 0; }
        .date-range { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); margin-bottom: var(--s4); }
        .filter-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--s3); margin-bottom: var(--s4); }

        .format-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s2); margin-bottom: var(--s4); }
        .format-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: var(--s3); border-radius: var(--radius);
          border: 2px solid var(--border); background: var(--surface-alt);
          transition: border-color .15s, background .15s;
        }
        .format-btn.active { border-color: var(--brand); background: var(--brand-light); }
        .format-btn:hover:not(.active) { border-color: var(--text-muted); }
        .format-icon { font-size: 1.5rem; }
        .format-label { font-size: .875rem; font-weight: 700; }
        .format-desc { font-size: .6875rem; color: var(--text-muted); text-align: center; }

        .check-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: .9375rem; }
        .mt-2 { margin-top: var(--s2); }
        .mt-3 { margin-top: var(--s3); }
        .export-actions { margin-top: var(--s5); }
        .export-actions .btn { width: 100%; justify-content: center; }

        .presets-card .section-title { margin-top: 0; }
        .preset-btn {
          display: flex; flex-direction: column; gap: 2px;
          width: 100%; text-align: left; padding: var(--s3);
          border-radius: var(--radius); border: 1px solid var(--border);
          margin-bottom: var(--s2); background: var(--surface-alt);
          transition: background .15s;
        }
        .preset-btn:hover { background: var(--brand-light); border-color: var(--brand); }
        .preset-range { font-size: .75rem; color: var(--text-muted); }
        .export-info { margin-top: var(--s5); padding: var(--s4); background: var(--surface-alt); border-radius: var(--radius); }
        .export-info h4 { font-size: .875rem; font-weight: 600; margin: 0 0 var(--s2); }
        .export-info ul { margin: 0; padding-left: var(--s4); }
        .export-info li { font-size: .8125rem; color: var(--text-sub); margin-bottom: 4px; }

        @media (max-width: 900px) {
          .export-layout { grid-template-columns: 1fr; }
          .filter-row, .date-range { grid-template-columns: 1fr 1fr; }
          .format-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .filter-row, .date-range { grid-template-columns: 1fr; }
        }
      `}</style>
    </AdminLayout>
  )
}

function prevMonth() {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() - 1)
  const from = d.toISOString().slice(0, 10)
  d.setMonth(d.getMonth() + 1); d.setDate(0)
  return { from, to: d.toISOString().slice(0, 10) }
}

function thisQuarter() {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3)
  const from = new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10)
  const to   = new Date(d.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10)
  return { from, to }
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
