import type { SessionUser } from '../../types'
import {
  LeaveIcon,
  HoursIcon,
  ProfileIcon,
  DocumentIcon,
  ReceiptIcon,
  TicketIcon,
  SettingsIcon,
  WarehouseIcon,
  LogoutIcon,
} from '../ui/Icons'
import MoreSheet, { type MoreSheetItem } from './MoreSheet'

interface Props {
  open: boolean
  user: SessionUser
  isAdmin: boolean
  onClose(): void
  onLogout(): void
}

// Icon tier: L (24px) — touch-first tegel-iconen in de overflow-sheet.
const ICON_SIZE = 24

export default function MobileMoreNav({ open, user, isAdmin, onClose, onLogout }: Props) {
  const items: MoreSheetItem[] = []

  if (user.location === 'both' || isAdmin) {
    items.push({
      href: '/team/nootmagazijn',
      icon: <WarehouseIcon size={ICON_SIZE} />,
      label: 'Rooster Nootmagazijn',
      helper: 'Teambezetting en diensten',
    })
  }
  items.push(
    { href: '/me/leave', icon: <LeaveIcon size={ICON_SIZE} />, label: 'Verlof', helper: 'Aanvragen en status' },
    { href: '/me/hours', icon: <HoursIcon size={ICON_SIZE} />, label: 'Mijn uren', helper: 'Ingediend en exportklaar' },
    { href: '/me/profile', icon: <ProfileIcon size={ICON_SIZE} />, label: 'Mijn profiel', helper: 'Contact- en accountgegevens' },
    { href: '/me/documents', icon: <DocumentIcon size={ICON_SIZE} />, label: 'Documenten', helper: 'Persoonlijke documenten' },
    { href: '/me/expenses', icon: <ReceiptIcon size={ICON_SIZE} />, label: 'Declaraties', helper: 'Kosten indienen en volgen' },
    { href: '/me/support', icon: <TicketIcon size={ICON_SIZE} />, label: 'Support', helper: 'Vraag hulp of meld een probleem' },
  )
  if (isAdmin) {
    items.push({ href: '/admin', icon: <SettingsIcon size={ICON_SIZE} />, label: 'Beheer', helper: 'Open het adminportaal' })
  }

  return (
    <MoreSheet
      open={open}
      eyebrow="Ingelogd als"
      title={user.display_name}
      navLabel="Menu"
      items={items}
      onClose={onClose}
      footer={
        <button type="button" className="more-link logout" onClick={onLogout}>
          <span className="more-icon"><LogoutIcon size={ICON_SIZE} /></span>
          <span className="more-text">
            <strong>Uitloggen</strong>
            <small>Sessie veilig afsluiten</small>
          </span>
        </button>
      }
    />
  )
}
