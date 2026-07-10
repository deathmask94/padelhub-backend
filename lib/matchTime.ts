// match_time es una columna Postgres TIME (sin fecha): Prisma la representa
// en JS como un Date anclado en 1970-01-01, y match_date (DATE, sin hora)
// vive aparte. Comparar match_time directamente contra Date.now() -- como
// hacian varias rutas -- siempre da verdadero, porque 1970 es menor que
// cualquier fecha real: cualquier partido 'confirmed' se marcaba 'in_progress'
// apenas se consultaba, sin importar si faltaban dias o ya paso.
//
// Estas funciones combinan match_date + match_time (ambos leidos como
// wall-clock de Chile, igual que ya hace el frontend con getUTCHours) y las
// comparan contra la hora real actual EN CHILE, expresada con el mismo
// truco -- asi no hace falta hardcodear el offset UTC-3/UTC-4 de Chile
// (que ademas cambia con el horario de verano) para que la comparacion sea
// correcta.

function chileWallClockAsUTCms(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
}

export function matchDateTimeAsUTCms(matchDate: Date, matchTime: Date): number {
  return Date.UTC(
    matchDate.getUTCFullYear(), matchDate.getUTCMonth(), matchDate.getUTCDate(),
    matchTime.getUTCHours(), matchTime.getUTCMinutes(), matchTime.getUTCSeconds(),
  );
}

export function hasMatchStarted(matchDate: Date, matchTime: Date): boolean {
  return chileWallClockAsUTCms() >= matchDateTimeAsUTCms(matchDate, matchTime);
}

export function msUntilMatch(matchDate: Date, matchTime: Date): number {
  return matchDateTimeAsUTCms(matchDate, matchTime) - chileWallClockAsUTCms();
}
