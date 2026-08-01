import Link from 'next/link';
import { useRouter } from 'next/router';
import { MessageCircle, MoreHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import type { SessionUser } from '@/types';
import { can } from '@/lib/capabilities';
import {
  ScheduleIcon,
  LeaveIcon,
  HoursIcon,
  MyScheduleIcon,
  SettingsIcon,
  ProfileIcon,
  DocumentIcon,
  ReceiptIcon,
  TicketIcon,
} from '@/components/ui/Icons';
import Sidebar, { type SidebarItem, type SidebarSection } from '@/components/layout/Sidebar';
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

  // ── Sidebar navigation (desktop ≥768px) — 3 sections + footer crosslink ──
  const showMarkt = user.location === 'markt' || user.location === 'both' || isAdmin;
  const showNoot = user.location === 'nootmagazijn' || user.location === 'both' || isAdmin;
  const bothLocations = user.location === 'both' || isAdmin;

  const roosterItems: SidebarItem[] = [];
  if (showMarkt) {
    roosterItems.push({
      href: '/team/markt',
      icon: <ScheduleIcon size={20} />,
      label: bothLocations ? 'Rooster Markt' : 'Rooster',
      isActive: onTeam && location === 'markt',
    });
  }
  if (showNoot) {
    roosterItems.push({
      href: '/team/nootmagazijn',
      icon: <ScheduleIcon size={20} />,
      label: bothLocations ? 'Rooster Noot' : 'Rooster',
      isActive: onTeam && location === 'nootmagazijn',
    });
  }
  roosterItems.push(
    { href: '/me', icon: <MyScheduleIcon size={20} />, label: 'Mijn rooster', isActive: onMe },
    { href: '/me/open-shifts', icon: <ScheduleIcon size={20} />, label: 'Open diensten', isActive: onOpenShifts },
  );

  const mijnZakenItems: SidebarItem[] = [
    { href: '/me/leave', icon: <LeaveIcon size={20} />, label: 'Verlof', isActive: onLeave },
    { href: '/me/hours', icon: <HoursIcon size={20} />, label: 'Mijn uren', isActive: onHours },
    { href: '/me/expenses', icon: <ReceiptIcon size={20} />, label: 'Declaraties', isActive: onExpenses },
    { href: '/me/documents', icon: <DocumentIcon size={20} />, label: 'Documenten', isActive: onDocuments },
    { href: '/me/profile', icon: <ProfileIcon size={20} />, label: 'Mijn profiel', isActive: onProfile },
  ];

  const contactItems: SidebarItem[] = [
    { href: '/me/chat', icon: <MessageCircle size={20} />, label: 'Teamchat', isActive: onChat },
    { href: '/me/support', icon: <TicketIcon size={20} />, label: 'Support', isActive: onSupport },
  ];

  const sections: SidebarSection[] = [
    { label: 'ROOSTER', items: roosterItems },
    { label: 'MIJN ZAKEN', items: mijnZakenItems },
    { label: 'CONTACT', items: contactItems },
  ];

  const footerSections: SidebarSection[] = isAdmin
    ? [{ items: [{ href: '/admin', icon: <SettingsIcon size={20} />, label: 'Beheer', isActive: router.pathname.startsWith('/admin') }] }]
    : [];

  return (
    <div className="team-shell">

      <Sidebar
        logoSrc="https://mhzmithddcdnouvlklev.supabase.co/storage/v1/object/public/Icons%20and%20Logo's/Notenman_2020_logo-300x72.png"
        sections={sections}
        footerSections={footerSections}
        user={user}
        onLogout={logout}
      />

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="team-main" data-loc={location}>
        <div className={`team-main-inner${onChat ? ' chat-main' : ''}`}>{children}</div>
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav className="team-bnav" aria-label="Mobiele navigatie">
        <Link
          href={user.location === 'nootmagazijn' ? '/team/nootmagazijn' : '/team/markt'}
          className={`tbn-item${onTeam ? ' active' : ''}`}
          aria-current={onTeam ? 'page' : undefined}
        >
          {onTeam && <span className="tbn-bar" aria-hidden="true" />}
          <span className="tbn-icon">
            <ScheduleIcon size={24} />
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
            <MyScheduleIcon size={24} />
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
            <MessageCircle size={24} />
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
            <ScheduleIcon size={24} />
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
            <MoreHorizontal size={24} />
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
        .team-shell {
          min-height: 100vh;
          display: flex;
        }

        /* ─── Main ───────────────────────────────────── */
        .team-main {
          flex: 1;
          margin-left: var(--sidebar-w);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .team-main[data-loc="markt"] { box-shadow: inset 0 3px 0 0 var(--markt); }
        .team-main[data-loc="nootmagazijn"] { box-shadow: inset 0 3px 0 0 var(--noot); }
        .team-main-inner {
          flex: 1;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--s8) var(--s6);
        }
        .team-main-inner.chat-main {
          max-width: 1440px;
          padding: 0;
        }

        /* ─── Mobile bottom nav ──────────────────────── */
        .team-bnav {
          display: none;
        }

        /* ─── Responsive ─────────────────────────────── */
        @media (max-width: 768px) {
          .team-main {
            margin-left: 0;
          }
          .team-main-inner {
            padding: var(--s4) var(--s3) calc(var(--bnav-h) + env(safe-area-inset-bottom, 0px));
          }
          .team-main-inner.chat-main {
            padding: 0 0 calc(var(--bnav-h) + env(safe-area-inset-bottom, 0px));
          }

          .team-bnav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            min-height: var(--bnav-h);
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
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 2px;
            border-radius: var(--r2);
            transition: background .16s ease;
          }
          .tbn-item.active .tbn-icon {
            background: rgba(200,136,42,.18);
          }
          .tbn-icon :global(svg) { transition: transform .16s ease; }
          .tbn-item.active .tbn-icon :global(svg) { transform: scale(1.08); }
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
          .team-main-inner {
            padding: var(--s3) var(--s2) calc(var(--bnav-h) + env(safe-area-inset-bottom, 0px));
          }
          .team-main-inner.chat-main {
            padding: 0 0 calc(var(--bnav-h) + env(safe-area-inset-bottom, 0px));
          }
        }
      `}</style>
    </div>
  );
}
