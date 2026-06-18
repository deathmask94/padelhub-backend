import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

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

    return NextResponse.json(matches);
  } catch (error: unknown) {
    console.error('[MY MATCHES ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener tus partidos' }, { status: 500 });
  }
}
