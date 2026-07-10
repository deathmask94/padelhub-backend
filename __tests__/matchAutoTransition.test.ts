import { GET as matchGetHandler } from "../app/api/matches/[id]/route";
import { prisma } from "@/lib/prisma";

// Bug real reproducido en vivo: un partido 'confirmed' programado para
// varias horas en el futuro (hoy 18:00, siendo recien las 00:06) pasaba a
// 'in_progress' apenas alguien abria el detalle del partido. Causa: se
// comparaba match_time (columna TIME, sin fecha -- Prisma la ancla en
// 1970-01-01) directo contra Date.now(), y 1970 siempre es "menor" que
// cualquier fecha real.

jest.mock("@/lib/jwt", () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: "someone-uuid", role: "player" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: {
      findUnique: jest.fn(),
      update:     jest.fn().mockResolvedValue({}),
    },
    player_ratings: {
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

function req() {
  return new Request("http://localhost:3000/api/matches/match-uuid", {
    headers: { Authorization: "Bearer fake-token" },
  });
}

describe("⏱️ Auto-transicion a 'in_progress' respeta la fecha real del partido", () => {
  beforeEach(() => jest.clearAllMocks());

  it("NO pasa a in_progress si el partido es manana (aunque la hora del dia ya paso)", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const matchDate = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate()));
    // Hora deliberadamente "pasada" en el reloj de hoy, para probar que
    // no importa: lo que cuenta es la fecha real del partido, no la hora sola.
    const matchTime = new Date(Date.UTC(1970, 0, 1, 0, 1, 0));

    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      id: "match-uuid", status: "confirmed", format: "singles", organizer_id: "organizer-uuid",
      club: "Club X", match_date: matchDate, match_time: matchTime, updated_at: new Date(),
      users: { id: "organizer-uuid", name: "Org", photo_url: null, level: "tercera", mmr: 1000 },
      match_players: [],
    });

    const res = await matchGetHandler(req(), { params: Promise.resolve({ id: "match-uuid" }) });
    const data = await res.json();

    expect(data.status).toBe("confirmed");
    expect(prisma.matches.update).not.toHaveBeenCalled();
  });

  it("SI pasa a in_progress si el partido es hoy y la hora ya llego", async () => {
    const now = new Date();
    const matchDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // Un minuto en el pasado en Chile: usamos la hora actual menos un
    // margen chico para no depender de a que hora corre el test.
    const chileNow = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now);
    const h = Number(chileNow.find((p) => p.type === "hour")?.value ?? "0") % 24;

    // Si estamos en la primera hora del dia en Chile, este caso de prueba
    // no aplica de forma segura (podria cruzar de dia) -- se salta.
    if (h === 0) return;

    const matchTime = new Date(Date.UTC(1970, 0, 1, h - 1, 0, 0));

    (prisma.matches.findUnique as jest.Mock).mockResolvedValue({
      id: "match-uuid", status: "confirmed", format: "singles", organizer_id: "organizer-uuid",
      club: "Club X", match_date: matchDate, match_time: matchTime, updated_at: new Date(),
      users: { id: "organizer-uuid", name: "Org", photo_url: null, level: "tercera", mmr: 1000 },
      match_players: [],
    });

    const res = await matchGetHandler(req(), { params: Promise.resolve({ id: "match-uuid" }) });
    const data = await res.json();

    expect(data.status).toBe("in_progress");
    expect(prisma.matches.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "in_progress" }) }),
    );
  });
});
