import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/jwt';

const ALLOWED_ORIGINS = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

function getCorsHeaders(origin: string | null) {
  const allowed = ALLOWED_ORIGINS.includes(origin ?? '') ? origin! : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
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
  const corsHeaders = getCorsHeaders(origin);

  // Preflight CORS
  if (method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
  }

  if (!isPublicRoute(pathname, method)) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      await verifyToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401, headers: corsHeaders }
      );
    }
  }

  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
