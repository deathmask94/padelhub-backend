import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ rut: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { rut } = await params;
    const rutNum  = parseInt(rut);
    if (isNaN(rutNum)) return NextResponse.json({ error: 'RUT inválido' }, { status: 400 });

    const user = await prisma.users.findFirst({
      where:  { rut: rutNum },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const agg = await prisma.player_ratings.aggregate({
      where: { rated_id: user.id },
      _avg:  { fair_play: true, punctuality: true, skill_level: true },
      _count: { id: true },
    });

    const round1 = (v: number | null) => v !== null ? Math.round(v * 10) / 10 : null;

    return NextResponse.json({
      ratings: {
        avg_fair_play:   round1(agg._avg.fair_play),
        avg_punctuality: round1(agg._avg.punctuality),
        avg_skill_level: round1(agg._avg.skill_level),
        total:           agg._count.id,
      },
    });
  } catch (error) {
    console.error('[RATINGS GET ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener valoraciones' }, { status: 500 });
  }
}
