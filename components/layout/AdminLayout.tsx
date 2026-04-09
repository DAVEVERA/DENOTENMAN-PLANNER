import { useRouter } from 'next/router'
import Link from 'next/link'
import type { SessionUser } from '@/types'
import { can } from '@/lib/capabilities'
import {
  LogoIcon, ScheduleIcon, EmployeesIcon, LeaveIcon,
  HoursIcon, ExportIcon, SettingsIcon, TeamViewIcon,
} from '@/components/ui/Icons'

interface Props { user: SessionUser; children: React.ReactNode; title?: string }

const NAV = [
  { href: '/admin',              icon: <ScheduleIcon />,  label: 'Rooster',      cap: 'read' as const },
  { href: '/admin/employees',    icon: <EmployeesIcon />, label: 'Medewerkers',  cap: 'manage_employees' as const },
  { href: '/admin/leave',        icon: <LeaveIcon />,     label: 'Verlof',       cap: 'approve_leave' as const },
  { href: '/admin/hours',        icon: <HoursIcon />,     label: 'Uren',         cap: 'manage_hours' as const },
  { href: '/admin/hours/export', icon: <ExportIcon />,    label: 'Export',       cap: 'export_data' as const },
  { href: '/admin/settings',     icon: <SettingsIcon />,  label: 'Instellingen', cap: 'manage_settings' as const },
]

export default function AdminLayout({ user, children, title }: Props) {
  const router = useRouter()
  const links  = NAV.filter(n => can(user, n.cap))

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="admin-shell">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon"><LogoIcon size={22} /></span>
          <span className="sidebar-logo-text">Planner</span>
        </div>

        <nav className="sidebar-nav" aria-label="Hoofdmenu">
          {links.map(l => {
            const isActive = router.pathname === l.href || (l.href !== '/admin' && router.pathname.startsWith(l.href))
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`sidebar-link${isActive ? ' active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="sidebar-link-icon">{l.icon}</span>
                <span className="sidebar-link-label">{l.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <Link href="/team/markt" className="sidebar-link sidebar-link-team">
            <span className="sidebar-link-icon"><TeamViewIcon /></span>
            <span className="sidebar-link-label">Team view</span>
          </Link>
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user.display_name}</div>
            <button className="sidebar-logout" onClick={logout} aria-label="Log uit">Uitloggen</button>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="admin-main">
        {title && (
          <header className="admin-topbar">
            <h1 className="admin-topbar-title">{title}</h1>
            <div className="admin-topbar-user">
              <span className="text-sm text-muted">{user.display_name}</span>
              <button className="topbar-logout-btn" onClick={logout}>Uitloggen</button>
            </div>
          </header>
        )}
        <div className="admin-content">{children}</div>
      </main>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────── */}
      <nav className="admin-bottom-nav" aria-label="Mobiele navigatie">
        {links.slice(0, 5).map(l => {
          const isActive = router.pathname === l.href || (l.href !== '/admin' && router.pathname.startsWith(l.href))
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`bottom-nav-item${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="bottom-nav-icon">{l.icon}</span>
              <span className="bottom-nav-label">{l.label}</span>
            </Link>
          )
        })}
      </nav>

      <style jsx>{`
        .admin-shell {
          display: flex; min-height: 100vh;
        }

        /* ── Sidebar ── */
        .admin-sidebar {
          width: var(--sidebar-w); flex-shrink: 0;
          background: var(--text); color: var(--text-inv);
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0;
          z-index: 100; overflow-y: auto;
        }
        .sidebar-logo {
          display: flex; align-items: center; gap: 10px;
          padding: 20px var(--s5);
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .sidebar-logo-icon { color: var(--brand-light); display: flex; align-items: center; }
        .sidebar-logo-text { font-size: 1.0625rem; font-weight: 700; letter-spacing: -.01em; }

        .sidebar-nav {
          flex: 1; padding: var(--s3) 0;
          display: flex; flex-direction: column; gap: 2px;
        }
        .sidebar-link {
          display: flex; align-items: center; gap: var(--s3);
          padding: 10px var(--s5); border-radius: 0;
          font-size: .9375rem; font-weight: 500;
          color: rgba(255,255,255,.65);
          transition: background .15s, color .15s;
          text-decoration: none;
        }
        .sidebar-link:hover { background: rgba(255,255,255,.06); color: #fff; }
        .sidebar-link.active { background: rgba(200,136,42,.18); color: var(--brand-light); }
        .sidebar-link-icon {
          width: 22px; display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,.5);
        }
        .sidebar-link:hover .sidebar-link-icon,
        .sidebar-link.active .sidebar-link-icon { color: inherit; }
        .sidebar-link-team { margin-top: var(--s2); border-top: 1px solid rgba(255,255,255,.08); padding-top: var(--s4); }

        .sidebar-footer { padding: var(--s4) 0 var(--s4); }
        .sidebar-user { padding: var(--s3) var(--s5); display: flex; flex-direction: column; gap: 4px; }
        .sidebar-user-name { font-size: .875rem; color: rgba(255,255,255,.5); }
        .sidebar-logout { font-size: .8125rem; color: rgba(255,255,255,.4); text-align: left; padding: 0; }
        .sidebar-logout:hover { color: rgba(255,255,255,.8); }

        /* ── Main ── */
        .admin-main {
          flex: 1; margin-left: var(--sidebar-w);
          min-height: 100vh; display: flex; flex-direction: column;
        }
        .admin-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--s4) var(--s8);
          background: var(--surface); border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 50;
        }
        .admin-topbar-title { font-size: 1.0625rem; font-weight: 600; margin: 0; }
        .admin-topbar-user { display: flex; align-items: center; gap: var(--s3); }
        .topbar-logout-btn { font-size: .8125rem; color: var(--text-muted); display: none; }
        .topbar-logout-btn:hover { color: var(--text); }
        .admin-content {
          flex: 1; padding: var(--s8);
        }

        /* ── Bottom Nav (mobile only) ── */
        .admin-bottom-nav { display: none; }

        @media (max-width: 768px) {
          .admin-sidebar { display: none; }
          .admin-main { margin-left: 0; padding-bottom: 70px; }
          .admin-content { padding: var(--s4) var(--s3); }
          .admin-topbar { padding: var(--s3) var(--s4); }
          .topbar-logout-btn { display: inline-flex; }

          .admin-bottom-nav {
            display: flex;
            position: fixed; bottom: 0; left: 0; right: 0;
            background: var(--surface); border-top: 1px solid var(--border);
            z-index: 100; box-shadow: 0 -2px 8px rgba(26,20,18,.08);
          }
          .bottom-nav-item {
            flex: 1; display: flex; flex-direction: column; align-items: center;
            padding: 8px 2px 6px; gap: 3px;
            color: var(--text-muted); text-decoration: none;
            transition: color .15s; min-width: 0;
          }
          .bottom-nav-item.active { color: var(--brand); }
          .bottom-nav-icon { display: flex; align-items: center; justify-content: center; }
          .bottom-nav-label { font-size: .5625rem; font-weight: 500; letter-spacing: .01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        }
      `}</style>
    </div>
  )
}
