import { useState, useEffect, useCallback } from 'react'
import TeamLayout from '@/components/layout/TeamLayout'
import { getSession } from '@/lib/auth'
import type { GetServerSideProps } from 'next'
import type { SessionUser, Shift, Location } from '@/types'
import Spinner from '@/components/ui/Spinner'

interface Props { user: SessionUser }

const LOC: Record<string, string> = { markt: 'De Notenkar', nootmagazijn: 'Nootmagazijn' }
const DAY_NL: Record<string, string> = {
  maandag: 'Maandag', dinsdag: 'Dinsdag', woensdag: 'Woensdag',
  donderdag: 'Donderdag', vrijdag: 'Vrijdag', zaterdag: 'Zaterdag', zondag: 'Zondag',
}

function shiftDesc(s: Shift) {
  const time = s.start_time ? `${s.start_time.slice(0,5)}–${s.end_time?.slice(0,5)}` : ''
  return `${DAY_NL[s.day_of_week] ?? s.day_of_week} · ${s.shift_type}${time ? ' · ' + time : ''}`
}

export default function OpenShiftsPage({ user }: Props) {
  const [allOpen, setAllOpen]         = useState<Shift[]>([])
  const [myOffered, setMyOffered]     = useState<Shift[]>([])
  const [loading, setLoading]         = useState(true)
  const [actionId, setActionId]       = useState<number | null>(null)
  const [claimedId, setClaimedId]     = useState<number | null>(null)
  const [toast, setToast]             = useState<string | null>(null)

  const locProp = (user.location && user.location !== 'both' ? user.location : 'markt') as Exclude<Location, 'both'>

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/shifts/open').then(r => r.json())
    const all: Shift[] = r.success ? r.data : []

    // Available to claim: admin-posted (no employee_id) OR offered by others (employee_id !== mine)
    const available = all.filter(s =>
      (!s.employee_id || s.employee_id !== user.employee_id) &&
      !(s.open_invite_status === 'pending' && s.open_invite_emp_id === user.employee_id)
    )
    const mine = all.filter(s => s.employee_id === user.employee_id)

    setAllOpen(available)
    setMyOffered(mine)
    setLoading(false)
  }, [user.employee_id])

  useEffect(() => { load() }, [load])

  async function claim(shiftId: number) {
    setActionId(shiftId)
    const r = await fetch('/api/shifts/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId }),
    }).then(r => r.json())
    setActionId(null)
    if (r.success) {
      setClaimedId(shiftId)
      showToast('✅ Claim ingediend! De beheerder beoordeelt je claim.')
      load()
    } else {
      showToast('❌ ' + (r.message ?? 'Er ging iets mis'))
    }
  }

  async function withdrawClaim(shiftId: number) {
    setActionId(shiftId)
    await fetch('/api/shifts/claim', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId }),
    })
    setActionId(null)
    showToast('Claim ingetrokken.')
    load()
  }

  async function withdrawOffer(shiftId: number) {
    setActionId(shiftId)
    await fetch('/api/shifts/offer', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId }),
    })
    setActionId(null)
    showToast('Aanbod ingetrokken.')
    load()
  }

  // Separate: available (no claim from me yet) vs. my pending claims
  const available    = allOpen.filter(s => s.open_invite_emp_id !== user.employee_id)
  const myClaims     = allOpen.filter(s => s.open_invite_emp_id === user.employee_id)

  return (
    <TeamLayout user={user} location={locProp}>
      {toast && (
        <div className="os-toast" role="alert">{toast}</div>
      )}

      <div className="os-page">
        <div className="os-page-head">
          <h1 className="os-h1">Open diensten</h1>
          <p className="os-sub">Claim een beschikbare dienst of bekijk jouw aangeboden diensten.</p>
        </div>

        {loading ? (
          <div className="os-loading"><Spinner /> Laden…</div>
        ) : (
          <>
            {/* ── Available shifts ── */}
            <section className="os-section">
              <div className="os-section-head">
                <h2 className="os-section-title">Beschikbare diensten</h2>
                {available.length > 0 && (
                  <span className="os-count">{available.length} beschikbaar</span>
                )}
              </div>

              {available.length === 0 ? (
                <div className="os-empty">
                  <div className="os-empty-icon">🎉</div>
                  <div>Geen open diensten op dit moment.</div>
                </div>
              ) : (
                <div className="os-grid">
                  {available.map(s => {
                    const isMine = s.employee_id === user.employee_id
                    return (
                      <div key={s.id} className={`os-card loc-${s.location}`}>
                        <div className="os-card-loc">
                          <span className={`loc-dot loc-dot-${s.location}`} />
                          {LOC[s.location] ?? s.location}
                        </div>
                        <div className="os-card-week">Week {s.week_number} · {s.year}</div>
                        <div className="os-card-day">{DAY_NL[s.day_of_week] ?? s.day_of_week}</div>
                        <div className="os-card-type">{s.shift_type}</div>
                        {s.start_time && (
                          <div className="os-card-time">
                            🕐 {s.start_time.slice(0,5)} – {s.end_time?.slice(0,5)}
                          </div>
                        )}
                        {s.employee_id && !isMine && (
                          <div className="os-card-offered-by">aangeboden door {s.employee_name}</div>
                        )}
                        {s.note && <div className="os-card-note">📝 {s.note}</div>}

                        {!isMine && (
                          <button
                            className="btn btn-primary os-claim-btn"
                            disabled={actionId === s.id}
                            onClick={() => claim(s.id)}
                          >
                            {actionId === s.id ? <Spinner /> : '✋ Ik doe het!'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── My pending claims ── */}
            {myClaims.length > 0 && (
              <section className="os-section">
                <div className="os-section-head">
                  <h2 className="os-section-title">Mijn claims</h2>
                  <span className="os-count pending">{myClaims.length} in behandeling</span>
                </div>
                <div className="os-claim-list">
                  {myClaims.map(s => (
                    <div key={s.id} className="os-claim-row">
                      <div className="os-claim-info">
                        <span className={`loc-dot loc-dot-${s.location}`} />
                        <div>
                          <div className="os-claim-label">{shiftDesc(s)} · Week {s.week_number}</div>
                          <div className="os-claim-status">⏳ Wacht op goedkeuring van de beheerder</div>
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={actionId === s.id}
                        onClick={() => withdrawClaim(s.id)}
                      >
                        {actionId === s.id ? <Spinner /> : 'Intrekken'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── My offered shifts ── */}
            <section className="os-section">
              <div className="os-section-head">
                <h2 className="os-section-title">Mijn aangeboden diensten</h2>
                {myOffered.length > 0 && (
                  <span className="os-count">{myOffered.length} aangeboden</span>
                )}
              </div>

              {myOffered.length === 0 ? (
                <div className="os-empty">
                  <div className="os-empty-icon">💡</div>
                  <div>Je hebt geen diensten aangeboden.</div>
                  <div className="os-empty-hint">Ga naar <strong>Mijn rooster</strong> en klik op een dienst om deze aan te bieden.</div>
                </div>
              ) : (
                <div className="os-claim-list">
                  {myOffered.map(s => {
                    const hasClaimer = !!s.open_invite_emp_id
                    return (
                      <div key={s.id} className="os-claim-row">
                        <div className="os-claim-info">
                          <span className={`loc-dot loc-dot-${s.location}`} />
                          <div>
                            <div className="os-claim-label">{shiftDesc(s)} · Week {s.week_number}</div>
                            <div className="os-claim-status">
                              {hasClaimer
                                ? `👋 Er is interesse — beheerder beoordeelt`
                                : '🔓 Zichtbaar voor collega\'s'}
                            </div>
                          </div>
                        </div>
                        {!hasClaimer && (
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={actionId === s.id}
                            onClick={() => withdrawOffer(s.id)}
                          >
                            {actionId === s.id ? <Spinner /> : 'Intrekken'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        .os-toast {
          position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
          background: var(--text); color: #fff;
          padding: 12px 24px; border-radius: 999px;
          font-size: .9375rem; font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,.25);
          z-index: 9999; white-space: nowrap;
          animation: toast-in .2s ease;
        }
        @keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(-8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }

        .os-page { max-width: 860px; }
        .os-page-head { margin-bottom: var(--s7); }
        .os-h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 4px; }
        .os-sub { color: var(--text-muted); margin: 0; font-size: .9375rem; }

        .os-loading { display: flex; align-items: center; gap: var(--s3); padding: var(--s8); color: var(--text-muted); }

        .os-section { margin-bottom: var(--s8); }
        .os-section-head {
          display: flex; align-items: center; gap: var(--s3);
          margin-bottom: var(--s4); border-bottom: 1.5px solid var(--border);
          padding-bottom: var(--s3);
        }
        .os-section-title { font-size: 1.0625rem; font-weight: 700; margin: 0; flex: 1; }
        .os-count {
          font-size: .75rem; font-weight: 700; padding: 3px 10px;
          border-radius: 999px; background: var(--surface-alt); color: var(--text-sub);
        }
        .os-count.pending { background: #FEF3C7; color: #92400E; }

        .os-empty {
          padding: var(--s8) var(--s4); text-align: center;
          color: var(--text-muted); font-size: .9375rem;
          background: var(--surface); border: 1px dashed var(--border);
          border-radius: var(--radius-lg);
          display: flex; flex-direction: column; align-items: center; gap: var(--s2);
        }
        .os-empty-icon { font-size: 2.5rem; }
        .os-empty-hint { font-size: .875rem; color: var(--text-muted); }

        /* Cards grid */
        .os-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--s3);
        }
        .os-card {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: var(--radius-xl); padding: var(--s4);
          display: flex; flex-direction: column; gap: var(--s2);
          position: relative; overflow: hidden;
          transition: box-shadow .15s, transform .15s;
        }
        .os-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.08); transform: translateY(-1px); }
        .os-card.loc-markt { border-top: 3px solid #2C6E49; }
        .os-card.loc-nootmagazijn { border-top: 3px solid #7B4F2E; }

        .os-card-loc {
          display: flex; align-items: center; gap: 6px;
          font-size: .75rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: var(--text-sub);
        }
        .loc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .loc-dot-markt { background: #2C6E49; }
        .loc-dot-nootmagazijn { background: #7B4F2E; }

        .os-card-week { font-size: .8125rem; color: var(--text-muted); }
        .os-card-day { font-size: 1.25rem; font-weight: 800; line-height: 1.1; }
        .os-card-type { font-size: .875rem; font-weight: 600; color: var(--text-sub); }
        .os-card-time { font-size: .8125rem; color: var(--text-muted); }
        .os-card-offered-by {
          font-size: .75rem; color: #6D28D9;
          background: rgba(124,58,237,.08); padding: 3px 8px;
          border-radius: 999px; align-self: flex-start;
        }
        .os-card-note { font-size: .8125rem; color: var(--text-muted); font-style: italic; }

        .os-claim-btn {
          margin-top: var(--s2); padding: 10px; font-size: .9375rem;
          font-weight: 700; justify-content: center;
        }

        /* Claims list */
        .os-claim-list { display: flex; flex-direction: column; gap: var(--s2); }
        .os-claim-row {
          display: flex; align-items: center; gap: var(--s4);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--s3) var(--s4);
        }
        .os-claim-info { display: flex; align-items: center; gap: var(--s3); flex: 1; }
        .os-claim-label { font-size: .9375rem; font-weight: 600; }
        .os-claim-status { font-size: .8125rem; color: var(--text-muted); margin-top: 2px; }

        @media (max-width: 480px) {
          .os-grid { grid-template-columns: 1fr; }
          .os-claim-row { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </TeamLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getSession(req as any, res as any)
  if (!session.user) return { redirect: { destination: '/login', permanent: false } }
  return { props: { user: session.user } }
}
