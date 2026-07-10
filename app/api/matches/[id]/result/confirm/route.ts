import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { calculateELO } from '@/lib/elo';
import { mmrToLevel } from '@/lib/mmrToLevel';
import { notify } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

// Confirma un resultado ya registrado por otro jugador (ver /result). Solo
// aqui se aplica el MMR y se marca el partido como finalizado -- exige que
// alguien distinto de quien registro lo confirme, para que el resultado no
// quede a criterio de un solo jugador.
export async function POST(request: Request, context: Params) {
  try {
    const { id: matchId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const match = await prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        match_results: true,
        match_players: {
          where: { status: 'confirmed' },
          include: { users: { select: { id: true, mmr: true } } },
        },
        users: { select: { id: true, mmr: true } },
      },
    });

    if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    const result = match.match_results;
    if (!result) return NextResponse.json({ error: 'Todavía no se ha registrado un resultado para este partido' }, { status: 400 });
    if (result.confirmed_by) return NextResponse.json({ error: 'El resultado ya fue confirmado' }, { status: 400 });
    if (result.registered_by === userId) {
      return NextResponse.json({ error: 'Quien registró el resultado no puede confirmarlo; debe hacerlo el rival' }, { status: 403 });
    }

    const isOrganizer   = match.organizer_id === userId;
    const isConfirmedPl = match.match_players.some((p) => p.user_id === userId);
    if (!isOrganizer && !isConfirmedPl) {
      return NextResponse.json({ error: 'Solo un jugador confirmado de este partido puede confirmar el resultado' }, { status: 403 });
    }

    const organizerPlayer = { id: match.users.id, mmr: match.users.mmr };
    const teamA = match.match_players.filter((p) => p.team === 'team_a').map((p) => ({ id: p.users.id, mmr: p.users.mmr }));
    const teamB = match.match_players.filter((p) => p.team === 'team_b').map((p) => ({ id: p.users.id, mmr: p.users.mmr }));
    if (result.organizer_team === 'team_a') teamA.push(organizerPlayer);
    else                                    teamB.push(organizerPlayer);

    const winner = result.winner as 'team_a' | 'team_b';
    const changes = match.is_ranked ? calculateELO(teamA, teamB, winner) : [];

    await prisma.$transaction([
      prisma.matches.update({
        where: { id: matchId },
        data:  { status: 'finished', updated_at: new Date() },
      }),
      prisma.match_results.update({
        where: { match_id: matchId },
        data:  { confirmed_by: userId, confirmed_at: new Date() },
      }),
      ...changes.map((c) =>
        prisma.users.update({
          where: { id: c.id },
          data:  { mmr: c.after, level: mmrToLevel(c.after), updated_at: new Date() },
        })
      ),
      ...changes.map((c) =>
        prisma.mmr_history.create({
          data: { user_id: c.id, match_id: matchId, mmr_before: c.before, mmr_after: c.after },
        })
      ),
    ]);

    const scoreStr = `${result.score_team_a} vs ${result.score_team_b}`;
    await Promise.all(
      [...teamA, ...teamB]
        .filter((p) => p.id !== userId)
        .map((p) => notify(p.id, `Resultado confirmado — ${match.club}`, scoreStr)),
    );

    return NextResponse.json({ message: 'Resultado confirmado', changes });
  } catch (error) {
    console.error('[MATCH RESULT CONFIRM ERROR]', error);
    return NextResponse.json({ error: 'Error al confirmar el resultado' }, { status: 500 });
  }
}
