import { LogoutIcon } from '../ui/Icons'
import MoreSheet from './MoreSheet'

interface Item { href: string; label: string; icon: React.ReactNode }
interface Props { open: boolean; items: Item[]; onClose(): void; onLogout(): void }

export default function AdminMobileMoreNav({ open, items, onClose, onLogout }: Props) {
  return (
    <MoreSheet
      open={open}
      eyebrow="Beheerportaal"
      title="Menu"
      navLabel="Overige beheerfuncties"
      items={items}
      onClose={onClose}
      footer={
        <button type="button" className="more-link logout" onClick={onLogout}>
          <span className="more-icon"><LogoutIcon size={24} /></span>
          <span className="more-text"><strong>Uitloggen</strong></span>
        </button>
      }
    />
  )
}
