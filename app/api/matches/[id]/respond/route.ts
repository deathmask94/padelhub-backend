import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { notify } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const { accept } = await request.json();

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_players: {
          where:   { status: { not: 'removed' } },
          include: { users: { select: { name: true } } },
        },
      },
    });

    if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

    const myEntry = match.match_players.find((p) => p.user_id === userId);
    if (!myEntry)                    return NextResponse.json({ error: 'No tienes invitación para este partido' }, { status: 404 });
    if (myEntry.status !== 'pending') return NextResponse.json({ error: 'Ya respondiste esta invitación' }, { status: 400 });

    await prisma.match_players.update({
      where: { id: myEntry.id },
      data:  { status: accept ? 'confirmed' : 'rejected' },
    });

    if (accept) {
      const maxPlayers    = MAX_PLAYERS[match.format] ?? 4;
      const activeAfter   = match.match_players.filter(
        (p) => p.user_id !== userId && p.status !== 'rejected',
      ).length + 1;

      if (activeAfter >= maxPlayers - 1) {
        await prisma.matches.update({
          where: { id: matchId },
          data:  { status: 'confirmed', updated_at: new Date() },
        });
      }
    } else {
      await notify(
        match.organizer_id,
        'Desafío rechazado',
        `${myEntry.users.name} rechazó tu invitación en ${match.club}. Busca un nuevo rival en Matchmaking.`
      );
    }

    return NextResponse.json({
      message: accept ? '¡Te has unido al partido!' : 'Invitación rechazada',
    });
  } catch (error) {
    console.error('[MATCH RESPOND ERROR]', error);
    return NextResponse.json({ error: 'Error al responder invitación' }, { status: 500 });
  }
}
