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
    const apiHost = process.env.NEXT_PUBLIC_API_URL?.trim();
    const wsHost = process.env.NEXT_PUBLIC_WS_URL?.trim();
    const backendHost = apiHost || (wsHost ? wsHost.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://') : undefined);
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
