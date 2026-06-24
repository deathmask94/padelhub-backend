import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { calculateELO } from '@/lib/elo';
import { mmrToLevel } from '@/lib/mmrToLevel';
import { notify } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const body = await request.json();
    const { winner, organizer_team, score_team_a, score_team_b } = body as {
      winner:         'team_a' | 'team_b' | 'draw';
      organizer_team: 'team_a' | 'team_b';
      score_team_a?:  string;
      score_team_b?:  string;
    };

    if (!winner || !organizer_team) {
      return NextResponse.json({ error: 'winner y organizer_team son requeridos' }, { status: 400 });
    }

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_players: {
          where: { status: 'confirmed' },
          include: { users: { select: { id: true, mmr: true } } },
        },
        users: { select: { id: true, mmr: true } },
      },
    });

    if (!match)                        return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    if (match.organizer_id !== userId) return NextResponse.json({ error: 'Solo el organizador puede registrar el resultado' }, { status: 403 });
    if (!['confirmed', 'in_progress'].includes(match.status)) {
      return NextResponse.json({ error: 'El partido debe estar confirmado o en curso' }, { status: 400 });
    }

    // Organizer as player on their selected team
    const organizerPlayer = { id: match.users.id, mmr: match.users.mmr };

    const teamA = match.match_players
      .filter((p) => p.team === 'team_a')
      .map((p) => ({ id: p.users.id, mmr: p.users.mmr }));

    const teamB = match.match_players
      .filter((p) => p.team === 'team_b')
      .map((p) => ({ id: p.users.id, mmr: p.users.mmr }));

    if (organizer_team === 'team_a') teamA.push(organizerPlayer);
    else                             teamB.push(organizerPlayer);

    if (teamA.length === 0 || teamB.length === 0) {
      return NextResponse.json({ error: 'Ambos equipos deben tener al menos un jugador' }, { status: 400 });
    }

    const changes = calculateELO(teamA, teamB, winner);

    // Persist all changes in a transaction
    await prisma.$transaction([
      // Update match status
      prisma.matches.update({
        where: { id: matchId },
        data:  { status: 'finished', updated_at: new Date() },
      }),
      // Create match result
      prisma.match_results.create({
        data: {
          match_id:      matchId,
          registered_by: userId,
          score_team_a:  score_team_a || '—',
          score_team_b:  score_team_b || '—',
          winner,
        },
      }),
      // Update each player's MMR and recalculate category
      ...changes.map((c) =>
        prisma.users.update({
          where: { id: c.id },
          data:  { mmr: c.after, level: mmrToLevel(c.after), updated_at: new Date() },
        })
      ),
      // Create MMR history entries
      ...changes.map((c) =>
        prisma.mmr_history.create({
          data: {
            user_id:   c.id,
            match_id:  matchId,
            mmr_before: c.before,
            mmr_after:  c.after,
          },
        })
      ),
    ]);

    const scoreStr = `${score_team_a || '—'} vs ${score_team_b || '—'}`;
    [...teamA, ...teamB].forEach((p) => {
      notify(p.id, `Resultado registrado — ${match.club}`, scoreStr);
    });

    return NextResponse.json({ message: 'Resultado registrado', changes });
  } catch (error) {
    console.error('[MATCH RESULT ERROR]', error);
    return NextResponse.json({ error: 'Error al registrar el resultado' }, { status: 500 });
  }
}
