import { GET as suggestionsHandler } from "@/app/api/users/suggestions/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "mock-user-uuid", role: "player" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    users: {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
    },
  },
}));

const mockRivals = (n: number, baseMMR = 1020) =>
  Array.from({ length: n }, (_, i) => ({
    id: `rival-${i}`, name: `Rival ${i}`, photo_url: null,
    level: "tercera", mmr: baseMMR + i * 5, zone: "Viña del Mar",
  }));

describe("🎯 PRUEBAS UNITARIAS - SUGERENCIAS DE RIVALES", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 401 si no se envía token", async () => {
    const req = new Request("http://localhost:3000/api/users/suggestions");
    const res = await suggestionsHandler(req);
    expect(res.status).toBe(401);
  });

  it("Debería retornar 404 si el usuario no existe", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res = await suggestionsHandler(req);
    expect(res.status).toBe(404);
  });

  it("Debería retornar como máximo 3 rivales, aunque haya más elegibles (≥80%) en ±150", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    // Diffs 0..25 -> compat a rango 150 entre 83% y 100%, todos elegibles (6).
    (prisma.users.findMany  as jest.Mock).mockResolvedValue(mockRivals(6, 1000));

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("suggestions");
    expect(data).toHaveProperty("range_used", 150);
    expect(data).toHaveProperty("user_mmr", 1000);
    expect(data.suggestions.length).toBe(3);
    expect(data.suggestions[0]).toHaveProperty("compatibility");
  });

  it("Debería expandir el rango a ±300 si ±150 da menos de 3 rivales elegibles", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    // Primera llamada (±150): 2 rivales cercanos (elegibles pero <3 en total);
    // segunda (±300): 5 rivales con diff <= 50 -> compat >= 80% a rango 300.
    (prisma.users.findMany as jest.Mock)
      .mockResolvedValueOnce(mockRivals(2, 1000))
      .mockResolvedValueOnce(mockRivals(5, 1010));

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.range_used).toBe(300);
    expect(data.suggestions.length).toBe(3);
  });

  it("Debería retornar lo que haya aunque sean <3 rivales tras agotar todos los rangos", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    // Diff 90/95: compat < 80% a rango 150 y 300, pero >= 80% a rango 500.
    (prisma.users.findMany  as jest.Mock).mockResolvedValue(mockRivals(2, 1090));

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.range_used).toBe(500);
    expect(data.suggestions.length).toBe(2);
  });

  it("Debería traer todo el rango elegible (no solo un subconjunto fijo tipo página)", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    (prisma.users.findMany  as jest.Mock).mockResolvedValue(mockRivals(6, 1000));

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    await suggestionsHandler(req);

    // No debe limitar la consulta a un puñado fijo ordenado por MMR: eso
    // reduciria el pool real de elegibles antes incluso de mezclar.
    expect(prisma.users.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ orderBy: expect.anything(), take: 20 })
    );
  });

  it("Debería excluir rivales con menos de 80% de compatibilidad", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    (prisma.users.findMany  as jest.Mock).mockResolvedValue([
      { id: "close", name: "Close", photo_url: null, level: "tercera", mmr: 1010, zone: "Z" }, // compat 93% a r150
      { id: "far",   name: "Far",   photo_url: null, level: "tercera", mmr: 1400, zone: "Z" }, // compat 0% siempre
    ]);

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    const ids = data.suggestions.map((s: { id: string }) => s.id);
    expect(ids).toContain("close");
    expect(ids).not.toContain("far");
    for (const s of data.suggestions) {
      expect(s.compatibility).toBeGreaterThanOrEqual(80);
    }
  });
});
