import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

const PAGE_SIZE = 30;

const ACTION_LABEL: Record<string, string> = {
  ADMIN_LOGIN:            'Inicio de sesión',
  USER_UPDATE:            'Modificación de usuario',
  MATCH_RESULT_ANNULLED:  'Anulación de resultado',
  BACKUP_DOWNLOADED:      'Descarga de respaldo',
  BACKUP_RESTORED:        'Restauración de respaldo',
  MMR_ADJUST:             'Ajuste manual de MMR',
};

export async function GET(request: Request) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const action     = searchParams.get('action') ?? '';
  const adminId    = searchParams.get('admin_id') ?? '';
  const dateFrom   = searchParams.get('date_from') ?? '';
  const dateTo     = searchParams.get('date_to') ?? '';

  const where: Record<string, unknown> = {};
  if (action)   where.action   = action;
  if (adminId)  where.admin_id = adminId;
  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.created_at = range;
  }

  const [total, logs] = await prisma.$transaction([
    prisma.admin_audit_logs.count({ where }),
    prisma.admin_audit_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      include: { users: { select: { id: true, name: true } } },
    }),
  ]);

  const items = logs.map((l) => ({
    id:          l.id,
    action:      l.action,
    action_label: ACTION_LABEL[l.action] ?? l.action,
    details:     l.details,
    ip:          l.ip,
    created_at:  l.created_at,
    admin:       { id: l.users.id, name: l.users.name },
  }));

  // Listado de admins únicos para el filtro del frontend
  const admins = await prisma.admin_audit_logs.findMany({
    distinct: ['admin_id'],
    select:   { admin_id: true, users: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    logs: items,
    total,
    page,
    pages:   Math.ceil(total / PAGE_SIZE),
    admins:  admins.map((a) => ({ id: a.users.id, name: a.users.name })),
    actions: Object.entries(ACTION_LABEL).map(([key, label]) => ({ key, label })),
  });
}
