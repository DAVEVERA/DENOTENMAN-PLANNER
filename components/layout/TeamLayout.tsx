import { useRouter } from 'next/router';
import { MessageCircle, Menu } from 'lucide-react';
import { useRef, useState } from 'react';
import type { SessionUser, Location } from '@/types';
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
import ReleaseUpdatePopout from '@/components/ui/ReleaseUpdatePopout';

interface Props {
  user: SessionUser;
  children: React.ReactNode;
  location?: Location;
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
  const roosterItems: SidebarItem[] = [{
    href: '/team/both',
    icon: <ScheduleIcon size={20} />,
    label: 'Rooster beide',
    isActive: onTeam && location === 'both',
  }];
  roosterItems.push({
    href: '/team/markt',
    icon: <ScheduleIcon size={20} />,
    label: 'Rooster Markt',
    isActive: onTeam && location === 'markt',
  });
  roosterItems.push({
    href: '/team/nootmagazijn',
    icon: <ScheduleIcon size={20} />,
    label: 'Rooster Magazijn',
    isActive: onTeam && location === 'nootmagazijn',
  });
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

      {/* ── Mobile bottom nav: alle navigatie zit achter deze ene knop ── */}
      <nav className="team-bnav" aria-label="Mobiele navigatie">
        <button
          ref={moreTriggerRef}
          type="button"
          className="bnav-trigger"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <Menu size={24} />
          <span>Menu</span>
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

      <ReleaseUpdatePopout
        userId={user.user_id}
        audience="employee"
        autoOpen={!isAdmin && router.pathname === '/team/[location]' && router.query.location === 'both'}
      />

      <style jsx>{`
        .team-shell {
          min-height: 100vh;
          display: flex;
        }

        /* ─── Main ───────────────────────────────────── */
        .team-main {
          flex: 1;
          min-width: 0;
          margin-left: var(--sidebar-w);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .team-main[data-loc="markt"] { box-shadow: inset 0 3px 0 0 var(--markt); }
        .team-main[data-loc="nootmagazijn"] { box-shadow: inset 0 3px 0 0 var(--noot); }
        .team-main[data-loc="both"] { border-top: 3px solid transparent; border-image: linear-gradient(90deg, var(--markt) 0 50%, var(--noot) 50%) 1; }
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
          .bnav-trigger {
            flex: 1;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 10px;
            min-height: var(--bnav-h);
            color: var(--text);
            font-size: 0.9375rem;
            font-weight: 600;
            letter-spacing: 0.01em;
          }
          .bnav-trigger:active {
            color: var(--brand);
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
