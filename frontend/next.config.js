const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname, '..'),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  async rewrites() {
    const backendHost = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (!backendHost) {
      return [];
    }

    const destination = `${backendHost.replace(/\/+$/, '')}/api/:path*`;
    return [
      {
        source: '/api/:path*',
        destination,
      },
    ];
  },
};

module.exports = nextConfig;
