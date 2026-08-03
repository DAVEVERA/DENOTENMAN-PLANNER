import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useDialogFocus } from '@/components/ui/useDialogFocus'
import {
  getReleaseUpdateContent,
  hasSeenReleaseUpdate,
  markReleaseUpdateSeen,
  readReleaseUpdatePreference,
  RELEASE_UPDATES_OPEN_EVENT,
  type ReleaseUpdateAudience,
} from '@/lib/release-updates'

interface Props {
  userId: string
  audience: ReleaseUpdateAudience
  autoOpen: boolean
}

export default function ReleaseUpdatePopout({ userId, audience, autoOpen }: Props) {
  const content = getReleaseUpdateContent(audience)
  const [open, setOpen] = useState(false)
  const [showFutureUpdates, setShowFutureUpdates] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    markReleaseUpdateSeen(userId, content.version, showFutureUpdates)
    setOpen(false)
  }, [content.version, showFutureUpdates, userId])

  useDialogFocus(open, dialogRef, close)

  useEffect(() => {
    const preference = readReleaseUpdatePreference(userId)
    setShowFutureUpdates(preference.autoShow)
    if (autoOpen && preference.autoShow && !hasSeenReleaseUpdate(preference, content.version)) {
      setOpen(true)
    }
  }, [autoOpen, content.version, userId])

  useEffect(() => {
    const handleOpen = () => {
      const preference = readReleaseUpdatePreference(userId)
      setShowFutureUpdates(preference.autoShow)
      setOpen(true)
    }
    window.addEventListener(RELEASE_UPDATES_OPEN_EVENT, handleOpen)
    return () => window.removeEventListener(RELEASE_UPDATES_OPEN_EVENT, handleOpen)
  }, [userId])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  if (!open) return null

  return (
    <div className="release-overlay" role="presentation">
      <div
        ref={dialogRef}
        className="release-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-update-title"
        aria-describedby="release-update-intro release-update-helper"
        tabIndex={-1}
      >
        <header className="release-header">
          <div className="release-heading">
            <p className="release-eyebrow">{content.eyebrow}</p>
            <h2 id="release-update-title">{content.title}</h2>
          </div>
          <button type="button" className="release-x" onClick={close} aria-label="Sluiten">
            <X size={24} aria-hidden="true" />
          </button>
        </header>

        <div className="release-body">
          <p id="release-update-intro" className="release-intro">{content.intro}</p>
          <ul className="release-list">
            {content.items.map(item => (
              <li key={item.title} className="release-item">
                <span className="release-check" aria-hidden="true"><Check size={18} /></span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
              </li>
            ))}
          </ul>

          <label className="release-toggle">
            <input
              type="checkbox"
              checked={showFutureUpdates}
              onChange={event => setShowFutureUpdates(event.target.checked)}
            />
            <span>{content.toggleLabel}</span>
          </label>

          <button type="button" className="release-close" onClick={close}>{content.closeLabel}</button>
          <p id="release-update-helper" className="release-helper">{content.helperText}</p>
        </div>
      </div>

      <style jsx>{`
        .release-overlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          overflow: hidden;
          padding: clamp(0.5rem, 3vw, 1rem);
          background: rgba(26, 20, 18, 0.58);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .release-dialog {
          width: min(100%, 40rem);
          max-height: calc(100dvh - clamp(1rem, 6vw, 2rem));
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r4);
          box-shadow: var(--shadow-lg);
          animation: release-enter 180ms ease-out;
        }
        .release-header {
          position: sticky;
          top: 0;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: var(--s3);
          padding: clamp(1rem, 5vw, 1.5rem);
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .release-heading { min-width: 0; }
        .release-eyebrow {
          margin: 0 0 var(--s1);
          color: var(--success);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        h2 {
          margin: 0;
          font-size: clamp(1.25rem, 6vw, 1.65rem);
          line-height: 1.18;
          text-wrap: balance;
        }
        .release-x {
          flex: 0 0 48px;
          display: inline-flex;
          width: 48px;
          height: 48px;
          align-items: center;
          justify-content: center;
          margin: -0.5rem -0.5rem 0 0;
          border-radius: var(--r-pill);
          color: var(--text-sub);
          touch-action: manipulation;
        }
        .release-x:hover { background: var(--surface-alt); color: var(--text); }
        .release-body {
          display: flex;
          flex-direction: column;
          gap: clamp(0.875rem, 4vw, 1.25rem);
          padding: clamp(1rem, 5vw, 1.5rem);
        }
        .release-intro { margin: 0; color: var(--text-sub); }
        .release-list { display: grid; gap: var(--s2); margin: 0; }
        .release-item {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr);
          gap: var(--s3);
          padding: var(--s3);
          background: var(--brand-subtle);
          border: 1px solid var(--brand-light);
          border-radius: var(--r3);
        }
        .release-item > span:last-child { min-width: 0; }
        .release-item strong,
        .release-item strong + span { display: block; }
        .release-item strong { margin-bottom: 2px; font-size: 0.9375rem; }
        .release-item strong + span { color: var(--text-sub); font-size: 0.875rem; line-height: 1.45; }
        .release-check {
          display: inline-flex;
          width: 32px;
          height: 32px;
          align-items: center;
          justify-content: center;
          border-radius: var(--r-pill);
          background: var(--success-bg);
          color: var(--success);
        }
        .release-toggle {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          align-items: center;
          min-height: 48px;
          cursor: pointer;
          color: var(--text-sub);
          font-size: 0.875rem;
          touch-action: manipulation;
        }
        .release-toggle input {
          width: 20px;
          height: 20px;
          margin-left: 4px;
          accent-color: var(--success);
        }
        .release-close {
          display: inline-flex;
          width: 100%;
          min-height: 48px;
          align-items: center;
          justify-content: center;
          padding: 0 var(--s4);
          border-radius: var(--r2);
          background: var(--brand);
          color: var(--text-inv);
          font-weight: 600;
          touch-action: manipulation;
        }
        .release-close:hover { background: var(--brand-dark); }
        .release-helper {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.75rem;
          line-height: 1.45;
          text-align: center;
        }
        @keyframes release-enter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 640px) {
          .release-overlay { align-items: center; }
          .release-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .release-close { width: auto; align-self: flex-end; min-width: 12rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .release-dialog { animation: none; }
        }
      `}</style>
    </div>
  )
}
