/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allows isolated verification builds while a local dev server owns `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compress: true,
  poweredByHeader: false, // Do not expose "X-Powered-By: Next.js" to clients

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mhzmithddcdnouvlklev.supabase.co',
      },
    ],
  },

  // Security headers applied to all routes
  async headers() {
    // Content-Security-Policy — scoped to what the app actually loads:
    // self-hosted scripts/styles, styled-jsx + Google Fonts stylesheets,
    // Supabase storage images, allow-listed Giphy media (proxied search,
    // but images are rendered directly from Giphy's CDN), and the Crisp
    // "quick assist" support widget (client.crisp.chat + its subdomains —
    // it loads its own JS, opens a WebSocket, renders images/fonts, and
    // embeds an iframe for the chat panel itself).
    // 'unsafe-inline' on script-src covers the SW-registration snippet in
    // pages/_document.tsx; style-src needs it for styled-jsx. Everything
    // else stays locked to 'self' or an explicit allow-list.
    //
    // 'unsafe-eval' is added ONLY in development: Next.js dev-mode hot
    // reload (react-refresh) evaluates code via eval() to patch modules
    // in place. Without this the dev server renders a blank page (CSP
    // silently blocks the eval, React never mounts). Production builds
    // don't use eval-based HMR, so prod stays without 'unsafe-eval'.
    const isDev = process.env.NODE_ENV !== 'production'
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://client.crisp.chat${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat",
      "font-src 'self' https://fonts.gstatic.com https://client.crisp.chat",
      "img-src 'self' data: blob: https://mhzmithddcdnouvlklev.supabase.co https://media.giphy.com https://media0.giphy.com https://image.crisp.chat https://client.crisp.chat",
      "connect-src 'self' https://client.crisp.chat wss://client.relay.crisp.chat https://storage.crisp.chat",
      "frame-src https://client.crisp.chat",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // Never let CDNs/browsers cache authenticated API responses.
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
      {
        // No third-party connections, embeds, support widget, push client or
        // externally hosted assets are permitted in the inspection surface.
        source: '/inspectie/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-src blob:",
              "object-src 'none'",
              "base-uri 'none'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
