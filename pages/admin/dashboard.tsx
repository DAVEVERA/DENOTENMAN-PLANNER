import { useState, useEffect } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import { getSession } from '@/lib/auth'
import { currentWeekYear } from '@/lib/dateUtils'
import type { GetServerSideProps } from 'next'
import type { SessionUser } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser; week: number; year: number }

interface InsightCard { id: string; icon: string; title: string; message: string; severity: string }
interface EmployeeLoad {
  employeeId: number
  employeeName: string
  contractHours: number
  scheduledHours: number
  delta: number
  utilizationPct: number
}
interface Stats {
  employees: number
  openShifts: number
  pendingLeave: number
  pendingExpenses: number
}

const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

function weekDateRange(w: number, y: number) {
  const jan4 = new Date(y, 0, 4)
  const dow = jan4.getDay() || 7
  const mon = new Date(jan4)
  mon.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`
  return `${fmt(mon)} – ${fmt(sun)}`
}

function UtilBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 130)
  const fillPct = Math.min(clamped / 130 * 100, 100)
  const colorClass = pct > 110 ? 'util-over' : pct < 60 ? 'util-under' : 'util-ok'
  return (
    <div className="util-bar-track" aria-label={`${pct}%`}>
      <div
        className={`util-bar-fill ${colorClass}`}
        style={{ width: `${fillPct}%` }}
      />
    </div>
  )
}

export default function AdminDashboard({ user, week, year }: Props) {
  const [insights, setInsights]   = useState<InsightCard[]>([])
  const [loadData, setLoadData]   = useState<EmployeeLoad[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [loading, setLoading]     = useState(true)
  const [loc, setLoc]             = useState<'markt' | 'nootmagazijn'>('markt')

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Goedemorgen' : now.getHours() < 17 ? 'Goedemiddag' : 'Goedenavond'
  const firstName = user.display_name.split(' ')[0]

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/insights?week=${week}&year=${year}&location=${loc}`).then(r => r.json()),
      fetch(`/api/admin/insights?week=${week}&year=${year}&location=${loc}&type=load`).then(r => r.json()),
      fetch(`/api/admin/dashboard-stats`).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([ins, load, st]) => {
      if (ins.success)  setInsights(ins.data)
      if (load.success) setLoadData(load.data)
      if (st.success)   setStats(st.data)
      setLoading(false)
    })
  }, [week, year, loc])

  const QUICK_LINKS = [
    { href: '/admin', icon: '📅', label: 'Rooster', desc: 'Weekplanning beheren' },
    { href: '/admin/employees', icon: '👥', label: 'Medewerkers', desc: 'Team & contracten' },
    { href: '/admin/open-shifts', icon: '🔓', label: 'Open diensten', desc: 'Openstaande shifts' },
    { href: '/admin/leave', icon: '☂️', label: 'Verlof', desc: 'Aanvragen beoordelen' },
    { href: '/admin/expenses', icon: '🧾', label: 'Declaraties', desc: 'Kosten & bonnen' },
    { href: '/admin/hours', icon: '⏱️', label: 'Uren', desc: 'Gewerkte uren' },
    { href: '/admin/hours/export', icon: '📤', label: 'Exporteren', desc: 'Naar CSV / Excel' },
    { href: '/admin/backup', icon: '💾', label: 'Backup', desc: 'Data-exports' },
    { href: '/admin/gesprekken', icon: '🎩', label: 'Support AI', desc: 'Chat met Support' },
    { href: '/admin/settings', icon: '⚙️', label: 'Instellingen', desc: 'Systeeminstellingen' },
  ]

  return (
    <AdminLayout user={user} title="Dashboard">

      {/* ── Greeting ── */}
      <div className="db-greeting">
        <div>
          <h2 className="db-hello">{greeting}, {firstName} 👋</h2>
          <p className="db-sub">
            Week {week} · {year} &nbsp;·&nbsp; {weekDateRange(week, year)}
          </p>
        </div>
        <div className="db-loc-tabs" role="tablist" aria-label="Locatie">
          {(['markt', 'nootmagazijn'] as const).map(l => (
            <button
              key={l}
              role="tab"
              aria-selected={loc === l ? 'true' : 'false'}
              className={`db-loc-tab${loc === l ? ' active' : ''}`}
              data-loc={l}
              onClick={() => setLoc(l)}
            >
              {l === 'markt' ? 'De Notenkar' : 'Het Nootmagazijn'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Stat cards ── */}
      {stats && (
        <div className="db-kpi-row">
          <div className="db-kpi-card">
            <span className="db-kpi-icon">👥</span>
            <div className="db-kpi-body">
              <span className="db-kpi-val">{stats.employees}</span>
              <span className="db-kpi-label">Medewerkers actief</span>
            </div>
          </div>
          <div className={`db-kpi-card${stats.openShifts > 0 ? ' kpi-warn' : ''}`}>
            <span className="db-kpi-icon">🔓</span>
            <div className="db-kpi-body">
              <span className="db-kpi-val">{stats.openShifts}</span>
              <span className="db-kpi-label">Open diensten</span>
            </div>
          </div>
          <div className={`db-kpi-card${stats.pendingLeave > 0 ? ' kpi-warn' : ''}`}>
            <span className="db-kpi-icon">☂️</span>
            <div className="db-kpi-body">
              <span className="db-kpi-val">{stats.pendingLeave}</span>
              <span className="db-kpi-label">Verlofaanvragen open</span>
            </div>
          </div>
          <div className={`db-kpi-card${stats.pendingExpenses > 0 ? ' kpi-warn' : ''}`}>
            <span className="db-kpi-icon">🧾</span>
            <div className="db-kpi-body">
              <span className="db-kpi-val">{stats.pendingExpenses}</span>
              <span className="db-kpi-label">Declaraties open</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="db-loading"><Spinner /> Laden…</div>
      ) : (
        <div className="db-main-grid">

          {/* ── Insights / Alerts ── */}
          <section className="db-section db-alerts" aria-label="Planningsanalyse">
            <h3 className="db-section-title">
              <span>🔍</span> Planningsanalyse
              <span className="db-section-sub">Week {week} · {weekDateRange(week, year)}</span>
            </h3>
            {insights.length === 0 ? (
              <div className="db-empty">
                <span className="db-empty-icon">✅</span>
                <span>Alles ziet er goed uit voor deze week!</span>
              </div>
            ) : (
              <div className="db-insight-list">
                {insights.map(card => (
                  <div key={card.id} className={`db-insight-card sev-${card.severity}`}>
                    <span className="db-insight-ico">{card.icon}</span>
                    <div className="db-insight-body">
                      <span className="db-insight-title">{card.title}</span>
                      <span className="db-insight-msg">{card.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Employee Load Balance ── */}
          <section className="db-section db-load" aria-label="Belasting medewerkers">
            <h3 className="db-section-title">
              <span>⚖️</span> Uren vs contract
              <span className="db-section-sub">Huidige week</span>
            </h3>
            {loadData.length === 0 ? (
              <div className="db-empty">
                <span className="db-empty-icon">👥</span>
                <span>Geen medewerkers gevonden.</span>
              </div>
            ) : (
              <div className="db-load-list">
                {loadData.map(emp => (
                  <div key={emp.employeeId} className="db-load-row">
                    <div className="db-load-info">
                      <span className="db-load-name">{emp.employeeName}</span>
                      <span className="db-load-hours">
                        {emp.scheduledHours}u&nbsp;/&nbsp;{emp.contractHours}u
                      </span>
                      <span className={`db-load-pct ${emp.utilizationPct > 110 ? 'pct-over' : emp.utilizationPct < 60 ? 'pct-under' : 'pct-ok'}`}>
                        {emp.utilizationPct}%
                      </span>
                    </div>
                    <UtilBar pct={emp.utilizationPct} />
                  </div>
                ))}
                <div className="db-load-legend">
                  <span className="leg-item leg-ok">● Normaal (60–110%)</span>
                  <span className="leg-item leg-under">● Onderbenut (&lt;60%)</span>
                  <span className="leg-item leg-over">● Overbelast (&gt;110%)</span>
                </div>
              </div>
            )}
          </section>

        </div>
      )}

      {/* ── Quick navigation ── */}
      <section className="db-section db-quicknav" aria-label="Snelnavigatie">
        <h3 className="db-section-title"><span>🚀</span> Snelnavigatie</h3>
        <div className="db-quicknav-grid">
          {QUICK_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="db-qlink">
              <span className="db-qlink-icon">{l.icon}</span>
              <div className="db-qlink-body">
                <span className="db-qlink-label">{l.label}</span>
                <span className="db-qlink-desc">{l.desc}</span>
              </div>
              <span className="db-qlink-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      <style jsx>{`
        /* ── Greeting ── */
        .db-greeting {
          display: flex; align-items: flex-start; justify-content: space-between;
          flex-wrap: wrap; gap: var(--s3); margin-bottom: var(--s6);
        }
        .db-hello { font-size: 1.375rem; font-weight: 700; margin: 0; line-height: 1.2; }
        .db-sub   { font-size: .875rem; color: var(--text-muted); margin: 4px 0 0; }

        .db-loc-tabs { display: flex; gap: 4px; background: var(--surface-alt); border-radius: var(--radius); padding: 3px; }
        .db-loc-tab {
          padding: 7px 14px; border-radius: calc(var(--radius) - 2px);
          font-size: .8125rem; font-weight: 500; color: var(--text-sub);
          transition: background .15s, color .15s;
        }
        .db-loc-tab.active[data-loc="markt"]        { background: var(--markt); color: #fff; }
        .db-loc-tab.active[data-loc="nootmagazijn"] { background: var(--noot);  color: #fff; }
        .db-loc-tab:not(.active):hover { background: var(--border); color: var(--text); }

        /* ── KPI row ── */
        .db-kpi-row {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s3);
          margin-bottom: var(--s5);
        }
        .db-kpi-card {
          display: flex; align-items: center; gap: var(--s3);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s4) var(--s4);
          transition: transform .15s, box-shadow .15s;
        }
        .db-kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.08); }
        .db-kpi-card.kpi-warn { border-left: 3px solid #E65100; }
        .db-kpi-icon { font-size: 1.75rem; flex-shrink: 0; }
        .db-kpi-body { display: flex; flex-direction: column; gap: 1px; }
        .db-kpi-val  { font-size: 1.625rem; font-weight: 800; line-height: 1; }
        .db-kpi-label{ font-size: .75rem; color: var(--text-muted); }

        /* ── Loading ── */
        .db-loading { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }

        /* ── Main grid ── */
        .db-main-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--s4);
          margin-bottom: var(--s5);
        }

        /* ── Sections ── */
        .db-section {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s5);
        }
        .db-section-title {
          display: flex; align-items: center; gap: var(--s2);
          font-size: 1rem; font-weight: 700; margin: 0 0 var(--s4);
          flex-wrap: wrap;
        }
        .db-section-sub {
          font-size: .75rem; font-weight: 400; color: var(--text-muted);
          margin-left: auto;
        }

        /* ── Empty state ── */
        .db-empty {
          display: flex; flex-direction: column; align-items: center; gap: var(--s2);
          padding: var(--s6); color: var(--text-muted); font-size: .9375rem; text-align: center;
        }
        .db-empty-icon { font-size: 2rem; }

        /* ── Insights ── */
        .db-insight-list { display: flex; flex-direction: column; gap: var(--s2); }
        .db-insight-card {
          display: flex; align-items: flex-start; gap: var(--s2);
          padding: var(--s3); border-radius: var(--radius); border: 1px solid var(--border);
          background: var(--bg); transition: transform .13s;
        }
        .db-insight-card:hover { transform: translateX(3px); }
        .sev-success { border-left: 3px solid #2E7D32; }
        .sev-warning { border-left: 3px solid #E65100; }
        .sev-danger  { border-left: 3px solid #dc3545; }
        .sev-info    { border-left: 3px solid var(--brand); }
        .db-insight-ico  { font-size: 1.125rem; flex-shrink: 0; padding-top: 1px; }
        .db-insight-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .db-insight-title{ font-size: .8125rem; font-weight: 700; }
        .db-insight-msg  { font-size: .75rem; color: var(--text-sub); line-height: 1.4; }

        /* ── Load balance ── */
        .db-load-list { display: flex; flex-direction: column; gap: var(--s2); }
        .db-load-row  { display: flex; flex-direction: column; gap: 4px; }
        .db-load-info { display: flex; align-items: center; gap: var(--s2); }
        .db-load-name { font-size: .8125rem; font-weight: 500; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .db-load-hours{ font-size: .75rem; color: var(--text-muted); flex-shrink: 0; }
        .db-load-pct  { font-size: .75rem; font-weight: 700; flex-shrink: 0; width: 40px; text-align: right; }
        .pct-ok    { color: #2E7D32; }
        .pct-under { color: #E65100; }
        .pct-over  { color: #dc3545; }

        .util-bar-track {
          height: 6px; background: var(--surface-alt); border-radius: 99px; overflow: hidden;
        }
        .util-bar-fill  {
          height: 100%; border-radius: 99px;
          transition: width .4s cubic-bezier(.4,0,.2,1);
        }
        .util-bar-fill.util-ok    { background: #2E7D32; }
        .util-bar-fill.util-under { background: #E65100; }
        .util-bar-fill.util-over  { background: #dc3545; }

        .db-load-legend {
          display: flex; flex-wrap: wrap; gap: var(--s3);
          margin-top: var(--s3); padding-top: var(--s3);
          border-top: 1px solid var(--border);
          font-size: .6875rem; color: var(--text-muted);
        }
        .leg-item { display: flex; align-items: center; gap: 4px; }
        .leg-ok    { color: var(--text-muted); }
        .leg-ok::before    { content: '●'; color: #2E7D32; }
        .leg-under::before { content: '●'; color: #E65100; }
        .leg-over::before  { content: '●'; color: #dc3545; }

        /* ── Quick nav ── */
        .db-quicknav { }
        .db-quicknav-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--s2);
        }
        .db-qlink {
          display: flex; align-items: center; gap: var(--s3);
          padding: var(--s3) var(--s4); border-radius: var(--radius);
          border: 1px solid var(--border); background: var(--bg);
          text-decoration: none; color: var(--text);
          transition: background .14s, border-color .14s, transform .13s, box-shadow .13s;
        }
        .db-qlink:hover {
          background: var(--surface); border-color: var(--brand);
          transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,.07);
        }
        .db-qlink-icon  { font-size: 1.25rem; flex-shrink: 0; }
        .db-qlink-body  { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .db-qlink-label { font-size: .8125rem; font-weight: 600; }
        .db-qlink-desc  { font-size: .6875rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .db-qlink-arrow { font-size: 1rem; color: var(--text-muted); flex-shrink: 0; transition: color .14s; }
        .db-qlink:hover .db-qlink-arrow { color: var(--brand); }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .db-kpi-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .db-main-grid { grid-template-columns: 1fr; }
          .db-kpi-row   { grid-template-columns: repeat(2, 1fr); }
          .db-greeting  { flex-direction: column; }
        }
        @media (max-width: 480px) {
          .db-kpi-row { grid-template-columns: 1fr 1fr; }
          .db-hello   { font-size: 1.125rem; }
          .db-quicknav-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </AdminLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  if (!['admin', 'manager'].includes(session.user.role)) {
    return { redirect: { destination: '/me', permanent: false } }
  }
  const { week, year } = currentWeekYear()
  return { props: { user: session.user, week, year } }
}
