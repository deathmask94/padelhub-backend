import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

function getMondayStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=dom, 1=lun...
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

const LEVEL_LABEL: Record<string, string> = {
  primera:     '1ra Cat.',
  segunda:     '2da Cat.',
  tercera:     '3ra Cat.',
  cuarta:      '4ta Cat.',
  quinta:      '5ta Cat.',
  sexta:       '6ta Cat.',
  septima_mas: '7ma+ Cat.',
};

export async function GET(request: Request) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const monday = getMondayStart();

  const [
    activeUsers,
    totalUsers,
    matchesThisWeek,
    matchesLive,
    usersWithActivity,
    avgMmrAgg,
    zoneGroups,
    levelGroups,
  ] = await Promise.all([
    // Usuarios activos
    prisma.users.count({ where: { is_active: true } }),
    // Total usuarios registrados
    prisma.users.count(),
    // Partidos finalizados esta semana (lun→ahora)
    prisma.matches.count({ where: { status: 'finished', updated_at: { gte: monday } } }),
    // Partidos en curso ahora mismo
    prisma.matches.count({ where: { status: { in: ['confirmed', 'in_progress'] } } }),
    // Usuarios que han jugado al menos un partido
    prisma.users.count({ where: { match_players: { some: {} } } }),
    // MMR promedio
    prisma.users.aggregate({ where: { is_active: true }, _avg: { mmr: true } }),
    // Top 5 zonas por nº de jugadores activos
    prisma.users.groupBy({
      by:      ['zone'],
      where:   { is_active: true },
      _count:  { id: true },
      orderBy: { _count: { id: 'desc' } },
      take:    5,
    }),
    // Distribución de niveles entre usuarios activos
    prisma.users.groupBy({
      by:      ['level'],
      where:   { is_active: true },
      _count:  { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
  ]);

  const avgMmr = avgMmrAgg._avg.mmr ? Math.round(avgMmrAgg._avg.mmr) : 0;
  const pctActive = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
  const pctPlayed = activeUsers > 0 ? Math.round((usersWithActivity / activeUsers) * 100) : 0;

  const zones = zoneGroups.map((z) => ({ zone: z.zone, count: z._count.id }));

  const levels = levelGroups.map((l) => ({
    level: l.level,
    label: LEVEL_LABEL[l.level] ?? l.level,
    count: l._count.id,
  }));

  return NextResponse.json({
    users: {
      active:       activeUsers,
      total:        totalUsers,
      pct_active:   pctActive,
      pct_played:   pctPlayed,
    },
    matches: {
      this_week: matchesThisWeek,
      live:      matchesLive,
    },
    avg_mmr:  avgMmr,
    zones,
    levels,
  });
}
