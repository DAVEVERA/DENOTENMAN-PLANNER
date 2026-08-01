import { LogOut, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useDialogFocus } from '../ui/useDialogFocus'

interface Item { href: string; label: string; icon: React.ReactNode }
interface Props { open: boolean; items: Item[]; onClose(): void; onLogout(): void }

export default function AdminMobileMoreNav({ open, items, onClose, onLogout }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(open, dialogRef, onClose)
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [onClose, open])
  if (!open) return null
  return (
    <div className="admin-more-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="admin-more-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-more-title" tabIndex={-1}>
        <div className="handle" />
        <header><div><span>Beheerportaal</span><h2 id="admin-more-title">Meer functies</h2></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Menu sluiten"><X size={22} /></button></header>
        <nav aria-label="Overige beheerfuncties">
          {items.map(item => <Link key={item.href} href={item.href} onClick={onClose}><span className="icon">{item.icon}</span><strong>{item.label}</strong></Link>)}
          <button type="button" className="logout" onClick={onLogout}><span className="icon"><LogOut size={20} /></span><strong>Uitloggen</strong></button>
        </nav>
      </section>
      <style jsx>{`
        .admin-more-backdrop { position: fixed; inset: 0; z-index: 600; display: flex; align-items: flex-end; background: rgba(20,15,12,.5); backdrop-filter: blur(5px); }
        .admin-more-sheet { width: 100%; max-height: 86dvh; padding: 12px 14px calc(18px + env(safe-area-inset-bottom)); overflow: auto; background: var(--surface); border-radius: 24px 24px 0 0; }
        .handle { width: 42px; height: 4px; margin: 0 auto 13px; background: #cfc5bc; border-radius: 99px; }
        header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; } header span { color: var(--text-muted); font-size: .7rem; } h2 { margin: 2px 0 0; font-size: 1.15rem; } header button { display: grid; width: 44px; height: 44px; place-items: center; background: var(--surface-alt); border-radius: 13px; }
        nav { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } nav :global(a), nav button { display: flex; min-height: 62px; align-items: center; gap: 10px; padding: 9px 11px; color: var(--text); text-align: left; background: var(--surface-alt); border: 1px solid var(--border); border-radius: 14px; text-decoration: none; } .icon { display: grid; width: 36px; min-width: 36px; height: 36px; place-items: center; color: var(--brand); background: #fff; border-radius: 11px; } strong { font-size: .75rem; }.logout { color: var(--danger); }
        @media(max-width:370px){ nav { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}
