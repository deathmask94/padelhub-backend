import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { id: matchId } = await params;

  const match = await prisma.matches.findUnique({
    where: { id: matchId },
    include: {
      match_results: true,
      mmr_history:   { select: { user_id: true, delta: true } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  }
  if (!match.match_results) {
    return NextResponse.json({ error: 'Este partido no tiene resultado registrado' }, { status: 400 });
  }
  if (match.status !== 'finished') {
    return NextResponse.json({ error: 'Solo se puede anular el resultado de un partido finalizado' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  // Revertir delta de cada jugador restando su variación de MMR
  await prisma.$transaction([
    ...match.mmr_history.map(({ user_id, delta }) =>
      prisma.users.update({
        where: { id: user_id },
        data:  { mmr: { decrement: delta }, updated_at: new Date() },
      })
    ),
    prisma.mmr_history.deleteMany({ where: { match_id: matchId } }),
    prisma.match_results.delete({ where: { match_id: matchId } }),
    prisma.matches.update({
      where: { id: matchId },
      data:  { status: 'confirmed', updated_at: new Date() },
    }),
    prisma.admin_audit_logs.create({
      data: {
        admin_id: admin.userId,
        action:   'MATCH_RESULT_ANNULLED',
        details:  `match=${matchId}, revertido MMR de ${match.mmr_history.length} jugadores`,
        ip,
      },
    }),
  ]);

  const updated = await prisma.matches.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, club: true, match_date: true },
  });

  return NextResponse.json({ message: 'Resultado anulado y MMR revertido', match: updated });
}
