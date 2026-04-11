/** @type {import('next').NextConfig} */
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
