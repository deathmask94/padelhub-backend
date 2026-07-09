import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/jwt';

// Origenes conocidos que de verdad llaman a esta API:
// - el frontend en produccion (Vercel)
// - la app Android (Capacitor sirve el WebView desde https://localhost por defecto)
// - el frontend en desarrollo local (Vite)
const ALLOWED_ORIGINS = new Set([
  'https://padel-hub-front-end.vercel.app',
  'https://localhost',
  process.env.FRONTEND_URL,
].filter((o): o is string => !!o));

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
    'X-Cors-Canary': 'v2',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function isPublicRoute(pathname: string, method: string): boolean {
  if (pathname === '/api/auth/login')   return true;
  if (pathname === '/api/auth/logout')  return true;
  if (pathname === '/api/auth/refresh')         return true;
  if (pathname === '/api/auth/forgot-password') return true;
  if (pathname === '/api/auth/reset-password')  return true;
  if (pathname === '/api/users' && method === 'POST') return true;
  if (pathname === '/api/test-db') return true;
  if (pathname === '/api/ranking') return true;
  if (pathname === '/api/admin/login') return true;
  if (pathname === '/api/reminders/send') return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  // Preflight CORS
  if (method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers });
  }

  if (!isPublicRoute(pathname, method)) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401, headers }
      );
    }

    try {
      await verifyToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401, headers }
      );
    }
  }

  const response = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
