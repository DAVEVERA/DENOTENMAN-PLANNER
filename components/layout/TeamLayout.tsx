import Link from 'next/link'
import { useRouter } from 'next/router'
import type { SessionUser } from '@/types'
import { LOCATION_LABELS } from '@/types'
import { can } from '@/lib/capabilities'
import {
  LogoIcon, ScheduleIcon, LeaveIcon,
  MyScheduleIcon, SettingsIcon,
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

  const onTeam  = router.pathname.startsWith('/team')
  const onMe    = router.pathname === '/me'
  const onLeave = router.pathname === '/me/leave'

  return (
    <div className="team-shell">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className={`team-header${location === 'nootmagazijn' ? ' is-noot' : ''}`}>
        <div className="team-inner">

          {/* Brand */}
          <div className="team-brand">
            <span className="team-brand-icon"><LogoIcon size={22} /></span>
            <span className="team-brand-name">{locLabel}</span>
          </div>

          {/* Desktop nav */}
          {location && (
            <nav className="team-nav" aria-label="Hoofdmenu">
              <Link href={`/team/${location}`}
                className={`tn-link${onTeam ? ' active' : ''}`}
                aria-current={onTeam ? 'page' : undefined}>
                <ScheduleIcon size={17} />
                Rooster
              </Link>
              <Link href="/me"
                className={`tn-link${onMe ? ' active' : ''}`}
                aria-current={onMe ? 'page' : undefined}>
                <MyScheduleIcon size={17} />
                Mijn rooster
              </Link>
              <Link href="/me/leave"
                className={`tn-link${onLeave ? ' active' : ''}`}
                aria-current={onLeave ? 'page' : undefined}>
                <LeaveIcon size={17} />
                Verlof
              </Link>
            </nav>
          )}

          {/* Right: user + admin link */}
          <div className="team-header-right">
            {isAdmin && (
              <Link href="/admin" className="team-admin-link">
                <SettingsIcon size={16} />
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
          background: var(--surface);
          box-shadow: 0 1px 0 var(--border), 0 3px 0 var(--markt);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .team-header.is-noot {
          box-shadow: 0 1px 0 var(--border), 0 3px 0 var(--noot);
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
          gap: var(--s2);
          flex-shrink: 0;
          text-decoration: none;
        }
        .team-brand-icon {
          color: var(--brand);
          display: flex;
          align-items: center;
        }
        .team-brand-name {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          letter-spacing: -.015em;
        }

        /* Desktop nav */
        .team-nav {
          display: flex;
          align-items: center;
          gap: 2px;
          flex: 1;
        }
        .tn-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: var(--r2);
          min-height: 40px;
          font-size: .9375rem;
          font-weight: 500;
          color: var(--text-muted);
          transition: background .14s, color .14s;
          text-decoration: none;
        }
        .tn-link:hover {
          background: var(--surface-alt);
          color: var(--text);
        }
        .tn-link.active {
          background: var(--brand-subtle);
          color: var(--brand-dark);
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
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: var(--r2);
          font-size: .8125rem;
          font-weight: 500;
          color: var(--text-muted);
          border: 1px solid var(--border);
          transition: background .14s, color .14s, border-color .14s;
          text-decoration: none;
        }
        .team-admin-link:hover {
          background: var(--surface-alt);
          color: var(--text);
          border-color: var(--border-strong);
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
          color: var(--text-sub);
          white-space: nowrap;
        }
        .team-logout {
          font-size: .75rem;
          color: var(--text-muted);
          padding: 0;
          transition: color .14s;
        }
        .team-logout:hover { color: var(--text); }

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
