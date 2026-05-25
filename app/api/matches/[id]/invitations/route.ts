import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: match_id } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const match = await prisma.matches.findUnique({ where: { id: match_id } });
    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    const invitations = await prisma.match_invitations.findMany({
      where: {
        match_id,
        ...(status && { status: status as any }),
      },
      include: {
        invitee: { select: { id: true, name: true, level: true, photo_url: true } },
        inviter: { select: { id: true, name: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener las invitaciones", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}
