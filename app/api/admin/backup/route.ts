import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

export async function GET(request: Request) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  try {
    const modelNames = Object.keys(prisma).filter(
      (key) => !key.startsWith('_') && !key.startsWith('$'),
    );

    const fullBackupData: Record<string, unknown> = {};
    let totalRecordsCount = 0;

    for (const model of modelNames) {
      try {
        const tableData = await (prisma as Record<string, { findMany: () => Promise<unknown[]> }>)[model].findMany();
        fullBackupData[model] = { record_count: tableData.length, records: tableData };
        totalRecordsCount += tableData.length;
      } catch {
        fullBackupData[model] = { error: 'No se pudo extraer la tabla.', records: [] };
      }
    }

    const masterBackup = {
      backup_info: {
        project:                  'PadelHub Backend',
        environment:              process.env.NODE_ENV ?? 'production',
        backup_date:              new Date().toISOString(),
        exported_entities_count:  modelNames.length,
        total_records_exported:   totalRecordsCount,
        database_provider:        'PostgreSQL (Supabase)',
      },
      database: fullBackupData,
    };

    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    await prisma.admin_audit_logs.create({
      data: {
        admin_id: admin.userId,
        action:   'BACKUP_DOWNLOAD',
        details:  `${totalRecordsCount} registros exportados en ${modelNames.length} tablas`,
        ip,
      },
    }).catch(() => {});

    const today = new Date().toISOString().split('T')[0];
    const fileName = `padelhub-backup-${today}.json`;

    return new NextResponse(JSON.stringify(masterBackup, null, 2), {
      status:  200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('[ADMIN BACKUP ERROR]', error);
    return NextResponse.json({ error: 'Error al generar el respaldo' }, { status: 500 });
  }
}
