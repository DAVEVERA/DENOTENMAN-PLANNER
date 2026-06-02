import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import Spinner from '@/components/ui/Spinner'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { Employee, SessionUser } from '@/types'

interface Props { user: SessionUser }

const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = today.slice(0, 8) + '01'

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV', desc: 'Voor Excel of boekhouding' },
  { value: 'excel', label: 'Excel', desc: '.xlsx met samenvatting' },
  { value: 'pdf', label: 'PDF', desc: 'Rapport voor administratie' },
  { value: 'json', label: 'JSON', desc: 'Voor koppelingen' },
]

export default function ExpenseExportPage({ user }: Props) {
  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(today)
  const [format, setFormat] = useState('excel')
  const [status, setStatus] = useState('approved')
  const [claimType, setClaimType] = useState('all')
  const [employeeId, setEmployeeId] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accountantEmail, setAccountantEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/employees?all=1').then(r => r.json()).then(d => setEmployees(d.data ?? []))
    fetch('/api/settings').then(r => r.json()).then(d => setAccountantEmail(d.data?.accountant_email ?? ''))
  }, [])

  async function doExport() {
    setLoading(true)
    setMessage('')
    const body: Record<string, unknown> = { format, from, to, status, email: sendEmail }
    if (claimType !== 'all') body.claim_type = claimType
    if (employeeId) body.employee_id = employeeId

    const r = await fetch('/api/expenses/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (sendEmail) {
      setLoading(false)
      setMessage(r.headers.get('X-Email-Sent') === '1'
        ? `Export verzonden naar ${accountantEmail}`
        : 'E-mail verzenden mislukt. Controleer het boekhouderadres en SMTP-instellingen.')
      return
    }

    const blob = await r.blob()
    const ext = format === 'excel' ? 'xlsx' : format
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `declaraties-${from}-${to}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <AdminLayout user={user} title="Declaraties exporteren">
      <div className="export-layout">
        <div className="export-card">
          <div className="export-head">
            <div>
              <h2>Declaraties exporteren</h2>
              <p>Exporteer beoordeelde declaraties voor de boekhouding.</p>
            </div>
            <Link href="/admin/expenses" className="btn btn-outline btn-sm">Beoordelen</Link>
          </div>

          <h3 className="section-title">Periode</h3>
          <div className="date-range">
            <div className="form-group">
              <label className="form-label" htmlFor="exp-from">Van</label>
              <input id="exp-from" type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-to">Tot</label>
              <input id="exp-to" type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          <h3 className="section-title">Filters</h3>
          <div className="filter-row">
            <div className="form-group">
              <label className="form-label" htmlFor="exp-status">Status</label>
              <select id="exp-status" className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="approved">Goedgekeurd</option>
                <option value="pending">In behandeling</option>
                <option value="rejected">Afgewezen</option>
                <option value="all">Alles</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-type">Type</label>
              <select id="exp-type" className="form-control" value={claimType} onChange={e => setClaimType(e.target.value)}>
                <option value="all">Alle types</option>
                <option value="reiskosten">Reiskosten</option>
                <option value="overuren">Overuren</option>
                <option value="overig">Overig</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-employee">Medewerker</label>
              <select id="exp-employee" className="form-control" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                <option value="">Alle medewerkers</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
          </div>

          <h3 className="section-title">Formaat</h3>
          <div className="format-grid">
            {FORMAT_OPTIONS.map(option => (
              <label key={option.value} className={`format-btn${format === option.value ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="expense-format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={() => setFormat(option.value)}
                  className="sr-only"
                />
                <span className="format-label">{option.label}</span>
                <span className="format-desc">{option.desc}</span>
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
              Geen boekhouder e-mailadres ingesteld. <Link href="/admin/settings" className="link">Instellen</Link>
            </div>
          )}
          {message && <div className="alert alert-info mt-3">{message}</div>}

          <div className="export-actions">
            <button type="button" className="btn btn-primary" onClick={doExport} disabled={loading}>
              {loading ? <><Spinner /> Genereren...</> : sendEmail ? 'Exporteren & verzenden' : 'Downloaden'}
            </button>
          </div>
        </div>

        <div className="presets-card">
          <h3 className="section-title">Workflow</h3>
          <div className="workflow-step active">1. Declaratie beoordelen</div>
          <div className="workflow-step active">2. Goedgekeurde declaraties exporteren</div>
          <div className="workflow-note">
            De standaard status is Goedgekeurd, zodat de export klaar is voor de boekhouding.
          </div>
        </div>
      </div>

      <style jsx>{`
        .export-layout { display: grid; grid-template-columns: 1fr 300px; gap: var(--s5); }
        .export-card, .presets-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
        }
        .export-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--s3); margin-bottom: var(--s5); }
        .export-head h2 { margin: 0; font-size: 1.25rem; font-weight: 800; }
        .export-head p { margin: 4px 0 0; color: var(--text-muted); font-size: .9375rem; }
        .section-title { font-size: .875rem; font-weight: 700; color: var(--text-muted); letter-spacing: .05em; text-transform: uppercase; margin: var(--s5) 0 var(--s3); }
        .section-title:first-child { margin-top: 0; }
        .date-range { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s3); }
        .filter-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--s3); }
        .format-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s2); }
        .format-btn {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: var(--s3); border-radius: var(--radius);
          border: 2px solid var(--border); background: var(--surface-alt);
        }
        .format-btn.active { border-color: var(--brand); background: var(--brand-light); }
        .format-label { font-size: .875rem; font-weight: 700; }
        .format-desc { font-size: .75rem; color: var(--text-muted); text-align: center; }
        .check-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: .9375rem; }
        .mt-2 { margin-top: var(--s2); }
        .mt-3 { margin-top: var(--s3); }
        .export-actions { margin-top: var(--s5); }
        .export-actions .btn { width: 100%; justify-content: center; }
        .workflow-step { border: 1px solid var(--border); border-radius: var(--radius); padding: var(--s3); margin-bottom: var(--s2); font-weight: 600; }
        .workflow-step.active { border-color: var(--brand); background: var(--brand-light); }
        .workflow-note { color: var(--text-muted); font-size: .875rem; margin-top: var(--s4); }
        @media (max-width: 900px) {
          .export-layout { grid-template-columns: 1fr; }
          .filter-row { grid-template-columns: 1fr; }
          .format-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 520px) {
          .date-range { grid-template-columns: 1fr; }
          .export-head { flex-direction: column; }
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
