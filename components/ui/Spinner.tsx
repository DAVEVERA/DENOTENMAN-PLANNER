// "De Notenman" truck-loader — vervangt de oude pinda-spinner.
// Rijdende pick-up truck met pinda-lading, compact genoeg om inline naast
// tekst te renderen (bv. in een knop of "Laden…"-rij).
//
// Let op: de oorspronkelijk aangeleverde raster-assets (truck.png/peanut.png/
// exhaust.png uit een losse upload / demo-standalone.html) zijn niet in deze
// repo teruggevonden. Herbouwd als zelfstandige inline-SVG + CSS-animatie
// i.p.v. PNG-imports — zelfde visuele identiteit (rijrichting, vering,
// wieldop-glans, uitlaat-puffs), geen binaire assets nodig, schaalt
// vlekkeloos op elke hoogte via aspect-ratio.
export default function Spinner({
  height = 22,
  duration = 4.2,
  className = '',
}: {
  height?: number
  duration?: number
  className?: string
}) {
  return (
    <span
      className={`dn-truckloader ${className}`.trim()}
      style={{ height, ['--dn-tl-duration' as string]: `${duration}s` }}
      role="status"
      aria-label="Laden…"
    >
      <span className="dn-tl-scene">
        <span className="dn-tl-rig">
          <span className="dn-tl-puff dn-tl-puff-base" />
          <span className="dn-tl-puff dn-tl-puff-drift" />
          <svg className="dn-tl-truck" viewBox="0 0 42 34" aria-hidden="true">
            {/* laadbak + pinda-cargo */}
            <rect x="2" y="10" width="22" height="14" rx="2" fill="#1A1412" />
            <circle className="dn-tl-peanut" cx="8" cy="14" r="3" fill="#C8882A" />
            <circle className="dn-tl-peanut" cx="14" cy="13" r="3.2" fill="#D9A24B" />
            <circle className="dn-tl-peanut" cx="19" cy="14.5" r="2.8" fill="#C8882A" />
            {/* cabine */}
            <path d="M24 10h14a4 4 0 0 1 4 4v3H24z" fill="#2A211B" />
            <rect x="30" y="12" width="8" height="5" rx="1" fill="#F4F1EE" opacity="0.85" />
            {/* chassis */}
            <rect x="2" y="24" width="40" height="3" rx="1.5" fill="#0F0C0A" />
            {/* wielen */}
            <g className="dn-tl-wheel" style={{ transformOrigin: '10px 27px' }}>
              <circle cx="10" cy="27" r="5.5" fill="#0F0C0A" />
              <circle className="dn-tl-hubcap" cx="10" cy="27" r="2.4" fill="#C8882A" />
            </g>
            <g className="dn-tl-wheel" style={{ transformOrigin: '33px 27px' }}>
              <circle cx="33" cy="27" r="5.5" fill="#0F0C0A" />
              <circle className="dn-tl-hubcap" cx="33" cy="27" r="2.4" fill="#C8882A" />
            </g>
          </svg>
        </span>
      </span>
      <span className="dn-tl-sr-only">Laden…</span>

      <style jsx>{`
        .dn-truckloader {
          position: relative;
          display: inline-block;
          aspect-ratio: 2.6 / 1;
          background: transparent;
          overflow: hidden;
          vertical-align: middle;
          line-height: 0;
        }
        .dn-tl-scene {
          position: absolute;
          inset: 0;
        }
        .dn-tl-rig {
          position: absolute;
          bottom: 8%;
          height: 62%;
          left: 100%;
          animation:
            dn-tl-drive var(--dn-tl-duration, 4.2s) linear infinite,
            dn-tl-bounce 0.5s ease-in-out infinite;
        }
        .dn-tl-truck {
          display: block;
          height: 100%;
          width: auto;
        }
        .dn-tl-wheel {
          animation: dn-tl-spin 0.6s linear infinite;
        }
        .dn-tl-hubcap {
          animation: dn-tl-glint 1.2s ease-in-out infinite;
        }
        .dn-tl-peanut {
          animation: dn-tl-jostle 0.5s ease-in-out infinite;
        }
        .dn-tl-puff {
          position: absolute;
          right: -6%;
          bottom: 32%;
          width: 20%;
          aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(200, 136, 42, 0.4), rgba(200, 136, 42, 0) 70%);
          opacity: 0;
          animation: dn-tl-puff-drift var(--dn-tl-duration, 4.2s) linear infinite;
        }
        .dn-tl-puff-drift {
          animation-delay: calc(var(--dn-tl-duration, 4.2s) / 2);
        }
        .dn-tl-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @keyframes dn-tl-drive {
          from {
            left: 100%;
          }
          to {
            left: -80%;
          }
        }
        @keyframes dn-tl-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6%);
          }
        }
        @keyframes dn-tl-spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes dn-tl-glint {
          0%,
          100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes dn-tl-jostle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-0.5px);
          }
        }
        @keyframes dn-tl-puff-drift {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.5);
          }
          10% {
            opacity: 0.7;
          }
          100% {
            opacity: 0;
            transform: translate(60%, -120%) scale(1.6);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dn-tl-rig {
            animation: none;
            left: 50%;
            transform: translateX(-50%);
          }
          .dn-tl-wheel,
          .dn-tl-hubcap,
          .dn-tl-peanut {
            animation: none;
          }
          .dn-tl-puff {
            display: none;
          }
        }
      `}</style>
    </span>
  )
}
