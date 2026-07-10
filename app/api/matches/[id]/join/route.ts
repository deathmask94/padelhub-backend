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

    const me = await prisma.users.findUnique({ where: { id: userId }, select: { gender: true, name: true } });

    if (match.gender_preference) {
      if (me?.gender !== match.gender_preference) {
        const label = match.gender_preference === 'Masculino' ? 'hombres' : 'mujeres';
        return NextResponse.json({ error: `Este partido es solo para ${label}` }, { status: 403 });
      }
    }

    // Solo cuenta como "ya inscrito" si tiene una fila activa: si abandono el
    // partido antes (status 'removed') o rechazo una invitacion ('rejected'),
    // debe poder volver a unirse.
    const alreadyJoined = match.match_players.some(
      (p) => p.user_id === userId && p.status !== 'rejected' && p.status !== 'removed'
    );
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

    // upsert (no create): ya existe una fila (match_id, user_id) unica si
    // el jugador abandono o rechazo una invitacion antes; hay que
    // reactivarla en vez de intentar insertar una nueva y chocar con esa
    // restriccion unica.
    const player = await prisma.match_players.upsert({
      where:  { match_id_user_id: { match_id: matchId, user_id: userId } },
      update: { status: 'confirmed', team: activePlayers % 2 === 0 ? 'team_a' : 'team_b', joined_at: new Date() },
      create: {
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

    await notify(
      match.organizer_id,
      'Nuevo jugador en tu partido',
      `${me?.name ?? 'Alguien'} se unió a tu partido en ${match.club}`
    );

    return NextResponse.json({ message: '¡Te has unido al partido!', player }, { status: 201 });
  } catch (error: unknown) {
    console.error('[MATCH JOIN ERROR]', error);
    return NextResponse.json({ error: 'Error al unirse al partido' }, { status: 500 });
  }
}
