import { AlertTriangle, ArrowRight, Check, Clock3, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { PlanningWatchItem } from '../../lib/team-chat/planning-watch'
import styles from './TeamChat.module.css'

interface Props {
  visible?: boolean
  onNavigate?(conversationId: number | null): void
  onChanged?(): void
  onClose?(): void
}

export default function PlanningWatchPanel({ visible = true, onNavigate, onChanged, onClose }: Props) {
  const [items, setItems] = useState<PlanningWatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const response = await fetch('/api/team-chat/planning-watch', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) throw new Error('PLANNING_WATCH_FAILED')
      setItems(payload.data)
    } catch {
      setLoadError('Planningwacht kon niet worden bijgewerkt. Controleer je verbinding en probeer opnieuw.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    void load()
  }, [load, visible])

  async function respond(item: PlanningWatchItem, decision: 'accepted' | 'declined') {
    if (!item.request_id) return
    setActionId(item.id)
    try {
      const response = await fetch(`/api/team-chat/exchanges/${item.request_id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (!response.ok) throw new Error('EXCHANGE_RESPONSE_FAILED')
      await load()
      onChanged?.()
    } catch {
      setLoadError('Je reactie kon niet veilig worden verwerkt. Probeer het opnieuw.')
    } finally {
      setActionId(null)
    }
  }

  if (!visible) return null
  return (
    <aside className={styles.planningWatch} aria-label="Planningwacht">
      <div className={styles.watchHeader}>
        <div>
          <p className={styles.eyebrow}>Actueel</p>
          <h2>Planningwacht</h2>
        </div>
        <div className={styles.watchHeaderActions}>
          <button type="button" className={styles.iconButton} onClick={() => { setLoading(true); void load() }} aria-label="Planningwacht verversen"><RefreshCw size={18} /></button>
          {onClose && <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Planningwacht sluiten"><X size={18} /></button>}
        </div>
      </div>
      <div className={styles.watchGuard}>
        <ShieldCheck size={17} />
        <span>Controleert altijd conflicten vóór het rooster wijzigt.</span>
      </div>
      {loading && <p className={styles.panelHint}>Planning controleren…</p>}
      {!loading && loadError && <p className={styles.watchError} role="alert">{loadError}</p>}
      {!loading && !loadError && items.length === 0 && (
        <div className={styles.watchCalm}><Check size={20} /><strong>Alles onder controle</strong><span>Geen directe roosteracties voor jou.</span></div>
      )}
      <div className={styles.watchItems}>
        {items.map(item => (
          <article key={item.id} className={`${styles.watchItem} ${styles[`severity_${item.severity}`]}`}>
            <span className={styles.watchIcon}>{item.severity === 'urgent' || item.severity === 'attention' ? <AlertTriangle size={18} /> : <Clock3 size={18} />}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
              {item.kind === 'exchange_response' && item.request_id ? (
                <div className={styles.watchActions}>
                  <button type="button" onClick={() => respond(item, 'accepted')} disabled={actionId === item.id}><Check size={16} /> Akkoord</button>
                  <button type="button" onClick={() => respond(item, 'declined')} disabled={actionId === item.id}><X size={16} /> Afwijzen</button>
                </div>
              ) : item.action ? (
                <button type="button" className={styles.watchLink} onClick={() => onNavigate?.(item.conversation_id)}>{item.action.label}<ArrowRight size={15} /></button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </aside>
  )
}
