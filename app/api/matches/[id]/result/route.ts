import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_WINNERS = ["team_a", "team_b", "draw"];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { submitted_by, score_team_a, score_team_b, winner } = await request.json();

    if (!submitted_by || !score_team_a || !score_team_b || !winner) {
      return NextResponse.json(
        { error: "Los campos submitted_by, score_team_a, score_team_b y winner son obligatorios" },
        { status: 400 }
      );
    }

    if (!VALID_WINNERS.includes(winner)) {
      return NextResponse.json(
        { error: "El campo winner debe ser 'team_a', 'team_b' o 'draw'" },
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

    if (!["in_progress", "confirmed"].includes(match.status)) {
      return NextResponse.json(
        { error: "Solo se puede registrar resultado de un partido en curso o confirmado" },
        { status: 400 }
      );
    }

    const isPlayer = match.match_players.some((p) => p.user_id === submitted_by);
    if (!isPlayer) {
      return NextResponse.json(
        { error: "Solo los jugadores del partido pueden registrar el resultado" },
        { status: 403 }
      );
    }

    // Verificar que no haya ya un resultado pendiente o confirmado
    const existing = await prisma.match_results.findUnique({ where: { match_id } });
    if (existing) {
      if (existing.confirmed) {
        return NextResponse.json(
          { error: "El resultado ya fue registrado y confirmado" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "Ya existe un resultado pendiente de confirmación para este partido",
          result_id: existing.id,
        },
        { status: 409 }
      );
    }

    const result = await prisma.match_results.create({
      data: {
        match_id,
        registered_by: submitted_by,
        score_team_a,
        score_team_b,
        winner: winner as any,
        confirmed: false,
      },
    });

    return NextResponse.json(
      {
        message: "Resultado registrado. Esperando confirmación del equipo contrario.",
        result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al registrar el resultado", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;

    const result = await prisma.match_results.findUnique({
      where: { match_id },
      include: {
        users: { select: { id: true, name: true } },
      },
    });

    if (!result) {
      return NextResponse.json({ error: "No hay resultado registrado para este partido" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener el resultado", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
