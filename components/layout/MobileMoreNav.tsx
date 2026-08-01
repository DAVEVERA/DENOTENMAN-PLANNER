import type { SessionUser } from '../../types'
import {
  ScheduleIcon,
  MyScheduleIcon,
  ChatIcon,
  LeaveIcon,
  HoursIcon,
  ProfileIcon,
  DocumentIcon,
  ReceiptIcon,
  TicketIcon,
  SettingsIcon,
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

// Alle navigatie zit nu in het hamburgermenu — de mobiele bottom-nav is
// alleen nog de trigger. Zelfde groepering/volgorde als de desktop
// sidebar (ROOSTER / MIJN ZAKEN / CONTACT), zodat mobiel en desktop
// dezelfde mentale kaart van de app geven.
export default function MobileMoreNav({ open, user, isAdmin, onClose, onLogout }: Props) {
  const showMarkt = user.location === 'markt' || user.location === 'both' || isAdmin
  const showNoot = user.location === 'nootmagazijn' || user.location === 'both' || isAdmin
  const bothLocations = user.location === 'both' || isAdmin

  const items: MoreSheetItem[] = []

  // ROOSTER
  if (showMarkt) {
    items.push({
      href: '/team/markt',
      icon: <ScheduleIcon size={ICON_SIZE} />,
      label: bothLocations ? 'Rooster Markt' : 'Rooster',
      helper: 'Teambezetting en diensten',
    })
  }
  if (showNoot) {
    items.push({
      href: '/team/nootmagazijn',
      icon: <ScheduleIcon size={ICON_SIZE} />,
      label: bothLocations ? 'Rooster Noot' : 'Rooster',
      helper: 'Teambezetting en diensten',
    })
  }
  items.push(
    { href: '/me', icon: <MyScheduleIcon size={ICON_SIZE} />, label: 'Mijn rooster', helper: 'Jouw ingeplande diensten' },
    { href: '/me/open-shifts', icon: <ScheduleIcon size={ICON_SIZE} />, label: 'Open diensten', helper: 'Beschikbare diensten claimen' },
  )

  // MIJN ZAKEN
  items.push(
    { href: '/me/leave', icon: <LeaveIcon size={ICON_SIZE} />, label: 'Verlof', helper: 'Aanvragen en status' },
    { href: '/me/hours', icon: <HoursIcon size={ICON_SIZE} />, label: 'Mijn uren', helper: 'Ingediend en exportklaar' },
    { href: '/me/expenses', icon: <ReceiptIcon size={ICON_SIZE} />, label: 'Declaraties', helper: 'Kosten indienen en volgen' },
    { href: '/me/documents', icon: <DocumentIcon size={ICON_SIZE} />, label: 'Documenten', helper: 'Persoonlijke documenten' },
    { href: '/me/profile', icon: <ProfileIcon size={ICON_SIZE} />, label: 'Mijn profiel', helper: 'Contact- en accountgegevens' },
  )

  // CONTACT
  items.push(
    { href: '/me/chat', icon: <ChatIcon size={ICON_SIZE} />, label: 'Teamchat', helper: 'Kanalen en dienstenruil' },
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
