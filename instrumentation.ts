export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron      = (await import('node-cron')).default;
    const fs        = await import('fs');
    const path      = await import('path');
    const { PrismaClient } = await import('@prisma/client');

    const prisma = new PrismaClient();

    const cronExpression = '0 */1 * * *';

    console.log("⏰ [MOTOR] Sistema de Backups Automáticos inicializado correctamente.");

    cron.schedule(cronExpression, async () => {
      console.log("💾 [CRON] Iniciando respaldo automático de la base de datos...");

      try {
        const modelNames = Object.keys(prisma).filter(
          (key) => !key.startsWith("_") && !key.startsWith("$")
        );

        const fullBackupData: Record<string, unknown> = {};
        for (const model of modelNames) {
          fullBackupData[model] = await (prisma as unknown as Record<string, { findMany: () => Promise<unknown> }>)[model].findMany();
        }

        const masterBackup = {
          backup_info: {
            type: "AUTOMATIC_CRON_BACKUP",
            backup_date: new Date().toISOString(),
            database_provider: "PostgreSQL (Supabase)",
          },
          database: fullBackupData,
        };

        const backupFolder = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupFolder)) {
          fs.mkdirSync(backupFolder, { recursive: true });
        }

        const now   = new Date().toLocaleTimeString('es-CL', { hour12: false }).replace(/:/g, '-');
        const today = new Date().toISOString().split('T')[0];
        const filePath = path.join(backupFolder, `cron_backup_${today}_${now}.json`);

        fs.writeFileSync(filePath, JSON.stringify(masterBackup, null, 2));
        console.log(`✅ [CRON] ¡Respaldo guardado con éxito!: ${filePath}`);

      } catch (error) {
        console.error("❌ [CRON] Error crítico durante la ejecución del respaldo:", error);
      }
    }, {
      scheduled: true,
      timezone: "America/Santiago",
    } as Parameters<typeof cron.schedule>[2]);
  }
}
