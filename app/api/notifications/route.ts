import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const since = new Date(Date.now() - SEVEN_DAYS_MS);

    // Limpieza: las notificaciones son efimeras, no un registro historico.
    // Se borran aca (en vez de depender de un cron, poco confiable en serverless)
    // para que la tabla no crezca sin limite.
    await prisma.notifications.deleteMany({
      where: { user_id: userId, created_at: { lt: since } },
    }).catch(() => {});

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

    // Si viene un id especifico, solo marca esa notificacion (al tocarla);
    // sin id, marca todas (boton "Leer todo").
    let id: string | undefined;
    try {
      const body = await request.json();
      id = body?.id;
    } catch { /* body vacio: comportamiento de "marcar todas" */ }

    await prisma.notifications.updateMany({
      where: { user_id: userId, read: false, ...(id ? { id } : {}) },
      data:  { read: true },
    });

    return NextResponse.json({ message: 'Notificaciones marcadas como leídas' });
  } catch (error) {
    console.error('[NOTIFICATIONS PATCH]', error);
    return NextResponse.json({ error: 'Error al actualizar notificaciones' }, { status: 500 });
  }
}

// Descartar una notificación puntual (swipe en la app) -- borrado real, no
// solo "leída", para que no vuelva a aparecer en absoluto.
export async function DELETE(request: Request) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta el id de la notificación' }, { status: 400 });

    await prisma.notifications.deleteMany({ where: { id, user_id: userId } });

    return NextResponse.json({ message: 'Notificación eliminada' });
  } catch (error) {
    console.error('[NOTIFICATIONS DELETE]', error);
    return NextResponse.json({ error: 'Error al eliminar la notificación' }, { status: 500 });
  }
}
