import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { confirmed_by } = await request.json();

    if (!confirmed_by) {
      return NextResponse.json({ error: "El campo confirmed_by es obligatorio" }, { status: 400 });
    }

    const match = await prisma.matches.findUnique({
      where: { id: match_id },
      include: { match_players: { where: { status: "confirmed" } } },
    });

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    const result = await prisma.match_results.findUnique({ where: { match_id } });

    if (!result) {
      return NextResponse.json(
        { error: "No hay resultado pendiente para confirmar" },
        { status: 404 }
      );
    }

    if (result.confirmed) {
      return NextResponse.json(
        { error: "El resultado ya fue confirmado" },
        { status: 409 }
      );
    }

    // Verificar que quien confirma es jugador del partido
    const confirmerRecord = match.match_players.find((p) => p.user_id === confirmed_by);
    if (!confirmerRecord) {
      return NextResponse.json(
        { error: "Solo los jugadores del partido pueden confirmar el resultado" },
        { status: 403 }
      );
    }

    // Verificar que quien confirma es del equipo contrario a quien registró
    const submitterRecord = match.match_players.find((p) => p.user_id === result.registered_by);
    if (submitterRecord && confirmerRecord.team === submitterRecord.team) {
      return NextResponse.json(
        { error: "Debe confirmar un jugador del equipo contrario" },
        { status: 403 }
      );
    }

    // No puede auto-confirmarse
    if (confirmed_by === result.registered_by) {
      return NextResponse.json(
        { error: "No puedes confirmar tu propio resultado" },
        { status: 403 }
      );
    }

    await prisma.$transaction([
      prisma.match_results.update({
        where: { match_id },
        data: {
          confirmed: true,
          confirmed_by,
          confirmed_at: new Date(),
        },
      }),
      prisma.matches.update({
        where: { id: match_id },
        data: { status: "finished", updated_at: new Date() },
      }),
    ]);

    return NextResponse.json({
      message: "Resultado confirmado. ¡Partido finalizado!",
      winner: result.winner,
      score_team_a: result.score_team_a,
      score_team_b: result.score_team_b,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al confirmar el resultado", details: error.message },
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
