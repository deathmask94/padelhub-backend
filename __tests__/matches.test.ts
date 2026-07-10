import { POST as createMatchHandler  } from "../app/api/matches/route";
import { POST as cancelMatchHandler  } from "../app/api/matches/[id]/cancel/route";
import { POST as resultMatchHandler  } from "../app/api/matches/[id]/result/route";
import { POST as inviteMatchHandler  } from "../app/api/matches/[id]/invite/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "organizer-uuid", role: "player" }),
}));

jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));

jest.mock("@/lib/elo", () => ({
  calculateELO: jest.fn().mockReturnValue([
    { id: "organizer-uuid", before: 1000, after: 1018 },
    { id: "rival-uuid",     before: 1000, after: 982  },
  ]),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({}) },
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: {
      create:     jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
    match_players: {
      create: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
    match_results: {
      create: jest.fn(),
    },
    mmr_history: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe("🎾 PRUEBAS UNITARIAS - PARTIDOS", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Debería agendar un partido correctamente y retornar status 201", async () => {
    (prisma.matches.create as jest.Mock).mockResolvedValue({ id: "match-uuid-creado" });

    const req = new Request("http://localhost:3000/api/matches", {
      method: "POST",
      body: JSON.stringify({
        organizer_id: "9e094ce9-64a6-44de-7806-744cdbb02695",
        club: "Pádel Club Viña del Mar",
        format: "doubles",
        match_date: "2026-05-20",
        match_time: "19:30:00"
      }),
    });

    const res = await createMatchHandler(req);
    expect(res.status).toBe(201);
  });

  it("Debería retornar 400 si faltan campos obligatorios al crear un partido", async () => {
    const req = new Request("http://localhost:3000/api/matches", { method: "POST", body: JSON.stringify({}) });
    const res = await createMatchHandler(req);
    expect(res.status).toBe(400);
  });

  it("Debería forzar is_ranked=false si el formato es dobles, aunque se pida ranked", async () => {
    (prisma.matches.create as jest.Mock).mockResolvedValue({ id: "match-uuid-creado" });

    const req = new Request("http://localhost:3000/api/matches", {
      method: "POST",
      body: JSON.stringify({
        organizer_id: "9e094ce9-64a6-44de-7806-744cdbb02695",
        club: "Pádel Club Viña del Mar",
        format: "doubles",
        is_ranked: true,
        match_date: "2026-05-20",
        match_time: "19:30:00",
      }),
    });

    await createMatchHandler(req);
    expect(prisma.matches.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ is_ranked: false }) })
    );
  });

  it("Debería forzar gender_preference al genero del organizador cuando is_ranked=true", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ gender: "Femenino" });
    (prisma.matches.create   as jest.Mock).mockResolvedValue({ id: "match-uuid-creado" });

    const req = new Request("http://localhost:3000/api/matches", {
      method: "POST",
      body: JSON.stringify({
        organizer_id: "9e094ce9-64a6-44de-7806-744cdbb02695",
        club: "Pádel Club Viña del Mar",
        format: "singles",
        is_ranked: true,
        gender_preference: "Masculino", // intento de bypass -- debe ser ignorado
        match_date: "2026-05-20",
        match_time: "19:30:00",
      }),
    });

    await createMatchHandler(req);
    expect(prisma.matches.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ is_ranked: true, gender_preference: "Femenino" }) })
    );
  });
});

describe("❌ PRUEBAS UNITARIAS - CANCELAR PARTIDO (POST /matches/[id]/cancel)", () => {
  beforeEach(() => jest.clearAllMocks());

  const OPEN_MATCH = {
    id: "match-uuid", status: "open", club: "Club Test",
    organizer_id: "organizer-uuid",
    match_date: new Date(), match_time: new Date(),
    users: { name: "Organizador" },
    match_players: [{ users: { id: "player-uuid", name: "Player", email: "p@test.cl" } }],
  };

  it("Debería retornar 403 si quien cancela no es el organizador", async () => {
    const { verifyToken } = require("@/lib/jwt");
    verifyToken.mockResolvedValueOnce({ userId: "otro-usuario", role: "player" });

    (prisma.matches.findUnique as jest.Mock).mockResolvedValue(OPEN_MATCH);

    const req = new Request("http://localhost:3000/api/matches/match-uuid/cancel", {
      method: "POST", headers: { Authorization: "Bearer token" },
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await cancelMatchHandler(req, ctx as any);
    expect(res.status).toBe(403);
  });

  it("Debería retornar 400 si el partido ya está cancelado", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({ ...OPEN_MATCH, status: "cancelled" });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/cancel", {
      method: "POST", headers: { Authorization: "Bearer token" },
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await cancelMatchHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 200 al cancelar correctamente", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue(OPEN_MATCH);
    (prisma.matches.update     as jest.Mock).mockResolvedValue({});

    const req = new Request("http://localhost:3000/api/matches/match-uuid/cancel", {
      method: "POST", headers: { Authorization: "Bearer token" },
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await cancelMatchHandler(req, ctx as any);
    expect(res.status).toBe(200);
  });
});

describe("🏆 PRUEBAS UNITARIAS - REGISTRAR RESULTADO (POST /matches/[id]/result)", () => {
  beforeEach(() => jest.clearAllMocks());

  const CONFIRMED_MATCH = {
    id: "match-uuid", status: "confirmed", club: "Club Test",
    organizer_id: "organizer-uuid", is_ranked: true,
    match_date: new Date(), match_time: new Date(),
    users:         { id: "organizer-uuid", mmr: 1000 },
    match_players: [
      { team: "team_b", users: { id: "rival-uuid", mmr: 1000 } },
    ],
  };

  it("Debería retornar 403 si quien registra no es el organizador", async () => {
    const { verifyToken } = require("@/lib/jwt");
    verifyToken.mockResolvedValueOnce({ userId: "otro-usuario", role: "player" });

    (prisma.matches.findUnique as jest.Mock).mockResolvedValue(CONFIRMED_MATCH);

    const req = new Request("http://localhost:3000/api/matches/match-uuid/result", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body:   JSON.stringify({ winner: "team_a", organizer_team: "team_a", score_team_a: "6-3", score_team_b: "3-6" }),
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await resultMatchHandler(req, ctx as any);
    expect(res.status).toBe(403);
  });

  it("Debería retornar 400 si el partido no está confirmado o en progreso", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({ ...CONFIRMED_MATCH, status: "open" });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/result", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body:   JSON.stringify({ winner: "team_a", organizer_team: "team_a" }),
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await resultMatchHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 400 si winner es 'draw' (en pádel no hay empate)", async () => {
    const req = new Request("http://localhost:3000/api/matches/match-uuid/result", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body:   JSON.stringify({ winner: "draw", organizer_team: "team_a", score_team_a: "6-3", score_team_b: "3-6" }),
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await resultMatchHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 400 si falta el score o no tiene el formato de games por set", async () => {
    const req = new Request("http://localhost:3000/api/matches/match-uuid/result", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body:   JSON.stringify({ winner: "team_a", organizer_team: "team_a", score_team_a: "4444444", score_team_b: "222" }),
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await resultMatchHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 200 y aplicar cambios de MMR correctamente si el partido es competitivo", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue(CONFIRMED_MATCH);
    (prisma.$transaction       as jest.Mock).mockResolvedValue([{}, {}, {}, {}]);

    const req = new Request("http://localhost:3000/api/matches/match-uuid/result", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body:   JSON.stringify({ winner: "team_a", organizer_team: "team_a", score_team_a: "6-3", score_team_b: "3-6" }),
    });
    const ctx  = { params: Promise.resolve({ id: "match-uuid" }) };
    const res  = await resultMatchHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.changes).toHaveLength(2);
  });

  it("No debería tocar el MMR si el partido es casual/exhibición", async () => {
    const { calculateELO } = require("@/lib/elo");
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({ ...CONFIRMED_MATCH, is_ranked: false });
    (prisma.$transaction       as jest.Mock).mockResolvedValue([{}, {}]);

    const req = new Request("http://localhost:3000/api/matches/match-uuid/result", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body:   JSON.stringify({ winner: "team_a", organizer_team: "team_a", score_team_a: "6-3", score_team_b: "3-6" }),
    });
    const ctx  = { params: Promise.resolve({ id: "match-uuid" }) };
    const res  = await resultMatchHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.changes).toEqual([]);
    expect(calculateELO).not.toHaveBeenCalled();
  });
});
