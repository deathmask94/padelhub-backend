import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

// Una cancha por ciudad — debe coincidir con el listado del frontend
// (PadelHub-FrontEnd/app/routes/crear.tsx y matchmaking.tsx).
const VALID_CLUBS = [
  "Pádel Club Viña del Mar",
  "Pádel Club Valparaíso",
  "Pádel Club Quilpué",
  "Pádel Club Villa Alemana",
  "Pádel Club Concón",
];

// ==========================================
// 1. POST: Crear un nuevo partido
// ==========================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizer_id, club, format, match_date, match_time, gender_preference } = body;

    // Validación básica de campos obligatorios
    if (!organizer_id || !club || !match_date || !match_time) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (organizer_id, club, match_date, match_time)" },
        { status: 400 }
      );
    }

    if (!VALID_CLUBS.includes(club)) {
      return NextResponse.json(
        { error: "Club no válido. Elige una de las canchas disponibles." },
        { status: 400 }
      );
    }

    if (gender_preference && gender_preference !== "Masculino" && gender_preference !== "Femenino") {
      return NextResponse.json(
        { error: "gender_preference debe ser 'Masculino', 'Femenino' o vacío" },
        { status: 400 }
      );
    }

    // match_date: "2026-06-18", match_time: "2026-06-18T14:00:00"
    const formattedDate = new Date(match_date);
    const formattedTime = new Date(match_time);

    // Crear el partido en la base de datos
    const newMatch = await prisma.matches.create({
      data: {
        organizer_id,
        club,
        format: format || "doubles", // Si no viene, por defecto es doubles
        status: "open",             // Estado inicial siempre abierto
        gender_preference: gender_preference || null,
        match_date: formattedDate,
        match_time: formattedTime,
      },
    });

    return NextResponse.json(
      { message: "¡Partido creado con éxito!", match: newMatch },
      { status: 201 }
    );

  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al crear el partido en el servidor", details: error.message },
      { status: 500 }
    );
  }
}

const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

// ==========================================
// 2. GET: Obtener partidos disponibles (con filtros)
// ==========================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zone   = searchParams.get("zone");
    const format = searchParams.get("format");
    const date   = searchParams.get("date"); // "today" | "week"

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dateWhere: { gte: Date; lt?: Date } = { gte: today };
    if (date === "today") {
      const t = new Date(today); t.setDate(t.getDate() + 1);
      dateWhere.lt = t;
    } else if (date === "week") {
      const t = new Date(today); t.setDate(t.getDate() + 7);
      dateWhere.lt = t;
    }

    // Un partido que el usuario ya rechazo o abandono no debe seguir
    // apareciendo en Disponibles -- ya tomo su decision al respecto (otros
    // usuarios si lo siguen viendo/pudiendo unirse mientras tenga cupos).
    let userId: string | null = null;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      try { ({ userId } = await verifyToken(token)); } catch { /* token invalido: no filtrar por usuario */ }
    }

    const matches = await prisma.matches.findMany({
      where: {
        status:     "open",
        match_date: dateWhere,
        ...(format ? { format: format as never } : {}),
        ...(zone   ? { users: { zone } }          : {}),
        ...(userId ? { match_players: { none: { user_id: userId, status: { in: ["rejected", "removed"] } } } } : {}),
      },
      include: {
        users: { select: { name: true, level: true, mmr: true, photo_url: true, zone: true } },
        match_players: {
          where: { status: { notIn: ["rejected", "removed"] } },
          select: { id: true },
        },
      },
      orderBy: { match_date: "asc" },
    });

    const result = matches
      .map((m) => {
        const maxPlayers    = MAX_PLAYERS[m.format] ?? 4;
        const playerCount   = m.match_players.length + 1; // +1 organizer
        const availableSlots = maxPlayers - playerCount;
        return { ...m, max_players: maxPlayers, player_count: playerCount, available_slots: availableSlots };
      })
      .filter((m) => m.available_slots > 0);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[MATCHES GET]", error);
    return NextResponse.json({ error: "Error al obtener los partidos" }, { status: 500 });
  }
}