import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

const SECRET = process.env.MATCH_QR_SECRET ?? "dev-secret-change-in-prod";
const MAX_PLAYERS: Record<string, number> = { doubles: 4, singles: 2 };

function verifyToken(token: string): { matchId: string; valid: boolean } {
  const parts = token.split(".");
  if (parts.length !== 3) return { matchId: "", valid: false };

  const [matchId, expiresStr, sig] = parts;
  const payload = `${matchId}.${expiresStr}`;
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  const expired = Date.now() > parseInt(expiresStr);

  return { matchId, valid: sig === expected && !expired };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { user_id, token } = await request.json();

    if (!user_id || !token) {
      return NextResponse.json(
        { error: "Los campos user_id y token son obligatorios" },
        { status: 400 }
      );
    }

    const { matchId, valid } = verifyToken(token);

    if (!valid) {
      return NextResponse.json(
        { error: "El QR es inválido o ha expirado" },
        { status: 400 }
      );
    }

    if (matchId !== match_id) {
      return NextResponse.json(
        { error: "El QR no corresponde a este partido" },
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

    if (match.status === "in_progress") {
      return NextResponse.json({ message: "El partido ya está en curso" }, { status: 200 });
    }

    if (match.status === "finished" || match.status === "cancelled") {
      return NextResponse.json(
        { error: "El partido ya no está disponible" },
        { status: 400 }
      );
    }

    const playerRecord = match.match_players.find((p) => p.user_id === user_id);

    if (!playerRecord) {
      return NextResponse.json(
        { error: "No eres jugador de este partido" },
        { status: 403 }
      );
    }

    if (playerRecord.confirmed_presence) {
      return NextResponse.json(
        { message: "Ya confirmaste tu presencia", already_confirmed: true },
        { status: 200 }
      );
    }

    // Marcar presencia del jugador
    await prisma.match_players.update({
      where: { match_id_user_id: { match_id, user_id } },
      data: { confirmed_presence: true, presence_confirmed_at: new Date() },
    });

    // Verificar si todos confirmaron
    const maxPlayers = MAX_PLAYERS[match.format] ?? 4;
    const confirmedCount =
      match.match_players.filter((p) => p.confirmed_presence).length + 1; // +1 por el actual

    if (confirmedCount >= maxPlayers) {
      await prisma.matches.update({
        where: { id: match_id },
        data: { status: "in_progress", updated_at: new Date() },
      });

      return NextResponse.json({
        message: "¡Todos confirmaron! El partido ha comenzado.",
        match_started: true,
        confirmed_count: confirmedCount,
        total_players: maxPlayers,
      });
    }

    return NextResponse.json({
      message: "Presencia confirmada",
      match_started: false,
      confirmed_count: confirmedCount,
      total_players: maxPlayers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al confirmar presencia", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
