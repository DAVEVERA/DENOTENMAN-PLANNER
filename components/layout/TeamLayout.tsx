import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import type { SessionUser } from '@/types'
import { LOCATION_LABELS } from '@/types'
import { can } from '@/lib/capabilities'
import {
  ScheduleIcon, LeaveIcon,
  MyScheduleIcon, SettingsIcon, ProfileIcon, DocumentIcon,
} from '@/components/ui/Icons'

interface Props {
  user: SessionUser
  children: React.ReactNode
  location?: 'markt' | 'nootmagazijn'
}

export default function TeamLayout({ user, children, location }: Props) {
  const router  = useRouter()
  const isAdmin = can(user, 'manage_shifts')
  const locLabel = location ? LOCATION_LABELS[location] : 'Planner'

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const onTeam        = router.pathname.startsWith('/team')
  const onMe          = router.pathname === '/me'
  const onOpenShifts  = router.pathname === '/me/open-shifts'
  const onLeave       = router.pathname === '/me/leave'
  const onProfile     = router.pathname === '/me/profile'
  const onDocuments   = router.pathname === '/me/documents'
  const onExpenses    = router.pathname === '/me/expenses'

  return (
    <div className="team-shell">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={`team-header${location === 'nootmagazijn' ? ' is-noot' : ''}`}>
        <div className="team-inner">

          {/* Brand – logo afbeelding */}
          <div className="team-brand">
            <Image
              src="https://mhzmithddcdnouvlklev.supabase.co/storage/v1/object/public/Icons%20and%20Logo's/Notenman_2020_logo-300x72.png"
              alt="DeNotenman"
              width={160}
              height={38}
              style={{ width: 'auto', height: '32px', display: 'block', filter: 'invert(1) brightness(2)' }}
              priority
            />
          </div>

          {/* Desktop nav */}
          {location && (
            <nav className="team-nav" aria-label="Hoofdmenu">
              <Link href={`/team/${location}`}
                className={`tn-link${onTeam ? ' active' : ''}`}
                aria-current={onTeam ? 'page' : undefined}>
                <ScheduleIcon size={20} />
                Rooster
              </Link>
              <Link href="/me"
                className={`tn-link${onMe ? ' active' : ''}`}
                aria-current={onMe ? 'page' : undefined}>
                <MyScheduleIcon size={20} />
                Mijn rooster
              </Link>
              <Link href="/me/leave"
                className={`tn-link${onLeave ? ' active' : ''}`}
                aria-current={onLeave ? 'page' : undefined}>
                <LeaveIcon size={20} />
                Verlof
              </Link>
              <Link href="/me/open-shifts"
                className={`tn-link${onOpenShifts ? ' active' : ''}`}
                aria-current={onOpenShifts ? 'page' : undefined}>
                <ScheduleIcon size={20} />
                Open diensten
              </Link>
              <Link href="/me/profile"
                className={`tn-link${onProfile ? ' active' : ''}`}
                aria-current={onProfile ? 'page' : undefined}>
                <ProfileIcon size={20} />
                Mijn profiel
              </Link>
              <Link href="/me/documents"
                className={`tn-link${onDocuments ? ' active' : ''}`}
                aria-current={onDocuments ? 'page' : undefined}>
                <DocumentIcon size={20} />
                Documenten
              </Link>
              <Link href="/me/expenses"
                className={`tn-link${onExpenses ? ' active' : ''}`}
                aria-current={onExpenses ? 'page' : undefined}>
                <DocumentIcon size={20} />
                Declaraties
              </Link>
            </nav>
          )}

          {/* Right: user + admin link */}
          <div className="team-header-right">
            {isAdmin && (
              <Link href="/admin" className="team-admin-link">
                <SettingsIcon size={20} />
                Beheer
              </Link>
            )}
            <div className="team-user">
              <span className="team-user-name">{user.display_name}</span>
              <button className="team-logout" onClick={logout} aria-label="Uitloggen">
                Uitloggen
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="team-main">
        {children}
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav className="team-bnav" aria-label="Mobiele navigatie">
        {location && (
          <Link href={`/team/${location}`}
            className={`tbn-item${onTeam ? ' active' : ''}`}
            aria-current={onTeam ? 'page' : undefined}>
            {onTeam && <span className="tbn-bar" aria-hidden="true" />}
            <span className="tbn-icon"><ScheduleIcon size={22} /></span>
            <span className="tbn-label">Rooster</span>
          </Link>
        )}
        <Link href="/me"
          className={`tbn-item${onMe ? ' active' : ''}`}
          aria-current={onMe ? 'page' : undefined}>
          {onMe && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon"><MyScheduleIcon size={22} /></span>
          <span className="tbn-label">Mijn rooster</span>
        </Link>
        <Link href="/me/leave"
          className={`tbn-item${onLeave ? ' active' : ''}`}
          aria-current={onLeave ? 'page' : undefined}>
          {onLeave && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon"><LeaveIcon size={22} /></span>
          <span className="tbn-label">Verlof</span>
        </Link>
        <Link href="/me/profile"
          className={`tbn-item${onProfile ? ' active' : ''}`}
          aria-current={onProfile ? 'page' : undefined}>
          {onProfile && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon"><ProfileIcon size={22} /></span>
          <span className="tbn-label">Profiel</span>
        </Link>
        <Link href="/me/documents"
          className={`tbn-item${onDocuments ? ' active' : ''}`}
          aria-current={onDocuments ? 'page' : undefined}>
          {onDocuments && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon"><DocumentIcon size={22} /></span>
          <span className="tbn-label">Docs</span>
        </Link>
        <Link href="/me/expenses"
          className={`tbn-item${onExpenses ? ' active' : ''}`}
          aria-current={onExpenses ? 'page' : undefined}>
          {onExpenses && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon">🧾</span>
          <span className="tbn-label">Declaraties</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" className="tbn-item">
            <span className="tbn-icon"><SettingsIcon size={22} /></span>
            <span className="tbn-label">Beheer</span>
          </Link>
        )}
      </nav>

      <style jsx>{`

        .team-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* ─── Header ─────────────────────────────────── */
        .team-header {
          background: #100C0A;
          box-shadow: 0 3px 0 var(--markt);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .team-header.is-noot {
          box-shadow: 0 3px 0 var(--noot);
        }
        .team-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 var(--s6);
          display: flex;
          align-items: center;
          gap: var(--s5);
          height: 58px;
        }

        /* Brand */
        .team-brand {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          text-decoration: none;
        }

        /* Desktop nav */
        .team-nav {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
          padding-left: var(--s4);
        }
        .tn-link {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: var(--r2);
          min-height: 40px;
          font-size: .9375rem;
          font-weight: 500;
          color: #fff;
          opacity: .7;
          transition: background .14s, opacity .14s;
          text-decoration: none;
          white-space: nowrap;
        }
        .tn-link svg { flex-shrink: 0; }
        .tn-link:hover {
          background: rgba(255,255,255,.09);
          opacity: 1;
        }
        .tn-link.active {
          background: rgba(200,136,42,.18);
          color: #FFCF6B;
          opacity: 1;
          font-weight: 600;
        }

        /* Right side */
        .team-header-right {
          display: flex;
          align-items: center;
          gap: var(--s3);
          flex-shrink: 0;
          margin-left: auto;
        }
        .team-admin-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--r2);
          font-size: .8125rem;
          font-weight: 500;
          color: #fff;
          opacity: .7;
          border: 1px solid rgba(255,255,255,.2);
          transition: background .14s, opacity .14s, border-color .14s;
          text-decoration: none;
        }
        .team-admin-link:hover {
          background: rgba(255,255,255,.09);
          opacity: 1;
          border-color: rgba(255,255,255,.4);
        }
        .team-user {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
        }
        .team-user-name {
          font-size: .875rem;
          font-weight: 500;
          color: #fff;
          opacity: .75;
          white-space: nowrap;
        }
        .team-logout {
          font-size: .75rem;
          color: #fff;
          opacity: .4;
          padding: 0;
          transition: opacity .14s;
        }
        .team-logout:hover { opacity: .85; }

        /* ─── Main ───────────────────────────────────── */
        .team-main {
          flex: 1;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          padding: var(--s8) var(--s6);
        }

        /* ─── Mobile bottom nav ──────────────────────── */
        .team-bnav { display: none; }

        /* ─── Responsive ─────────────────────────────── */
        @media (max-width: 768px) {
          .team-nav { display: none; }
          .team-user { display: none; }
          .team-admin-link { display: none; }

          .team-inner {
            padding: 0 var(--s4);
            height: 52px;
          }
          .team-brand-name { font-size: .9375rem; }

          .team-main {
            padding: var(--s4) var(--s3) calc(62px + env(safe-area-inset-bottom, 0px));
          }

          .team-bnav {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: var(--surface);
            border-top: 1px solid var(--border);
            z-index: 200;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -4px 24px rgba(26,20,18,.1);
          }
          .tbn-item {
            flex: 1;
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
          .tbn-item.active { color: var(--brand); }
          .tbn-bar {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 3px;
            border-radius: 0 0 3px 3px;
            background: var(--brand);
          }
          .tbn-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 2px;
          }
          .tbn-label {
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
          .team-main { padding: var(--s3) var(--s2) calc(62px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>
    </div>
  )
}
