import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['open', 'confirmed', 'in_progress', 'finished', 'cancelled'] as const;
type MatchStatus = (typeof VALID_STATUSES)[number];

// Escape hatch para soporte/pruebas: cambia el estado del partido a mano,
// sin pasar por el flujo normal (join/respond/result). No toca match_results
// ni MMR -- si se necesita revertir un resultado ya registrado, esa es
// annul-result, no esta ruta.
export async function POST(request: Request, { params }: Params) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { id: matchId } = await params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const status = body.status as MatchStatus | undefined;
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status debe ser uno de: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const match = await prisma.matches.findUnique({ where: { id: matchId }, select: { id: true, club: true, status: true } });
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  const previousStatus = match.status;

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

  const [updated] = await prisma.$transaction([
    prisma.matches.update({
      where: { id: matchId },
      data:  { status, updated_at: new Date() },
      select: { id: true, status: true, club: true, match_date: true },
    }),
    prisma.admin_audit_logs.create({
      data: {
        admin_id: admin.userId,
        action:   'MATCH_STATUS_FORCED',
        details:  `match=${matchId} (${match.club}): ${previousStatus} -> ${status}`,
        ip,
      },
    }),
  ]);

  return NextResponse.json({ message: 'Estado del partido actualizado', match: updated });
}
