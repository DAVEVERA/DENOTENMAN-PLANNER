import { Clock3, FileText, LogOut, ReceiptText, Settings, TicketCheck, Umbrella, UserRound, Warehouse, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

import type { SessionUser } from '../../types'
import { useDialogFocus } from '../ui/useDialogFocus'

interface Props {
  open: boolean
  user: SessionUser
  isAdmin: boolean
  onClose(): void
  onLogout(): void
}

export default function MobileMoreNav({ open, user, isAdmin, onClose, onLogout }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(open, dialogRef, onClose)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [onClose, open])

  if (!open) return null
  const link = (href: string, icon: React.ReactNode, label: string, helper: string) => (
    <Link href={href} className="more-link" onClick={onClose}>
      <span className="more-icon">{icon}</span>
      <span><strong>{label}</strong><small>{helper}</small></span>
    </Link>
  )

  return (
    <div className="more-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-title" tabIndex={-1}>
        <div className="more-handle" aria-hidden="true" />
        <header>
          <div><span>Ingelogd als</span><h2 id="more-title">{user.display_name}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Meer-menu sluiten"><X size={22} /></button>
        </header>
        <nav aria-label="Meer functies">
          {(user.location === 'both' || isAdmin) && link('/team/nootmagazijn', <Warehouse size={21} />, 'Rooster Nootmagazijn', 'Teambezetting en diensten')}
          {link('/me/leave', <Umbrella size={21} />, 'Verlof', 'Aanvragen en status')}
          {link('/me/hours', <Clock3 size={21} />, 'Mijn uren', 'Ingediend en exportklaar')}
          {link('/me/profile', <UserRound size={21} />, 'Mijn profiel', 'Contact- en accountgegevens')}
          {link('/me/documents', <FileText size={21} />, 'Documenten', 'Persoonlijke documenten')}
          {link('/me/expenses', <ReceiptText size={21} />, 'Declaraties', 'Kosten indienen en volgen')}
          {link('/me/support', <TicketCheck size={21} />, 'Support', 'Vraag hulp of meld een probleem')}
          {isAdmin && link('/admin', <Settings size={21} />, 'Beheer', 'Open het adminportaal')}
          <button type="button" className="more-link logout" onClick={onLogout}>
            <span className="more-icon"><LogOut size={21} /></span>
            <span><strong>Uitloggen</strong><small>Sessie veilig afsluiten</small></span>
          </button>
        </nav>
      </section>
      <style jsx>{`
        .more-backdrop { position: fixed; inset: 0; z-index: 500; display: flex; align-items: flex-end; justify-content: center; background: rgba(20,15,12,.48); backdrop-filter: blur(5px); }
        .more-sheet { width: 100%; max-height: min(86dvh, 720px); padding: 12px 14px calc(18px + env(safe-area-inset-bottom, 0px)); overflow: auto; background: var(--surface); border-radius: 24px 24px 0 0; box-shadow: 0 -20px 70px rgba(0,0,0,.22); }
        .more-handle { width: 42px; height: 4px; margin: 0 auto 13px; background: #cfc5bc; border-radius: 99px; }
        header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2px 2px 14px; }
        header span { color: var(--text-muted); font-size: .7rem; }
        h2 { margin: 2px 0 0; font-size: 1.15rem; }
        header button { display: grid; width: 44px; height: 44px; place-items: center; color: var(--text-sub); background: var(--surface-alt); border-radius: 14px; }
        nav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        :global(.more-link) { display: flex; min-height: 68px; align-items: center; gap: 11px; padding: 10px 11px; color: var(--text); text-align: left; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 15px; text-decoration: none; }
        :global(.more-link:focus-visible) { outline: 3px solid rgba(44,110,73,.28); outline-offset: 1px; }
        :global(.more-icon) { display: grid; width: 38px; min-width: 38px; height: 38px; place-items: center; color: var(--brand); background: var(--surface); border-radius: 12px; }
        :global(.more-link span:last-child) { display: flex; min-width: 0; flex-direction: column; }
        :global(.more-link strong) { font-size: .78rem; }
        :global(.more-link small) { margin-top: 3px; overflow: hidden; color: var(--text-muted); font-size: .65rem; text-overflow: ellipsis; white-space: nowrap; }
        .logout { width: 100%; color: var(--danger); }
        @media (max-width: 370px) { nav { grid-template-columns: 1fr; } .more-sheet { max-height: 90dvh; } }
      `}</style>
    </div>
  )
}
