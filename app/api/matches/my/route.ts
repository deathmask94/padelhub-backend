import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

async function autoTransitionConfirmed(matchIds: string[], matches: { id: string; status: string; match_time: Date }[]) {
  const toUpdate = matches.filter(
    (m) => m.status === 'confirmed' && Date.now() >= new Date(m.match_time).getTime()
  );
  if (toUpdate.length === 0) return;
  await prisma.matches.updateMany({
    where: { id: { in: toUpdate.map((m) => m.id) } },
    data:  { status: 'in_progress', updated_at: new Date() },
  });
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { userId } = await verifyToken(token);

    const matches = await prisma.matches.findMany({
      where: {
        OR: [
          { organizer_id: userId },
          { match_players: { some: { user_id: userId } } },
        ],
      },
      include: {
        users: { select: { name: true, phone: true } },
        match_players: { select: { user_id: true, status: true, team: true } },
      },
      orderBy: { match_date: 'asc' },
    });

    await autoTransitionConfirmed(matches.map((m) => m.id), matches);

    const result = matches.map((m) => ({
      ...m,
      status: m.status === 'confirmed' && Date.now() >= new Date(m.match_time).getTime()
        ? 'in_progress' : m.status,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[MY MATCHES ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener tus partidos' }, { status: 500 });
  }
}
