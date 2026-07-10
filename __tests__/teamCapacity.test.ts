import { POST as inviteHandler } from "../app/api/matches/[id]/invite/route";
import { POST as joinHandler }   from "../app/api/matches/[id]/join/route";
import { prisma } from "@/lib/prisma";

// Bug reportado: en dobles cada equipo tiene cupo maximo de 2, pero
// /invite dejaba el equipo como opcional ("Automatico") y /join asignaba
// por paridad del total de jugadores en vez de contar por equipo -- ambos
// caminos podian terminar metiendo un 3er jugador al mismo equipo.

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "organizer-uuid", role: "player" }),
}));

jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: {
      findUnique: jest.fn(),
      update:     jest.fn().mockResolvedValue({}),
    },
    users: {
      findUnique: jest.fn().mockResolvedValue({ gender: null, name: "Alguien", email: null }),
    },
    match_players: {
      upsert: jest.fn().mockResolvedValue({ id: "mp-uuid" }),
    },
  },
}));

const BASE_MATCH = {
  id: "match-uuid", status: "open", format: "doubles", organizer_id: "organizer-uuid",
  club: "Club X", users: { name: "Organizador" },
};

describe("🎾 PRUEBAS UNITARIAS - CUPO DE EQUIPOS EN DOBLES (max 2 por equipo)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("invite: debería retornar 400 si no se elige equipo en un partido de dobles", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({ ...BASE_MATCH, match_players: [] });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/invite", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ userId: "invitee-uuid" }), // sin team
    });
    const res = await inviteHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(400);
    expect(prisma.match_players.upsert).not.toHaveBeenCalled();
  });

  it("invite: debería rechazar invitar a un equipo que ya tiene 2 jugadores", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_MATCH,
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_a" },
        { user_id: "p2", status: "confirmed", team: "team_a" },
      ],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/invite", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ userId: "invitee-uuid", team: "team_a" }),
    });
    const res = await inviteHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(400);
    expect(prisma.match_players.upsert).not.toHaveBeenCalled();
  });

  it("invite: debería permitir invitar al equipo con cupo libre", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_MATCH,
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_a" },
        { user_id: "p2", status: "confirmed", team: "team_a" },
      ],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/invite", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ userId: "invitee-uuid", team: "team_b" }),
    });
    const res = await inviteHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(201);
    expect(prisma.match_players.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ team: "team_b" }) })
    );
  });

  it("join: debería asignar al equipo con menos jugadores, no por paridad del total", async () => {
    const { verifyToken } = require("@/lib/jwt");
    verifyToken.mockResolvedValueOnce({ userId: "joiner-uuid", role: "player" });

    // Escenario del bug: el organizador invito explicitamente a 2 jugadores
    // a team_b (paridad de "activePlayers"=2, par, hubiera asignado team_a
    // de nuevo -- pero team_a esta vacio y team_b lleno, hay que llenar A).
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      id: "match-uuid", status: "open", format: "doubles", organizer_id: "organizer-uuid",
      club: "Club X",
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_b" },
        { user_id: "p2", status: "confirmed", team: "team_b" },
      ],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/join", {
      method: "POST", headers: { Authorization: "Bearer token" },
    });
    const res = await joinHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });

    expect(res.status).toBe(201);
    expect(prisma.match_players.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ team: "team_a" }) })
    );
  });
});
