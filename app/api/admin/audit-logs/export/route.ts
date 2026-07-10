import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

const ACTION_LABEL: Record<string, string> = {
  ADMIN_LOGIN:            'Inicio de sesión',
  USER_UPDATE:            'Modificación de usuario',
  MATCH_RESULT_ANNULLED:  'Anulación de resultado',
  BACKUP_DOWNLOADED:      'Descarga de respaldo',
  BACKUP_RESTORED:        'Restauración de respaldo',
  MMR_ADJUST:             'Ajuste manual de MMR',
  MATCH_STATUS_FORCED:    'Estado de partido forzado',
};

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if contains comma, quote or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const action   = searchParams.get('action') ?? '';
  const adminId  = searchParams.get('admin_id') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo   = searchParams.get('date_to') ?? '';

  const where: Record<string, unknown> = {};
  if (action)  where.action   = action;
  if (adminId) where.admin_id = adminId;
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

  const logs = await prisma.admin_audit_logs.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: { users: { select: { name: true } } },
  });

  const header = ['Fecha', 'Hora', 'Administrador', 'Acción', 'Detalle', 'IP'].join(',');

  const rows = logs.map((l) => {
    const dt   = new Date(l.created_at);
    const date = dt.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = dt.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return [
      escapeCSV(date),
      escapeCSV(time),
      escapeCSV(l.users.name),
      escapeCSV(ACTION_LABEL[l.action] ?? l.action),
      escapeCSV(l.details),
      escapeCSV(l.ip),
    ].join(',');
  });

  const csv = [header, ...rows].join('\r\n');

  // BOM UTF-8 para que Excel lo abra con tildes correctamente
  const bom  = '﻿';
  const body = bom + csv;

  const today    = new Date().toISOString().slice(0, 10);
  const filename = `auditoria_padelhub_${today}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
