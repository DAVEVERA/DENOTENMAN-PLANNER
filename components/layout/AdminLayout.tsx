import { useRouter } from 'next/router'
import Link from 'next/link'
import Image from 'next/image'
import type { SessionUser } from '@/types'
import { can } from '@/lib/capabilities'
import {
  ScheduleIcon, EmployeesIcon, LeaveIcon,
  HoursIcon, ExportIcon, SettingsIcon, TeamViewIcon,
} from '@/components/ui/Icons'

interface Props { user: SessionUser; children: React.ReactNode; title?: string }

const NAV = [
  { href: '/admin',              icon: <ScheduleIcon size={20} />,  label: 'Rooster',      cap: 'read' as const },
  { href: '/admin/employees',    icon: <EmployeesIcon size={20} />, label: 'Medewerkers',  cap: 'manage_employees' as const },
  { href: '/admin/leave',        icon: <LeaveIcon size={20} />,     label: 'Verlof',       cap: 'approve_leave' as const },
  { href: '/admin/hours',        icon: <HoursIcon size={20} />,     label: 'Uren',         cap: 'manage_hours' as const },
  { href: '/admin/hours/export', icon: <ExportIcon size={20} />,    label: 'Export',       cap: 'export_data' as const },
  { href: '/admin/settings',     icon: <SettingsIcon size={20} />,  label: 'Instellingen', cap: 'manage_settings' as const },
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function AdminLayout({ user, children, title }: Props) {
  const router = useRouter()
  const links  = NAV.filter(n => can(user, n.cap))

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="admin-shell">

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className="admin-sidebar" aria-label="Hoofdnavigatie">

        {/* Logo */}
        <div className="sb-logo">
          <div className="sb-logo-img-wrap">
            <Image
              src="https://mhzmithddcdnouvlklev.supabase.co/storage/v1/object/public/Icons%20and%20Logo's/Notenman_2020_logo-300x72.png"
              alt="DeNotenman"
              width={180}
              height={43}
              style={{ width: 'auto', height: '36px', display: 'block' }}
              priority
            />
          </div>
        </div>

        {/* Scrollable body */}
        <div className="sb-body">

          {/* Main nav */}
          <div className="sb-section">
            <span className="sb-section-label">Menu</span>
            <nav className="sb-nav" aria-label="Beheer">
              {links.map(l => {
                const isActive = router.pathname === l.href ||
                  (l.href !== '/admin' && router.pathname.startsWith(l.href))
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`sb-link${isActive ? ' active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="sb-icon">{l.icon}</span>
                    <span className="sb-label">{l.label}</span>
                    {isActive && <span className="sb-dot" aria-hidden="true" />}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Footer nav */}
          <div className="sb-section sb-section--bottom">
            <span className="sb-section-label">Weergave</span>
            <nav className="sb-nav" aria-label="Weergave">
              <Link href="/team/markt" className="sb-link">
                <span className="sb-icon"><TeamViewIcon size={20} /></span>
                <span className="sb-label">Team view</span>
              </Link>
            </nav>
          </div>

        </div>

        {/* User area */}
        <div className="sb-user">
          <div className="sb-avatar" aria-hidden="true">{getInitials(user.display_name)}</div>
          <div className="sb-user-info">
            <span className="sb-user-name">{user.display_name}</span>
            <button className="sb-logout" onClick={logout} aria-label="Uitloggen">
              Uitloggen
            </button>
          </div>
        </div>

      </aside>

      {/* ══════════════════ MAIN ══════════════════ */}
      <main className="admin-main">
        {title && (
          <header className="admin-topbar">
            <h1 className="admin-topbar-title">{title}</h1>
            <div className="admin-topbar-right">
              <span className="topbar-user">{user.display_name}</span>
              <button className="topbar-logout" onClick={logout}>Uitloggen</button>
            </div>
          </header>
        )}
        <div className="admin-content">{children}</div>
      </main>

      {/* ══════════════════ MOBILE BOTTOM NAV ══════════════════ */}
      <nav className="admin-bnav" aria-label="Mobiele navigatie">
        {links.map(l => {
          const isActive = router.pathname === l.href ||
            (l.href !== '/admin' && router.pathname.startsWith(l.href))
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`bn-item${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && <span className="bn-bar" aria-hidden="true" />}
              <span className="bn-icon">{l.icon}</span>
              <span className="bn-label">{l.label}</span>
            </Link>
          )
        })}
      </nav>

      <style jsx>{`

        /* ─── Shell ─────────────────────────────────────── */
        .admin-shell {
          display: flex;
          min-height: 100vh;
        }

        /* ─── Sidebar ───────────────────────────────────── */
        .admin-sidebar {
          width: 248px;
          flex-shrink: 0;
          background: #100C0A;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 100;
          border-right: 1px solid rgba(255,255,255,.06);
        }

        /* Logo */
        .sb-logo {
          display: flex;
          align-items: center;
          padding: 20px 20px 18px;
          border-bottom: 1px solid rgba(255,255,255,.07);
          flex-shrink: 0;
        }
        .sb-logo-img-wrap {
          display: flex;
          align-items: center;
          /* Logo is zwart op transparant — invert maakt het wit */
          filter: invert(1) brightness(2);
        }

        /* Scrollable body */
        .sb-body {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 8px 0;
          scrollbar-width: none;
        }
        .sb-body::-webkit-scrollbar { display: none; }

        /* Sections */
        .sb-section {
          padding: 12px 0 4px;
        }
        .sb-section--bottom {
          margin-top: auto;
          border-top: 1px solid rgba(255,255,255,.07);
          padding-top: 16px;
        }
        .sb-section-label {
          display: block;
          font-size: .5625rem;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(255,255,255,.22);
          padding: 0 20px 6px;
        }

        /* Nav */
        .sb-nav {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 0 10px;
        }
        .sb-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 9px;
          font-size: .9375rem;
          font-weight: 500;
          color: rgba(255,255,255,.75);
          transition: background .14s, color .14s;
          text-decoration: none;
          position: relative;
        }
        .sb-link:hover {
          background: rgba(255,255,255,.09);
          color: #fff;
        }
        .sb-link:hover .sb-icon { color: #fff; }
        .sb-link.active {
          background: rgba(200,136,42,.18);
          color: #FFCF6B;
        }
        .sb-link.active .sb-icon { color: #FFCF6B; }

        .sb-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: rgba(255,255,255,.85);
          transition: color .14s;
        }
        .sb-label { flex: 1; white-space: nowrap; }
        .sb-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--brand);
          flex-shrink: 0;
          opacity: .9;
        }

        /* User area */
        .sb-user {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 14px 18px 20px;
          border-top: 1px solid rgba(255,255,255,.07);
          flex-shrink: 0;
        }
        .sb-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          flex-shrink: 0;
          background: var(--brand);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: .6875rem;
          font-weight: 700;
          letter-spacing: .02em;
        }
        .sb-user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .sb-user-name {
          font-size: .875rem;
          font-weight: 500;
          color: rgba(255,255,255,.65);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-logout {
          font-size: .75rem;
          color: rgba(255,255,255,.28);
          text-align: left;
          padding: 0;
          transition: color .14s;
        }
        .sb-logout:hover { color: rgba(255,255,255,.65); }

        /* ─── Main content ──────────────────────────────── */
        .admin-main {
          flex: 1;
          margin-left: 248px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .admin-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--s4) var(--s8);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .admin-topbar-title {
          font-size: 1.0625rem;
          font-weight: 600;
          margin: 0;
        }
        .admin-topbar-right {
          display: flex;
          align-items: center;
          gap: var(--s3);
        }
        .topbar-user {
          font-size: .875rem;
          color: var(--text-muted);
          display: none;
        }
        .topbar-logout {
          font-size: .8125rem;
          color: var(--text-muted);
          display: none;
          min-height: 44px;
          padding: 0 var(--s2);
          transition: color .14s;
        }
        .topbar-logout:hover { color: var(--text); }
        .admin-content {
          flex: 1;
          padding: var(--s8);
        }

        /* ─── Mobile bottom nav ─────────────────────────── */
        .admin-bnav { display: none; }

        /* ─── Responsive ────────────────────────────────── */
        @media (max-width: 768px) {
          .admin-sidebar { display: none; }
          .admin-main {
            margin-left: 0;
            padding-bottom: calc(62px + env(safe-area-inset-bottom, 0px));
          }
          .admin-content { padding: var(--s4) var(--s3); }
          .admin-topbar { padding: var(--s3) var(--s4); }
          .topbar-user { display: inline; }
          .topbar-logout { display: inline-flex; align-items: center; }

          .admin-bnav {
            display: flex;
            justify-content: space-evenly;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: var(--surface);
            border-top: 1px solid var(--border);
            z-index: 200;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -4px 24px rgba(26,20,18,.1);
          }
          .bn-item {
            flex: 1 1 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 8px 2px;
            min-height: 58px;
            gap: 4px;
            min-width: 0;
            color: var(--text-muted);
            text-decoration: none;
            transition: color .14s;
            position: relative;
          }
          .bn-item.active { color: var(--brand); }
          .bn-bar {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 3px;
            border-radius: 0 0 3px 3px;
            background: var(--brand);
          }
          .bn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 2px;
          }
          .bn-label {
            font-size: .625rem;
            font-weight: 600;
            letter-spacing: .02em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            padding: 0 2px;
          }
        }

        @media (max-width: 390px) {
          .admin-content { padding: var(--s3) var(--s2); }
          .bn-label { font-size: .5625rem; }
        }
      `}</style>
    </div>
  )
}
