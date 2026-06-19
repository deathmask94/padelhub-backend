import { NextResponse } from 'next/server';
import { verifyToken } from './jwt';

export async function getAdminPayload(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    if (payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'No autorizado o sin permisos de administrador' }, { status: 403 });
}
