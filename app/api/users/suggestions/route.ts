import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

const compat = (userMMR: number, rivalMMR: number, range: number): number =>
  Math.max(0, Math.round(100 - (Math.abs(userMMR - rivalMMR) / range) * 100));

export async function GET(request: Request) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { userId } = await verifyToken(token);

    const me = await prisma.users.findUnique({
      where:  { id: userId },
      select: { mmr: true, is_active: true },
    });
    if (!me || !me.is_active) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userMMR = me.mmr;

    // Intentar con ±150, luego ±300, luego ±500 hasta tener al menos 5 rivales
    const RANGES = [150, 300, 500];
    let suggestions: { id: string; name: string; photo_url: string | null; level: string; mmr: number; zone: string; compatibility: number }[] = [];
    let range_used = 150;

    for (const range of RANGES) {
      const rivals = await prisma.users.findMany({
        where: {
          is_active: true,
          id:        { not: userId },
          mmr:       { gte: Math.max(0, userMMR - range), lte: userMMR + range },
        },
        select:  { id: true, name: true, photo_url: true, level: true, mmr: true, zone: true },
        orderBy: { mmr: 'asc' },
        take:    20,
      });

      if (rivals.length >= 5) {
        range_used  = range;
        suggestions = rivals
          .map((r) => ({ ...r, compatibility: compat(userMMR, r.mmr, range) }))
          .sort((a, b) => b.compatibility - a.compatibility);
        break;
      }

      // Si es el último rango, devolver lo que haya aunque sean menos de 5
      if (range === 500) {
        range_used  = range;
        suggestions = rivals
          .map((r) => ({ ...r, compatibility: compat(userMMR, r.mmr, range) }))
          .sort((a, b) => b.compatibility - a.compatibility);
      }
    }

    return NextResponse.json({ suggestions, range_used, user_mmr: userMMR });
  } catch (error) {
    console.error('[SUGGESTIONS ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener sugerencias' }, { status: 500 });
  }
}
