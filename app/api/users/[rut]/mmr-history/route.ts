import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ rut: string }> };

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export async function GET(_request: Request, context: Params) {
  try {
    const { rut } = await context.params;
    const player = await prisma.users.findFirst({ where: { rut: parseInt(rut) } });
    if (!player) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });

    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [entries, startEntry] = await Promise.all([
      prisma.mmr_history.findMany({
        where:   { user_id: player.id, calculated_at: { gte: threeMonthsAgo } },
        orderBy: { calculated_at: 'asc' },
        include: { matches: { select: { club: true, match_date: true } } },
      }),
      prisma.mmr_history.findFirst({
        where:   { user_id: player.id, calculated_at: { lt: threeMonthsAgo } },
        orderBy: { calculated_at: 'desc' },
        select:  { mmr_after: true },
      }),
    ]);

    const baseMMR = startEntry?.mmr_after
      ?? (entries.length > 0 ? entries[0].mmr_before : player.mmr);

    // 13 semanas, de más antigua a más reciente
    const now = new Date();
    const weeks = Array.from({ length: 13 }, (_, i) => {
      const start = new Date(now);
      start.setDate(now.getDate() - (12 - i) * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end, label: `${start.getDate()} ${MESES[start.getMonth()]}` };
    });

    let lastMMR = baseMMR;
    const weekly_chart = weeks.map((w) => {
      const weekEntries = entries.filter((e) => {
        const d = new Date(e.calculated_at);
        return d >= w.start && d < w.end;
      });
      if (weekEntries.length > 0) lastMMR = weekEntries[weekEntries.length - 1].mmr_after;
      return { label: w.label, mmr: lastMMR };
    });

    const matches = [...entries].reverse().map((e) => ({
      match_id:   e.match_id,
      club:       e.matches.club,
      date:       e.matches.match_date,
      mmr_before: e.mmr_before,
      mmr_after:  e.mmr_after,
      delta:      e.delta,
      win:        e.delta > 0,
    }));

    return NextResponse.json({ weekly_chart, matches });
  } catch (error) {
    console.error('[MMR HISTORY ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener historial de MMR' }, { status: 500 });
  }
}
