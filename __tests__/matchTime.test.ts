import { hasMatchStarted, matchDateTimeAsUTCms } from "@/lib/matchTime";

// match_time es una columna Postgres TIME (sin fecha): Prisma la trae a JS
// como un Date anclado en 1970-01-01. Compararla directo contra Date.now()
// (como hacia el codigo viejo) da siempre "ya empezo", sin importar la
// fecha real del partido -- 1970 es menor que cualquier fecha real.

describe("🕐 lib/matchTime — combina match_date + match_time correctamente", () => {
  it("un partido programado para dentro de una semana NO deberia figurar como empezado", () => {
    const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const matchDate = new Date(Date.UTC(inAWeek.getUTCFullYear(), inAWeek.getUTCMonth(), inAWeek.getUTCDate()));
    const matchTime = new Date(Date.UTC(1970, 0, 1, 18, 0, 0)); // 18:00, fecha 1970 (como llega de Prisma)

    expect(hasMatchStarted(matchDate, matchTime)).toBe(false);
  });

  it("un partido programado para ayer SI deberia figurar como empezado", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const matchDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()));
    const matchTime = new Date(Date.UTC(1970, 0, 1, 18, 0, 0));

    expect(hasMatchStarted(matchDate, matchTime)).toBe(true);
  });

  it("matchDateTimeAsUTCms ignora la fecha 1970 de match_time y usa la de match_date", () => {
    const matchDate = new Date(Date.UTC(2026, 6, 15)); // 15 jul 2026
    const matchTime = new Date(Date.UTC(1970, 0, 1, 9, 30, 0)); // 09:30, fecha basura de Postgres TIME

    const combined = new Date(matchDateTimeAsUTCms(matchDate, matchTime));
    expect(combined.getUTCFullYear()).toBe(2026);
    expect(combined.getUTCMonth()).toBe(6);
    expect(combined.getUTCDate()).toBe(15);
    expect(combined.getUTCHours()).toBe(9);
    expect(combined.getUTCMinutes()).toBe(30);
  });
});
