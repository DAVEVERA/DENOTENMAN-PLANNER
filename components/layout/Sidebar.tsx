import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SessionUser } from '@/types'

// ─────────────────────────────────────────────────────────────────────────
// Sidebar — dumb presentation primitive shared by AdminLayout & TeamLayout.
// It renders sections/items exactly as given; it holds NO capability logic
// (`can()`) and NO location logic — callers compute `isActive`/visibility
// and pass the finished item list in.
// ─────────────────────────────────────────────────────────────────────────

export interface SidebarItem {
  href: string
  icon: ReactNode
  label: string
  isActive: boolean
  badge?: ReactNode
}

export interface SidebarSection {
  /** Section heading, e.g. "ROOSTER". Omit for an unlabelled top section. */
  label?: string
  items: SidebarItem[]
}

interface SidebarProps {
  logoSrc: string
  /** Main, scrollable navigation sections. */
  sections: SidebarSection[]
  /** Sections pinned to the bottom of the scrollable body (e.g. "Weergave" / "Beheer"). */
  footerSections?: SidebarSection[]
  user: SessionUser
  onLogout: () => void
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function SidebarNavSection({ section, pinned }: { section: SidebarSection; pinned?: boolean }) {
  if (section.items.length === 0) return null
  return (
    <div className={`sb-section${pinned ? ' sb-section--bottom' : ''}`}>
      {section.label && <span className="sb-section-label">{section.label}</span>}
      <nav className="sb-nav" aria-label={section.label ?? 'Navigatie'}>
        {section.items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sb-link${item.isActive ? ' active' : ''}`}
            aria-current={item.isActive ? 'page' : undefined}
          >
            <span className="sb-icon">{item.icon}</span>
            <span className="sb-label">{item.label}</span>
            {item.badge}
            {item.isActive && <span className="sb-dot" aria-hidden="true" />}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export default function Sidebar({ logoSrc, sections, footerSections = [], user, onLogout }: SidebarProps) {
  return (
    <aside className="app-sidebar" aria-label="Hoofdnavigatie">

      {/* Logo */}
      <div className="sb-logo">
        <div className="sb-logo-img-wrap">
          <Image
            src={logoSrc}
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
        {sections.map((section, i) => (
          <SidebarNavSection key={section.label ?? `section-${i}`} section={section} />
        ))}
        {footerSections.map((section, i) => (
          <SidebarNavSection key={section.label ?? `footer-${i}`} section={section} pinned={i === 0} />
        ))}
      </div>

      {/* User area */}
      <div className="sb-user">
        <div className="sb-avatar" aria-hidden="true">{getInitials(user.display_name)}</div>
        <div className="sb-user-info">
          <span className="sb-user-name">{user.display_name}</span>
          <button className="sb-logout" onClick={onLogout} aria-label="Uitloggen">
            Uitloggen
          </button>
        </div>
      </div>

      <style jsx>{`
        .app-sidebar {
          width: var(--sidebar-w);
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
        .sb-section { padding: 12px 0 4px; }
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
          color: rgba(255,255,255,.65);
          padding: 0 20px 6px;
        }

        /* Nav */
        .sb-nav { display: flex; flex-direction: column; gap: 1px; padding: 0 10px; }
        .sb-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 9px;
          font-size: .9375rem;
          font-weight: 500;
          color: #fff;
          transition: background .14s, color .14s;
          text-decoration: none;
          position: relative;
        }
        .sb-link:hover { background: rgba(255,255,255,.09); color: #fff; }
        .sb-link:hover .sb-icon { color: #fff; }
        .sb-link.active { background: rgba(200,136,42,.18); color: #FFCF6B; }
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
        .sb-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
        .sb-user-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
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

        @media (max-width: 768px) {
          .app-sidebar { display: none; }
        }
      `}</style>
    </aside>
  )
}
