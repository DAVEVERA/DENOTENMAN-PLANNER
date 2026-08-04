import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { getSession } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'

type Language = 'nl' | 'fr'

const COPY = {
  nl: {
    eyebrow: 'Uitsluitend voor dit account',
    title: 'Aanmelden als inspectiedienst',
    subtitle: 'Deze afgeschermde omgeving geeft alleen toegang tot de marktbezetting van vandaag en de documenten die voor controle zijn vrijgegeven.',
    username: 'Gebruikersnaam', password: 'Wachtwoord', submit: 'Veilig aanmelden', loading: 'Veilig aanmelden…',
    footer: 'Geen toegang? Neem contact op met de beheerder van De Notenman.',
    fallbackError: 'Aanmelden is niet gelukt. Controleer uw gegevens of probeer later opnieuw.',
    rateLimitError: 'Te veel aanmeldpogingen. Probeer het over 15 minuten opnieuw.',
    language: 'Français · Shift+F2',
  },
  fr: {
    eyebrow: 'Exclusivement pour ce compte',
    title: 'Connexion du service d’inspection',
    subtitle: 'Cet espace sécurisé donne uniquement accès à l’équipe présente aujourd’hui sur le marché et aux documents autorisés pour le contrôle.',
    username: 'Nom d’utilisateur', password: 'Mot de passe', submit: 'Se connecter en toute sécurité', loading: 'Connexion sécurisée…',
    footer: 'Accès impossible ? Contactez l’administrateur de De Notenman.',
    fallbackError: 'La connexion a échoué. Vérifiez vos données ou réessayez plus tard.',
    rateLimitError: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
    language: 'Nederlands · Maj+F2',
  },
} as const

export default function InspectionLoginPage() {
  const router = useRouter()
  const [language, setLanguage] = useState<Language>('nl')
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const copy = COPY[language]

  useEffect(() => {
    const stored = sessionStorage.getItem('inspection-language')
    if (stored === 'fr') setLanguage('fr')
  }, [])

  useEffect(() => {
    document.documentElement.lang = language === 'nl' ? 'nl-BE' : 'fr-BE'
    sessionStorage.setItem('inspection-language', language)
    const shortcut = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'F2') {
        event.preventDefault()
        setLanguage(current => current === 'nl' ? 'fr' : 'nl')
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [language])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/inspectie/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const result = await response.json()
      if (result.success) return router.replace('/inspectie')
      setError(response.status === 429 ? copy.rateLimitError : copy.fallbackError)
    } catch {
      setError(copy.fallbackError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="inspection-login">
      <button className="language-button" type="button" onClick={() => setLanguage(language === 'nl' ? 'fr' : 'nl')}>
        {copy.language}
      </button>
      <section className="login-panel" aria-labelledby="inspection-login-title">
        <div className="wordmark" aria-label="De Notenman">DE NOTENMAN</div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="inspection-login-title">{copy.title}</h1>
        <p className="subtitle">{copy.subtitle}</p>
        <form onSubmit={submit}>
          {error && <div className="error" role="alert">{error}</div>}
          <label htmlFor="inspection-username">{copy.username}</label>
          <input id="inspection-username" autoComplete="username" autoFocus required maxLength={80}
            value={form.username} onChange={event => setForm(current => ({ ...current, username: event.target.value }))} />
          <label htmlFor="inspection-password">{copy.password}</label>
          <input id="inspection-password" type="password" autoComplete="current-password" required maxLength={128}
            value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} />
          <button className="submit" type="submit" disabled={loading}>
            {loading && <Spinner height={18} />} {loading ? copy.loading : copy.submit}
          </button>
        </form>
        <p className="footer">{copy.footer}</p>
      </section>
      <style jsx>{`
        .inspection-login{min-height:100dvh;background:#100c0a;color:#fff;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .language-button{position:fixed;top:max(12px,env(safe-area-inset-top));right:16px;min-height:48px;padding:0 14px;border:1px solid rgba(255,255,255,.24);border-radius:999px;color:#fff;background:rgba(255,255,255,.06);font-weight:700;z-index:2}
        .login-panel{width:100%;max-width:430px;background:#1a1410;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,.28)}
        .wordmark{text-align:center;font-weight:900;letter-spacing:.16em;color:#ffcf6b;margin-bottom:24px}
        .eyebrow{display:inline-flex;background:rgba(44,110,73,.24);border:1px solid rgba(111,199,148,.3);color:#bfe7d0;border-radius:999px;padding:5px 10px;font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px}
        h1{font-size:clamp(1.5rem,7vw,2rem);margin:0 0 10px;line-height:1.15}.subtitle{color:rgba(255,255,255,.68);margin:0 0 24px;font-size:.94rem}
        form{display:flex;flex-direction:column;gap:8px}label{font-size:.84rem;font-weight:700;color:rgba(255,255,255,.78);margin-top:6px}
        input{min-height:50px;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:0 13px;background:rgba(255,255,255,.06);color:#fff;font-size:1rem}input:focus{outline:3px solid rgba(255,207,107,.28);border-color:#ffcf6b}
        .submit{min-height:50px;border-radius:10px;background:#235a3b;color:#fff;font-weight:800;margin-top:12px;display:flex;gap:8px;align-items:center;justify-content:center}.submit:disabled{opacity:.65}
        .error{background:#3b1715;border:1px solid #8c332d;color:#ffd3cf;border-radius:9px;padding:11px 12px;font-size:.88rem;margin-bottom:4px}
        .footer{text-align:center;color:rgba(255,255,255,.45);font-size:.78rem;margin:20px 0 0}
        @media(max-width:420px){.inspection-login{align-items:flex-start;padding-top:84px}.login-panel{padding:24px 18px}.language-button{right:12px}}
      `}</style>
    </main>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (session.user?.role === 'inspector') return { redirect: { destination: '/inspectie', permanent: false } }
  if (session.user) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}
