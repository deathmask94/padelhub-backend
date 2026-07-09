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
    const zone     = searchParams.get('zone') ?? undefined;
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = 10;

    const where = { ...(zone ? { zone } : {}), is_active: true, role: "player" };

    const [players, total] = await Promise.all([
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
