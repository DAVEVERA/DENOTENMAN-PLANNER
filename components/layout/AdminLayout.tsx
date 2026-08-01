import { useRouter } from 'next/router'
import { MessageCircle, Menu } from 'lucide-react'
import { useRef, useState } from 'react'
import type { SessionUser, Capability } from '@/types'
import { can } from '@/lib/capabilities'
import {
  ScheduleIcon, EmployeesIcon, LeaveIcon,
  HoursIcon, ExportIcon, SettingsIcon, TeamViewIcon, MyScheduleIcon,
  DashboardIcon, TicketIcon,
} from '@/components/ui/Icons'
import Sidebar, { type SidebarItem, type SidebarSection } from '@/components/layout/Sidebar'
import AdminMobileMoreNav from '@/components/layout/AdminMobileMoreNav'

interface Props { user: SessionUser; children: React.ReactNode; title?: string; location?: 'markt' | 'nootmagazijn' }

/** Icon stored as a component (not pre-sized JSX) so sidebar (M/20) and
 *  bottom-nav/sheet (L/24) can render the same config row at different sizes. */
type NavIconComponent = (props: { size?: number; className?: string }) => React.JSX.Element

function ChatIcon({ size, className }: { size?: number; className?: string }) {
  return <MessageCircle size={size} strokeWidth={2} className={className} aria-hidden="true" />
}

const NAV: { href: string; Icon: NavIconComponent; label: string; cap: Capability }[] = [
  { href: '/admin/dashboard',   Icon: DashboardIcon,  label: 'Dashboard',      cap: 'read' },
  { href: '/admin',             Icon: ScheduleIcon,   label: 'Rooster',        cap: 'read' },
  { href: '/admin/employees',   Icon: EmployeesIcon,  label: 'Medewerkers',    cap: 'manage_employees' },
  { href: '/admin/open-shifts', Icon: HoursIcon,      label: 'Open diensten',  cap: 'manage_shifts' },
  { href: '/admin/team-chat',   Icon: ChatIcon,        label: 'Chatbeheer',     cap: 'read' },
  { href: '/admin/leave',       Icon: LeaveIcon,      label: 'Verlof',         cap: 'approve_leave' },
  { href: '/admin/expenses',    Icon: ExportIcon,     label: 'Declaraties',    cap: 'manage_hours' },
  { href: '/admin/hours',       Icon: HoursIcon,      label: 'Uren',           cap: 'manage_hours' },
  { href: '/admin/hours/export',Icon: ExportIcon,     label: 'Export',         cap: 'export_data' },
  { href: '/admin/settings',    Icon: SettingsIcon,   label: 'Instellingen',   cap: 'manage_settings' },
  { href: '/admin/backup',      Icon: ExportIcon,     label: 'Backup',         cap: 'manage_settings' },
  { href: '/me/support',        Icon: TicketIcon,     label: 'Support',        cap: 'read' },
]

export default function AdminLayout({ user, children, title, location }: Props) {
  const router = useRouter()
  const links  = NAV.filter(n => can(user, n.cap))
  const [moreOpen, setMoreOpen] = useState(false)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)

  function isNavActive(href: string) {
    // /admin must be exact-match so it doesn't activate on /admin/dashboard etc.
    return href === '/admin'
      ? router.pathname === '/admin'
      : router.pathname === href || router.pathname.startsWith(href + '/')
  }

  const sidebarItems: SidebarItem[] = links.map(l => ({
    href: l.href,
    icon: <l.Icon size={20} />,
    label: l.label,
    isActive: isNavActive(l.href),
  }))

  // Alle navigatie zit nu in het hamburgermenu — de mobiele bottom-nav is
  // alleen nog de trigger. Zelfde volgorde als de desktop sidebar, plus de
  // "Weergave"-crosslinks (Team Markt/Nootmagazijn/Individueel) die op
  // desktop in de sidebar-footer staan.
  const mobileMenuItems = [
    ...links.map(l => ({ href: l.href, icon: <l.Icon size={24} />, label: l.label })),
    { href: '/team/markt', icon: <TeamViewIcon size={24} />, label: 'Team Markt' },
    { href: '/team/nootmagazijn', icon: <TeamViewIcon size={24} />, label: 'Team Nootmagazijn' },
    { href: '/admin/view', icon: <MyScheduleIcon size={24} />, label: 'Individueel' },
  ]

  const sections: SidebarSection[] = [
    { label: 'Menu', items: sidebarItems },
  ]

  const onTeamMarkt = router.pathname === '/team/[location]' && router.query.location === 'markt'
  const onTeamNoot  = router.pathname === '/team/[location]' && router.query.location === 'nootmagazijn'
  const onIndividueel = router.pathname.startsWith('/admin/view')

  const footerSections: SidebarSection[] = [
    {
      label: 'Weergave',
      items: [
        { href: '/team/markt',        icon: <TeamViewIcon size={20} />,  label: 'Team Markt',        isActive: onTeamMarkt },
        { href: '/team/nootmagazijn', icon: <TeamViewIcon size={20} />,  label: 'Team Nootmagazijn', isActive: onTeamNoot },
        { href: '/admin/view',        icon: <MyScheduleIcon size={20} />, label: 'Individueel',       isActive: onIndividueel },
      ],
    },
  ]

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="admin-shell">

      <Sidebar
        logoSrc="https://mhzmithddcdnouvlklev.supabase.co/storage/v1/object/public/Icons%20and%20Logo's/Notenman_2020_logo-300x72.png"
        sections={sections}
        footerSections={footerSections}
        user={user}
        onLogout={logout}
      />

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
        <div className="admin-content" data-loc={location}>{children}</div>
      </main>

      {/* ══════════════════ MOBILE BOTTOM NAV: alleen de menu-knop ══════════════════ */}
      <nav className="admin-bnav" aria-label="Mobiele navigatie">
        <button ref={moreTriggerRef} type="button" className="bnav-trigger" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" aria-expanded={moreOpen}>
          <Menu size={24} />
          <span>Menu</span>
        </button>
      </nav>

      <AdminMobileMoreNav
        open={moreOpen}
        items={mobileMenuItems}
        onClose={() => { setMoreOpen(false); requestAnimationFrame(() => moreTriggerRef.current?.focus()) }}
        onLogout={logout}
      />

      <style jsx>{`

        /* ─── Shell ─────────────────────────────────────── */
        .admin-shell {
          display: flex;
          min-height: 100vh;
        }

        /* ─── Main content ──────────────────────────────── */
        .admin-main {
          flex: 1;
          margin-left: var(--sidebar-w);
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
          color: rgba(255, 255, 255, 0.75);
        }
        .admin-topbar-right {
          display: flex;
          align-items: center;
          gap: var(--s3);
        }
        .topbar-user {
          font-size: .875rem;
          color: rgba(255, 255, 255, 0.75);
          display: none;
        }
        .topbar-logout {
          font-size: .8125rem;
          color: rgba(255, 255, 255, 0.75);
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
        .admin-content[data-loc="markt"] { box-shadow: inset 0 3px 0 0 var(--markt); }
        .admin-content[data-loc="nootmagazijn"] { box-shadow: inset 0 3px 0 0 var(--noot); }

        /* ─── Mobile bottom nav ─────────────────────────── */
        .admin-bnav { display: none; }

        /* ─── Responsive ────────────────────────────────── */
        @media (max-width: 768px) {
          .admin-main {
            margin-left: 0;
            padding-bottom: calc(var(--bnav-h) + env(safe-area-inset-bottom, 0px));
          }
          .admin-content { padding: var(--s4) var(--s3); }
          .admin-topbar { padding: var(--s3) var(--s4); }
          .topbar-user { display: inline; }
          .topbar-logout { display: inline-flex; align-items: center; }

          .admin-bnav {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            min-height: var(--bnav-h);
            background: var(--surface);
            border-top: 1px solid var(--border);
            z-index: 200;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -4px 24px rgba(223, 215, 212, 0.1);
          }
          .bnav-trigger {
            flex: 1;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 10px;
            min-height: var(--bnav-h);
            color: var(--text);
            font-size: .9375rem;
            font-weight: 600;
            letter-spacing: .01em;
          }
          .bnav-trigger:active { color: var(--brand); }
        }

        @media (max-width: 390px) {
          .admin-content { padding: var(--s3) var(--s2); }
        }
      `}</style>
    </div>
  )
}
