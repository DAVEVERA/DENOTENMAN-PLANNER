// Pinda-spinner — rollende noot als laad-indicator
export default function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="dn-spinner"
      aria-hidden="true"
    >
      {/* Pinda-silhouet: twee ronde lobben verbonden door een smalle taille */}
      <path
        d="M12 2C9.24 2 7 4.24 7 7c0 1.6.72 3.04 1.85 4-.6.7-.97 1.59-1 2.5h-.01C6.79 14.06 6 15.1 6 16.5 6 19.54 8.69 22 12 22s6-2.46 6-5.5c0-1.4-.79-2.44-1.84-3-.03-.91-.4-1.8-1-2.5A4.98 4.98 0 0 0 17 7c0-2.76-2.24-5-5-5zm0 1.5c1.93 0 3.5 1.57 3.5 3.5S13.93 10.5 12 10.5 8.5 8.93 8.5 7 10.07 3.5 12 3.5zm0 8.5c.55 0 1.07.11 1.54.3-.34.5-.54 1.1-.54 1.7v.25c-.32-.1-.66-.15-1-.15s-.68.05-1 .15V14c0-.6-.2-1.2-.54-1.7.47-.19.99-.3 1.54-.3zm0 2.75c1.93 0 3.5 1.23 3.5 2.75S13.93 20.25 12 20.25 8.5 19.02 8.5 17.5 10.07 14.25 12 14.25z"
        fill="currentColor"
        opacity="0.25"
      />
      {/* Animatie-arc bovenaan — geeft rotatie-gevoel */}
      <path
        d="M12 2a5 5 0 0 1 4.33 2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
