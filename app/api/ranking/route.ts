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
    const zone  = searchParams.get('zone') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);

    const players = await prisma.users.findMany({
      where:   { ...(zone ? { zone } : {}), is_active: true },
      orderBy: { mmr: 'desc' },
      take:    limit,
      select:  { id: true, name: true, photo_url: true, level: true, mmr: true, zone: true },
    });

    return NextResponse.json(
      players.map((p, i) => ({ position: i + 1, ...p }))
    );
  } catch (error) {
    console.error('[RANKING GET]', error);
    return NextResponse.json({ error: 'Error al obtener el ranking' }, { status: 500 });
  }
}
