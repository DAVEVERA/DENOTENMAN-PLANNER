import { useEffect, useState } from 'react'

type State = 'checking' | 'available' | 'enabling' | 'enabled' | 'denied' | 'unsupported' | 'error'

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0))).buffer as ArrayBuffer
}

export default function PushNotificationButton() {
  const [state, setState] = useState<State>('checking')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker.ready
      .then(registration => registration.pushManager.getSubscription())
      .then(subscription => setState(subscription ? 'enabled' : 'available'))
      .catch(() => setState('error'))
  }, [])

  async function enablePush() {
    setState('enabling')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'available')
        return
      }

      const keyResponse = await fetch('/api/notifications/subscribe', { cache: 'no-store' })
      const keyData = await keyResponse.json()
      if (!keyData.success || !keyData.publicKey) throw new Error(keyData.message ?? 'Publieke pushsleutel ontbreekt')

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(keyData.publicKey),
      })
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.message ?? 'Pushabonnement opslaan mislukt')
      setState('enabled')
    } catch (error) {
      console.error('[push inschakelen]', error)
      setState('error')
    }
  }

  if (state === 'unsupported') return null

  const content = state === 'enabled'
    ? <span className="push-status">✓ Pushmeldingen actief</span>
    : state === 'denied'
      ? <span className="push-status denied">Pushmeldingen geblokkeerd in je browser</span>
      : (
        <button className="push-button" type="button" onClick={enablePush} disabled={state === 'checking' || state === 'enabling'}>
          {state === 'enabling' ? 'Inschakelen…' : state === 'error' ? 'Opnieuw push inschakelen' : 'Pushmeldingen inschakelen'}
        </button>
      )

  return (
    <>
      {content}
      <style jsx global>{`
        .push-button {
          min-height: 44px; padding: 8px 13px; border-radius: var(--radius);
          border: 1px solid var(--border); background: var(--surface); color: var(--text-sub);
          font-size: .8125rem; font-weight: 600;
        }
        .push-button:hover:not(:disabled) { border-color: var(--brand); color: var(--brand); }
        .push-button:disabled { opacity: .6; cursor: wait; }
        .push-status {
          display: inline-flex; align-items: center; min-height: 44px;
          padding: 8px 12px; border-radius: var(--radius);
          background: #ECFDF5; color: #047857; font-size: .8125rem; font-weight: 600;
        }
        .push-status.denied { background: #FEF2F2; color: #B91C1C; }
      `}</style>
    </>
  )
}
