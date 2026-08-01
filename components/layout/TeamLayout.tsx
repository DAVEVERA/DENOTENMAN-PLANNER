import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { MessageCircle, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import type { SessionUser } from '@/types';
import { LOCATION_LABELS } from '@/types';
import { can } from '@/lib/capabilities';
import {
  ScheduleIcon,
  LeaveIcon,
  HoursIcon,
  MyScheduleIcon,
  SettingsIcon,
  ProfileIcon,
  DocumentIcon,
} from '@/components/ui/Icons';
import MobileMoreNav from '@/components/layout/MobileMoreNav';

interface Props {
  user: SessionUser;
  children: React.ReactNode;
  location?: 'markt' | 'nootmagazijn';
}

export default function TeamLayout({ user, children, location }: Props) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const isAdmin = can(user, 'manage_shifts');
  const locLabel = location ? LOCATION_LABELS[location] : 'Planner';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const onTeam = router.pathname.startsWith('/team');
  const onMe = router.pathname === '/me';
  const onOpenShifts = router.pathname === '/me/open-shifts';
  const onChat = router.pathname === '/me/chat';
  const onLeave = router.pathname === '/me/leave';
  const onHours = router.pathname === '/me/hours';
  const onProfile = router.pathname === '/me/profile';
  const onDocuments = router.pathname === '/me/documents';
  const onExpenses = router.pathname === '/me/expenses';
  const onSupport = router.pathname === '/me/support';

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
              style={{
                width: 'auto',
                height: '32px',
                display: 'block',
                filter: 'invert(1) brightness(2)',
              }}
              priority
            />
          </div>

          {/* Desktop nav */}
          <nav className="team-nav" aria-label="Hoofdmenu">
            {(user.location === 'markt' || user.location === 'both' || isAdmin) && (
              <Link
                href="/team/markt"
                className={`tn-link${onTeam && location === 'markt' ? ' active' : ''}`}
                aria-current={onTeam && location === 'markt' ? 'page' : undefined}
              >
                <ScheduleIcon size={20} />
                {user.location === 'both' || isAdmin ? 'Rooster Markt' : 'Rooster'}
              </Link>
            )}
            {(user.location === 'nootmagazijn' || user.location === 'both' || isAdmin) && (
              <Link
                href="/team/nootmagazijn"
                className={`tn-link${onTeam && location === 'nootmagazijn' ? ' active' : ''}`}
                aria-current={onTeam && location === 'nootmagazijn' ? 'page' : undefined}
              >
                <ScheduleIcon size={20} />
                {user.location === 'both' || isAdmin ? 'Rooster Noot' : 'Rooster'}
              </Link>
            )}
            <Link
              href="/me"
              className={`tn-link${onMe ? ' active' : ''}`}
              aria-current={onMe ? 'page' : undefined}
            >
              <MyScheduleIcon size={20} />
              Mijn rooster
            </Link>
            <Link
              href="/me/leave"
              className={`tn-link${onLeave ? ' active' : ''}`}
              aria-current={onLeave ? 'page' : undefined}
            >
              <LeaveIcon size={20} />
              Verlof
            </Link>
            <Link
              href="/me/hours"
              className={`tn-link${onHours ? ' active' : ''}`}
              aria-current={onHours ? 'page' : undefined}
            >
              <HoursIcon size={20} />
              Mijn uren
            </Link>
            <Link
              href="/me/open-shifts"
              className={`tn-link${onOpenShifts ? ' active' : ''}`}
              aria-current={onOpenShifts ? 'page' : undefined}
            >
              <ScheduleIcon size={20} />
              Open diensten
            </Link>
            <Link
              href="/me/chat"
              className={`tn-link${onChat ? ' active' : ''}`}
              aria-current={onChat ? 'page' : undefined}
            >
              <MessageCircle size={20} />
              Teamchat
            </Link>
            <Link
              href="/me/profile"
              className={`tn-link${onProfile ? ' active' : ''}`}
              aria-current={onProfile ? 'page' : undefined}
            >
              <ProfileIcon size={20} />
              Mijn profiel
            </Link>
            <Link
              href="/me/documents"
              className={`tn-link${onDocuments ? ' active' : ''}`}
              aria-current={onDocuments ? 'page' : undefined}
            >
              <DocumentIcon size={20} />
              Documenten
            </Link>
            <Link
              href="/me/expenses"
              className={`tn-link${onExpenses ? ' active' : ''}`}
              aria-current={onExpenses ? 'page' : undefined}
            >
              <DocumentIcon size={20} />
              Declaraties
            </Link>
            <Link
              href="/me/support"
              className={`tn-link${onSupport ? ' active' : ''}`}
              aria-current={onSupport ? 'page' : undefined}
            >
              <span className="support-icon">🎫</span>
              Support
            </Link>
          </nav>

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
      <main className={`team-main${onChat ? ' chat-main' : ''}`}>{children}</main>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav className="team-bnav" aria-label="Mobiele navigatie">
        <Link
          href={user.location === 'nootmagazijn' ? '/team/nootmagazijn' : '/team/markt'}
          className={`tbn-item${onTeam ? ' active' : ''}`}
          aria-current={onTeam ? 'page' : undefined}
        >
          {onTeam && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon">
            <ScheduleIcon size={22} />
          </span>
          <span className="tbn-label">Rooster</span>
        </Link>
        <Link
          href="/me"
          className={`tbn-item${onMe ? ' active' : ''}`}
          aria-current={onMe ? 'page' : undefined}
        >
          {onMe && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon">
            <MyScheduleIcon size={22} />
          </span>
          <span className="tbn-label">Mijn rooster</span>
        </Link>
        <Link
          href="/me/chat"
          className={`tbn-item${onChat ? ' active' : ''}`}
          aria-current={onChat ? 'page' : undefined}
        >
          {onChat && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon">
            <MessageCircle size={22} />
          </span>
          <span className="tbn-label">Chat</span>
        </Link>
        <Link
          href="/me/open-shifts"
          className={`tbn-item${onOpenShifts ? ' active' : ''}`}
          aria-current={onOpenShifts ? 'page' : undefined}
        >
          {onOpenShifts && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon">
            <ScheduleIcon size={22} />
          </span>
          <span className="tbn-label">Open</span>
        </Link>
        <button
          ref={moreTriggerRef}
          type="button"
          className={`tbn-item${moreOpen ? ' active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          {moreOpen && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon">
            <MoreHorizontal size={22} />
          </span>
          <span className="tbn-label">Meer</span>
        </button>
      </nav>

      <MobileMoreNav
        open={moreOpen}
        user={user}
        isAdmin={isAdmin}
        onClose={() => {
          setMoreOpen(false);
          requestAnimationFrame(() => moreTriggerRef.current?.focus());
        }}
        onLogout={logout}
      />

      <style jsx>{`
        .support-icon {
          font-size: 1.1rem;
          line-height: 1;
        }

        .team-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* ─── Header ─────────────────────────────────── */
        .team-header {
          background: #100c0a;
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
          min-width: 0;
          padding-left: var(--s4);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .team-nav::-webkit-scrollbar {
          display: none;
        }
        .tn-link {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: var(--r2);
          min-height: 40px;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #fff;
          opacity: 0.7;
          transition:
            background 0.14s,
            opacity 0.14s;
          text-decoration: none;
          white-space: nowrap;
        }
        .tn-link svg {
          flex-shrink: 0;
        }
        .tn-link:hover {
          background: rgba(255, 255, 255, 0.09);
          opacity: 1;
        }
        .tn-link.active {
          background: rgba(200, 136, 42, 0.18);
          color: #ffcf6b;
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
          font-size: 0.8125rem;
          font-weight: 500;
          color: #fff;
          opacity: 0.7;
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition:
            background 0.14s,
            opacity 0.14s,
            border-color 0.14s;
          text-decoration: none;
        }
        .team-admin-link:hover {
          background: rgba(255, 255, 255, 0.09);
          opacity: 1;
          border-color: rgba(255, 255, 255, 0.4);
        }
        .team-user {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
        }
        .team-user-name {
          font-size: 0.875rem;
          font-weight: 500;
          color: #fff;
          opacity: 0.75;
          white-space: nowrap;
        }
        .team-logout {
          font-size: 0.75rem;
          color: #fff;
          opacity: 0.4;
          padding: 0;
          transition: opacity 0.14s;
        }
        .team-logout:hover {
          opacity: 0.85;
        }

        /* ─── Main ───────────────────────────────────── */
        .team-main {
          flex: 1;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          padding: var(--s8) var(--s6);
        }
        .team-main.chat-main {
          max-width: 1440px;
        }

        /* ─── Mobile bottom nav ──────────────────────── */
        .team-bnav {
          display: none;
        }

        /* ─── Responsive ─────────────────────────────── */
        @media (max-width: 768px) {
          .team-nav {
            display: none;
          }
          .team-user {
            display: none;
          }
          .team-admin-link {
            display: none;
          }

          .team-inner {
            padding: 0 var(--s4);
            height: 52px;
          }
          .team-brand-name {
            font-size: 0.9375rem;
          }

          .team-main {
            padding: var(--s4) var(--s3) calc(62px + env(safe-area-inset-bottom, 0px));
          }
          .team-main.chat-main {
            padding: 0 0 calc(62px + env(safe-area-inset-bottom, 0px));
          }

          .team-bnav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--surface);
            border-top: 1px solid var(--border);
            z-index: 200;
            padding-bottom: env(safe-area-inset-bottom, 0px);
            box-shadow: 0 -4px 24px rgba(26, 20, 18, 0.1);
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
            transition: color 0.14s;
            position: relative;
          }
          .tbn-item.active {
            color: var(--brand);
          }
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
            font-size: 0.625rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            padding: 0 2px;
          }
        }

        @media (max-width: 390px) {
          .team-main {
            padding: var(--s3) var(--s2) calc(62px + env(safe-area-inset-bottom, 0px));
          }
          .team-main.chat-main {
            padding: 0 0 calc(62px + env(safe-area-inset-bottom, 0px));
          }
        }
      `}</style>
    </div>
  );
}
