import { POST as inviteHandler } from "../app/api/matches/[id]/invite/route";
import { POST as joinHandler }   from "../app/api/matches/[id]/join/route";
import { prisma } from "@/lib/prisma";

// Bug reportado: en dobles cada equipo tiene cupo maximo de 2, pero
// /invite dejaba el equipo como opcional ("Automatico") y /join asignaba
// por paridad del total de jugadores en vez de contar por equipo -- ambos
// caminos podian terminar metiendo un 3er jugador al mismo equipo.
//
// Ademas, "Automatico" debe respetar equidad de genero: si el partido es
// mixto (hombres y mujeres), cada equipo debe quedar con un hombre y una
// mujer, nunca dos del mismo sexo juntos.

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

  it("invite: debería rechazar invitar a un equipo que ya tiene 2 jugadores", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_MATCH,
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_a", users: { gender: null } },
        { user_id: "p2", status: "confirmed", team: "team_a", users: { gender: null } },
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
        { user_id: "p1", status: "confirmed", team: "team_a", users: { gender: null } },
        { user_id: "p2", status: "confirmed", team: "team_a", users: { gender: null } },
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
        { user_id: "p1", status: "confirmed", team: "team_b", users: { gender: null } },
        { user_id: "p2", status: "confirmed", team: "team_b", users: { gender: null } },
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

describe("⚖️ PRUEBAS UNITARIAS - EQUIDAD DE GÉNERO EN 'AUTOMÁTICO'", () => {
  beforeEach(() => jest.clearAllMocks());

  it("invite: si todos son del mismo sexo, Automático solo balancea por cupo", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ gender: "Masculino", name: "Juan", email: null });
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_MATCH,
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_a", users: { gender: "Masculino" } },
      ],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/invite", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ userId: "invitee-uuid" }), // sin team -> Automatico
    });
    const res = await inviteHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(201);
    // team_a tiene 1, team_b tiene 0 -> deberia ir a team_b
    expect(prisma.match_players.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ team: "team_b" }) })
    );
  });

  it("invite: en partido mixto, empareja con el equipo que tiene el sexo opuesto", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ gender: "Femenino", name: "Ana", email: null });
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_MATCH,
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_a", users: { gender: "Masculino" } },
      ],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/invite", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ userId: "invitee-uuid" }), // Automatico
    });
    const res = await inviteHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(201);
    // team_a tiene un hombre solo -> la mujer debe emparejarse ahi, no a team_b vacio
    expect(prisma.match_players.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ team: "team_a" }) })
    );
  });

  it("invite: no deja dos hombres juntos si ya hay una mujer esperando en un equipo", async () => {
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ gender: "Masculino", name: "Pedro", email: null });
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...BASE_MATCH,
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_a", users: { gender: "Masculino" } },
        { user_id: "p2", status: "confirmed", team: "team_b", users: { gender: "Femenino" } },
      ],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/invite", {
      method: "POST", headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ userId: "invitee-uuid" }), // Automatico, es hombre
    });
    const res = await inviteHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(201);
    // team_a ya tiene un hombre (dejarlo ahi lo dejaria 2 hombres); team_b
    // tiene una mujer sola -> el hombre nuevo debe ir a team_b para emparejar.
    expect(prisma.match_players.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ team: "team_b" }) })
    );
  });

  it("join: aplica la misma equidad de género que invite", async () => {
    const { verifyToken } = require("@/lib/jwt");
    verifyToken.mockResolvedValueOnce({ userId: "joiner-uuid", role: "player" });
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ gender: "Femenino", name: "Sofia" });
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      id: "match-uuid", status: "open", format: "doubles", organizer_id: "organizer-uuid",
      club: "Club X",
      match_players: [
        { user_id: "p1", status: "confirmed", team: "team_a", users: { gender: "Masculino" } },
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
