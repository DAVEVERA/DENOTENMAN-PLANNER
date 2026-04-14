/** @type {import('next').NextConfig} */

// NextAuth vereist NEXTAUTH_URL tijdens de build. Vercel stelt automatisch
// VERCEL_URL in (zonder protocol), dus we bouwen de volledige URL hier op.
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mhzmithddcdnouvlklev.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
