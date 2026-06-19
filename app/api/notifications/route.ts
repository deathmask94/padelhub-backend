import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const since = new Date(Date.now() - THIRTY_DAYS_MS);

    const notifications = await prisma.notifications.findMany({
      where:   { user_id: userId, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      select:  { id: true, title: true, body: true, read: true, created_at: true },
    });

    const unread_count = notifications.filter((n) => !n.read).length;

    return NextResponse.json({ notifications, unread_count });
  } catch (error) {
    console.error('[NOTIFICATIONS GET]', error);
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    await prisma.notifications.updateMany({
      where: { user_id: userId, read: false },
      data:  { read: true },
    });

    return NextResponse.json({ message: 'Notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('[NOTIFICATIONS PATCH]', error);
    return NextResponse.json({ error: 'Error al actualizar notificaciones' }, { status: 500 });
  }
}
