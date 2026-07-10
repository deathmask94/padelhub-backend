import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    await verifyToken(token);

    const { searchParams } = new URL(request.url);
    const zone       = searchParams.get('zone') ?? undefined;
    const genderParam = searchParams.get('gender');
    const gender      = genderParam === 'Masculino' || genderParam === 'Femenino' ? genderParam : undefined;
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = 10;

    const where: Record<string, unknown> = { is_active: true, role: 'player' };
    if (zone)   where.zone   = zone;
    if (gender) where.gender = gender;

    // $transaction (no Promise.all): la conexion pooled corre con
    // connection_limit=1, asi que dos queries concurrentes sobre la misma
    // conexion rompen la request. El resto del panel admin ya sigue este patron.
    const [players, total] = await prisma.$transaction([
      prisma.users.findMany({
        where,
        orderBy: { mmr: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select:  { id: true, name: true, photo_url: true, level: true, mmr: true, zone: true },
      }),
      prisma.users.count({ where }),
    ]);

    return NextResponse.json({
      players: players.map((p, i) => ({ position: (page - 1) * pageSize + i + 1, ...p })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('[RANKING GET]', error);
    return NextResponse.json({ error: 'Error al obtener el ranking' }, { status: 500 });
  }
}
