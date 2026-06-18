import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

type Params = { params: Promise<{ id: string }> };

const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { userId } = await verifyToken(token);

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: { match_players: true },
    });

    if (!match) {
      return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    }

    if (match.status !== 'open') {
      return NextResponse.json({ error: 'El partido ya no está disponible para unirse' }, { status: 400 });
    }

    if (match.organizer_id === userId) {
      return NextResponse.json({ error: 'No puedes unirte a tu propio partido como jugador' }, { status: 400 });
    }

    const alreadyJoined = match.match_players.some((p) => p.user_id === userId);
    if (alreadyJoined) {
      return NextResponse.json({ error: 'Ya estás inscrito en este partido' }, { status: 400 });
    }

    const maxPlayers = MAX_PLAYERS[match.format] ?? 4;
    const activePlayers = match.match_players.filter(
      (p) => p.status !== 'rejected' && p.status !== 'removed'
    ).length;

    if (activePlayers >= maxPlayers - 1) {
      return NextResponse.json({ error: 'El partido está completo' }, { status: 400 });
    }

    const player = await prisma.match_players.create({
      data: {
        match_id: matchId,
        user_id:  userId,
        team:     activePlayers % 2 === 0 ? 'team_a' : 'team_b',
        status:   'confirmed',
      },
    });

    // Si el partido quedó completo, actualizarlo a confirmado
    if (activePlayers + 1 >= maxPlayers - 1) {
      await prisma.matches.update({
        where: { id: matchId },
        data:  { status: 'confirmed', updated_at: new Date() },
      });
    }

    return NextResponse.json({ message: '¡Te has unido al partido!', player }, { status: 201 });
  } catch (error: unknown) {
    console.error('[MATCH JOIN ERROR]', error);
    return NextResponse.json({ error: 'Error al unirse al partido' }, { status: 500 });
  }
}
