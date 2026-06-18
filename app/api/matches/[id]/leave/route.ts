import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const match = await prisma.matches.findUnique({
      where:   { id: matchId },
      include: { match_players: { where: { status: { in: ['confirmed', 'pending'] } } } },
    });

    if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

    if (match.organizer_id === userId) {
      return NextResponse.json({ error: 'El organizador no puede abandonar su propio partido. Usa cancelar.' }, { status: 400 });
    }

    if (['finished', 'cancelled'].includes(match.status)) {
      return NextResponse.json({ error: 'No puedes abandonar un partido ya finalizado o cancelado' }, { status: 400 });
    }

    if (match.status === 'in_progress') {
      return NextResponse.json({ error: 'No puedes abandonar un partido que ya está en curso' }, { status: 400 });
    }

    const myEntry = match.match_players.find((p) => p.user_id === userId);
    if (!myEntry) return NextResponse.json({ error: 'No estás inscrito en este partido' }, { status: 404 });

    await prisma.$transaction([
      prisma.match_players.update({
        where: { id: myEntry.id },
        data:  { status: 'removed' },
      }),
      // Si estaba confirmado, abrirlo de nuevo para que entre otro jugador
      ...(match.status === 'confirmed'
        ? [prisma.matches.update({
            where: { id: matchId },
            data:  { status: 'open', updated_at: new Date() },
          })]
        : []),
    ]);

    return NextResponse.json({ message: 'Has abandonado el partido. Quedará disponible para otros jugadores.' });
  } catch (error) {
    console.error('[MATCH LEAVE ERROR]', error);
    return NextResponse.json({ error: 'Error al abandonar el partido' }, { status: 500 });
  }
}
