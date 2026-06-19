import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { id } = await params;

  const match = await prisma.matches.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, name: true, rut: true, dv_rut: true, mmr: true, level: true, zone: true },
      },
      match_players: {
        include: {
          users: { select: { id: true, name: true, rut: true, dv_rut: true, mmr: true, level: true } },
        },
        orderBy: { joined_at: 'asc' },
      },
      match_results: {
        include: {
          users: { select: { name: true } },
        },
      },
      mmr_history: {
        include: {
          users: { select: { id: true, name: true } },
        },
        orderBy: { calculated_at: 'asc' },
      },
    },
  });

  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  return NextResponse.json({ match });
}
