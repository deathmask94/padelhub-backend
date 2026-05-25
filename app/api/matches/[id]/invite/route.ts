import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { invited_by, user_id } = await request.json();

    if (!invited_by || !user_id) {
      return NextResponse.json(
        { error: "Los campos invited_by y user_id son obligatorios" },
        { status: 400 }
      );
    }

    if (invited_by === user_id) {
      return NextResponse.json(
        { error: "No puedes invitarte a ti mismo" },
        { status: 400 }
      );
    }

    const match = await prisma.matches.findUnique({
      where: { id: match_id },
      include: { match_players: { where: { status: "confirmed" } } },
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    if (match.status !== "open") {
      return NextResponse.json(
        { error: "El partido no está disponible para invitaciones" },
        { status: 400 }
      );
    }

    const isInMatch = match.match_players.some((mp) => mp.user_id === invited_by);
    if (!isInMatch) {
      return NextResponse.json(
        { error: "Solo los jugadores del partido pueden enviar invitaciones" },
        { status: 403 }
      );
    }

    const maxPlayers = MAX_PLAYERS[match.format] ?? 4;
    if (match.match_players.length >= maxPlayers) {
      return NextResponse.json({ error: "El partido ya está completo" }, { status: 400 });
    }

    const alreadyJoined = match.match_players.some((mp) => mp.user_id === user_id);
    if (alreadyJoined) {
      return NextResponse.json(
        { error: "El jugador ya es parte de este partido" },
        { status: 409 }
      );
    }

    const invitee = await prisma.users.findUnique({ where: { id: user_id } });
    if (!invitee) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    const invitation = await prisma.match_invitations.create({
      data: { match_id, invited_by, user_id, status: "pending" },
    });

    return NextResponse.json(
      { message: "Invitación enviada correctamente", invitation },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe una invitación pendiente para este jugador" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Error al enviar la invitación", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
