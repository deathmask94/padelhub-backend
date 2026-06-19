import { POST as rateHandler }    from "@/app/api/matches/[id]/rate/route";
import { GET  as getRatingsHandler } from "@/app/api/users/[rut]/ratings/route";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "mock-rater-uuid", role: "player" }),
}));

jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: {
      findUnique: jest.fn(),
    },
    player_ratings: {
      createMany:  jest.fn(),
      aggregate:   jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
  },
}));

const FINISHED_MATCH = {
  id:          "match-uuid",
  status:      "finished",
  club:        "Club Test",
  organizer_id: "organizer-uuid",
  updated_at:  new Date(), // ahora mismo → dentro de la ventana de 24h
  match_players: [
    { user_id: "mock-rater-uuid" }, // el rater siempre es participante para pasar el guard
    { user_id: "player-a-uuid" },
    { user_id: "player-b-uuid" },
  ],
};

const validRatings = [
  { rated_id: "player-a-uuid", fair_play: 5, punctuality: 4, skill_level: 3 },
  { rated_id: "player-b-uuid", fair_play: 4, punctuality: 5, skill_level: 4 },
];

function makeRateRequest(body: object) {
  return new Request("http://localhost:3000/api/matches/match-uuid/rate", {
    method:  "POST",
    headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

describe("⭐ PRUEBAS UNITARIAS - VALORACIONES (POST /matches/[id]/rate)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 401 si no se envía token", async () => {
    const req = new Request("http://localhost:3000/api/matches/x/rate", { method: "POST" });
    const ctx = { params: Promise.resolve({ id: "x" }) };
    const res = await rateHandler(req, ctx as any);
    expect(res.status).toBe(401);
  });

  it("Debería retornar 400 si el partido no ha finalizado", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...FINISHED_MATCH, status: "confirmed",
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await rateHandler(makeRateRequest({ ratings: validRatings }), ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 403 si han pasado más de 24h desde que terminó el partido", async () => {
    const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h atrás
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...FINISHED_MATCH, updated_at: pastDate,
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await rateHandler(makeRateRequest({ ratings: validRatings }), ctx as any);
    expect(res.status).toBe(403);
  });

  it("Debería retornar 400 si se intenta valorar a uno mismo", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      ...FINISHED_MATCH, organizer_id: "mock-rater-uuid",
    });
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const selfRating = [{ rated_id: "mock-rater-uuid", fair_play: 5, punctuality: 5, skill_level: 5 }];
    const res = await rateHandler(makeRateRequest({ ratings: selfRating }), ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 400 si un valor de escala está fuera de rango (1-5)", async () => {
    (prisma.matches.findUnique as jest.Mock).mockResolvedValue(FINISHED_MATCH);
    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const badRating = [{ rated_id: "player-a-uuid", fair_play: 6, punctuality: 3, skill_level: 3 }];
    const res = await rateHandler(makeRateRequest({ ratings: badRating }), ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 200 y crear las valoraciones correctamente", async () => {
    (prisma.matches.findUnique   as jest.Mock).mockResolvedValue(FINISHED_MATCH);
    (prisma.player_ratings.createMany as jest.Mock).mockResolvedValue({ count: 2 });

    const ctx = { params: Promise.resolve({ id: "match-uuid" }) };
    const res = await rateHandler(makeRateRequest({ ratings: validRatings }), ctx as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/correctamente/i);
    expect(prisma.player_ratings.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });
});

describe("📊 PRUEBAS UNITARIAS - REPUTACIÓN (GET /users/[rut]/ratings)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Debería retornar 400 si el RUT no es un número válido", async () => {
    const req = new Request("http://localhost:3000/api/users/abc/ratings");
    const ctx = { params: Promise.resolve({ rut: "abc" }) };
    const res = await getRatingsHandler(req, ctx as any);
    expect(res.status).toBe(400);
  });

  it("Debería retornar 404 si el usuario no existe", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost:3000/api/users/12345678/ratings");
    const ctx = { params: Promise.resolve({ rut: "12345678" }) };
    const res = await getRatingsHandler(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("Debería retornar 200 con promedios correctamente redondeados", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ id: "user-uuid" });
    (prisma.player_ratings.aggregate as jest.Mock).mockResolvedValue({
      _avg:   { fair_play: 4.333, punctuality: 3.666, skill_level: 4.0 },
      _count: { id: 3 },
    });

    const req = new Request("http://localhost:3000/api/users/12345678/ratings");
    const ctx = { params: Promise.resolve({ rut: "12345678" }) };
    const res  = await getRatingsHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ratings.total).toBe(3);
    expect(data.ratings.avg_fair_play).toBe(4.3);
    expect(data.ratings.avg_punctuality).toBe(3.7);
    expect(data.ratings.avg_skill_level).toBe(4.0);
  });

  it("Debería retornar ceros/null si el usuario no tiene valoraciones", async () => {
    (prisma.users.findFirst as jest.Mock).mockResolvedValue({ id: "user-uuid" });
    (prisma.player_ratings.aggregate as jest.Mock).mockResolvedValue({
      _avg:   { fair_play: null, punctuality: null, skill_level: null },
      _count: { id: 0 },
    });

    const req = new Request("http://localhost:3000/api/users/12345678/ratings");
    const ctx = { params: Promise.resolve({ rut: "12345678" }) };
    const res  = await getRatingsHandler(req, ctx as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ratings.total).toBe(0);
    expect(data.ratings.avg_fair_play).toBeNull();
  });
});
