import { GET as profileGetHandler, PUT as profilePutHandler } from "../app/api/users/[rut]/profile/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    users: {
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
      count:      jest.fn(),
    },
    mmr_history: {
      aggregate: jest.fn(),
      findMany:  jest.fn(),
    },
    matches: {
      findMany: jest.fn(),
    },
  },
}));

describe("👤 PRUEBAS UNITARIAS - EDITAR USERNAME (PUT /users/[rut]/profile)", () => {
  beforeEach(() => jest.clearAllMocks());

  const PLAYER = {
    id: "player-uuid", rut: 11111111, username: "@viejo", username_changed_at: null,
  };

  it("Debería retornar 400 si el formato de usuario es inválido", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(PLAYER);

    const req = new Request("http://localhost:3000/api/users/11111111/profile", {
      method: "PUT", body: JSON.stringify({ username: "a" }),
    });
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res = await profilePutHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería cambiar el username si nunca se había cambiado antes", async () => {
    (prisma.users.findFirst  as jest.Mock).mockResolvedValue(PLAYER);
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.users.update     as jest.Mock).mockResolvedValue({ ...PLAYER, username: "@nuevo" });

    const req = new Request("http://localhost:3000/api/users/11111111/profile", {
      method: "PUT", body: JSON.stringify({ username: "nuevo" }),
    });
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res = await profilePutHandler(req, ctx as any);

    expect(res.status).toBe(200);
    expect(prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ username: "@nuevo", username_changed_at: expect.any(Date) }) })
    );
  });

  it("Debería retornar 400 si ya cambió el username hace menos de 30 días", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ ...PLAYER, username_changed_at: tenDaysAgo });

    const req = new Request("http://localhost:3000/api/users/11111111/profile", {
      method: "PUT", body: JSON.stringify({ username: "nuevo" }),
    });
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res = await profilePutHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería permitir el cambio si ya pasaron más de 30 días desde el último", async () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    (prisma.users.findFirst  as jest.Mock).mockResolvedValue({ ...PLAYER, username_changed_at: fortyDaysAgo });
    (prisma.users.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.users.update     as jest.Mock).mockResolvedValue({ ...PLAYER, username: "@nuevo" });

    const req = new Request("http://localhost:3000/api/users/11111111/profile", {
      method: "PUT", body: JSON.stringify({ username: "nuevo" }),
    });
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res = await profilePutHandler(req, ctx as any);
    expect(res.status).toBe(200);
  });

  it("Debería retornar 400 si el username ya está en uso por otro jugador", async () => {
    (prisma.users.findFirst  as jest.Mock).mockResolvedValue(PLAYER);
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ id: "otro-uuid", username: "@nuevo" });

    const req = new Request("http://localhost:3000/api/users/11111111/profile", {
      method: "PUT", body: JSON.stringify({ username: "nuevo" }),
    });
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res = await profilePutHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("No debería tocar username_changed_at si el username enviado es el mismo que ya tenía", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(PLAYER);
    (prisma.users.update    as jest.Mock).mockResolvedValue(PLAYER);

    const req = new Request("http://localhost:3000/api/users/11111111/profile", {
      method: "PUT", body: JSON.stringify({ username: "viejo" }),
    });
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res = await profilePutHandler(req, ctx as any);

    expect(res.status).toBe(200);
    expect(prisma.users.findUnique).not.toHaveBeenCalled();
    expect(prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ username_changed_at: expect.anything() }) })
    );
  });
});

describe("📊 PRUEBAS UNITARIAS - STATS COMPETITIVO/CASUAL (GET /users/[rut]/profile)", () => {
  beforeEach(() => jest.clearAllMocks());

  const PLAYER_STATS = { id: "player-uuid", rut: 11111111, zone: "Viña del Mar", mmr: 1200 };

  function mockBaseQueries() {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(PLAYER_STATS);
    (prisma.users.count as jest.Mock)
      .mockResolvedValueOnce(2)   // ranking_position
      .mockResolvedValueOnce(10); // total_in_zone
    (prisma.mmr_history.aggregate as jest.Mock).mockResolvedValue({ _sum: { delta: 20 } });
    (prisma.mmr_history.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // mmr_chart
      .mockResolvedValueOnce([]); // last_matches
  }

  it("Debería retornar 404 si el jugador no existe", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost:3000/api/users/99999999/profile");
    const ctx = { params: Promise.resolve({ rut: "99999999" }) };
    const res = await profileGetHandler(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("Debería contar un partido competitivo ganado como organizador", async () => {
    mockBaseQueries();
    (prisma.matches.findMany as jest.Mock).mockResolvedValue([
      {
        is_ranked: true, organizer_id: "player-uuid", organizer_team: "team_a",
        match_results: { winner: "team_a" }, match_players: [],
      },
    ]);

    const req = new Request("http://localhost:3000/api/users/11111111/profile");
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res  = await profileGetHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stats.competitive).toEqual({ played: 1, wins: 1, losses: 0 });
    expect(data.stats.casual).toEqual({ played: 0, wins: 0, losses: 0 });
  });

  it("Debería contar un partido casual perdido como jugador invitado (no organizador)", async () => {
    mockBaseQueries();
    (prisma.matches.findMany as jest.Mock).mockResolvedValue([
      {
        is_ranked: false, organizer_id: "otro-organizador", organizer_team: "team_a",
        match_results: { winner: "team_a" }, match_players: [{ team: "team_b" }],
      },
    ]);

    const req = new Request("http://localhost:3000/api/users/11111111/profile");
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res  = await profileGetHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stats.casual).toEqual({ played: 1, wins: 0, losses: 1 });
    expect(data.stats.competitive).toEqual({ played: 0, wins: 0, losses: 0 });
  });

  it("Debería separar partidos competitivos y casuales del mismo jugador correctamente", async () => {
    mockBaseQueries();
    (prisma.matches.findMany as jest.Mock).mockResolvedValue([
      { is_ranked: true,  organizer_id: "player-uuid", organizer_team: "team_a", match_results: { winner: "team_b" }, match_players: [] },
      { is_ranked: false, organizer_id: "player-uuid", organizer_team: "team_a", match_results: { winner: "team_a" }, match_players: [] },
    ]);

    const req = new Request("http://localhost:3000/api/users/11111111/profile");
    const ctx = { params: Promise.resolve({ rut: "11111111" }) };
    const res  = await profileGetHandler(req, ctx as any);
    const data = await res.json();

    expect(data.stats.competitive).toEqual({ played: 1, wins: 0, losses: 1 });
    expect(data.stats.casual).toEqual({ played: 1, wins: 1, losses: 0 });
  });
});
