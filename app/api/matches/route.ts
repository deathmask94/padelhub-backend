import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

// ==========================================
// POST: Crear un nuevo partido
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizer_id, club, format, match_date, match_time } = body;

    if (!organizer_id || !club || !match_date || !match_time) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (organizer_id, club, match_date, match_time)" },
        { status: 400 }
      );
    }

    const fmt = format || "doubles";

    const newMatch = await prisma.matches.create({
      data: {
        organizer_id,
        club,
        format: fmt,
        status: "open",
        match_date: new Date(match_date),
        match_time: new Date(`${match_date}T${match_time}`),
      },
    });

    // Agrega al organizador como primer jugador (team_a, confirmado)
    await prisma.match_players.create({
      data: {
        match_id: newMatch.id,
        user_id:  organizer_id,
        team:     "team_a",
        status:   "confirmed",
      },
    });

    return NextResponse.json(
      { message: "¡Partido creado con éxito!", match: newMatch },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al crear el partido", details: error.message },
      { status: 500 }
    );
  }
}

// ==========================================
// GET: Listar partidos abiertos (filtro por zona opcional)
// ==========================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zone   = searchParams.get("zone");
    const status = searchParams.get("status") || "open";

    const matches = await prisma.matches.findMany({
      where: {
        status: status as any,
        ...(zone && {
          users: { zone: { equals: zone, mode: "insensitive" } },
        }),
      },
      include: {
        users: {
          select: { id: true, name: true, level: true, zone: true },
        },
        match_players: {
          where:  { status: "confirmed" },
          include: {
            users: { select: { id: true, name: true, level: true, photo_url: true } },
          },
        },
      },
      orderBy: { match_date: "asc" },
    });

    const result = matches.map((m) => {
      const maxPlayers   = MAX_PLAYERS[m.format] ?? 4;
      const playerCount  = m.match_players.length;
      const spotsLeft    = maxPlayers - playerCount;

      return {
        id:           m.id,
        club:         m.club,
        format:       m.format,
        status:       m.status,
        match_date:   m.match_date,
        match_time:   m.match_time,
        zone:         m.users.zone,
        organizer:    m.users,
        players:      m.match_players.map((mp) => ({
          ...mp.users,
          team:   mp.team,
          joined: mp.joined_at,
        })),
        max_players:  maxPlayers,
        player_count: playerCount,
        spots_left:   spotsLeft,
        is_full:      spotsLeft === 0,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener los partidos", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
