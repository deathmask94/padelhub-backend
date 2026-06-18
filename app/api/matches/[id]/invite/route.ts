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

    const body = await request.json();
    const invitedUserId: string = body.userId;
    if (!invitedUserId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: { match_players: { where: { status: { not: 'removed' } } } },
    });

    if (!match)                        return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    if (match.organizer_id !== userId) return NextResponse.json({ error: 'Solo el organizador puede invitar' }, { status: 403 });
    if (match.status !== 'open')       return NextResponse.json({ error: 'El partido no está abierto' }, { status: 400 });
    if (invitedUserId === userId)      return NextResponse.json({ error: 'No puedes invitarte a ti mismo' }, { status: 400 });

    const alreadyIn = match.match_players.some((p) => p.user_id === invitedUserId);
    if (alreadyIn) return NextResponse.json({ error: 'Este jugador ya está en el partido' }, { status: 400 });

    const maxPlayers = MAX_PLAYERS[match.format] ?? 4;
    if (match.match_players.length >= maxPlayers - 1) {
      return NextResponse.json({ error: 'El partido ya está completo' }, { status: 400 });
    }

    const player = await prisma.match_players.create({
      data: {
        match_id: matchId,
        user_id:  invitedUserId,
        team:     match.match_players.length % 2 === 0 ? 'team_a' : 'team_b',
        status:   'pending',
      },
    });

    return NextResponse.json({ message: 'Invitación enviada', player }, { status: 201 });
  } catch (error) {
    console.error('[MATCH INVITE ERROR]', error);
    return NextResponse.json({ error: 'Error al invitar jugador' }, { status: 500 });
  }
}
