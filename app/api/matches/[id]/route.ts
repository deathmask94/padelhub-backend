import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

type Params = { params: Promise<{ id: string }> };

const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas

async function autoTransitionStatus(matchId: string, currentStatus: string, matchTime: Date) {
  if (currentStatus !== 'confirmed') return;
  const startTime = new Date(matchTime).getTime();
  if (Date.now() >= startTime) {
    await prisma.matches.update({
      where: { id: matchId },
      data:  { status: 'in_progress', updated_at: new Date() },
    });
  }
}

export async function GET(request: Request, context: Params) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const { id: matchId } = await context.params;

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        users: { select: { id: true, name: true, photo_url: true, level: true, mmr: true } },
        match_players: {
          where:   { status: { not: 'removed' } },
          orderBy: { joined_at: 'asc' },
          include: {
            users: { select: { id: true, name: true, photo_url: true, level: true, mmr: true } },
          },
        },
      },
    });

    if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

    await autoTransitionStatus(matchId, match.status, match.match_time);
    const currentStatus = match.status === 'confirmed' && Date.now() >= new Date(match.match_time).getTime()
      ? 'in_progress' : match.status;

    const endsAt = new Date(new Date(match.match_time).getTime() + MATCH_DURATION_MS);

    const maxPlayers  = MAX_PLAYERS[match.format] ?? 4;
    const isOrganizer = match.organizer_id === userId;
    const myEntry     = match.match_players.find((p) => p.user_id === userId);

    // Valoraciones
    const RATING_WINDOW_MS = 24 * 60 * 60 * 1000;
    const isFinished = currentStatus === 'finished';
    const withinWindow = isFinished
      && Date.now() - new Date(match.updated_at).getTime() < RATING_WINDOW_MS;
    const isParticipant = isOrganizer || !!myEntry;

    const hasRated = isFinished && isParticipant
      ? (await prisma.player_ratings.count({
          where: { match_id: matchId, rater_id: userId },
        })) > 0
      : false;

    const canRate = withinWindow && isParticipant && !hasRated;

    return NextResponse.json({
      ...match,
      status:       currentStatus,
      max_players:  maxPlayers,
      is_organizer: isOrganizer,
      my_status:    myEntry?.status ?? null,
      ends_at:      endsAt.toISOString(),
      can_rate:     canRate,
      has_rated:    hasRated,
    });
  } catch (error) {
    console.error('[MATCH GET]', error);
    return NextResponse.json({ error: 'Error al obtener el partido' }, { status: 500 });
  }
}
