import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['node-cron'],
  // El endpoint de backup lee prisma/schema.prisma en runtime para incrustarlo
  // en el JSON exportado; sin esto Vercel no lo incluye en el bundle serverless.
  outputFileTracingIncludes: {
    '/api/admin/backup': ['./prisma/schema.prisma'],
  },
  // Los headers CORS los pone middleware.ts (necesita reflejar el Origin
  // segun un allow-list, algo que este helper estatico no puede hacer).
};

export default nextConfig;
