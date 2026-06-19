import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    let payload: { userId: string; role: string };
    try {
      payload = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
    }

    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const user = await prisma.users.findUnique({
      where: { id: payload.userId, is_active: true },
      select: {
        id: true, name: true, email: true, role: true,
        rut: true, dv_rut: true, created_at: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[ADMIN ME ERROR]', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
