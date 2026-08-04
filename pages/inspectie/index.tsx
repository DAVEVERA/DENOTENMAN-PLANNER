/* eslint-disable @next/next/no-img-element -- private blob URLs cannot use the Next image optimizer */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { getSession } from '@/lib/auth'
import type { InspectionDocumentMeta, InspectionOverview } from '@/lib/inspection'
import Spinner from '@/components/ui/Spinner'

type Language = 'nl' | 'fr'
type Viewer = { url: string; mimeType: string; expiresAt: number; viewCount: number; documentId: number; documentType: InspectionDocumentMeta['type'] }

const COPY = {
  nl: {
    previewTitle: 'Voorbeeldmodus inspectiedienst', previewText: 'U ziet uitsluitend wat een inspecteur ziet. Testinzages hebben geen invloed op het echte inspectieaccount.', back: 'Terug naar beheer',
    readOnly: 'Alleen-lezen inspectieomgeving', language: 'Français · Shift+F2', logout: 'Veilig afmelden',
    gateTitle: 'Voor u documenten inkijkt', gateIntro: 'U krijgt uitsluitend inzage in de marktbezetting van vandaag en de relevante documenten van de aanwezige medewerkers.',
    rules: ['Een document blijft maximaal 5 seconden zichtbaar en sluit daarna automatisch.', 'Daarna wacht u 10 seconden voordat hetzelfde document opnieuw kan worden geopend.', 'Een document kan maximaal 3 keer na elkaar worden ingezien. Daarna wordt het 3 uur geblokkeerd.', 'De toepassing biedt geen functie om documenten te downloaden, af te drukken, te delen of buiten deze omgeving te openen.'],
    exclusive: 'Gebruik puur en alleen dit account voor een officiële inspectie.', service: 'Dienst- of stamnummer', serviceHelp: 'Vul het officiële nummer in waarmee uw overheidsdienst u identificeert.', privacy: 'Wij gebruiken uw dienstnummer uitsluitend om deze inzages beveiligd te registreren.',
    integrity: 'Ik verklaar dat ik deze inzage uitvoer in mijn officiële hoedanigheid en de verkregen informatie behandel overeenkomstig mijn ambtsplichten, de geldende vertrouwelijkheidsregels en, waar van toepassing, mijn ambtseed.',
    open: 'Verklaring bevestigen en doorgaan', loading: 'Marktbezetting van vandaag veilig laden…',
    today: 'Marktcontrole — vandaag', onlyToday: 'Alleen vandaag · Markt', employees: 'medewerkers van dienst', noEmployees: 'Vandaag zijn er geen medewerkers op de markt ingepland.',
    documents: 'Documenten ter inzage', noDocuments: 'Voor deze medewerker zijn geen documenten voor inspectie vrijgegeven.', identity: 'Identiteitsdocument', contract: 'Arbeidsovereenkomst',
    inspect: '5 sec. inkijken', again: 'Nogmaals 5 sec. inkijken', last: 'Laatste inzage', cooldown: 'Opnieuw mogelijk over', locked: 'Geblokkeerd tot',
    ready: 'Klaar voor inzage?', readyText: (n: number) => `Deze inzage telt als poging ${n} van 3. Het document sluit na 5 seconden automatisch. Daarna geldt een wachttijd van 10 seconden.`, third: 'Dit is de derde inzage. Zodra het document sluit, wordt het 3 uur geblokkeerd.',
    start: 'Document 5 seconden tonen', startLast: 'Laatste inzage starten', cancel: 'Annuleren',
    secureView: 'Beveiligde inzage', closes: 'Sluit automatisch over', attempt: 'Poging', closeNow: 'Nu sluiten',
    loadError: 'Het inspectieoverzicht kon niet veilig worden geladen. Probeer opnieuw.', viewError: 'De inzage kon niet veilig worden gestart. Probeer later opnieuw.', expired: 'De beveiligde inzage is verlopen voordat het document werd geopend.',
  },
  fr: {
    previewTitle: 'Mode aperçu du service d’inspection', previewText: 'Vous voyez uniquement ce qu’un inspecteur voit. Les consultations de test n’affectent pas le compte d’inspection réel.', back: 'Retour à l’administration',
    readOnly: 'Espace d’inspection en lecture seule', language: 'Nederlands · Maj+F2', logout: 'Se déconnecter en toute sécurité',
    gateTitle: 'Avant de consulter les documents', gateIntro: 'Vous pouvez uniquement consulter l’équipe présente aujourd’hui sur le marché et les documents pertinents des collaborateurs présents.',
    rules: ['Un document reste visible pendant 5 secondes au maximum, puis se ferme automatiquement.', 'Vous devez ensuite attendre 10 secondes avant de consulter à nouveau le même document.', 'Un document peut être consulté au maximum 3 fois de suite. Il est ensuite bloqué pendant 3 heures.', 'L’application ne permet pas de télécharger, d’imprimer, de partager ni d’ouvrir les documents en dehors de cet espace.'],
    exclusive: 'Utilisez uniquement et exclusivement ce compte pour une inspection officielle.', service: 'Numéro de service ou matricule', serviceHelp: 'Introduisez le numéro officiel utilisé par votre service pour vous identifier.', privacy: 'Nous utilisons votre numéro uniquement pour enregistrer ces consultations de manière sécurisée.',
    integrity: 'Je déclare effectuer cette consultation dans le cadre de mes fonctions officielles et traiter les informations conformément à mes obligations professionnelles, aux règles de confidentialité applicables et, le cas échéant, à mon serment.',
    open: 'Confirmer la déclaration et continuer', loading: 'Chargement sécurisé de l’équipe du marché…',
    today: 'Contrôle du marché — aujourd’hui', onlyToday: 'Aujourd’hui uniquement · Marché', employees: 'collaborateurs en service', noEmployees: 'Aucun collaborateur n’est prévu sur le marché aujourd’hui.',
    documents: 'Documents à consulter', noDocuments: 'Aucun document n’est autorisé pour ce collaborateur.', identity: 'Pièce d’identité', contract: 'Contrat de travail',
    inspect: 'Consulter pendant 5 s', again: 'Consulter à nouveau pendant 5 s', last: 'Dernière consultation', cooldown: 'À nouveau disponible dans', locked: 'Bloqué jusqu’à',
    ready: 'Prêt à consulter le document ?', readyText: (n: number) => `Cette consultation compte comme tentative ${n} sur 3. Le document se fermera automatiquement après 5 secondes. Un délai de 10 secondes s’appliquera ensuite.`, third: 'Il s’agit de la troisième consultation. Dès la fermeture du document, celui-ci sera bloqué pendant 3 heures.',
    start: 'Afficher le document pendant 5 secondes', startLast: 'Démarrer la dernière consultation', cancel: 'Annuler',
    secureView: 'Consultation sécurisée', closes: 'Fermeture automatique dans', attempt: 'Tentative', closeNow: 'Fermer maintenant',
    loadError: 'L’aperçu d’inspection n’a pas pu être chargé en toute sécurité.', viewError: 'La consultation n’a pas pu être démarrée en toute sécurité.', expired: 'La consultation sécurisée a expiré avant l’ouverture du document.',
  },
} as const

function secondsUntil(value: string | null, now: number) {
  return value ? Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000)) : 0
}

export default function InspectionPage({ preview }: { preview: boolean }) {
  const router = useRouter()
  const [language, setLanguage] = useState<Language>('nl')
  const [serviceNumber, setServiceNumber] = useState('')
  const [integrity, setIntegrity] = useState(false)
  const [overview, setOverview] = useState<InspectionOverview | null>(null)
  const [selected, setSelected] = useState<InspectionDocumentMeta | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewLoading, setViewLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())
  const openerRefs = useRef(new Map<number, HTMLElement>())
  const confirmRef = useRef<HTMLElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const copy = COPY[language]

  const closeViewer = useCallback(() => {
    setViewer(current => {
      if (current) {
        URL.revokeObjectURL(current.url)
        setTimeout(() => openerRefs.current.get(current.documentId)?.focus(), 0)
      }
      return null
    })
    setSelected(null)
    setNotice(language === 'nl' ? 'Inzage gesloten.' : 'Consultation fermée.')
  }, [language])

  useEffect(() => {
    const stored = sessionStorage.getItem('inspection-language')
    if (stored === 'fr') setLanguage('fr')
  }, [])
  useEffect(() => {
    document.documentElement.lang = language === 'nl' ? 'nl-BE' : 'fr-BE'
    sessionStorage.setItem('inspection-language', language)
    const keydown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'F2') { event.preventDefault(); setLanguage(current => current === 'nl' ? 'fr' : 'nl') }
      if (event.key === 'Escape') { if (viewer) closeViewer(); else setSelected(null) }
      if ((event.ctrlKey || event.metaKey) && ['s', 'p'].includes(event.key.toLowerCase())) event.preventDefault()
    }
    window.addEventListener('keydown', keydown, true)
    return () => window.removeEventListener('keydown', keydown, true)
  }, [language, viewer, closeViewer])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (viewer && viewer.expiresAt <= now) closeViewer()
  }, [viewer, now, closeViewer])
  useEffect(() => {
    if (!viewer) return
    const timeout = window.setTimeout(closeViewer, Math.max(0, viewer.expiresAt - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [viewer, closeViewer])
  useEffect(() => {
    const dialog = viewer ? viewerRef.current : selected ? confirmRef.current : null
    if (!dialog) return
    const activeRoot = viewer ? dialog : dialog.parentElement
    const shell = dialog.closest('.inspection-shell')
    const background = Array.from(shell?.children ?? []).filter(element => element !== activeRoot) as HTMLElement[]
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    for (const element of background) {
      element.setAttribute('inert', '')
      element.setAttribute('aria-hidden', 'true')
    }
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'))
    const initial = dialog.querySelector<HTMLElement>('[data-dialog-focus]') ?? focusable[0]
    initial?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || focusable.length === 0) return
      const first = focusable[0]; const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener('keydown', trapFocus)
    return () => {
      dialog.removeEventListener('keydown', trapFocus)
      for (const element of background) {
        element.removeAttribute('inert')
        element.removeAttribute('aria-hidden')
      }
      previouslyFocused?.focus()
    }
  }, [selected, viewer])
  useEffect(() => {
    const hide = () => { if (document.hidden) closeViewer() }
    const offline = () => closeViewer()
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('offline', offline)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('offline', offline) }
  }, [closeViewer])
  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer.url) }, [viewer])

  async function openOverview(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      const response = await fetch('/api/inspectie/overzicht', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceNumber, integrityAccepted: integrity }) })
      const result = await response.json()
      if (response.status === 401) return router.replace('/inspectie/login')
      if (!result.success) throw new Error(copy.loadError)
      setOverview(result.data)
      setServiceNumber('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.loadError) }
    finally { setLoading(false) }
  }

  function updateDocument(id: number, values: Partial<InspectionDocumentMeta>) {
    setOverview(current => current ? ({ ...current, employees: current.employees.map(employee => ({ ...employee, documents: employee.documents.map(document => document.id === id ? { ...document, ...values } : document) })) }) : current)
  }

  async function startView() {
    if (!selected) return
    setViewLoading(true); setError('')
    try {
      const grantResponse = await fetch(`/api/inspectie/documenten/${selected.id}`, { method: 'POST' })
      const grantResult = await grantResponse.json()
      if (grantResponse.status === 401) return router.replace('/inspectie/login')
      if (!grantResult.success) {
        const state = grantResult.data
        if (state) updateDocument(selected.id, { nextAllowedAt: state.next_allowed_at ?? selected.nextAllowedAt, blockedUntil: state.blocked_until ?? selected.blockedUntil })
        throw new Error(copy.viewError)
      }
      const grant = grantResult.data
      updateDocument(selected.id, { viewCount: grant.view_count, nextAllowedAt: grant.next_allowed_at, blockedUntil: grant.blocked_until })
      const contentResponse = await fetch('/api/inspectie/documenten/inhoud', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: grant.token }), cache: 'no-store',
      })
      if (!contentResponse.ok) throw new Error(contentResponse.status === 410 ? copy.expired : copy.viewError)
      const serverExpiresAt = new Date(contentResponse.headers.get('X-Inspection-Expires-At') ?? grant.expires_at).getTime()
      const expiresAt = Math.min(serverExpiresAt, Date.now() + 5_000)
      const blob = await contentResponse.blob()
      if (expiresAt <= Date.now()) throw new Error(copy.expired)
      setViewer({ url: URL.createObjectURL(blob), mimeType: blob.type, expiresAt, viewCount: grant.view_count, documentId: selected.id, documentType: selected.type })
      setSelected(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.viewError); setSelected(null) }
    finally { setViewLoading(false) }
  }

  async function logout() {
    setOverview(null); closeViewer(); sessionStorage.removeItem('inspection-language')
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    router.replace('/inspectie/login')
  }
  async function exitPreview() {
    setOverview(null); closeViewer()
    const response = await fetch('/api/inspectie/exit-preview', { method: 'POST' })
    router.replace(response.ok ? '/admin/settings' : '/login')
  }

  const formattedDate = useMemo(() => overview ? new Intl.DateTimeFormat(language === 'nl' ? 'nl-BE' : 'fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' }).format(new Date(`${overview.date}T12:00:00Z`)) : '', [overview, language])

  return (
    <main className="inspection-shell" onContextMenu={event => event.preventDefault()}>
      {preview && <aside className="preview" role="status"><div><strong>{copy.previewTitle}</strong><span>{copy.previewText}</span></div><button onClick={exitPreview}>{copy.back}</button></aside>}
      <header><div className="brand"><b>DE NOTENMAN</b><span>{copy.readOnly}</span></div><div className="header-actions"><button onClick={() => setLanguage(language === 'nl' ? 'fr' : 'nl')}>{copy.language}</button><button onClick={logout}>{copy.logout}</button></div></header>
      <div className="content">
        {!overview ? (
          <section className="gate" aria-labelledby="gate-title">
            <p className="scope">{copy.exclusive}</p><h1 id="gate-title">{copy.gateTitle}</h1><p>{copy.gateIntro}</p>
            <ul>{copy.rules.map(rule => <li key={rule}><span aria-hidden>✓</span>{rule}</li>)}</ul>
            <form onSubmit={openOverview}>
              {error && <div className="alert" role="alert">{error}</div>}
              <label htmlFor="service-number">{copy.service}</label>
              <input id="service-number" required minLength={3} maxLength={32} pattern={'[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\\x2F\\x2D]{2,31}'} autoComplete="off" value={serviceNumber} onChange={event => setServiceNumber(event.target.value)} aria-describedby="service-help" />
              <small id="service-help">{copy.serviceHelp}<br />{copy.privacy}</small>
              <label className="integrity"><input type="checkbox" checked={integrity} onChange={event => setIntegrity(event.target.checked)} required /><span>{copy.integrity}</span></label>
              <button className="primary" disabled={loading}>{loading && <Spinner height={20} />}{loading ? copy.loading : copy.open}</button>
            </form>
          </section>
        ) : (
          <section className="roster" aria-labelledby="roster-title">
            <div className="roster-heading"><div><span className="market-badge">{copy.onlyToday}</span><h1 id="roster-title">{copy.today}</h1><p>{formattedDate} · {overview.employees.length} {copy.employees}</p></div></div>
            {error && <div className="alert" role="alert">{error}</div>}{notice && <p className="notice" aria-live="polite">{notice}</p>}
            {overview.employees.length === 0 ? <div className="empty">{copy.noEmployees}</div> : overview.employees.map(employee => (
              <article className="employee" key={employee.id}>
                <div className="employee-info"><div className="avatar" aria-hidden>{employee.name.charAt(0)}</div><div><h2>{employee.name}</h2>{employee.shifts.map((shift, index) => <p key={index}>{shift.fullDay ? (language === 'nl' ? 'Volledige dag' : 'Journée complète') : `${shift.startTime ?? '—'}–${shift.endTime ?? '—'}`}</p>)}</div></div>
                <div className="document-list"><h3>{copy.documents}</h3>{employee.documents.length === 0 ? <p className="muted">{copy.noDocuments}</p> : employee.documents.map(document => {
                  const blockedSeconds = secondsUntil(document.blockedUntil, now); const cooldownSeconds = secondsUntil(document.nextAllowedAt, now); const effectiveCount = document.blockedUntil && blockedSeconds === 0 ? 0 : document.viewCount; const disabled = blockedSeconds > 0 || cooldownSeconds > 0
                  return <div className="document" key={document.id} tabIndex={-1} ref={node => { if (node) openerRefs.current.set(document.id, node) }}><div><strong>{document.type === 'identity' ? copy.identity : copy.contract}</strong><span>{blockedSeconds > 0 ? `${copy.locked} ${new Date(document.blockedUntil!).toLocaleTimeString(language === 'nl' ? 'nl-BE' : 'fr-BE', { hour: '2-digit', minute: '2-digit' })}` : cooldownSeconds > 0 ? `${copy.cooldown} 00:${String(cooldownSeconds).padStart(2, '0')}` : effectiveCount === 2 ? `${copy.last} · ${language === 'nl' ? 'daarna 3 uur geblokkeerd' : 'blocage de 3 heures ensuite'}` : `${effectiveCount} / 3`}</span></div><button disabled={disabled} onClick={() => setSelected({ ...document, viewCount: effectiveCount })}>{effectiveCount === 0 ? copy.inspect : effectiveCount === 2 ? copy.last : copy.again}</button></div>
                })}</div>
              </article>
            ))}
          </section>
        )}
      </div>

      {selected && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}><section ref={confirmRef} className="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{copy.ready}</h2><p>{copy.readyText(selected.viewCount + 1)}</p>{selected.viewCount === 2 && <p className="third">{copy.third}</p>}<div><button onClick={() => setSelected(null)}>{copy.cancel}</button><button data-dialog-focus className="primary" onClick={startView} disabled={viewLoading}>{viewLoading && <Spinner height={18} />}{selected.viewCount === 2 ? copy.startLast : copy.start}</button></div></section></div>}
      {viewer && <div ref={viewerRef} className="viewer" role="dialog" aria-modal="true" aria-label={copy.secureView}><div className="viewer-bar"><div><strong>{copy.secureView} · {viewer.documentType === 'identity' ? copy.identity : copy.contract}</strong><span>{copy.attempt} {viewer.viewCount} / 3</span></div><div className="countdown" aria-live="polite">{copy.closes} <b>{Math.min(5, Math.max(0, Math.ceil((viewer.expiresAt - now) / 1000)))}</b> sec.</div><button data-dialog-focus onClick={closeViewer}>{copy.closeNow}</button></div><div className="document-canvas">{viewer.mimeType === 'application/pdf' ? <iframe src={`${viewer.url}#toolbar=0&navpanes=0&scrollbar=0`} title={copy.secureView} /> : <img src={viewer.url} alt={copy.secureView} draggable={false} />}</div></div>}

      <style jsx>{`
        .inspection-shell{min-height:100dvh;background:#f8f5f0;color:#1a1412;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.preview{position:sticky;top:0;z-index:30;background:#713b13;color:#fff;padding:10px max(16px,calc((100vw - 880px)/2));display:flex;align-items:center;justify-content:space-between;gap:16px}.preview div{display:flex;flex-direction:column}.preview span{font-size:.78rem;opacity:.82}.preview button,.header-actions button{min-height:48px;border:1px solid currentColor;border-radius:9px;padding:0 13px;font-weight:800;color:inherit}
        header{height:auto;min-height:76px;background:#100c0a;color:#fff;padding:14px max(16px,calc((100vw - 880px)/2));display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:flex;flex-direction:column}.brand b{color:#ffcf6b;letter-spacing:.14em}.brand span{font-size:.76rem;color:rgba(255,255,255,.58)}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.header-actions button{font-size:.8rem}
        .content{width:min(880px,calc(100% - 32px));margin:0 auto;padding:28px 0 56px}.gate{max-width:680px;margin:auto;background:#fff;border:1px solid #d8cec4;border-radius:16px;padding:28px}.gate h1{margin:5px 0 10px}.scope,.market-badge{display:inline-flex;background:#e8f5ee;color:#235a3b;border-radius:999px;padding:6px 10px;font-size:.76rem;font-weight:800}.gate>p:not(.scope){color:#5c5248}.gate ul{display:grid;gap:10px;margin:22px 0;padding:16px;background:#fbf8f4;border-radius:12px}.gate li{display:flex;gap:10px;font-size:.9rem}.gate li span{color:#235a3b;font-weight:900}.gate form{display:flex;flex-direction:column;gap:9px}.gate label{font-weight:800;font-size:.88rem}.gate input[type=text],.gate input:not([type]){min-height:50px;border:1px solid #b9aca0;border-radius:9px;padding:0 12px}.gate small{color:#6e6258}.integrity{display:flex;align-items:flex-start;gap:12px;margin:12px 0;font-weight:500!important;line-height:1.45}.integrity input{width:22px;height:22px;flex:none}.primary{background:#235a3b!important;color:#fff!important;border-color:#235a3b!important}.gate button,.document button,.confirm button{min-height:48px;border:1px solid #b9aca0;border-radius:9px;padding:0 15px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:8px}.alert{background:#fee4e2;color:#8c1d18;border-radius:9px;padding:12px;margin:12px 0}.notice{color:#235a3b;font-weight:700;margin:10px 0}.roster-heading{margin-bottom:20px}.roster-heading h1{margin:10px 0 4px}.roster-heading p{color:#5c5248}.employee{background:#fff;border:1px solid #d8cec4;border-radius:14px;margin:14px 0;padding:20px;display:grid;grid-template-columns:220px 1fr;gap:24px}.employee-info{display:flex;gap:12px}.avatar{width:44px;height:44px;border-radius:50%;background:#e8f5ee;color:#235a3b;display:grid;place-items:center;font-weight:900;flex:none}.employee h2{font-size:1.05rem}.employee-info p{color:#5c5248;font-size:.88rem}.document-list h3{font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;color:#6e6258;margin-bottom:8px}.document{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid #e8e0d8}.document>div{display:flex;flex-direction:column}.document span,.muted{font-size:.78rem;color:#6e6258}.document button{min-width:150px;color:#235a3b;border-color:#235a3b}.document button:disabled{color:#6e6258;border-color:#d8cec4;opacity:.7}.empty{background:#fff;border:1px dashed #b9aca0;border-radius:12px;padding:36px;text-align:center;color:#5c5248}
        .modal-backdrop{position:fixed;inset:0;z-index:50;background:rgba(16,12,10,.68);display:grid;place-items:center;padding:16px}.confirm{background:#fff;border-radius:14px;padding:24px;width:min(480px,100%);box-shadow:0 24px 70px rgba(0,0,0,.3)}.confirm h2{margin-bottom:10px}.confirm p{color:#5c5248}.confirm .third{background:#fff3e0;color:#8a4b08;padding:11px;border-radius:8px;margin-top:12px;font-weight:700}.confirm>div{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
        .viewer{position:fixed;inset:0;z-index:80;background:#100c0a;color:#fff;display:flex;flex-direction:column}.viewer-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:max(12px,env(safe-area-inset-top)) 16px 12px;border-bottom:1px solid rgba(255,255,255,.14);background:#1a1410}.viewer-bar>div{display:flex;flex-direction:column}.viewer-bar span{font-size:.75rem;color:rgba(255,255,255,.62)}.viewer-bar button{min-height:48px;border:1px solid #fff;border-radius:9px;padding:0 14px;color:#fff;font-weight:800}.countdown{font-size:.88rem!important;align-items:center}.countdown b{font-size:1.4rem;color:#ffcf6b}.document-canvas{flex:1;min-height:0;display:grid;place-items:center;padding:8px;overflow:hidden}.document-canvas img{max-width:100%;max-height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none}.document-canvas iframe{width:100%;height:100%;border:0;background:#2a2420}
        @media(max-width:700px){.preview{align-items:flex-start;flex-direction:column}.preview button{width:100%}header{align-items:flex-start;flex-direction:column}.header-actions{width:100%}.header-actions button{flex:1}.content{width:min(100% - 24px,880px);padding-top:16px}.gate{padding:20px 16px}.employee{grid-template-columns:1fr;padding:16px;gap:16px}.document{align-items:stretch;flex-direction:column}.document button{width:100%}.confirm>div{flex-direction:column-reverse}.confirm button{width:100%}.viewer-bar{align-items:stretch;flex-direction:column}.viewer-bar button{width:100%}}
        @media(max-width:360px){.header-actions{flex-direction:column}.gate{padding:16px 12px}.content{width:calc(100% - 16px)}}
        @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
      `}</style>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/inspectie/login', permanent: false } }
  if (session.user.role !== 'inspector') return { redirect: { destination: '/', permanent: false } }
  return { props: { preview: Boolean(session.inspection_admin_return) } }
}
