import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { id } = await params;

  const user = await prisma.users.findUnique({
    where: { id },
    select: {
      id: true, rut: true, dv_rut: true, name: true, email: true,
      phone: true, level: true, zone: true, mmr: true,
      role: true, is_active: true, reminder_enabled: true,
      photo_url: true, created_at: true, updated_at: true,
      _count: {
        select: {
          matches:       true,
          match_players: true,
          mmr_history:   true,
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  return NextResponse.json({ user });
}

export async function PATCH(request: Request, { params }: Params) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json() as {
    is_active?: boolean;
    level?: string;
    zone?: string;
  };

  const { is_active, level, zone } = body;
  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  if (is_active !== undefined) {
    updates.is_active = Boolean(is_active);
    changes.push(`is_active=${is_active}`);
  }
  if (level !== undefined) {
    updates.level = level as never;
    changes.push(`level=${level}`);
  }
  if (zone !== undefined) {
    updates.zone = zone;
    changes.push(`zone=${zone}`);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  updates.updated_at = new Date();

  const [user] = await prisma.$transaction([
    prisma.users.update({
      where: { id },
      data:  updates,
      select: {
        id: true, rut: true, dv_rut: true, name: true, email: true,
        phone: true, level: true, zone: true, mmr: true,
        role: true, is_active: true, created_at: true,
      },
    }),
    prisma.admin_audit_logs.create({
      data: {
        admin_id: admin.userId,
        action:   'USER_UPDATE',
        details:  `user=${id} changes: ${changes.join(', ')}`,
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown',
      },
    }),
  ]);

  return NextResponse.json({ user });
}
