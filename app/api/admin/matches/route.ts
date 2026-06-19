import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const status    = searchParams.get('status') ?? '';
  const dateFrom  = searchParams.get('date_from') ?? '';
  const dateTo    = searchParams.get('date_to')   ?? '';
  const zone      = searchParams.get('zone')      ?? '';
  const q         = searchParams.get('q')?.trim() ?? '';
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'));

  const where: Record<string, unknown> = {};

  if (status) where.status = status as never;

  if (dateFrom || dateTo) {
    where.match_date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    };
  }

  if (q.length >= 2) {
    where.club = { contains: q, mode: 'insensitive' };
  }

  // Filtro por zona del organizador
  if (zone) {
    where.users = { zone };
  }

  const [matches, total] = await prisma.$transaction([
    prisma.matches.findMany({
      where,
      select: {
        id: true, club: true, format: true, status: true,
        match_date: true, match_time: true, created_at: true,
        users: { select: { id: true, name: true, zone: true } },
        _count: { select: { match_players: true } },
        match_results: { select: { winner: true, score_team_a: true, score_team_b: true } },
      },
      orderBy: { match_date: 'desc' },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
    }),
    prisma.matches.count({ where }),
  ]);

  return NextResponse.json({
    matches,
    total,
    page,
    pageSize:   PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
