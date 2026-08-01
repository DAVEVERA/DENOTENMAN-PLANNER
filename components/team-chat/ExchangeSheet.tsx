import { ArrowRightLeft, Check, X } from 'lucide-react'
import { useRef, useState } from 'react'

import type { TeamShiftSnapshot } from '../../lib/team-chat/repository'
import { createClientNonce } from '../../lib/team-chat/client'
import { useDialogFocus } from '../ui/useDialogFocus'
import styles from './TeamChat.module.css'

interface Props {
  shift: TeamShiftSnapshot
  currentEmployeeId: number | null
  conversationId: number
  onClose(): void
  onCreated(): void
}

export default function ExchangeSheet({ shift, currentEmployeeId, conversationId, onClose, onCreated }: Props) {
  const isOwn = Boolean(currentEmployeeId && shift.employee_id === currentEmployeeId)
  const [targetShiftId, setTargetShiftId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(true, dialogRef, onClose)

  async function submit() {
    setSaving(true)
    setError(null)
    const body = isOwn
      ? {
          kind: 'swap',
          source_shift_id: shift.shift_id,
          target_shift_id: Number(targetShiftId),
          conversation_id: conversationId,
          client_nonce: createClientNonce(),
        }
      : {
          kind: 'takeover',
          source_shift_id: shift.shift_id,
          conversation_id: conversationId,
          client_nonce: createClientNonce(),
        }
    try {
      const response = await fetch('/api/team-chat/exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.code || 'SHIFT_EXCHANGE_FAILED')
      onCreated()
      onClose()
    } catch {
      setError('Het voorstel kon niet veilig worden aangemaakt. Controleer de dienst en probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  const valid = !isOwn || (Number.isInteger(Number(targetShiftId)) && Number(targetShiftId) > 0 && Number(targetShiftId) !== shift.shift_id)

  return (
    <div className={styles.sheetBackdrop} role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="exchange-title" tabIndex={-1}>
        <div className={styles.sheetHandle} aria-hidden="true" />
        <div className={styles.sheetHeader}>
          <div>
            <p className={styles.eyebrow}>Roosterbeveiligd</p>
            <h2 id="exchange-title">{isOwn ? 'Ruil voorstellen' : 'Dienst overnemen'}</h2>
          </div>
          <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Sluiten"><X size={21} /></button>
        </div>

        <div className={styles.exchangeFacts}>
          <div><span>Dienst</span><strong>#{shift.shift_id} · {shift.shift_type}</strong></div>
          <div><span>Moment</span><strong>Week {shift.week_number}, {shift.day_of_week}</strong></div>
          <div><span>Tijd</span><strong>{shift.full_day ? 'Hele dag' : `${shift.start_time?.slice(0, 5)}–${shift.end_time?.slice(0, 5)}`}</strong></div>
          <div><span>Locatie</span><strong>{shift.location === 'markt' ? 'Markt' : 'Nootmagazijn'}</strong></div>
        </div>

        {isOwn && (
          <label className={styles.fieldLabel}>
            Dienst-ID van je collega
            <input
              className={styles.textInput}
              inputMode="numeric"
              value={targetShiftId}
              onChange={event => setTargetShiftId(event.target.value.replace(/\D/g, ''))}
              placeholder="Bijvoorbeeld 1842"
            />
            <span>De tijden en locatie blijven altijd onveranderd; alleen de medewerkers wisselen.</span>
          </label>
        )}

        <div className={styles.guardrail}>
          <Check size={18} />
          <span>Het rooster wijzigt pas na akkoord van beide collega’s en een laatste conflictcontrole.</span>
        </div>
        {error && <p className={styles.inlineError} role="alert">{error}</p>}
        <div className={styles.sheetActions}>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>Annuleren</button>
          <button className={styles.primaryButton} type="button" onClick={submit} disabled={!valid || saving}>
            <ArrowRightLeft size={18} />{saving ? 'Veilig controleren…' : 'Voorstel versturen'}
          </button>
        </div>
      </section>
    </div>
  )
}
