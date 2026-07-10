import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ rut: string }> };

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PAGE_SIZE = 10;
const CHART_BUCKETS = 12;

export async function GET(request: Request, context: Params) {
  try {
    const { rut } = await context.params;
    const player = await prisma.users.findFirst({ where: { rut: parseInt(rut) } });
    if (!player) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);

    // Todo el historico del jugador -- ya no se acota a 3 meses. Las filas
    // sin match_id son ajustes manuales de admin (no partidos jugados): se
    // usan para el grafico de evolucion de MMR (si afectaron el MMR, deben
    // reflejarse ahi), pero se excluyen de "partidos"/"victorias"/"derrotas"
    // y de la lista, que son estrictamente sobre partidos reales.
    const allEntries = await prisma.mmr_history.findMany({
      where:   { user_id: player.id },
      orderBy: { calculated_at: 'asc' },
      include: { matches: { select: { club: true, match_date: true } } },
    });

    const matchEntries = allEntries.filter((e) => e.match_id !== null);
    const played = matchEntries.length;
    const wins   = matchEntries.filter((e) => e.delta > 0).length;
    const losses = matchEntries.filter((e) => e.delta < 0).length;
    const totalDelta = matchEntries.reduce((s, e) => s + e.delta, 0);

    // Grafico: se reparte todo el historico (desde la primera fila hasta
    // ahora) en un numero fijo de tramos iguales, en vez de semanas fijas --
    // asi funciona igual de bien con 3 meses de historia que con 3 años.
    let chart: { label: string; mmr: number }[] = [];
    if (allEntries.length > 0) {
      const firstDate = new Date(allEntries[0].calculated_at);
      const now       = new Date();
      const totalMs   = Math.max(now.getTime() - firstDate.getTime(), 1);
      const bucketMs  = totalMs / CHART_BUCKETS;
      let lastMMR = allEntries[0].mmr_before;
      chart = Array.from({ length: CHART_BUCKETS }, (_, i) => {
        const bucketStart = new Date(firstDate.getTime() + i * bucketMs);
        const bucketEnd   = new Date(firstDate.getTime() + (i + 1) * bucketMs);
        const inBucket = allEntries.filter((e) => {
          const d = new Date(e.calculated_at);
          return d >= bucketStart && (i === CHART_BUCKETS - 1 ? d <= bucketEnd : d < bucketEnd);
        });
        if (inBucket.length > 0) lastMMR = inBucket[inBucket.length - 1].mmr_after;
        return { label: `${bucketStart.getDate()} ${MESES[bucketStart.getMonth()]}`, mmr: lastMMR };
      });
    }

    // Lista de partidos paginada, mas reciente primero.
    const matchesDesc = [...matchEntries].reverse();
    const totalPages  = Math.max(1, Math.ceil(matchesDesc.length / PAGE_SIZE));
    const pageItems = matchesDesc.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((e) => ({
      match_id:   e.match_id,
      club:       e.matches?.club ?? null,
      date:       e.matches?.match_date ?? null,
      mmr_before: e.mmr_before,
      mmr_after:  e.mmr_after,
      delta:      e.delta,
      win:        e.delta > 0,
    }));

    return NextResponse.json({
      chart,
      matches: pageItems,
      pagination: { page, page_size: PAGE_SIZE, total: matchesDesc.length, total_pages: totalPages },
      summary: { played, wins, losses, total_delta: totalDelta },
    });
  } catch (error) {
    console.error('[MMR HISTORY ERROR]', error);
    return NextResponse.json({ error: 'Error al obtener historial de MMR' }, { status: 500 });
  }
}
