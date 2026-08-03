import { ArrowRightLeft, CalendarClock, MapPin, UserRound } from 'lucide-react'

import type { TeamShiftSnapshot } from '../../lib/team-chat/repository'
import styles from './TeamChat.module.css'

interface Props {
  shift: TeamShiftSnapshot
  currentEmployeeId: number | null
  onExchange?(shift: TeamShiftSnapshot): void
}

export function formatShiftSnapshot(shift: TeamShiftSnapshot): string {
  const time = shift.full_day
    ? 'Hele dag'
    : [shift.start_time?.slice(0, 5), shift.end_time?.slice(0, 5)].filter(Boolean).join('–')
  return `Week ${shift.week_number} · ${shift.day_of_week} · ${time || shift.shift_type}`
}

export default function ShiftMessageCard({ shift, currentEmployeeId, onExchange }: Props) {
  const isOwn = Boolean(currentEmployeeId && shift.employee_id === currentEmployeeId)
  return (
    <article className={styles.shiftCard} aria-label={`Gedeelde dienst: ${formatShiftSnapshot(shift)}`}>
      <div className={styles.shiftCardAccent} />
      <div className={styles.shiftCardHeader}>
        <span className={styles.shiftType}>{shift.shift_type}</span>
        <span className={styles.shiftId}>Dienst #{shift.shift_id}</span>
      </div>
      <strong>{formatShiftSnapshot(shift)}</strong>
      <div className={styles.shiftMeta}>
        <span><MapPin size={15} />{shift.location === 'markt' ? 'Markt' : 'Magazijn'}</span>
        <span><UserRound size={15} />{shift.employee_name || 'Open dienst'}</span>
        <span><CalendarClock size={15} />{shift.break_minutes} min pauze</span>
      </div>
      {onExchange && (
        <button className={styles.shiftAction} type="button" onClick={() => onExchange(shift)}>
          <ArrowRightLeft size={17} />
          {isOwn ? 'Ruil voorstellen' : 'Dienst overnemen'}
        </button>
      )}
    </article>
  )
}
