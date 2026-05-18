import { POST as createMatchHandler } from "../app/api/matches/route";
import { prisma } from "@/lib/prisma";

// Sincronizamos el mock con la ruta relativa del archivo
jest.mock("@/lib/prisma", () => ({
  prisma: {
    matches: {
      create: jest.fn(),
    },
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
        club: "Padel Break Club",
        format: "doubles",
        match_date: "2026-05-20",
        match_time: "19:30:00"
      }),
    });

    const res = await createMatchHandler(req);
    expect(res.status).toBe(201);
  });
});
