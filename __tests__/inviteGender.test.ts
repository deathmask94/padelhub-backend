import { POST as inviteHandler } from "../app/api/matches/[id]/invite/route";
import { prisma } from "@/lib/prisma";

// Bug reportado en produccion: un partido con "gender_preference: Mujeres"
// (el filtro de que genero puede ocupar los cupos abiertos) igual dejaba
// invitar a un jugador hombre directamente, porque esa validacion solo
// existia en /join (autoservicio), no en /invite (organizador invita a
// mano). El filtro debe aplicar igual por los dos caminos.

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "organizer-uuid", role: "player" }),
}));

jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    users:   { findUnique: jest.fn() },
    match_players: { upsert: jest.fn().mockResolvedValue({ id: "mp-uuid" }) },
  },
}));

const BASE_MATCH = {
  id: "match-uuid", status: "open", format: "doubles", organizer_id: "organizer-uuid",
  club: "Club X", match_players: [], users: { name: "Organizador" },
};

function inviteRequest(userId: string) {
  return new Request("http://localhost:3000/api/matches/match-uuid/invite", {
    method: "POST",
    headers: { Authorization: "Bearer fake-token" },
    body: JSON.stringify({ userId, team: "team_a" }),
  });
}

describe("🚻 gender_preference tambien se respeta al invitar directamente", () => {
  beforeEach(() => jest.clearAllMocks());

  it("bloquea invitar a un hombre si el partido es solo para mujeres", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({ ...BASE_MATCH, gender_preference: "Femenino" });
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ name: "Juan", email: null, gender: "Masculino" });

    const res = await inviteHandler(inviteRequest("hombre-uuid"), { params: Promise.resolve({ id: "match-uuid" }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/solo para mujeres/i);
    expect(prisma.match_players.upsert).not.toHaveBeenCalled();
  });

  it("permite invitar a una mujer si el partido es solo para mujeres", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({ ...BASE_MATCH, gender_preference: "Femenino" });
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ name: "Ana", email: null, gender: "Femenino" });

    const res = await inviteHandler(inviteRequest("mujer-uuid"), { params: Promise.resolve({ id: "match-uuid" }) });

    expect(res.status).toBe(201);
    expect(prisma.match_players.upsert).toHaveBeenCalled();
  });

  it("permite invitar a cualquiera si el partido no tiene restriccion de genero", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({ ...BASE_MATCH, gender_preference: null });
    (prisma.users.findUnique as jest.Mock).mockResolvedValue({ name: "Juan", email: null, gender: "Masculino" });

    const res = await inviteHandler(inviteRequest("hombre-uuid"), { params: Promise.resolve({ id: "match-uuid" }) });

    expect(res.status).toBe(201);
    expect(prisma.match_players.upsert).toHaveBeenCalled();
  });
});
