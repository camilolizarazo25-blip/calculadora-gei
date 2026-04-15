/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
}

module.exports = nextConfig
