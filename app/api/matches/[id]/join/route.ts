import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

// ==========================================
// POST: Unirse a un partido
// ==========================================
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: "El campo user_id es obligatorio" },
        { status: 400 }
      );
    }

    const match = await prisma.matches.findUnique({
      where: { id: match_id },
      include: {
        match_players: { where: { status: "confirmed" } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    if (match.status !== "open") {
      return NextResponse.json(
        { error: "El partido no está disponible para unirse" },
        { status: 400 }
      );
    }

    const maxPlayers = MAX_PLAYERS[match.format] ?? 4;

    if (match.match_players.length >= maxPlayers) {
      return NextResponse.json(
        { error: "El partido ya está completo" },
        { status: 400 }
      );
    }

    const alreadyJoined = match.match_players.some((mp) => mp.user_id === user_id);
    if (alreadyJoined) {
      return NextResponse.json(
        { error: "Ya eres parte de este partido" },
        { status: 409 }
      );
    }

    // Asignar equipo alternando: pares → team_a, impares → team_b
    const team = match.match_players.length % 2 === 0 ? "team_a" : "team_b";

    const player = await prisma.match_players.create({
      data: {
        match_id,
        user_id,
        team,
        status: "confirmed",
      },
    });

    // Si el partido queda completo, cambia el estado a "confirmed"
    const newCount = match.match_players.length + 1;
    if (newCount >= maxPlayers) {
      await prisma.matches.update({
        where: { id: match_id },
        data:  { status: "confirmed" },
      });
    }

    return NextResponse.json(
      { message: "Te has unido al partido correctamente", player },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ya eres parte de este partido" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Error al unirse al partido", details: error.message },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE: Salir de un partido
// ==========================================
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json(
        { error: "El campo user_id es obligatorio" },
        { status: 400 }
      );
    }

    const match = await prisma.matches.findUnique({
      where: { id: match_id },
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    if (match.organizer_id === user_id) {
      return NextResponse.json(
        { error: "El organizador no puede abandonar el partido. Puedes cancelarlo en su lugar." },
        { status: 400 }
      );
    }

    const entry = await prisma.match_players.findUnique({
      where: { match_id_user_id: { match_id, user_id } },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "No eres parte de este partido" },
        { status: 404 }
      );
    }

    await prisma.match_players.delete({
      where: { match_id_user_id: { match_id, user_id } },
    });

    // Si el partido estaba confirmado (lleno), vuelve a "open"
    if (match.status === "confirmed") {
      await prisma.matches.update({
        where: { id: match_id },
        data:  { status: "open" },
      });
    }

    return NextResponse.json(
      { message: "Has salido del partido correctamente" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al salir del partido", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
