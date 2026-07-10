import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
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
    const { winner, score_team_a, score_team_b } = body as {
      winner:        'team_a' | 'team_b';
      score_team_a?: string;
      score_team_b?: string;
    };

    if (winner !== 'team_a' && winner !== 'team_b') {
      return NextResponse.json({ error: "winner debe ser 'team_a' o 'team_b' (en pádel no hay empate)" }, { status: 400 });
    }
    // Cada set aporta un digito por equipo (ej. "6-4-6" = 3 sets); se
    // exige el score, ya no es opcional.
    const SCORE_PATTERN = /^\d(-\d){1,2}$/;
    if (!score_team_a || !score_team_b || !SCORE_PATTERN.test(score_team_a) || !SCORE_PATTERN.test(score_team_b)) {
      return NextResponse.json({ error: 'El score es obligatorio y debe tener el formato de games por set, ej. 6-4-6' }, { status: 400 });
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

    // El equipo del organizador ya no se pregunta aca: en dobles quedo fijo
    // desde que se creo el partido (matches.organizer_team), y en singles
    // se deduce solo -- es el equipo opuesto al del unico rival. Antes se
    // le preguntaba al organizador y podia elegir mal (ej. un equipo que ya
    // estaba lleno por los invitados).
    let organizerTeam: 'team_a' | 'team_b';
    if (match.format === 'doubles') {
      if (match.organizer_team !== 'team_a' && match.organizer_team !== 'team_b') {
        return NextResponse.json({ error: 'Este partido no tiene un equipo de organizador definido' }, { status: 400 });
      }
      organizerTeam = match.organizer_team;
    } else {
      const opponentTeam = match.match_players[0]?.team;
      organizerTeam = opponentTeam === 'team_a' ? 'team_b' : 'team_a';
    }

    const organizerPlayer = { id: match.users.id, mmr: match.users.mmr };

    const teamA = match.match_players
      .filter((p) => p.team === 'team_a')
      .map((p) => ({ id: p.users.id, mmr: p.users.mmr }));

    const teamB = match.match_players
      .filter((p) => p.team === 'team_b')
      .map((p) => ({ id: p.users.id, mmr: p.users.mmr }));

    if (organizerTeam === 'team_a') teamA.push(organizerPlayer);
    else                            teamB.push(organizerPlayer);

    if (teamA.length === 0 || teamB.length === 0) {
      return NextResponse.json({ error: 'Ambos equipos deben tener al menos un jugador' }, { status: 400 });
    }

    // No se aplica MMR ni se marca "finished" todavia: el resultado queda
    // pendiente de que otro jugador confirmado lo confirme (ver
    // /result/confirm). Esto evita que un solo jugador decida el resultado
    // (y el MMR de todos) sin que nadie mas lo valide.
    await prisma.match_results.create({
      data: {
        match_id:       matchId,
        registered_by:  userId,
        organizer_team: organizerTeam,
        score_team_a,
        score_team_b,
        winner,
      },
    });

    const scoreStr = `${score_team_a} vs ${score_team_b}`;
    const others = [...teamA, ...teamB].filter((p) => p.id !== userId);
    await Promise.all(
      others.map((p) =>
        notify(p.id, `Resultado pendiente de confirmar — ${match.club}`, `${scoreStr}. Confirma el resultado para que se registre.`)
      )
    );

    return NextResponse.json({ message: 'Resultado registrado, pendiente de confirmación del rival' });
  } catch (error) {
    console.error('[MATCH RESULT ERROR]', error);
    return NextResponse.json({ error: 'Error al registrar el resultado' }, { status: 500 });
  }
}
