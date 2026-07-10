import { POST as joinHandler }   from "../app/api/matches/[id]/join/route";
import { POST as inviteHandler } from "../app/api/matches/[id]/invite/route";
import { prisma } from "@/lib/prisma";

// Bug real reportado en produccion: un jugador se une a un partido, lo
// abandona (match_players.status pasa a 'removed', la fila NO se borra
// por la restriccion unica @@unique([match_id, user_id])) y al intentar
// unirse de nuevo el backend le dice "ya estas inscrito" o revienta con
// un error de constraint unica. Estas pruebas fijan el fix: reunirse o
// ser re-invitado despues de abandonar debe funcionar (upsert, no create).

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "joiner-uuid", role: "player" }),
}));

jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: {
      findUnique: jest.fn(),
      update:     jest.fn().mockResolvedValue({}),
    },
    users: {
      findUnique: jest.fn().mockResolvedValue({ gender: null, name: "Joiner" }),
    },
    match_players: {
      upsert: jest.fn().mockResolvedValue({ id: "mp-uuid" }),
    },
  },
}));

const REMOVED_ROW = { id: "mp-old", user_id: "joiner-uuid", status: "removed", team: "team_a" };

describe("🔁 Reunirse/re-invitar despues de abandonar un partido", () => {
  beforeEach(() => jest.clearAllMocks());

  it("join: permite unirse de nuevo si la unica fila previa esta en 'removed'", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      id: "match-uuid", status: "open", format: "doubles", organizer_id: "organizer-uuid",
      club: "Club X", gender_preference: null,
      match_players: [REMOVED_ROW],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/join", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
    });
    const res = await joinHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });

    expect(res.status).toBe(201);
    expect(prisma.match_players.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { match_id_user_id: { match_id: "match-uuid", user_id: "joiner-uuid" } },
        update: expect.objectContaining({ status: "confirmed" }),
      }),
    );
  });

  it("join: sigue bloqueando si la fila previa esta activa (confirmed/pending)", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      id: "match-uuid", status: "open", format: "doubles", organizer_id: "organizer-uuid",
      club: "Club X", gender_preference: null,
      match_players: [{ ...REMOVED_ROW, status: "confirmed" }],
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/join", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
    });
    const res = await joinHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/ya estás inscrito/i);
    expect(prisma.match_players.upsert).not.toHaveBeenCalled();
  });

  it("invite: re-invitar a alguien que abandono reactiva la fila en vez de fallar", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      id: "match-uuid", status: "open", format: "doubles", organizer_id: "joiner-uuid",
      club: "Club X",
      match_players: [], // la fila 'removed' queda filtrada por el where del include, no aparece aca
      users: { name: "Organizador" },
    });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/invite", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
      body: JSON.stringify({ userId: "invitee-uuid", team: "team_a" }),
    });
    const res = await inviteHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });

    expect(res.status).toBe(201);
    expect(prisma.match_players.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { match_id_user_id: { match_id: "match-uuid", user_id: "invitee-uuid" } },
        update: expect.objectContaining({ status: "pending" }),
      }),
    );
  });
});
