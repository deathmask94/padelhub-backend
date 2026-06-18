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
    const q     = searchParams.get('q')?.trim() ?? '';
    const level = searchParams.get('level');

    if (q.length < 2) return NextResponse.json([]);

    const users = await prisma.users.findMany({
      where: {
        is_active: true,
        id:   { not: userId },
        name: { contains: q, mode: 'insensitive' },
        ...(level ? { level: level as never } : {}),
      },
      select: { id: true, name: true, photo_url: true, level: true, mmr: true, zone: true },
      take: 10,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('[USER SEARCH ERROR]', error);
    return NextResponse.json({ error: 'Error al buscar jugadores' }, { status: 500 });
  }
}
