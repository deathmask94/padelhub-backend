import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['node-cron'],
  // El endpoint de backup lee prisma/schema.prisma en runtime para incrustarlo
  // en el JSON exportado; sin esto Vercel no lo incluye en el bundle serverless.
  outputFileTracingIncludes: {
    '/api/admin/backup': ['./prisma/schema.prisma'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
