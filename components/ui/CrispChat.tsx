import { useEffect } from 'react'

declare global {
  interface Window {
    $crisp?: unknown[]
    CRISP_WEBSITE_ID?: string
  }
}

/**
 * "Quick assist" support widget — embeds Crisp live chat.
 *
 * Fails closed: if NEXT_PUBLIC_CRISP_WEBSITE_ID isn't set, this renders
 * nothing and does not attempt to load any script. No console noise, no
 * broken widget button — the app just doesn't have live support wired up
 * yet, same as the VAPID-unconfigured push-notification path.
 *
 * NEXT_PUBLIC_* is intentional here: a Crisp website ID is a public
 * identifier (same trust level as a Google Analytics ID), not a secret —
 * it only lets the Crisp widget attach to this specific workspace's inbox,
 * it does not grant any account access.
 */
export default function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID
    if (!websiteId) return
    if (document.getElementById('crisp-chat-script')) return

    window.$crisp = window.$crisp ?? []
    window.CRISP_WEBSITE_ID = websiteId

    const script = document.createElement('script')
    script.id = 'crisp-chat-script'
    script.src = 'https://client.crisp.chat/l.js'
    script.async = true
    document.head.appendChild(script)
  }, [])

  return null
}
