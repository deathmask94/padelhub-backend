import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const q      = searchParams.get('q')?.trim() ?? '';
  const zone   = searchParams.get('zone') ?? '';
  const level  = searchParams.get('level') ?? '';
  const status = searchParams.get('status') ?? 'all'; // 'active' | 'inactive' | 'all'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'));

  const where: Record<string, unknown> = {};

  if (q.length >= 2) {
    where.name = { contains: q, mode: 'insensitive' };
  }
  if (zone)  where.zone  = zone;
  if (level) where.level = level as never;
  if (status === 'active')   where.is_active = true;
  if (status === 'inactive') where.is_active = false;

  const [users, total] = await prisma.$transaction([
    prisma.users.findMany({
      where,
      select: {
        id: true, rut: true, dv_rut: true, name: true, email: true,
        phone: true, level: true, zone: true, mmr: true,
        role: true, is_active: true, created_at: true,
        photo_url: true,
      },
      orderBy: { created_at: 'desc' },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
    }),
    prisma.users.count({ where }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    pageSize:   PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
