import Link from 'next/link'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useDialogFocus } from '../ui/useDialogFocus'
import { CloseIcon } from '../ui/Icons'

// ─────────────────────────────────────────────────────────────────────────
// MoreSheet — shared mobile "overflow" bottom-sheet primitive, used by both
// the employee portal (MobileMoreNav) and the admin portal
// (AdminMobileMoreNav). Presentation-only: eyebrow/title text, item tiles
// and an optional footer slot (logout button / crosslink) are supplied by
// the caller.
// ─────────────────────────────────────────────────────────────────────────

export interface MoreSheetItem {
  href: string
  icon: ReactNode
  label: string
  helper?: string
}

interface MoreSheetProps {
  open: boolean
  /** Small label above the title, e.g. "Ingelogd als" / "Beheerportaal". */
  eyebrow: string
  /** Sheet title, e.g. the user's display name or "Meer functies". */
  title: string
  items: MoreSheetItem[]
  /** Extra tile(s) rendered after the item grid — e.g. the logout button. */
  footer?: ReactNode
  onClose(): void
  navLabel?: string
  closeLabel?: string
}

const CLOSE_MS = 220

export default function MoreSheet({
  open,
  eyebrow,
  title,
  items,
  footer,
  onClose,
  navLabel = 'Meer functies',
  closeLabel = 'Menu sluiten',
}: MoreSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  // Mounted while open OR while the close transition is still playing —
  // avoids the previous instant `if (!open) return null` unmount.
  const [mounted, setMounted] = useState(open)

  // `open && mounted` (not just `open`) is required: the sheet renders
  // `null` for one render tick after `open` flips true (mount happens in
  // an effect below), so dialogRef.current is still null when this hook's
  // setup effect would otherwise fire. Gating on `mounted` too delays that
  // effect until the dialog actually exists in the DOM, so the focus trap
  // and initial-focus logic engage on the render where they can succeed.
  useDialogFocus(open && mounted, dialogRef, onClose)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(raf)
    }
    setEntered(false)
    if (!mounted) return
    const t = setTimeout(() => setMounted(false), CLOSE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!mounted) return null

  const titleId = 'more-sheet-title'

  return (
    <div
      className={`more-backdrop${entered ? ' entered' : ''}`}
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className={`more-sheet${entered ? ' entered' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="more-handle" aria-hidden="true" />
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel}>
            <CloseIcon size={18} />
          </button>
        </header>
        <nav aria-label={navLabel}>
          {items.map(item => (
            <Link key={item.href} href={item.href} className="more-link" onClick={onClose}>
              <span className="more-icon">{item.icon}</span>
              <span className="more-text">
                <strong>{item.label}</strong>
                {item.helper && <small>{item.helper}</small>}
              </span>
            </Link>
          ))}
          {footer}
        </nav>
      </section>
      <style jsx>{`
        .more-backdrop {
          position: fixed; inset: 0; z-index: 500;
          display: flex; align-items: flex-end; justify-content: center;
          background: rgba(20,15,12,.48); backdrop-filter: blur(5px);
          opacity: 0; transition: opacity .16s ease;
        }
        .more-backdrop.entered { opacity: 1; }
        .more-sheet {
          width: 100%;
          /* dvh fallback: if dvh is unsupported the whole min() is invalid
             and dropped, so declare the vh version first — unsupporting
             browsers keep it, supporting ones override with the dvh line. */
          max-height: min(86vh, 720px);
          max-height: min(86dvh, 720px);
          padding: 12px 14px calc(18px + env(safe-area-inset-bottom, 0px));
          overflow: auto; background: var(--surface);
          border-radius: 24px 24px 0 0; box-shadow: 0 -20px 70px rgba(0,0,0,.22);
          transform: translateY(100%); opacity: 0;
          transition: transform .22s ease-out, opacity .22s ease-out;
        }
        .more-sheet.entered { transform: translateY(0); opacity: 1; }
        .more-handle { width: 42px; height: 4px; margin: 0 auto 13px; background: #cfc5bc; border-radius: 99px; }
        header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2px 2px 14px; }
        header span { color: var(--text-muted); font-size: .7rem; }
        h2 { margin: 2px 0 0; font-size: 1.15rem; }
        header button { display: grid; width: 44px; height: 44px; place-items: center; color: var(--text-sub); background: var(--surface-alt); border-radius: 14px; }
        nav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        :global(.more-link) { display: flex; min-height: 68px; align-items: center; gap: 11px; padding: 10px 11px; color: var(--text); text-align: left; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 15px; text-decoration: none; }
        :global(.more-link:focus-visible) { outline: 3px solid rgba(44,110,73,.28); outline-offset: 1px; }
        :global(.more-icon) { display: grid; width: 38px; min-width: 38px; height: 38px; place-items: center; color: var(--brand); background: var(--surface); border-radius: 12px; }
        :global(.more-text) { display: flex; min-width: 0; flex-direction: column; }
        :global(.more-text strong) { font-size: .78rem; }
        :global(.more-text small) { margin-top: 3px; overflow: hidden; color: var(--text-muted); font-size: .65rem; text-overflow: ellipsis; white-space: nowrap; }
        :global(.more-link.logout) { width: 100%; color: var(--danger); }
        @media (max-width: 370px) { nav { grid-template-columns: 1fr; } .more-sheet { max-height: 90vh; max-height: 90dvh; } }
        @media (prefers-reduced-motion: reduce) {
          .more-backdrop, .more-sheet { transition-duration: .01ms; }
        }
      `}</style>
    </div>
  )
}
