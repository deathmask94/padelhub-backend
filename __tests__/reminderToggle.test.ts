import { POST as respondHandler } from "../app/api/matches/[id]/respond/route";
import { GET as remindersHandler } from "../app/api/reminders/send/route";
import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";

// El toggle "Recordatorios de partido" del perfil (reminder_enabled) debe
// controlar UNICAMENTE el push de los eventos de recordatorio (partido
// confirmado, 24h/1h antes). El email de esos mismos eventos se manda
// siempre, sin importar el toggle. Estas pruebas verifican esa separacion
// contra el codigo real de las rutas, no una reimplementacion aparte.

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "player-uuid", role: "player" }),
}));

jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));

jest.mock("@/lib/push", () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({}) },
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: {
      findUnique: jest.fn(),
      update:     jest.fn().mockResolvedValue({}),
      findMany:   jest.fn(),
    },
    match_players: {
      update: jest.fn().mockResolvedValue({}),
    },
    match_reminders: {
      findUnique: jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({}),
    },
  },
}));

const ORGANIZER = { id: "organizer-uuid", name: "Organizador", email: "org@test.com", reminder_enabled: true };
const PLAYER_ON  = { id: "player-uuid",     name: "Jugador Con Toggle On",  email: "on@test.com",  reminder_enabled: true };

describe("🔕 Toggle 'Recordatorios de partido': solo afecta push, nunca email", () => {
  beforeEach(() => jest.clearAllMocks());

  it("Partido confirmado: manda push si reminder_enabled=true", async () => {
    (prisma.matches.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "match-uuid", format: "singles", organizer_id: ORGANIZER.id, club: "Club X",
        match_players: [{ id: "mp-1", user_id: PLAYER_ON.id, status: "pending", users: { name: PLAYER_ON.name } }],
      })
      .mockResolvedValueOnce({
        id: "match-uuid", club: "Club X", match_date: new Date(), match_time: new Date(),
        format: "singles", users: ORGANIZER, match_players: [{ users: PLAYER_ON }],
      });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/respond", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
      body: JSON.stringify({ accept: true }),
    });
    const res = await respondHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(200);

    expect(sendPush).toHaveBeenCalledWith(ORGANIZER.id, expect.any(String), expect.any(String));
    expect(sendPush).toHaveBeenCalledWith(PLAYER_ON.id, expect.any(String), expect.any(String));
  });

  it("Partido confirmado: NO manda push si reminder_enabled=false (pero el email si se intenta)", async () => {
    const playerOff = { id: "player-uuid", name: "Jugador Con Toggle Off", email: "off@test.com", reminder_enabled: false };

    (prisma.matches.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: "match-uuid", format: "singles", organizer_id: ORGANIZER.id, club: "Club X",
        match_players: [{ id: "mp-1", user_id: playerOff.id, status: "pending", users: { name: playerOff.name } }],
      })
      .mockResolvedValueOnce({
        id: "match-uuid", club: "Club X", match_date: new Date(), match_time: new Date(),
        format: "singles", users: ORGANIZER, match_players: [{ users: playerOff }],
      });

    const req = new Request("http://localhost:3000/api/matches/match-uuid/respond", {
      method: "POST",
      headers: { Authorization: "Bearer fake-token" },
      body: JSON.stringify({ accept: true }),
    });
    const res = await respondHandler(req, { params: Promise.resolve({ id: "match-uuid" }) });
    expect(res.status).toBe(200);

    // El organizador (reminder_enabled=true) si recibe push...
    expect(sendPush).toHaveBeenCalledWith(ORGANIZER.id, expect.any(String), expect.any(String));
    // ...pero el jugador que apago el toggle, no.
    expect(sendPush).not.toHaveBeenCalledWith(playerOff.id, expect.any(String), expect.any(String));
  });

  it("Recordatorio 24h/1h: el email se manda aunque reminder_enabled=false, el push no", async () => {
    const playerOff = { id: "player-uuid", name: "Jugador Con Toggle Off", email: "off@test.com", reminder_enabled: false };

    // match_date/match_time construidos para caer justo en el objetivo de
    // 24h desde ahora (matchDateTimeAsUTCms combina fecha real + hora del
    // dia; ver lib/matchTime.ts). El filtro de 1h no debe capturar este
    // mismo partido -- por eso solo se espera 1 envio, no 2.
    const target24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const matchDate = new Date(Date.UTC(target24h.getUTCFullYear(), target24h.getUTCMonth(), target24h.getUTCDate()));
    const matchTime = new Date(Date.UTC(1970, 0, 1, target24h.getUTCHours(), target24h.getUTCMinutes(), target24h.getUTCSeconds()));

    (prisma.matches.findMany as jest.Mock).mockResolvedValue([{
      id: "match-uuid", club: "Club X", format: "singles",
      match_date: matchDate, match_time: matchTime,
      users: playerOff, match_players: [],
    }]);

    const req = new Request("http://localhost:3000/api/reminders/send", {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const res = await remindersHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sent).toBe(1); // el email SI se conto como enviado (solo por la ventana de 24h)
    expect(sendPush).not.toHaveBeenCalled(); // pero el push, no
  });
});
