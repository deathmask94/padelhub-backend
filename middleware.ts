import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/jwt';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

  // Preflight CORS
  if (method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  }

  if (!isPublicRoute(pathname, method)) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    try {
      await verifyToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401, headers: CORS_HEADERS }
      );
    }
  }

  const response = NextResponse.next();
  Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
