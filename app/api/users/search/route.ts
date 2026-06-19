import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { userId } = await verifyToken(token);

    const { searchParams } = new URL(request.url);
    const q       = searchParams.get('q')?.trim() ?? '';
    const level   = searchParams.get('level');
    const zone    = searchParams.get('zone');
    const mmr_min = searchParams.get('mmr_min');
    const mmr_max = searchParams.get('mmr_max');

    // q es opcional: si tiene menos de 2 chars simplemente no filtra por nombre
    const nameFilter = q.length >= 2
      ? { name: { contains: q, mode: 'insensitive' as const } }
      : {};

    const users = await prisma.users.findMany({
      where: {
        is_active: true,
        id: { not: userId },
        ...nameFilter,
        ...(level   ? { level: level as never }                            : {}),
        ...(zone    ? { zone }                                              : {}),
        ...(mmr_min || mmr_max ? {
          mmr: {
            ...(mmr_min ? { gte: parseInt(mmr_min) } : {}),
            ...(mmr_max ? { lte: parseInt(mmr_max) } : {}),
          },
        } : {}),
      },
      select:  { id: true, name: true, photo_url: true, level: true, mmr: true, zone: true },
      orderBy: { mmr: 'desc' },
      take:    20,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[USER SEARCH ERROR]', error);
    return NextResponse.json({ error: 'Error al buscar jugadores' }, { status: 500 });
  }
}
