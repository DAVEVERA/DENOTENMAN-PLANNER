interface Props {
  ochtend: number
  middag:  number
  avond:   number
  total:   number
  max?:    number
}

export default function OccupancyBar({ ochtend, middag, avond, total, max = 8 }: Props) {
  const pct = Math.min(100, (total / max) * 100)
  const fill = pct >= 80 ? 'full' : pct >= 40 ? 'mid' : 'low'

  return (
    <div 
      className="occ-bar-wrap" 
      role="img" 
      aria-label={`${total} totaal ingeroosterd. Ochtend: ${ochtend}, Middag: ${middag}, Avond: ${avond}`}
    >
      <div className="occ-bar" aria-hidden="true">
        <div className={`occ-fill occ-${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="occ-chips">
        {ochtend > 0 && <span className="occ-chip chip-o" aria-label={`${ochtend} medewerkers in de ochtend`}>{ochtend}O</span>}
        {middag  > 0 && <span className="occ-chip chip-m" aria-label={`${middag} medewerkers in de middag`}>{middag}M</span>}
        {avond   > 0 && <span className="occ-chip chip-a" aria-label={`${avond} medewerkers in de avond`}>{avond}A</span>}
        {total === 0 && <span className="occ-chip chip-empty" aria-label="Geen medewerkers ingeroosterd">–</span>}
      </div>

      <style jsx>{`
        .occ-bar-wrap { display: flex; flex-direction: column; gap: 4px; }
        .occ-bar {
          height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;
        }
        .occ-fill {
          height: 100%; border-radius: 3px; transition: width .3s;
        }
        .occ-low  { background: #A5D6A7; }
        .occ-mid  { background: #FFB74D; }
        .occ-full { background: var(--danger); }

        .occ-chips { display: flex; gap: 3px; flex-wrap: wrap; }
        .occ-chip {
          font-size: .625rem; font-weight: 700; padding: 1px 4px;
          border-radius: 3px; line-height: 1.4;
        }
        .chip-o { background: var(--shift-ochtend); }
        .chip-m { background: var(--shift-middag); }
        .chip-a { background: var(--shift-avond); }
        .chip-empty { color: var(--text-muted); }
      `}</style>
    </div>
  )
}
