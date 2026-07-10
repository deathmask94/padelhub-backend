import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

const compat = (userMMR: number, rivalMMR: number, range: number): number =>
  Math.max(0, Math.round(100 - (Math.abs(userMMR - rivalMMR) / range) * 100));

const MIN_COMPATIBILITY = 80;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(request: Request) {
  try {
    const auth  = request.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { userId } = await verifyToken(token);

    const me = await prisma.users.findUnique({
      where:  { id: userId },
      select: { mmr: true, is_active: true, gender: true },
    });
    if (!me || !me.is_active) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userMMR = me.mmr;

    // Matchmaking siempre es competitivo (afecta MMR), asi que el rival
    // obligatoriamente debe ser del mismo sexo -- no es una preferencia
    // opcional como en la creacion manual de partidos casuales.
    const genderFilter = me.gender ?? undefined;

    // El matchmaking siempre entrega como maximo 3 rivales por busqueda (no
    // hay "ver mas" tipo lista/paginacion): cada "Buscar rival" es una
    // tirada nueva, al azar dentro de los elegibles.
    const MAX_SUGGESTIONS = 3;

    // Intentar con ±150, luego ±300, luego ±500 hasta tener al menos 3 rivales
    const RANGES = [150, 300, 500];
    let suggestions: { id: string; name: string; photo_url: string | null; level: string; mmr: number; zone: string; compatibility: number }[] = [];
    let range_used = 150;

    for (const range of RANGES) {
      // Sin orderBy ni take chico aca: si se trajeran solo, por ejemplo, los
      // 20 con MMR mas cercano (ordenados), el shuffle de mas abajo solo
      // revolveria ese mismo subconjunto fijo -- con mas elegibles que eso,
      // siempre serian los mismos candidatos "paginados" por MMR, nunca los
      // demas. Se trae todo el rango (con un techo de seguridad) y se
      // filtra/mezcla sobre el conjunto completo de elegibles.
      const rivals = await prisma.users.findMany({
        where: {
          is_active: true,
          role:      "player",
          id:        { not: userId },
          mmr:       { gte: Math.max(0, userMMR - range), lte: userMMR + range },
          ...(genderFilter ? { gender: genderFilter } : {}),
        },
        select: { id: true, name: true, photo_url: true, level: true, mmr: true, zone: true },
        take:   500,
      });

      const eligible = rivals
        .map((r) => ({ ...r, compatibility: compat(userMMR, r.mmr, range) }))
        .filter((r) => r.compatibility >= MIN_COMPATIBILITY);

      range_used  = range;
      suggestions = shuffle(eligible).slice(0, MAX_SUGGESTIONS);

      // Si ya hay suficientes candidatos compatibles, o es el ultimo rango
      // disponible, nos quedamos con lo que haya (en orden aleatorio, no
      // siempre el "mejor" primero).
      if (suggestions.length >= MAX_SUGGESTIONS || range === 500) break;
    }

    return NextResponse.json({ suggestions, range_used, user_mmr: userMMR });
  } catch (error) {
    console.error('[SUGGESTIONS ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener sugerencias' }, { status: 500 });
  }
}
