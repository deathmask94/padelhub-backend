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

  it("Debería retornar sugerencias con compatibilidad cuando hay ≥5 rivales en ±150", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    (prisma.users.findMany  as jest.Mock).mockResolvedValue(mockRivals(6));

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("suggestions");
    expect(data).toHaveProperty("range_used");
    expect(data).toHaveProperty("user_mmr", 1000);
    expect(data.suggestions.length).toBeGreaterThanOrEqual(5);
    expect(data.suggestions[0]).toHaveProperty("compatibility");
  });

  it("Debería expandir el rango a ±300 si ±150 da menos de 5 rivales", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    // Primera llamada (±150): 2 rivales; segunda (±300): 5
    (prisma.users.findMany as jest.Mock)
      .mockResolvedValueOnce(mockRivals(2))
      .mockResolvedValueOnce(mockRivals(5, 1250));

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.range_used).toBe(300);
    expect(data.suggestions.length).toBe(5);
  });

  it("Debería retornar lo que haya aunque sean <5 rivales tras agotar todos los rangos", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    (prisma.users.findMany  as jest.Mock).mockResolvedValue(mockRivals(2, 1400));

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.range_used).toBe(500);
    expect(data.suggestions.length).toBe(2);
  });

  it("Las sugerencias deben venir ordenadas por compatibilidad descendente", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ mmr: 1000, is_active: true });
    (prisma.users.findMany  as jest.Mock).mockResolvedValue([
      { id: "a", name: "A", photo_url: null, level: "tercera", mmr: 1100, zone: "Z" },
      { id: "b", name: "B", photo_url: null, level: "tercera", mmr: 1010, zone: "Z" },
      { id: "c", name: "C", photo_url: null, level: "tercera", mmr: 1140, zone: "Z" },
      { id: "d", name: "D", photo_url: null, level: "tercera", mmr: 1005, zone: "Z" },
      { id: "e", name: "E", photo_url: null, level: "tercera", mmr: 1050, zone: "Z" },
    ]);

    const req = new Request("http://localhost:3000/api/users/suggestions", {
      headers: { Authorization: "Bearer valid-token" },
    });
    const res  = await suggestionsHandler(req);
    const data = await res.json();

    const comps = data.suggestions.map((s: { compatibility: number }) => s.compatibility);
    const sorted = [...comps].sort((a: number, b: number) => b - a);
    expect(comps).toEqual(sorted);
  });
});
