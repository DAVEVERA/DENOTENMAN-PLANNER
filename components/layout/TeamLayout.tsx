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
  const router = useRouter()
  const isAdmin = can(user, 'manage_shifts')

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const locLabel = location ? LOCATION_LABELS[location] : 'Planner'

  return (
    <div className="team-shell">
      <header className={`team-header ${location === 'nootmagazijn' ? 'is-nootmagazijn' : ''}`}>
        <div className="team-header-inner">
          <div className="team-brand">
            <span className="team-brand-icon"><LogoIcon size={22} /></span>
            <span className="team-brand-name">{locLabel}</span>
          </div>

          <nav className="team-nav" aria-label="Hoofdmenu">
            {location && (
              <>
                <Link href={`/team/${location}`}
                  className={`team-nav-link${router.pathname.startsWith('/team') ? ' active' : ''}`}
                  aria-current={router.pathname.startsWith('/team') ? 'page' : undefined}>
                  Rooster
                </Link>
                <Link href="/me"
                  className={`team-nav-link${router.pathname === '/me' ? ' active' : ''}`}
                  aria-current={router.pathname === '/me' ? 'page' : undefined}>
                  Mijn rooster
                </Link>
                <Link href="/me/leave"
                  className={`team-nav-link${router.pathname === '/me/leave' ? ' active' : ''}`}
                  aria-current={router.pathname === '/me/leave' ? 'page' : undefined}>
                  Verlof
                </Link>
              </>
            )}
            {isAdmin && (
              <Link href="/admin" className="team-nav-link admin-link">
                Beheer ↗
              </Link>
            )}
          </nav>

          <div className="team-header-user">
            <span className="team-user-name">{user.display_name}</span>
            <button className="team-logout" onClick={logout} aria-label="Log uit">Uitloggen</button>
          </div>
        </div>
      </header>

      <main className="team-main">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="team-bottom-nav" aria-label="Mobiele navigatie">
        {location && (
          <Link href={`/team/${location}`}
            className={`tbn-item${router.pathname.startsWith('/team') ? ' active' : ''}`}
            aria-current={router.pathname.startsWith('/team') ? 'page' : undefined}>
            <span className="tbn-icon"><ScheduleIcon /></span>
            <span className="tbn-label">Rooster</span>
          </Link>
        )}
        <Link href="/me"
          className={`tbn-item${router.pathname === '/me' ? ' active' : ''}`}
          aria-current={router.pathname === '/me' ? 'page' : undefined}>
          <span className="tbn-icon"><MyScheduleIcon /></span>
          <span className="tbn-label">Mijn rooster</span>
        </Link>
        <Link href="/me/leave"
          className={`tbn-item${router.pathname === '/me/leave' ? ' active' : ''}`}
          aria-current={router.pathname === '/me/leave' ? 'page' : undefined}>
          <span className="tbn-icon"><LeaveIcon /></span>
          <span className="tbn-label">Verlof</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" className="tbn-item">
            <span className="tbn-icon"><SettingsIcon /></span>
            <span className="tbn-label">Beheer</span>
          </Link>
        )}
      </nav>

      <style jsx>{`
        .team-shell { min-height: 100vh; display: flex; flex-direction: column; }

        .team-header {
          background: var(--surface);
          border-bottom: 3px solid var(--markt);
          position: sticky; top: 0; z-index: 50;
        }
        .team-header-inner {
          max-width: 1100px; margin: 0 auto;
          padding: 0 var(--s6);
          display: flex; align-items: center; gap: var(--s6); height: 60px;
        }
        .team-brand { display: flex; align-items: center; gap: var(--s2); flex-shrink: 0; }
        .team-brand-icon { color: var(--brand); display: flex; align-items: center; }
        .team-brand-name { font-size: 1rem; font-weight: 700; white-space: nowrap; }

        .team-nav { display: flex; align-items: center; gap: 2px; flex: 1; }
        .team-nav-link {
          padding: 10px var(--s3); border-radius: var(--r1);
          min-height: 44px; display: inline-flex; align-items: center;
          font-size: .9375rem; font-weight: 500; color: var(--text-sub);
          transition: background .15s, color .15s;
        }
        .team-nav-link:hover { background: var(--surface-alt); color: var(--text); }
        .team-nav-link.active { color: var(--text); background: var(--surface-alt); }
        .admin-link { margin-left: auto; font-size: .875rem; color: var(--text-muted); }

        .team-header-user {
          display: flex; align-items: center; gap: var(--s3); flex-shrink: 0;
        }
        .team-user-name { font-size: .875rem; color: var(--text-sub); }
        .team-logout { font-size: .8125rem; color: var(--text-muted); }
        .team-logout:hover { color: var(--text); }

        .team-main { flex: 1; max-width: 1100px; margin: 0 auto; width: 100%; padding: var(--s8) var(--s6); }

        .team-bottom-nav { display: none; }

        @media (max-width: 768px) {
          .team-nav { display: none; }
          .team-header-user { display: none; }
          .team-header-inner { padding: 0 var(--s4); height: 52px; }
          .team-brand-name { font-size: .9375rem; }
          .team-main { padding: var(--s3) var(--s3) calc(64px + env(safe-area-inset-bottom, 0px)); }

          .team-bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0;
            background: var(--surface); border-top: 1px solid var(--border);
            z-index: 100; box-shadow: 0 -2px 8px rgba(26,20,18,.08);
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          .tbn-item {
            flex: 1; display: flex; flex-direction: column; align-items: center;
            padding: 10px 2px 8px; min-height: 56px; gap: 3px; min-width: 0;
            color: var(--text-muted); text-decoration: none;
            transition: color .15s;
          }
          .tbn-item.active { color: var(--brand); }
          .tbn-icon { display: flex; align-items: center; justify-content: center; }
          .tbn-label { font-size: .6875rem; font-weight: 500; letter-spacing: .01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
        }
      `}</style>
    </div>
  )
}
