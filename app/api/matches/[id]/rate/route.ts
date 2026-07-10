import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';
import { notify } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

const RATING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

interface RatingInput {
  rated_id:     string;
  fair_play:    number;
  punctuality:  number;
  companerismo: number;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const { id: matchId } = await params;
    const { ratings } = await request.json() as { ratings: RatingInput[] };

    if (!Array.isArray(ratings) || ratings.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos una valoración' }, { status: 400 });
    }

    const match = await prisma.matches.findUnique({
      where:   { id: matchId },
      include: {
        match_players: { where: { status: 'confirmed' }, select: { user_id: true } },
      },
    });

    if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
    if (match.status !== 'finished') {
      return NextResponse.json({ error: 'Solo se puede valorar partidos finalizados' }, { status: 400 });
    }

    const elapsed = Date.now() - new Date(match.updated_at).getTime();
    if (elapsed > RATING_WINDOW_MS) {
      return NextResponse.json({ error: 'El período de valoración de 24 horas ha expirado' }, { status: 403 });
    }

    // Verificar que el usuario es parte del partido
    const confirmedIds = new Set(match.match_players.map((p) => p.user_id));
    confirmedIds.add(match.organizer_id);

    if (!confirmedIds.has(userId)) {
      return NextResponse.json({ error: 'No eres participante de este partido' }, { status: 403 });
    }

    // Validar cada valoración
    for (const r of ratings) {
      if (r.rated_id === userId) {
        return NextResponse.json({ error: 'No puedes valorarte a ti mismo' }, { status: 400 });
      }
      if (!confirmedIds.has(r.rated_id)) {
        return NextResponse.json({ error: `El usuario ${r.rated_id} no es participante del partido` }, { status: 400 });
      }
      for (const field of ['fair_play', 'punctuality', 'companerismo'] as const) {
        const v = r[field];
        if (!Number.isInteger(v) || v < 1 || v > 5) {
          return NextResponse.json({ error: `${field} debe ser un entero entre 1 y 5` }, { status: 400 });
        }
      }
    }

    // Insertar valoraciones (skipDuplicates respeta la restricción única)
    await prisma.player_ratings.createMany({
      data: ratings.map((r) => ({
        match_id:     matchId,
        rater_id:     userId,
        rated_id:     r.rated_id,
        fair_play:    r.fair_play,
        punctuality:  r.punctuality,
        companerismo: r.companerismo,
      })),
      skipDuplicates: true,
    });

    await Promise.all(
      ratings.map((r) =>
        notify(r.rated_id, 'Recibiste una valoración', `Un compañero valoró tu desempeño en ${match.club}`)
      )
    );

    return NextResponse.json({ message: 'Valoraciones enviadas correctamente' });
  } catch (error) {
    console.error('[RATE ERROR]', error);
    return NextResponse.json({ error: 'Error al enviar valoraciones' }, { status: 500 });
  }
}
