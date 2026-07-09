import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminPayload, unauthorizedResponse } from '@/lib/adminGuard';

// Orden de inserción respetando FK: tablas padre primero
const RESTORE_ORDER = [
  'users',
  'matches',
  'refresh_tokens',
  'password_reset_tokens',
  'match_players',
  'match_results',
  'mmr_history',
  'match_reminders',
  'admin_audit_logs',
];

interface BackupTable {
  records: Record<string, unknown>[];
  record_count?: number;
}

// Columnas generadas por Postgres (GENERATED ALWAYS AS): el backup las exporta
// como si fueran datos normales, pero la BD rechaza cualquier insert explícito
// sobre ellas. Hay que quitarlas antes de restaurar para que no fallen las filas.
const GENERATED_COLUMNS: Record<string, string[]> = {
  mmr_history: ['delta'],
};

function stripGeneratedColumns(tableName: string, records: Record<string, unknown>[]) {
  const cols = GENERATED_COLUMNS[tableName];
  if (!cols) return records;
  return records.map((r) => {
    const clean = { ...r };
    for (const col of cols) delete clean[col];
    return clean;
  });
}
interface BackupFile {
  backup_info: {
    backup_date:           string;
    total_records_exported: number;
    exported_entities_count: number;
  };
  database: Record<string, BackupTable>;
}

export async function POST(request: Request) {
  const admin = await getAdminPayload(request);
  if (!admin) return unauthorizedResponse();

  let body: BackupFile;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido en el cuerpo de la solicitud' }, { status: 400 });
  }

  if (!body.backup_info || !body.database) {
    return NextResponse.json(
      { error: 'Formato de archivo inválido: faltan campos backup_info o database' },
      { status: 400 },
    );
  }

  const results: Record<string, { inserted: number; error?: string }> = {};
  let totalInserted = 0;

  for (const tableName of RESTORE_ORDER) {
    const tableData = body.database[tableName];
    if (!tableData || !Array.isArray(tableData.records) || tableData.records.length === 0) {
      results[tableName] = { inserted: 0 };
      continue;
    }

    try {
      const model = (prisma as unknown as Record<string, { createMany: (args: unknown) => Promise<{ count: number }> }>)[tableName];
      if (!model?.createMany) {
        results[tableName] = { inserted: 0, error: 'Modelo no encontrado' };
        continue;
      }

      const { count } = await model.createMany({
        data:           stripGeneratedColumns(tableName, tableData.records),
        skipDuplicates: true,
      });

      results[tableName] = { inserted: count };
      totalInserted += count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      results[tableName] = { inserted: 0, error: msg };
    }
  }

  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  await prisma.admin_audit_logs.create({
    data: {
      admin_id: admin.userId,
      action:   'BACKUP_RESTORED',
      details:  `Importación desde backup del ${body.backup_info.backup_date}. ${totalInserted} registros insertados.`,
      ip,
    },
  }).catch(() => {});

  return NextResponse.json({
    message:       `Importación completada. ${totalInserted} registros nuevos insertados.`,
    totalInserted,
    results,
    backup_date:   body.backup_info.backup_date,
  });
}
