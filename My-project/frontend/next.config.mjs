/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Allow access from local network and external tunnels (ngrok) in Next.js
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    'localhost:3001',
    '127.0.0.1:3001',
    'localhost:18080',
    '127.0.0.1:18080',
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.app',
    '*.ngrok.io',
    'implode-tackling-conical.ngrok-free.dev',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://*.ngrok-free.app',
    'https://*.ngrok-free.dev',
  ],
  serverExternalPackages: [],
  async redirects() {
    return [
      {
        source: '/login/Admin-ctf',
        destination: '/admin-ctf',
        permanent: true,
      },
      {
        source: '/login/admin-ctf',
        destination: '/admin-ctf',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
