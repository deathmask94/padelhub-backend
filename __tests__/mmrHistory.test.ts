import { GET as mmrHistoryHandler } from "../app/api/users/[rut]/mmr-history/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
    },
    mmr_history: {
      findMany: jest.fn(),
    },
  },
}));

const PLAYER = { id: "player-uuid", rut: 11111111 };

function makeEntry(i: number, opts: Partial<{ match_id: string | null; delta: number }> = {}) {
  return {
    id: `entry-${i}`,
    user_id: "player-uuid",
    match_id: opts.match_id !== undefined ? opts.match_id : `match-${i}`,
    mmr_before: 1000 + i * 10,
    mmr_after: 1000 + i * 10 + (opts.delta ?? 10),
    delta: opts.delta ?? 10,
    calculated_at: new Date(Date.now() - (50 - i) * 24 * 60 * 60 * 1000), // orden cronologico ascendente
    matches: { club: "Club Test", match_date: new Date() },
  };
}

describe("📈 PRUEBAS UNITARIAS - HISTORIAL MMR (GET /users/[rut]/mmr-history)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 404 si el jugador no existe", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost:3000/api/users/99999999/mmr-history");
    const ctx = { params: Promise.resolve({ rut: "99999999" }) };
    const res = await mmrHistoryHandler(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("Debería excluir ajustes de admin (match_id null) de partidos/victorias/derrotas y de la lista", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(PLAYER);
    (prisma.mmr_history.findMany as jest.Mock).mockResolvedValue([
      makeEntry(0, { delta: 15 }),
      makeEntry(1, { match_id: null, delta: 200 }), // ajuste manual de admin -- no es un partido
      makeEntry(2, { delta: -10 }),
    ]);

    const req = new Request("http://localhost:3000/api/users/11111111/mmr-history");
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res  = await mmrHistoryHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.summary).toEqual({ played: 2, wins: 1, losses: 1, total_delta: 5 });
    expect(data.matches).toHaveLength(2);
    expect(data.matches.every((m: { match_id: string | null }) => m.match_id !== null)).toBe(true);
  });

  it("Debería paginar de a 10 partidos, mas reciente primero", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(PLAYER);
    const entries = Array.from({ length: 15 }, (_, i) => makeEntry(i));
    (prisma.mmr_history.findMany as jest.Mock).mockResolvedValue(entries);

    const req1 = new Request("http://localhost:3000/api/users/11111111/mmr-history?page=1");
    const ctx  = { params: Promise.resolve({ rut: "11111111" }) };
    const res1  = await mmrHistoryHandler(req1, ctx as any);
    const data1 = await res1.json();

    expect(data1.pagination).toEqual({ page: 1, page_size: 10, total: 15, total_pages: 2 });
    expect(data1.matches).toHaveLength(10);
    // El mas reciente (entry-14) debe ser el primero de la pagina 1.
    expect(data1.matches[0].match_id).toBe("match-14");

    const req2  = new Request("http://localhost:3000/api/users/11111111/mmr-history?page=2");
    const res2  = await mmrHistoryHandler(req2, ctx as any);
    const data2 = await res2.json();

    expect(data2.matches).toHaveLength(5);
    expect(data2.matches[data2.matches.length - 1].match_id).toBe("match-0");
  });

  it("Debería retornar chart vacío si el jugador no tiene historial", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(PLAYER);
    (prisma.mmr_history.findMany as jest.Mock).mockResolvedValue([]);

    const req = new Request("http://localhost:3000/api/users/11111111/mmr-history");
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res  = await mmrHistoryHandler(req, ctx as any);
    const data = await res.json();

    expect(data.chart).toEqual([]);
    expect(data.summary).toEqual({ played: 0, wins: 0, losses: 0, total_delta: 0 });
  });

  it("Debería repartir todo el historico en 12 tramos para el grafico", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(PLAYER);
    (prisma.mmr_history.findMany as jest.Mock).mockResolvedValue([
      makeEntry(0), makeEntry(1), makeEntry(2),
    ]);

    const req = new Request("http://localhost:3000/api/users/11111111/mmr-history");
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res  = await mmrHistoryHandler(req, ctx as any);
    const data = await res.json();

    expect(data.chart).toHaveLength(12);
  });
});
